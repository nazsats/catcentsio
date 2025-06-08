'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface SidebarProps {
  onDisconnect: () => void;
}

export default function Sidebar({ onDisconnect }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', isOpen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [isOpen]);

  const getLinkClass = (href: string, disabled = false) =>
    `flex items-center space-x-3 transition-colors ${
      disabled
        ? 'text-gray-500 cursor-not-allowed'
        : pathname === href
        ? 'text-purple-400 font-semibold'
        : 'text-gray-300 hover:text-purple-300'
    }`;

  return (
    <>
      {/* Hamburger Button: only when closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
          className="fixed top-20 left-4 z-30 p-2 bg-purple-700 rounded-md md:hidden"
        >
          <div className="space-y-1.5">
            <span className="block w-6 h-0.5 bg-white"></span>
            <span className="block w-6 h-0.5 bg-white"></span>
            <span className="block w-6 h-0.5 bg-white"></span>
          </div>
        </button>
      )}

      {/* Sidebar with close button inside */}
      <aside
        className={
          `fixed inset-y-0 left-0 w-64 bg-black/90 p-6 flex flex-col justify-between border-r border-purple-900 shadow-lg transform transition-transform duration-200 ease-in-out z-20 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 md:static`
        }
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

            <Link href="https://portal.catcents.io/" className={getLinkClass('https://portal.catcents.io/') }>
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

            <Link href="/dashboard/leaderboard" className={getLinkClass('/dashboard/leaderboard')}>
              <Image
                src="/sidebar/leaderboard.png"
                alt="Leaderboard Icon"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-base">Leaderboard</span>
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

        {/* Close Button: at bottom-right of sidebar */}
        {isOpen && (
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="absolute bottom-6 right-4 p-2 bg-transparent text-white md:hidden"
          >
            <div className="relative w-6 h-6">
              <span className="absolute inset-0 block w-full h-0.5 bg-white transform rotate-45"></span>
              <span className="absolute inset-0 block w-full h-0.5 bg-white transform -rotate-45"></span>
            </div>
          </button>
        )}

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
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
