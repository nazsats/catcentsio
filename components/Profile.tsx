'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProfileProps {
  account: string | null;
  onCopyAddress: () => void;
  onDisconnect: () => void;
}

export default function Profile({ account, onCopyAddress, onDisconnect }: ProfileProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    onCopyAddress();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative z-50 -mt-2 flex items-center justify-between bg-black/80 rounded-lg border border-purple-900 shadow-lg p-2 md:p-4">
      {/* Desktop-only group */}
      <div className="hidden md:flex items-center space-x-4">
        {/* Address */}
        <p className="text-gray-200 font-semibold text-base whitespace-nowrap">
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connecting...'}
        </p>

        {/* Copy Button */}
        <div className="relative">
          <button
            onClick={handleCopy}
            className="text-purple-400 hover:text-purple-300 transition-colors"
            aria-label="Copy wallet address"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
          {isCopied && (
            <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-purple-700 text-white text-xs py-1 px-2 rounded shadow">
              Copied!
            </span>
          )}
        </div>

        {/* Social Icons */}
        <div className="flex items-center space-x-3">
          <a
            href="https://x.com/CatCentsio/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
            aria-label="Visit Catcents on X"
          >
            <Image src="/x.png" alt="X" width={20} height={20} className="w-5 h-5" />
          </a>
          <a
            href="https://t.me/catcentsio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
            aria-label="Telegram"
          >
            <Image src="/telegram.png" alt="Telegram" width={20} height={20} className="w-5 h-5" />
          </a>
          <a
            href="https://discord.gg/TXPbt7ztMC"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
            aria-label="Discord"
          >
            <Image src="/discord.png" alt="Discord" width={20} height={20} className="w-5 h-5" />
          </a>
          <a
            href="https://catcents.gitbook.io/catcents"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
            aria-label="Docs"
          >
            <Image src="/gitbook.png" alt="Docs" width={20} height={20} className="w-5 h-5" />
          </a>
        </div>

        {/* Desktop Disconnect */}
        <button
          onClick={onDisconnect}
          className="bg-purple-700 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors font-semibold"
        >
          Disconnect
        </button>
      </div>

      {/* Mobile-only group */}
      <div className="flex md:hidden items-center space-x-2">
        <button
          onClick={onDisconnect}
          className="bg-purple-700 text-white px-3 py-1 rounded-lg hover:bg-purple-600 transition-colors text-sm font-semibold"
        >
          Disconnect
        </button>
        <Image
          src="/avatar.png"
          alt="Profile Avatar"
          width={40}
          height={40}
          className="w-10 h-10 object-contain -mt-1"
          onError={(e) => { e.currentTarget.src = '/avatar.png'; }}
        />
      </div>

      {/* Desktop Avatar inline */}
      <div className="hidden md:flex flex-shrink-0">
        <Image
          src="/avatar.png"
          alt="Profile Avatar"
          width={40}
          height={40}
          className="w-10 h-10 object-contain"
          onError={(e) => { e.currentTarget.src = '/avatar.png'; }}
        />
      </div>
    </div>
  );
}
