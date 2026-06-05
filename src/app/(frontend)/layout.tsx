import React from 'react'
import { IBM_Plex_Serif, IBM_Plex_Sans } from 'next/font/google'
import './styles.css'
import { Footer } from '@/components/Footer'
import { Wordmark } from '@/components/Wordmark'

const plexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-serif',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-sans',
})

export const metadata = {
  title: 'PflegeAtlas',
  description: 'Wissen für die professionelle Pflege. Frei. Geprüft. Praxisnah.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${plexSerif.variable} ${plexSans.variable}`}>
      <body className="min-h-screen flex flex-col bg-surface font-sans text-ink">
        <header className="border-b border-rule py-4">
          <div className="mx-auto max-w-6xl px-4">
            <a href="/" className="inline-block">
              <Wordmark size="md" />
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
