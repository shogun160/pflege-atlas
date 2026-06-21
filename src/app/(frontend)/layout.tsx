import React from 'react'
import Link from 'next/link'
import { IBM_Plex_Serif, IBM_Plex_Sans } from 'next/font/google'
import './styles.css'
import { Footer } from '@/components/Footer'
import { Logo } from '@/components/Logo'
import { HeaderUserMenu } from '@/components/HeaderUserMenu'
import { getSession } from '@/lib/auth'

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

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <html lang="de" className={`${plexSerif.variable} ${plexSans.variable}`}>
      <body className="min-h-screen flex flex-col bg-surface font-sans text-ink">
        <header className="mx-auto w-full max-w-6xl px-4 flex items-center justify-between gap-4">
          <Link href="/" className="inline-block">
            <Logo priority />
          </Link>
          <HeaderUserMenu session={session} />
        </header>
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
