# Marketing Ravan brand kit

Generated from the approved flat-vector Ravan mascot (`assets-src/logo/mark-white-v2.png`).
Rebuild everything with:

```
python scripts/brand/cutout-mark-white.py  # transparent mark -> assets-src/logo/mark.png
python scripts/brand/icons.py         # favicons, app icons, site logo files
python scripts/brand/vectorize.py     # traced SVG of the mark
node   scripts/brand/build-kit.mjs    # all lockups, social, print, email
```

Company details (phone, address, GSTIN, person name) live in `B` at the top of
`scripts/brand/build-kit.mjs`. They are placeholders right now.

## logo/
- `mark-master.png`, `mark-2048/1024/512/256.png`: the mark on transparent background
- `mark.svg`: auto-traced vector of the mark (good for print at any size; not hand-drawn)
- `logo-horizontal-for-dark/for-light.png`: transparent lockups, cream or ink wordmark
- `logo-horizontal-tagline-*.png`: same with the tagline
- `logo-stacked-*.png`: stacked lockups (transparent and on solid backgrounds)
- `logo-*-on-dark/on-light.png`: lockups on the ground / paper colour
- `wordmark-for-dark/for-light.png`: wordmark alone

## web/
- `favicon.ico` (16/32/48/64) and `favicon-*.png`
- `apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- `og-image-1200x630.png`: link preview image (also copied to `site/public/og-image.png`)

## social/
- `avatar-1024.png`, `avatar-gold-1024.png`: profile pictures (crop to circle in-app)
- `linkedin-cover-1584x396.png`, `x-header-1500x500.png`, `facebook-cover-1640x624.png`
- `youtube-banner-2560x1440.png` (content sits inside the 1546x423 safe area)
- `instagram-post-1080.png`, `instagram-story-1080x1920.png`: post templates

## stationery/
- `letterhead-A4.pdf` (sample letter), `letterhead-A4-blank.pdf`, `letterhead-A4.png`
- `visiting-card.pdf`: 96 x 61 mm with 3 mm bleed, page 1 front, page 2 back
- `visiting-card-front.png`, `visiting-card-back.png`: 300 dpi previews

## brand-sheet/
- `brand-sheet-A4.pdf` / `.png`: logo, clear space, colours (hex/RGB/CMYK), type, rules

## email/
- `email-signature.html`: table-based signature; the image loads from
  `https://marketingravan.com/brand/mark-160.png` (file is in `site/public/brand/`)

## Colours
Ground #0D0907 · Cream #F4EADB · Gold #F0A32F · Ember #E2571E · Maroon #8E1F1F

## Fonts
Bricolage Grotesque 800 (display, wordmark) · Instrument Sans 400/500/600 (body).
Both are free Google Fonts.
