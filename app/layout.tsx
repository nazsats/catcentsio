// app/layout.tsx
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Catcentsio - Web3 Community Platform',
    template: '%s | Catcentsio',
  },
  description: 'Join Catcentsio, a Web3 Community Platform to earn rewards through quests, proposals, and games. Connect your wallet and start today!',
  keywords: 'Web3, Blockchain, Monad, Catcentsio, Crypto, Community',
  authors: [{ name: 'Catcentsio Team' }],
  openGraph: {
    title: 'Catcentsio - Web3 Community Platform',
    description: 'Earn rewards in a fun Web3 ecosystem with Catcentsio.',
    url: 'https://catcentsio.com', // Replace with your actual domain
    siteName: 'Catcentsio',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Catcentsio Platform Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Catcentsio - Web3 Community Platform',
    description: 'Earn rewards with Catcentsio!',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#9333EA" />
      </head>
      <body className={inter.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}