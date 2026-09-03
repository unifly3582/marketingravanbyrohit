#!/usr/bin/env python3
"""
meshy.py — generate 3D models with the Meshy API (https://docs.meshy.ai/en/api).

    python meshy.py balance
    python meshy.py image  chair.jpg  --out models/chair --pbr --formats glb,usdz
    python meshy.py text   "a rattan accent chair, mid-century, studio product shot"
    python meshy.py status <task-id> --kind image
    python meshy.py list   --kind image

Auth: reads MESHY_API_KEY, else scripts/meshy-key.txt.
Get a key at https://www.meshy.ai/settings/api — it is shown only once.

Stdlib only, so there is nothing to install.

Two things about this API worth knowing before you spend credits:

  * Image to 3D is ONE stage. Text to 3D is TWO — a `preview` task builds bare
    geometry, then a `refine` task textures it, and refine needs the preview's
    id. This script runs both for you unless you pass --preview-only, which is
    worth using while you are still iterating on the prompt: previews are much
    cheaper than paying to texture a shape you are going to throw away.

  * These models reconstruct a SINGLE OBJECT. Feeding it a photo of a whole room
    does not give you a room you can walk through — it gives you one lumpy mesh.
    Shoot or crop to one piece of furniture at a time.

Credits are refunded automatically when a task FAILS, but not when it succeeds
and you simply dislike the result.
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://api.meshy.ai"
IMAGE_EP = "/openapi/v1/image-to-3d"
TEXT_EP = "/openapi/v2/text-to-3d"
BALANCE_EP = "/openapi/v1/balance"

POLL_SECONDS = 5
POLL_TIMEOUT = 40 * 60          # generation can genuinely take tens of minutes
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED"}


# --------------------------------------------------------------------------
# transport
# --------------------------------------------------------------------------

def get_key() -> str:
    key = os.environ.get("MESHY_API_KEY", "").strip()
    if key:
        return key
    f = Path(__file__).resolve().parent / "meshy-key.txt"
    if f.exists():
        return f.read_text(encoding="utf-8").strip()
    sys.exit("No MESHY_API_KEY and no scripts/meshy-key.txt.\n"
             "Create a key at https://www.meshy.ai/settings/api")


def call(method: str, path: str, payload=None, retries: int = 5):
    """One API call, with backoff on 429 and 5xx.

    Meshy rate-limits two separate things: requests per second, and the number
    of generation tasks queued at once (`NoMoreConcurrentTasks`). Both surface
    as 429, and both just need waiting out — so treat them the same and back off
    rather than failing the run.
    """
    url = BASE + path
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Authorization": f"Bearer {get_key()}"}
    if data:
        headers["Content-Type"] = "application/json"

    delay = 2.0
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")[:400]
            if e.code == 429 or e.code >= 500:
                if attempt == retries - 1:
                    sys.exit(f"HTTP {e.code} after {retries} tries: {body}")
                why = "concurrent task limit" if "Concurrent" in body else "rate limit"
                print(f"    {e.code} ({why}) — waiting {delay:.0f}s", flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 60)
                continue
            sys.exit(f"HTTP {e.code}: {body}")
        except urllib.error.URLError as e:
            if attempt == retries - 1:
                sys.exit(f"Network error: {e}")
            time.sleep(delay)
            delay = min(delay * 2, 60)
    sys.exit("Unreachable")


def as_image_ref(src: str) -> str:
    """Meshy takes a public URL or a base64 data URI. Local files become the latter."""
    if src.startswith(("http://", "https://", "data:")):
        return src
    p = Path(src)
    if not p.exists():
        sys.exit(f"No such image: {src}")
    if p.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
        sys.exit(f"Meshy accepts .jpg/.jpeg/.png only — got {p.suffix}")
    mime = mimetypes.guess_type(p.name)[0] or "image/png"
    b64 = base64.b64encode(p.read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


# --------------------------------------------------------------------------
# polling and download
# --------------------------------------------------------------------------

def wait(endpoint: str, task_id: str, label: str = "task") -> dict:
    started = time.time()
    last = -1
    while True:
        t = call("GET", f"{endpoint}/{task_id}")
        status, prog = t.get("status"), t.get("progress", 0)
        if prog != last:
            print(f"  {label}: {status} {prog}%", flush=True)
            last = prog
        if status in TERMINAL:
            if status != "SUCCEEDED":
                err = (t.get("task_error") or {}).get("message", "")
                print(f"  {label} {status}. {err}")
                print("  (credits for failed tasks are refunded automatically)")
            return t
        if time.time() - started > POLL_TIMEOUT:
            sys.exit(f"Timed out after {POLL_TIMEOUT // 60} min. Task {task_id} may still "
                     f"finish — check with:  python meshy.py status {task_id}")
        time.sleep(POLL_SECONDS)


def download(task: dict, out_base: Path, textures: bool = True):
    """Save every model format, the thumbnail, and optionally the texture maps."""
    out_base.parent.mkdir(parents=True, exist_ok=True)
    saved = []

    for fmt, url in (task.get("model_urls") or {}).items():
        if not url:
            continue
        dest = out_base.with_suffix(f".{fmt}")
        _fetch(url, dest)
        saved.append(dest)

    if task.get("thumbnail_url"):
        dest = out_base.with_name(out_base.name + "_thumb.png")
        _fetch(task["thumbnail_url"], dest)
        saved.append(dest)

    if textures:
        for i, tex in enumerate(task.get("texture_urls") or []):
            for kind, url in tex.items():
                if not url:
                    continue
                suffix = f"_tex{i}_{kind}" if i else f"_{kind}"
                dest = out_base.with_name(out_base.name + suffix + ".png")
                _fetch(url, dest)
                saved.append(dest)

    for p in saved:
        print(f"  saved {p}  ({p.stat().st_size/1e6:.1f} MB)")
    if task.get("consumed_credits") is not None:
        print(f"  credits used: {task['consumed_credits']}")
    return saved


def _fetch(url: str, dest: Path):
    req = urllib.request.Request(url, headers={"User-Agent": "meshy-script"})
    with urllib.request.urlopen(req, timeout=300) as r:
        dest.write_bytes(r.read())


def common_opts(p):
    p.add_argument("--out", default=None, help="Output path without extension")
    p.add_argument("--ai-model", default=None, help="meshy-5 | meshy-6 | meshy-7 (default: latest)")
    p.add_argument("--model-type", default=None, choices=["standard", "smart-topology", "lowpoly"])
    p.add_argument("--formats", default="glb", help="Comma list: glb,obj,fbx,stl,usdz,3mf")
    p.add_argument("--pbr", action="store_true", help="Also generate metallic/roughness/normal maps")
    p.add_argument("--texture-resolution", default=None, choices=["2k", "4k", "8k"])
    p.add_argument("--polycount", type=int, default=None, help="100–300000 (default 30000)")
    p.add_argument("--topology", default=None, choices=["quad", "triangle"])
    p.add_argument("--ultra", action="store_true", help="Higher fidelity, meshy-7, extra credits")
    p.add_argument("--no-textures", action="store_true", help="Don't download texture maps")


def add_common(body: dict, a):
    if a.ai_model:
        body["ai_model"] = a.ai_model
    if a.model_type:
        body["model_type"] = a.model_type
    if a.formats:
        body["target_formats"] = [f.strip() for f in a.formats.split(",") if f.strip()]
    if a.pbr:
        body["enable_pbr"] = True
    if a.texture_resolution:
        body["texture_resolution"] = a.texture_resolution
    if a.polycount:
        body["target_polycount"] = a.polycount
        body["should_remesh"] = True
    if a.topology:
        body["topology"] = a.topology
        body["should_remesh"] = True
    if a.ultra:
        body["ultra_mode"] = True
    return body


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------

def cmd_balance(a):
    print(f"balance: {call('GET', BALANCE_EP).get('balance')} credits")


def cmd_image(a):
    body = add_common({"image_url": as_image_ref(a.image)}, a)
    if a.texture_prompt:
        body["texture_prompt"] = a.texture_prompt
    if a.no_texture:
        body["should_texture"] = False

    print(f"Image to 3D: {a.image}")
    task_id = call("POST", IMAGE_EP, body)["result"]
    print(f"  task {task_id}")
    task = wait(IMAGE_EP, task_id, "generate")
    if task.get("status") != "SUCCEEDED":
        sys.exit(1)
    out = Path(a.out) if a.out else Path("models") / Path(a.image).stem
    download(task, out, textures=not a.no_textures)


def cmd_text(a):
    # Stage 1 -- geometry only. Cheap, and the shape is what usually needs iterating.
    body = add_common({"mode": "preview", "prompt": a.prompt}, a)
    body.pop("enable_pbr", None)
    body.pop("texture_resolution", None)

    print(f"Text to 3D (preview): {a.prompt[:70]}")
    preview_id = call("POST", TEXT_EP, body)["result"]
    print(f"  preview task {preview_id}")
    preview = wait(TEXT_EP, preview_id, "preview")
    if preview.get("status") != "SUCCEEDED":
        sys.exit(1)

    stem = a.out or f"models/{_slug(a.prompt)}"
    if a.preview_only:
        print("\nPreview only — stop here, or texture it later with:")
        print(f"  python meshy.py refine {preview_id}")
        download(preview, Path(stem + "_preview"), textures=False)
        return

    # Stage 2 -- texture the mesh the preview produced.
    refine = {"mode": "refine", "preview_task_id": preview_id}
    if a.pbr:
        refine["enable_pbr"] = True
    if a.texture_resolution:
        refine["texture_resolution"] = a.texture_resolution
    if a.texture_prompt:
        refine["texture_prompt"] = a.texture_prompt

    print("\nTexturing (refine)...")
    refine_id = call("POST", TEXT_EP, refine)["result"]
    print(f"  refine task {refine_id}")
    task = wait(TEXT_EP, refine_id, "refine")
    if task.get("status") != "SUCCEEDED":
        sys.exit(1)
    download(task, Path(stem), textures=not a.no_textures)


def cmd_refine(a):
    body = {"mode": "refine", "preview_task_id": a.preview_id}
    if a.pbr:
        body["enable_pbr"] = True
    if a.texture_resolution:
        body["texture_resolution"] = a.texture_resolution
    if a.texture_prompt:
        body["texture_prompt"] = a.texture_prompt
    task_id = call("POST", TEXT_EP, body)["result"]
    print(f"refine task {task_id}")
    task = wait(TEXT_EP, task_id, "refine")
    if task.get("status") != "SUCCEEDED":
        sys.exit(1)
    download(task, Path(a.out or f"models/{a.preview_id[:8]}"), textures=not a.no_textures)


def cmd_status(a):
    ep = IMAGE_EP if a.kind == "image" else TEXT_EP
    t = call("GET", f"{ep}/{a.id}")
    print(json.dumps({k: t.get(k) for k in
                      ("id", "status", "progress", "consumed_credits",
                       "created_at", "finished_at", "task_error")}, indent=2))
    if t.get("status") == "SUCCEEDED" and a.download:
        download(t, Path(a.out or f"models/{a.id[:8]}"))


def cmd_list(a):
    ep = IMAGE_EP if a.kind == "image" else TEXT_EP
    rows = call("GET", f"{ep}?page_size={a.limit}&page_num=1&sort_by=-created_at")
    rows = rows if isinstance(rows, list) else rows.get("result", [])
    if not rows:
        print("no tasks")
        return
    for t in rows:
        prompt = (t.get("prompt") or "")[:45]
        print(f"{t.get('id','')[:36]}  {t.get('status',''):<11} "
              f"{t.get('progress',0):>3}%  {prompt}")


def _slug(text, n=40):
    keep = "".join(c if c.isalnum() or c in " -_" else "" for c in text.lower())
    return "-".join(keep.split())[:n] or "model"


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("balance", help="Show remaining credits").set_defaults(fn=cmd_balance)

    pi = sub.add_parser("image", help="Image to 3D (single stage)")
    pi.add_argument("image", help="Local .jpg/.png, or a public URL")
    pi.add_argument("--texture-prompt", default=None, help="Guide the texture, max 600 chars")
    pi.add_argument("--no-texture", action="store_true", help="Geometry only")
    common_opts(pi)
    pi.set_defaults(fn=cmd_image)

    pt = sub.add_parser("text", help="Text to 3D (preview then refine)")
    pt.add_argument("prompt", help="Max 600 chars")
    pt.add_argument("--preview-only", action="store_true",
                    help="Stop after geometry — cheaper while iterating on the prompt")
    pt.add_argument("--texture-prompt", default=None)
    common_opts(pt)
    pt.set_defaults(fn=cmd_text)

    pr = sub.add_parser("refine", help="Texture an existing preview task")
    pr.add_argument("preview_id")
    pr.add_argument("--texture-prompt", default=None)
    common_opts(pr)
    pr.set_defaults(fn=cmd_refine)

    ps = sub.add_parser("status", help="Check one task")
    ps.add_argument("id")
    ps.add_argument("--kind", default="image", choices=["image", "text"])
    ps.add_argument("--download", action="store_true")
    ps.add_argument("--out", default=None)
    ps.set_defaults(fn=cmd_status)

    pl = sub.add_parser("list", help="Recent tasks")
    pl.add_argument("--kind", default="image", choices=["image", "text"])
    pl.add_argument("--limit", type=int, default=10)
    pl.set_defaults(fn=cmd_list)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
