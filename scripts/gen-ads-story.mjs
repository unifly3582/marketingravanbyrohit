#!/usr/bin/env node
/*
 * gen-ads-story.mjs — the monochrome scene objects for the Meta Ads story page
 * (site/src/pages/AdsStory.jsx), generated with nano banana (Gemini image).
 *
 *   node scripts/gen-ads-story.mjs            # everything that is missing
 *   node scripts/gen-ads-story.mjs dice bulb  # named ones
 *   FORCE=1 node scripts/gen-ads-story.mjs    # regenerate existing ones
 *
 * Output: assets-src/ads-story/<key>.png, then
 *   python scripts/ads-story-to-webp.py
 * writes site/src/assets/ads-story/<key>.webp for the page to import.
 *
 * Every picture is black-and-white on a pure white background so the page can
 * lay it over its paper stage with mix-blend-mode: multiply (no cutouts needed).
 */
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generate } from './nanobanana.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'assets-src', 'ads-story')

const STYLE = `Black-and-white photograph, monochrome, high-key editorial advertising style, on a PURE WHITE seamless background
(#ffffff, no grey backdrop, no vignette), crisp studio lighting, rich blacks, a soft natural contact shadow under the object.
Single subject, centred, generous empty white margin around it. No text, no logos, no watermark, no colour at all.`

const ITEMS = {
  crowd: {
    aspect: '16:9',
    prompt: `Long-exposure black-and-white photograph inside a vast bright white hall: a dense crowd of people rushing past as ghostly motion-blurred streaks,
and in the exact centre ONE person standing perfectly still and sharp, wearing a long dark coat, facing the camera. Overexposed white floor and walls,
the crowd dissolves into white at the edges. Cinematic, grainy. No text.`,
  },
  dice: {
    aspect: '1:1',
    prompt: `Three glossy black dice with white pips tumbling in mid-air, caught at different angles, product-photography sharpness, subtle reflections on their faces. ${STYLE}`,
  },
  megaphone: {
    aspect: '1:1',
    prompt: `A raised hand and forearm in a rolled denim sleeve holding a vintage chrome metal megaphone pointed up-left, seen from the side, cut off at the wrist below. ${STYLE}`,
  },
  phone: {
    aspect: '1:1',
    prompt: `Two hands holding a modern smartphone upright, one index finger about to tap the screen; the screen shows a blank pale-grey social media feed with empty square post placeholders. ${STYLE}`,
  },
  skyline: {
    aspect: '16:9',
    prompt: `Black-and-white photograph of a dense modern city skyline of skyscrapers seen from below at street level, layered in receding shades of grey,
the buildings fading to pure white towards the top of the frame, bright white overexposed sky. No text.`,
  },
  lens: {
    aspect: '1:1',
    prompt: `Top-down photograph of a giant classic magnifying glass lying on white, and six tiny business people in suits (miniature figures, seen from above) standing around its rim looking down into the lens, long soft shadows. ${STYLE}`,
  },
  chess: {
    aspect: '1:1',
    prompt: `A tall white marble chess king cracking apart with fragments flying off and a spiderweb of fissures across it, toppling slightly, next to a small intact glossy black chess pawn standing firm in front of it. ${STYLE}`,
  },
  bulb: {
    aspect: '1:1',
    prompt: `A clear glass light bulb with a detailed human brain inside it instead of a filament, the brass screw cap at the bottom, tilted slightly, floating. ${STYLE}`,
  },
  computer: {
    aspect: '1:1',
    prompt: `A vintage 1980s beige personal computer with a boxy CRT monitor and a mechanical keyboard, seen from the front and slightly above; two hands typing on the keyboard from the bottom of the frame; the screen is a blank bright white rectangle. ${STYLE}`,
  },
  handshake: {
    aspect: '1:1',
    prompt: `Top-down photograph, directly from above, of two business people in dark suits shaking hands while standing on a plain flat black floor, seen from high overhead so they are small figures, a thin white line splitting the black floor between them. High contrast, the black floor fills the whole frame. No text.`,
  },
  walking: {
    aspect: '16:9',
    prompt: `Top-down photograph, directly from above, of five business people in dark suits walking in different directions across a vast bright white floor, spread far apart, each casting a long hard shadow. Black-and-white, high-key, overexposed white ground. No text.`,
  },
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
const want = process.argv.slice(2)
const keys = want.length ? want : Object.keys(ITEMS)
for (const key of keys) {
  const it = ITEMS[key]
  if (!it) { console.error(`unknown item ${key}`); continue }
  const out = join(OUT, `${key}.png`)
  if (existsSync(out) && !process.env.FORCE) { console.log(`skip ${key}`); continue }
  console.log(`gen ${key}...`)
  try {
    await generate({ prompt: it.prompt, out, aspect: it.aspect, size: '1K' })
    console.log(`  -> ${out}`)
  } catch (e) {
    console.error(`  FAILED ${key}: ${e.message}`)
  }
}
