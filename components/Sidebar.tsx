'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface SidebarProps {
  onDisconnect: () => void;
}

export default function Sidebar({ onDisconnect }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname(); // Get current route

  // Define active link styles
  const getLinkClass = (href: string, disabled: boolean = false) =>
    `flex items-center space-x-3 transition-colors ${
      disabled
        ? 'text-gray-500 cursor-not-allowed'
        : pathname === href
        ? 'text-purple-400 font-semibold'
        : 'text-gray-300 hover:text-purple-300'
    }`;

  return (
    <>
      {/* Toggle Button - Attached to Sidebar */}
      <button
        className={`md:hidden fixed top-1/2 z-20 bg-purple-700 text-white p-3 rounded-r-lg shadow-lg transition-all duration-200 ease-in-out ${
          isOpen ? 'left-64' : 'left-0'
        } transform -translate-y-1/2`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Menu"
      >
        <span className="text-xl font-bold">{isOpen ? '>' : '<'}</span>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 w-64 bg-black/90 p-6 flex flex-col justify-between border-r border-purple-900 shadow-lg transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 z-10`}
      >
        <div>
          <h1 className="text-2xl font-bold mb-8 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Catcents
          </h1>
          <nav className="space-y-4">
            <Link href="/dashboard" className={getLinkClass('/dashboard')}>
              <Image
                src="/sidebar/dashboard.png"
                alt="Dashboard Icon"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-base">Dashboard</span>
            </Link>
            <Link href="/dashboard/quests" className={getLinkClass('/dashboard/quests')}>
              <Image
                src="/sidebar/quest.png"
                alt="Quests Icon"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-base">Quests</span>
            </Link>
            <Link href="/dashboard/proposals" className={getLinkClass('/dashboard/proposals')}>
              <Image
                src="/sidebar/proposals.png"
                alt="Proposals Icon"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-base">Proposals</span>
            </Link>
            <Link href="/dashboard/games" className={getLinkClass('/dashboard/games')}>
              <Image
                src="/sidebar/games.png"
                alt="Games Icon"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-base">Games</span>
            </Link>
            <div className={getLinkClass('/dashboard/nft-staking', true)}>
              <Image
                src="/sidebar/nft-staking.png"
                alt="NFT Staking Icon"
                width={24}
                height={24}
                className="w-6 h-6 opacity-50"
              />
              <div className="flex items-center space-x-2">
                <span className="text-base">NFT Staking</span>
                <span className="text-xs text-yellow-400 bg-gray-800 px-1 rounded">Coming Soon</span>
              </div>
            </div>
          </nav>
        </div>
        <button
          onClick={onDisconnect}
          className="bg-purple-700 text-white py-2 rounded-lg hover:bg-purple-600 transition-colors font-semibold"
        >
          Disconnect
        </button>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-0 transition-opacity duration-200 ease-in-out"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}