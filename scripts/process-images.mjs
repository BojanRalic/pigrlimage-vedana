/**
 * Local batch processor for source photos.
 * Usage: node scripts/process-images.mjs <destination> <source-folder>
 *   destination: pilgrimage | vedana
 *   source-folder: path to folder with JPG/JPEG source files
 *
 * Output: public/images/{destination}/*.webp
 *         lib/data/{destination}.json (updated)
 */

import sharp from 'sharp'
import { readdir, writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename, extname } from 'path'

const MAX_DIM   = 1080
const QUALITY   = 80
const MAX_BYTES = 300_000
const LOGO_PCT  = 0.45
const OPACITY   = 0.60

const [,, destination, srcDir] = process.argv

if (!destination || !['pilgrimage', 'vedana'].includes(destination)) {
  console.error('Usage: node scripts/process-images.mjs <pilgrimage|vedana> <source-folder>')
  process.exit(1)
}
if (!srcDir || !existsSync(srcDir)) {
  console.error(`Source folder not found: ${srcDir}`)
  process.exit(1)
}

const cwd = process.cwd()
const LOGO_PATH = join(cwd, 'public', 'logo.png')
const OUT_DIR   = join(cwd, 'public', 'images', destination)
const DATA_PATH = join(cwd, 'lib', 'data', `${destination}.json`)

if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true })

// Load logo once
let logoBase = null
let logoBaseMeta = null
if (existsSync(LOGO_PATH)) {
  logoBase = await readFile(LOGO_PATH)
  logoBaseMeta = await sharp(logoBase).metadata()
} else {
  console.warn('logo.png not found in public/ — skipping watermark')
}

async function makeLogoBuffer(targetW) {
  if (!logoBase) return null
  const targetH = Math.round(targetW * logoBaseMeta.height / logoBaseMeta.width)
  const resized = await sharp(logoBase).resize(targetW, targetH).ensureAlpha().toBuffer()
  const { data, info } = await sharp(resized).raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (r > 230 && g > 230 && b > 230) {
      data[i + 3] = 0
    } else {
      data[i + 3] = Math.round(data[i + 3] * OPACITY)
    }
  }
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
  return { buf, w: info.width, h: info.height }
}

const files = (await readdir(srcDir))
  .filter(f => /\.(jpg|jpeg|png|tiff?)$/i.test(f))
  .sort()

console.log(`\nProcessing ${files.length} files → ${destination}\n`)

// Load existing data to merge
let existingData = []
try {
  existingData = JSON.parse(await readFile(DATA_PATH, 'utf8'))
} catch {}
const existingMap = new Map(existingData.map(e => [e.id, e]))

const entries = []

for (let i = 0; i < files.length; i++) {
  const srcPath = join(srcDir, files[i])
  const baseName = basename(files[i], extname(files[i]))
  const outName = `${baseName}.webp`
  const outPath = join(OUT_DIR, outName)

  // Resize to max 1080px keeping aspect ratio
  const meta = await sharp(srcPath).metadata()
  const isLandscape = (meta.width ?? 0) >= (meta.height ?? 1)
  const resizeOpts = isLandscape
    ? { width: MAX_DIM, withoutEnlargement: true }
    : { height: MAX_DIM, withoutEnlargement: true }

  const resizedBuf = await sharp(srcPath).resize(resizeOpts).toBuffer()
  const rm = await sharp(resizedBuf).metadata()
  const rw = rm.width
  const rh = rm.height

  // Logo: bottom-right corner
  let compositeInput = []
  if (logoBase) {
    const shorter = Math.min(rw, rh)
    const logoW = Math.round(shorter * LOGO_PCT)
    const logo = await makeLogoBuffer(logoW)
    if (logo) {
      const left = Math.round((rw - logo.w) / 2)
      const top  = Math.round((rh - logo.h) / 2)
      compositeInput = [{ input: logo.buf, left, top, blend: 'over' }]
    }
  }

  // WebP with quality loop to stay under 300KB
  let quality = QUALITY
  let output
  while (quality >= 50) {
    output = await sharp(resizedBuf)
      .composite(compositeInput)
      .webp({ quality })
      .toBuffer()
    if (output.length <= MAX_BYTES) break
    quality -= 5
  }

  await writeFile(outPath, output)
  const kb = Math.round(output.length / 1024)
  console.log(`[${i + 1}/${files.length}] ${outName} — ${rw}x${rh} — ${kb}KB (q${quality})`)

  const entry = { id: baseName, src: `/images/${destination}/${outName}`, alt: baseName, width: rw, height: rh }
  existingMap.set(baseName, entry)
  entries.push(entry)
}

// Write updated JSON (preserve entries not in this batch)
const merged = [...existingMap.values()]
await writeFile(DATA_PATH, JSON.stringify(merged, null, 2))
console.log(`\nDone. ${files.length} images processed. lib/data/${destination}.json updated (${merged.length} total entries).`)
