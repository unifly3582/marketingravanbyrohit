#!/usr/bin/env python3
"""
nanobanana.py — directed image generation with Google's Gemini image models.

Two ways to drive it:
  1. One-shot (great for an agent like Claude Code to call, inspect, then re-call):
       python nanobanana.py "a tin of Buggly Farms cricket protein, studio lit" --out can.png
  2. Interactive chat (you steer it turn by turn; context is preserved so you can
     say "make the label bigger" and it edits the SAME image):
       python nanobanana.py --chat

Setup:
  pip install google-genai pillow
  export GEMINI_API_KEY="your_key_from_aistudio.google.com/apikey"

Models (--model):
  gemini-3.1-flash-image   Nano Banana 2  (default; fast, 512/1K/2K/4K, up to 14 ref images)
  gemini-3-pro-image       Nano Banana Pro (highest quality, best text rendering)
  gemini-2.5-flash-image   Nano Banana    (cheapest)
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from google import genai
    from google.genai import types
    from PIL import Image
except ImportError:
    sys.exit("Missing deps. Run: pip install google-genai pillow")

DEFAULT_MODEL = "gemini-3.1-flash-image"


def build_config(aspect: str | None, size: str | None) -> types.GenerateContentConfig:
    img_cfg = None
    if aspect or size:
        kwargs = {}
        if aspect:
            kwargs["aspect_ratio"] = aspect          # e.g. 1:1, 16:9, 9:16, 4:5, 21:9
        if size:
            kwargs["image_size"] = size              # 512, 1K, 2K, 4K  (uppercase K)
        img_cfg = types.ImageConfig(**kwargs)
    return types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=img_cfg,
    )


def save_images(response, out_base: Path) -> list[Path]:
    """Walk response parts, save every image, print any text the model returned."""
    saved = []
    idx = 0
    for part in response.parts:
        if getattr(part, "text", None):
            print(f"[model] {part.text.strip()}")
        elif getattr(part, "inline_data", None) is not None:
            img = part.as_image()
            path = out_base if idx == 0 else out_base.with_stem(f"{out_base.stem}_{idx}")
            img.save(path)
            saved.append(path)
            idx += 1
    return saved


def one_shot(client, args):
    contents = [args.prompt]
    for ref in args.ref or []:
        contents.append(Image.open(ref))     # reference / image-to-edit inputs
    resp = client.models.generate_content(
        model=args.model,
        contents=contents,
        config=build_config(args.aspect, args.size),
    )
    saved = save_images(resp, Path(args.out))
    if saved:
        print("Saved:", ", ".join(str(p) for p in saved))
    else:
        print("No image returned. Model said:",
              getattr(resp, "text", "") or "(nothing — possibly blocked by safety filters)")


def chat_loop(client, args):
    cfg = build_config(args.aspect, args.size)
    chat = client.chats.create(model=args.model, config=cfg)
    n = 0
    print(f"Interactive mode — model={args.model}. "
          "Type a prompt to generate, then refine ('make it warmer', 'add fog').")
    print("Commands: /new (reset context)  /model <name>  /quit\n")
    while True:
        try:
            msg = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not msg:
            continue
        if msg == "/quit":
            break
        if msg == "/new":
            chat = client.chats.create(model=args.model, config=cfg)
            print("[context reset]")
            continue
        if msg.startswith("/model "):
            args.model = msg.split(" ", 1)[1].strip()
            chat = client.chats.create(model=args.model, config=cfg)
            print(f"[model -> {args.model}, context reset]")
            continue
        resp = chat.send_message(msg)
        saved = save_images(resp, Path(args.out).with_stem(f"{Path(args.out).stem}_{n:02d}"))
        if saved:
            print("Saved:", ", ".join(str(p) for p in saved))
        n += 1


def main():
    p = argparse.ArgumentParser(description="Directed Gemini image generation.")
    p.add_argument("prompt", nargs="?", help="Text prompt (omit if using --chat).")
    p.add_argument("--chat", action="store_true", help="Interactive multi-turn editing.")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--out", default="output.png", help="Output filename / base.")
    p.add_argument("--ref", nargs="*", help="Reference image path(s) to edit or guide from.")
    p.add_argument("--aspect", help="1:1, 16:9, 9:16, 4:5, 3:2, 21:9, etc.")
    p.add_argument("--size", help="512, 1K, 2K, 4K (uppercase K).")
    args = p.parse_args()

    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("Set GEMINI_API_KEY first (get one at aistudio.google.com/apikey).")

    client = genai.Client()   # reads GEMINI_API_KEY automatically

    if args.chat:
        chat_loop(client, args)
    elif args.prompt:
        one_shot(client, args)
    else:
        p.error("Give a prompt, or use --chat.")


if __name__ == "__main__":
    main()
