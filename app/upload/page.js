'use client'

import { useState, useRef, useCallback } from 'react'

const DESTINATIONS = [
  { id: 'pilgrimage', label: 'Pilgrimage Village' },
  { id: 'vedana', label: 'Vedana Lagoon' },
]

function StatusIcon({ status }) {
  if (status === 'done') {
    return (
      <svg className="w-4 h-4 text-teal-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (status === 'error') {
    return (
      <svg className="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }
  if (status === 'uploading' || status === 'converting') {
    return (
      <svg className="w-4 h-4 text-teal-500 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m6.366 1.634l-2.12 2.12M21 12h-3m-1.634 6.366l-2.12-2.12M12 21v-3m-6.366-1.634l2.12-2.12M3 12h3m1.634-6.366l2.12 2.12" />
      </svg>
    )
  }
  return <div className="w-4 h-4 rounded-full border-2 border-teal-200 shrink-0" />
}

function FileRow({ item, index }) {
  const statusLabel = {
    waiting: 'Čeka...',
    uploading: `Šalje se... ${item.uploadProgress}%`,
    converting: 'Konvertuje se...',
    done: `Gotovo — ${item.result?.sizeKb ?? '?'}KB (q${item.result?.quality ?? '?'})`,
    error: item.error ?? 'Greška',
  }[item.status]

  return (
    <div className="flex items-center gap-3 py-3 border-b border-teal-900/5 last:border-0">
      {/* Thumbnail */}
      <div className="w-16 h-12 rounded-lg overflow-hidden bg-teal-900/5 shrink-0 flex items-center justify-center">
        {item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-6 h-6 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-teal-900 truncate font-medium">{item.file.name}</p>
        <p className="text-xs text-teal-600/70 mt-0.5">{statusLabel}</p>
        {(item.status === 'uploading') && (
          <div className="mt-1.5 h-1 bg-teal-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 rounded-full transition-all duration-200"
              style={{ width: `${item.uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      <StatusIcon status={item.status} />
    </div>
  )
}

export default function UploadPage() {
  const [destination, setDestination] = useState('pilgrimage')
  const [items, setItems] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const addFiles = useCallback((files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return
    const previews = imageFiles.map(file => ({
      file,
      status: 'waiting',
      previewUrl: URL.createObjectURL(file),
      uploadProgress: 0,
      result: null,
      error: null,
    }))
    setItems(prev => [...prev, ...previews])
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  function uploadFileWithProgress(file, dest, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('destination', dest)

      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100))
      }
      xhr.onload = () => {
        if (xhr.status === 200) resolve(JSON.parse(xhr.responseText))
        else {
          try { reject(new Error(JSON.parse(xhr.responseText).error)) }
          catch { reject(new Error(`HTTP ${xhr.status}`)) }
        }
      }
      xhr.onerror = () => reject(new Error('Konekcija prekinuta'))
      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    })
  }

  async function startUpload() {
    const pending = items.filter(i => i.status === 'waiting' || i.status === 'error')
    if (!pending.length) return
    setIsRunning(true)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.status !== 'waiting' && item.status !== 'error') continue

      setItems(prev => prev.map((it, idx) =>
        idx === i ? { ...it, status: 'uploading', uploadProgress: 0, error: null } : it
      ))

      try {
        const result = await uploadFileWithProgress(
          item.file,
          destination,
          (progress) => {
            setItems(prev => prev.map((it, idx) =>
              idx === i ? { ...it, uploadProgress: progress } : it
            ))
            if (progress === 100) {
              setItems(prev => prev.map((it, idx) =>
                idx === i ? { ...it, status: 'converting' } : it
              ))
            }
          }
        )
        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'done', result, previewUrl: result.path } : it
        ))
      } catch (err) {
        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'error', error: err.message } : it
        ))
      }
    }

    setIsRunning(false)
  }

  const doneCount = items.filter(i => i.status === 'done').length
  const totalCount = items.length
  const overallPct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0
  const pendingCount = items.filter(i => i.status === 'waiting' || i.status === 'error').length

  return (
    <main className="min-h-screen bg-cream-100">
      <section className="bg-teal-900 py-14 px-4 text-center">
        <p className="text-cream-100/50 text-xs tracking-[0.3em] uppercase mb-3">HUE</p>
        <h1
          className="text-cream-50 text-4xl sm:text-5xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Upload Photos
        </h1>
        <p className="text-cream-100/40 text-sm">Batch convert to WebP · max 1080px · max 300KB</p>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Destination */}
        <div>
          <p className="text-xs font-medium text-teal-700/70 uppercase tracking-widest mb-2">Destinacija</p>
          <div className="flex gap-2">
            {DESTINATIONS.map(d => (
              <button
                key={d.id}
                onClick={() => setDestination(d.id)}
                disabled={isRunning}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  destination === d.id
                    ? 'bg-teal-800 text-cream-50 shadow-sm'
                    : 'bg-teal-900/10 text-teal-700 hover:bg-teal-900/15'
                } disabled:opacity-50`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isRunning && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer select-none ${
            isDragging
              ? 'border-teal-600 bg-teal-50'
              : 'border-teal-200 hover:border-teal-400 hover:bg-teal-50/50'
          } ${isRunning ? 'pointer-events-none opacity-50' : ''}`}
        >
          <svg className="w-10 h-10 text-teal-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-teal-700 font-medium">Prevuci fotografije ovdje</p>
          <p className="text-teal-500/70 text-sm mt-1">ili klikni da odabereš fajlove</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => addFiles(e.target.files)}
          />
        </div>

        {/* Overall progress */}
        {totalCount > 0 && (
          <div>
            <div className="flex justify-between text-xs text-teal-700/70 mb-1.5">
              <span>{doneCount} / {totalCount} fotografija</span>
              <span>{overallPct}%</span>
            </div>
            <div className="h-2 bg-teal-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 rounded-full transition-all duration-300"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        )}

        {/* File list */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl px-4 shadow-sm border border-teal-900/5">
            {items.map((item, i) => (
              <FileRow key={i} item={item} index={i} />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {pendingCount > 0 && !isRunning && (
            <button
              onClick={startUpload}
              className="flex-1 py-3 bg-teal-800 text-cream-50 rounded-full text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              Uploaduj {pendingCount} {pendingCount === 1 ? 'fotografiju' : 'fotografija'}
            </button>
          )}
          {isRunning && (
            <div className="flex-1 py-3 bg-teal-800/50 text-cream-50/70 rounded-full text-sm font-medium text-center">
              Procesira se...
            </div>
          )}
          {items.length > 0 && !isRunning && (
            <button
              onClick={() => setItems([])}
              className="px-5 py-3 bg-teal-900/10 text-teal-700 rounded-full text-sm font-medium hover:bg-teal-900/15 transition-colors"
            >
              Obriši listu
            </button>
          )}
        </div>

        {doneCount > 0 && !isRunning && (
          <p className="text-center text-xs text-teal-600/60">
            Fotografije su sačuvane u <code className="font-mono">public/images/{destination}/</code> i registrovane u <code className="font-mono">lib/data/{destination}.json</code>
          </p>
        )}
      </div>
    </main>
  )
}
