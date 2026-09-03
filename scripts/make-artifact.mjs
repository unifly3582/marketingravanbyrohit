// Bundle the built site (dist/) into one self-contained HTML file:
// inline CSS + JS, and swap every asset path for a base64 data URI.
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'C:/Users/DELL/Downloads/theblossomgreen/bloom-green-landing/dist'
const OUT = process.argv[2]

const html = readFileSync(join(DIST, 'index.html'), 'utf8')

const cssFile = html.match(/assets\/index-[\w-]+\.css/)[0]
const jsFile = html.match(/assets\/index-[\w-]+\.js/)[0]
let css = readFileSync(join(DIST, cssFile), 'utf8')
let js = readFileSync(join(DIST, jsFile), 'utf8')

const MIME = {
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  glb: 'model/gltf-binary',
}

// every runtime asset the app references by absolute path
const assets = [
  ...new Set(
    [...js.matchAll(/"(\/(?:img|models|decor)\/[^"]+)"/g), ...css.matchAll(/url\((\/(?:img|decor)\/[^)]+)\)/g)].map(
      (m) => m[1],
    ),
  ),
]

let total = 0
for (const path of assets) {
  const file = join(DIST, path)
  const ext = path.split('.').pop().toLowerCase()
  const data = readFileSync(file)
  total += data.length
  const uri = `data:${MIME[ext] || 'application/octet-stream'};base64,${data.toString('base64')}`
  js = js.split(`"${path}"`).join(JSON.stringify(uri))
  css = css.split(`url(${path})`).join(`url(${uri})`)
  console.log(`inlined ${path} (${(data.length / 1024).toFixed(0)} KB)`)
}

// safe to embed in a <script> tag
js = js.replace(/<\/script/gi, '<\\/script')

const page = `<meta charset="utf-8">
<title>Bloom Green</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`

writeFileSync(OUT, page)
console.log(`\nassets inlined: ${assets.length} (${(total / 1e6).toFixed(1)} MB raw)`)
console.log(`output: ${OUT} — ${(statSync(OUT).size / 1e6).toFixed(1)} MB`)
