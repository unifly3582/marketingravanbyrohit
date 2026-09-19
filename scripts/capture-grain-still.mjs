// Capture a tiny still of the hero's grain shader for site/public/grain-still.webp.
//
// ShaderGrain.jsx shows this as the canvas background until the shader's
// first frame (and for good where WebGL2 is missing), so the hero looks the
// same before and after the shader starts. Run against a server that serves
// the built site (or the dev server):
//
//   node scripts/capture-grain-still.mjs http://localhost:4179/
//
// Needs Chrome and the site's node_modules (puppeteer-core, sharp-free: the
// resize is done by Pillow via scripts/bake-portrait-shadows.py's sibling
// one-liner below).
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const site = resolve(here, '..', 'site')
const require = createRequire(resolve(site, 'package.json'))
const puppeteer = (await import(pathToFileURL(require.resolve('puppeteer-core')))).default

const url = process.argv[2] || 'http://localhost:4179/'
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'load' })
// let the worker compile and draw a few frames
await new Promise((r) => setTimeout(r, 4000))
const rect = await page.evaluate(() => {
  // only the field: hide the copy, the face and the wordmarks drawn over it
  for (const el of document.querySelectorAll('.hero-connected-panel > *:not(canvas), header')) el.style.display = 'none'
  const st = document.createElement('style')
  st.textContent = '.hero-connected-panel::after{display:none!important}.hero-connected-panel{mask-image:none!important;-webkit-mask-image:none!important}'
  document.head.appendChild(st)
  const c = document.querySelector('.hero-connected-panel canvas')
  const r = c.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height, bg: getComputedStyle(c).backgroundImage }
})
console.log('canvas', rect)
const png = resolve(site, 'public', 'grain-still.png')
await page.screenshot({ path: png, clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })
await browser.close()
// downscale to a few KB (the grain itself is not needed at this size, only the tones)
execFileSync('python', ['-c', `
from PIL import Image
im = Image.open(r'${png}').convert('RGB')
im = im.resize((160, round(160 * im.height / im.width)), Image.LANCZOS)
im.save(r'${resolve(site, 'public', 'grain-still.webp')}', 'WEBP', quality=70, method=6)
import os; print('grain-still.webp', os.path.getsize(r'${resolve(site, 'public', 'grain-still.webp')}') // 1024, 'kB')
`], { stdio: 'inherit' })
unlinkSync(png)
