// Photoreal botanical props on white, for cutout keying.
import { generate } from './nanobanana.mjs'

const OUT = 'C:/Users/DELL/Downloads/theblossomgreen/test-out'

const jobs = [
  {
    out: `${OUT}/branch-raw.png`,
    aspect: '1:1',
    prompt:
      'A single elegant olive branch with silvery-green leaves, photorealistic, arranged diagonally from lower left to upper right, isolated on a pure solid white background, soft even studio light, no shadow on the background, high detail botanical still life.',
  },
  {
    out: `${OUT}/jasmine-raw.png`,
    aspect: '1:1',
    prompt:
      'A small sprig of white jasmine flowers with two open blossoms, buds and dark green leaves, photorealistic, isolated on a pure solid white background, soft even studio light, no shadow on the background, high detail botanical still life.',
  },
]

for (const j of jobs) {
  process.stdout.write(`>> ${j.out.split('/').pop()} ... `)
  try {
    const { saved, finishReason } = await generate({ prompt: j.prompt, out: j.out, aspect: j.aspect, size: '1K', ref: [] })
    console.log(saved ? 'OK' : `NO IMAGE (${finishReason})`)
  } catch (e) {
    console.log(`ERROR: ${e.message.slice(0, 200)}`)
  }
}
console.log('done')
