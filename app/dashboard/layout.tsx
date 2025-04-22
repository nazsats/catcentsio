'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import { useDisconnect } from 'wagmi';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { address: account, status, isConnecting: loading } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  useEffect(() => {
    console.log('DashboardLayout: Redirect useEffect - Account:', account, 'Status:', status, 'Loading:', loading);
    // Delay redirect to allow wallet rehydration
    const timer = setTimeout(() => {
      if (status === 'disconnected' && !loading) {
        console.log('DashboardLayout: Wallet disconnected, redirecting to /');
        router.replace('/');
      } else {
        console.log('DashboardLayout: Wallet state:', { status, account, loading });
      }
    }, 1000); // 1s delay
    return () => clearTimeout(timer);
  }, [status, loading, router, account]); // Added 'account' to dependency array

  // Always render the layout, let useEffect handle redirects
  if (!account && !loading) {
    return null; // Prevent rendering if wallet is disconnected (after useEffect check)
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Sidebar onDisconnect={disconnect} />
      <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
    </div>
  );
}