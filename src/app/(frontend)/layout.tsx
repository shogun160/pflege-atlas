import React from 'react'
import './styles.css'
import { Footer } from '@/components/Footer'

export const metadata = {
  description: 'Wissen für die professionelle Pflege. Frei. Geprüft. Praxisnah.',
  title: 'PflegeCommons',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-gray-200 py-4">
          <div className="mx-auto max-w-6xl px-4">
            <a href="/" className="font-bold text-lg">
              PflegeCommons
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
