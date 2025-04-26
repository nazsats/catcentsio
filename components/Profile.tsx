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
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = () => {
    onCopyAddress();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const toggleProfile = () => setIsOpen(!isOpen);

  return (
    <div className="relative flex items-center bg-black/80 rounded-lg border border-purple-900 shadow-lg p-2 md:p-4 transition-transform duration-200 hover:scale-105">
      {/* Avatar - Image Only */}
      <button
        onClick={toggleProfile}
        className="shrink-0 md:cursor-default mr-3 md:mr-4"
        aria-label="Toggle profile details on mobile"
      >
        <Image
          src="/avatar.png"
          alt="Profile Avatar"
          width={40}
          height={40}
          className="w-10 h-10 object-contain"
          onError={(e) => (e.currentTarget.src = '/avatar.png')}
        />
      </button>

      {/* Profile Content */}
      <div
        className={`${
          isOpen ? 'flex' : 'hidden'
        } md:flex items-start md:items-center flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 absolute md:static top-12 right-0 md:top-auto md:right-auto z-10 bg-black/90 md:bg-transparent rounded-b-lg md:rounded-none border md:border-0 border-purple-900 shadow-lg md:shadow-none p-4 md:p-0 w-64 md:w-auto transition-all duration-200 ease-in-out`}
      >
        {/* Account Info */}
        <div className="flex flex-col space-y-2 md:space-y-0">
          <p className="text-gray-200 font-semibold text-sm md:text-base">
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connecting...'}
          </p>
          <div className="flex items-center space-x-3">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="text-purple-400 hover:text-purple-300 relative transition-colors"
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
              {isCopied && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-purple-700 text-white text-xs py-1 px-2 rounded shadow animate-fade-in">
                  Copied!
                </span>
              )}
            </button>

            {/* Social Media and Docs Icons */}
            <a
              href="https://x.com/CatCentsio/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
              aria-label="Visit Catcents on X"
            >
              <Image
                src="/x.png"
                alt="Visit Catcents on X"
                width={20}
                height={20}
                className="w-5 h-5 object-contain filter brightness-100 hover:brightness-125"
              />
            </a>
            <a
              href="https://t.me/catcentsio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
              aria-label="Join Catcents on Telegram"
            >
              <Image
                src="/telegram.png"
                alt="Join Catcents on Telegram"
                width={20}
                height={20}
                className="w-5 h-5 object-contain filter brightness-100 hover:brightness-125"
              />
            </a>
            <a
              href="https://discord.gg/TXPbt7ztMC"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
              aria-label="Join Catcents on Discord"
            >
              <Image
                src="/discord.png"
                alt="Join Catcents on Discord"
                width={20}
                height={20}
                className="w-5 h-5 object-contain filter brightness-100 hover:brightness-125"
              />
            </a>
            <a
              href="https://catcents.gitbook.io/catcents"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
              aria-label="Visit Catcents Documentation"
            >
              <Image
                src="/gitbook.png"
                alt="Visit Catcents Documentation"
                width={20}
                height={20}
                className="w-5 h-5 object-contain filter brightness-100 hover:brightness-125"
              />
            </a>
          </div>
        </div>

        {/* Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="bg-purple-700 text-white px-3 py-1 rounded-md hover:bg-purple-600 transition-colors text-sm font-semibold w-full md:w-auto"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}