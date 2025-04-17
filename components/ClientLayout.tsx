// components/ClientLayout.tsx
'use client'

import { useEffect, useState } from 'react'
import { ReactNode } from 'react'
import ContextProvider from '@/context'

export default function ClientLayout({ children }: { children: ReactNode }) {
  const [cookies, setCookies] = useState<string | null>(null)

  useEffect(() => {
    setCookies(document.cookie || null)
  }, [])

  return <ContextProvider cookies={cookies}>{children}</ContextProvider>
}