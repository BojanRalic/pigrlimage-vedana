import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata = {
  title: 'Pigrlimage Vedana — Gallery',
  description: 'Pilgrimage Village & Vedana Lagoon photo gallery. Browse and select your favourite photographs.',
  openGraph: {
    title: 'Pigrlimage Vedana — Gallery',
    description: 'Pilgrimage Village & Vedana Lagoon photo gallery. Browse and select your favourite photographs.',
    url: 'https://pigrlimage-vedana.vercel.app',
    siteName: 'Pigrlimage Vedana Gallery',
    images: [
      {
        url: 'https://pigrlimage-vedana.vercel.app/og-image.png',
        secureUrl: 'https://pigrlimage-vedana.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Pigrlimage Vedana Gallery',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pigrlimage Vedana — Gallery',
    description: 'Pilgrimage Village & Vedana Lagoon photo gallery. Browse and select your favourite photographs.',
    images: ['https://pigrlimage-vedana.vercel.app/og-image.png'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} bg-cream-100`}>
        {children}
      </body>
    </html>
  )
}
