import sharp from 'sharp'
import { join } from 'path'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

export const runtime = 'nodejs'

// This endpoint is intentionally a local-dev-only tool.
// It writes processed WebP files to public/images/ and updates lib/data/*.json.
// Blocked in production (VERCEL env) where the filesystem is read-only.

const MAX_DIM = 1080
const QUALITY = 80
const MAX_BYTES = 300_000
const LOGO_PCT = 0.32
const LOGO_OPACITY = 0.55

async function makeLogoBuffer(logoPath, targetW, originalW, originalH) {
  const raw = await readFile(logoPath)
  const meta = await sharp(raw).metadata()
  const targetH = Math.round(targetW * meta.height / meta.width)
  const resized = await sharp(raw).resize(targetW, targetH).ensureAlpha().toBuffer()
  const { data, info } = await sharp(resized).raw().toBuffer({ resolveWithObject: true })
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * LOGO_OPACITY)
  }
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
  return { buf, w: info.width, h: info.height }
}

export async function POST(request) {
  if (process.env.VERCEL) {
    return Response.json({ error: 'Upload is a local-dev-only tool.' }, { status: 403 })
  }
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const destination = formData.get('destination')

    if (!file || !destination) {
      return Response.json({ error: 'Missing file or destination' }, { status: 400 })
    }
    if (!['pilgrimage', 'vedana'].includes(destination)) {
      return Response.json({ error: 'Invalid destination' }, { status: 400 })
    }

    const originalName = file.name
    const baseName = originalName.replace(/\.[^.]+$/, '')
    const outName = `${baseName}.webp`
    const cwd = process.cwd()

    // Reject duplicate: file already exists on disk
    const outDir = join(cwd, 'public', 'images', destination)
    const outPath = join(outDir, outName)
    if (existsSync(outPath)) {
      return Response.json({ skipped: true, name: outName, path: `/images/${destination}/${outName}` })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Resize to max 1080px keeping aspect ratio
    const meta = await sharp(buffer).metadata()
    const isLandscape = (meta.width ?? 0) >= (meta.height ?? 1)
    const resizeOpts = isLandscape
      ? { width: MAX_DIM, withoutEnlargement: true }
      : { height: MAX_DIM, withoutEnlargement: true }

    const resizedBuf = await sharp(buffer).resize(resizeOpts).toBuffer()
    const rm = await sharp(resizedBuf).metadata()
    const rw = rm.width
    const rh = rm.height

    // Logo bottom-right
    const logoPath = join(cwd, 'public', 'logo.png')
    let compositeInput = []
    if (existsSync(logoPath)) {
      const shorter = Math.min(rw, rh)
      const logoW = Math.round(shorter * LOGO_PCT)
      const logo = await makeLogoBuffer(logoPath, logoW, rw, rh)
      const left = Math.round((rw - logo.w) / 2)
      const top = Math.round((rh - logo.h) / 2)
      compositeInput = [{ input: logo.buf, left, top, blend: 'over' }]
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

    // Save to public/images/{destination}/
    if (!existsSync(outDir)) {
      await mkdir(outDir, { recursive: true })
    }
    await writeFile(outPath, output)

    // Update lib/data/{destination}.json
    const dataPath = join(cwd, 'lib', 'data', `${destination}.json`)
    let data = []
    try {
      data = JSON.parse(await readFile(dataPath, 'utf8'))
    } catch {}

    const newEntry = {
      id: baseName,
      src: `/images/${destination}/${outName}`,
      alt: baseName,
      width: rw,
      height: rh,
    }

    // Replace if already exists, otherwise append
    const idx = data.findIndex(e => e.id === baseName)
    if (idx >= 0) {
      data[idx] = newEntry
    } else {
      data.push(newEntry)
    }

    await writeFile(dataPath, JSON.stringify(data, null, 2))

    return Response.json({
      path: newEntry.src,
      width: rw,
      height: rh,
      name: outName,
      sizeKb: Math.round(output.length / 1024),
      quality,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
