'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { pilgrimageImages, vedanaImages } from '@/lib/images'
import Tabs from '@/components/Tabs'
import Gallery from '@/components/Gallery'
import Lightbox from '@/components/Lightbox'

const allImages = [...pilgrimageImages, ...vedanaImages]

export default function Page() {
  const [activeTab, setActiveTab] = useState('pilgrimage')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    fetch('/api/selection')
      .then(r => r.json())
      .then(ids => setSelectedIds(new Set(ids)))
  }, [])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setLightboxIndex(null)
  }

  const toggleSelect = useCallback(async (id) => {
    const action = selectedIds.has(id) ? 'remove' : 'add'
    setSelectedIds(prev => {
      const next = new Set(prev)
      action === 'add' ? next.add(id) : next.delete(id)
      return next
    })
    await fetch('/api/selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
  }, [selectedIds])

  const visibleImages =
    activeTab === 'chosen'
      ? allImages.filter(img => selectedIds.has(img.id))
      : activeTab === 'pilgrimage'
      ? pilgrimageImages
      : vedanaImages

  const total = visibleImages.length

  const handlePrev = useCallback(() => {
    setLightboxIndex(i => (i - 1 + total) % total)
  }, [total])

  const handleNext = useCallback(() => {
    setLightboxIndex(i => (i + 1) % total)
  }, [total])

  const totalCount = allImages.length

  return (
    <main className="min-h-screen bg-cream-100">
      <section className="bg-teal-900 py-20 px-4 text-center">
        <p className="text-cream-100/50 text-xs tracking-[0.3em] uppercase mb-3">Hoi An</p>
        <h1
          className="text-cream-50 text-5xl sm:text-6xl font-bold mb-4"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Gallery
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-px w-12 bg-cream-100/25" />
          <p className="text-cream-100/50 text-sm tracking-wider">Select your photographs</p>
          <div className="h-px w-12 bg-cream-100/25" />
        </div>
        <p className="text-cream-100/30 text-xs tracking-widest uppercase">{totalCount} photographs</p>
      </section>

      <section className="py-10 px-4">
        <Tabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          selectedCount={selectedIds.size}
        />
      </section>

      <section className="pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {activeTab === 'chosen' && visibleImages.length === 0 ? (
          <p className="text-center text-teal-700/50 py-20 text-sm">
            You haven&apos;t selected any photographs yet.
          </p>
        ) : (
          <Gallery
            images={visibleImages}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onOpenLightbox={setLightboxIndex}
          />
        )}
      </section>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            index={lightboxIndex}
            images={visibleImages}
            onClose={() => setLightboxIndex(null)}
            onPrev={handlePrev}
            onNext={handleNext}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-teal-800 text-cream-50 flex items-center justify-center shadow-lg hover:bg-teal-700 transition-colors"
            aria-label="Back to top"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  )
}
