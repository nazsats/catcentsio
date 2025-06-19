'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { Toaster } from 'react-hot-toast';
import Loader from '@/components/Loader';

export default function LandingPage() {
  const { address: account, isConnecting: loading } = useAccount();
  const { open } = useAppKit();
  const router = useRouter();
  const [refCode, setRefCode] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const usersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const ref = queryParams.get('ref');
    if (ref) {
      setRefCode(ref);
      sessionStorage.setItem('referralCode', ref);
      console.log('Referral code captured and stored:', ref);
    } else {
      console.log('No referral code found in URL');
    }
  }, []);

  useEffect(() => {
    console.log('Checking redirect - Account:', account, 'Loading:', loading);
    if (account && !loading) {
      console.log('Redirecting to /dashboard');
      router.replace('/dashboard');
    }
  }, [account, loading, router]);

  useEffect(() => {
    if (account || loading) {
      console.log('Account exists or loading, skipping animations');
      return;
    }
    console.log('Running animations - Loading:', loading);

    const titleElement = titleRef.current;
    if (titleElement) {
      const titleText = 'CATCENTS';
      titleElement.innerHTML = titleText
        .split('')
        .map((char) => `<span class="split-char">${char}</span>`)
        .join('');
    }

    const chars = titleElement?.querySelectorAll('.split-char');
    const tl = gsap.timeline({ delay: 0.5 });

    if (chars && chars.length) {
      tl.from(chars, {
        opacity: 0,
        scale: 0.5,
        duration: 0.8,
        ease: 'back.out(1.7)',
        stagger: 0.1,
      });
    }

    if (contentRef.current) {
      tl.fromTo(
        contentRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
        },
        '-=0.4'
      );
    }

    if (buttonRef.current) {
      tl.fromTo(
        buttonRef.current,
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.7,
          ease: 'elastic.out(1, 0.5)',
        },
        '-=0.4'
      );
    }

    if (usersRef.current) {
      tl.fromTo(
        usersRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'bounce.out',
        },
        '-=0.3'
      );
    }

    if (navRef.current) {
      gsap.fromTo(
        navRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.2 }
      );
    }
  }, [account, loading]);

  console.log('Rendering page - Loading:', loading, 'Account:', account, 'RefCode:', refCode);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e1f] bg-[radial-gradient(ellipse_at_center,#1e293b_0%,#0a0e1f_100%)]">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f9fafb', border: '1px solid #7b3fe4' } }} />

      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-gradient-to-r from-[#7b3fe4] to-[#39d7ff] opacity-10 blur-3xl rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        <svg className="absolute top-1/4 left-1/4 w-6 h-6 text-[#b79cff] opacity-30 animate-[float_5s_infinite]" viewBox="0 0 24 24" fill="url(#paw-gradient)">
          <path d="M12 20c-2.5 0-4.5-2-4.5-4.5 0-1.2.5-2.3 1.3-3.1.8-.8 1.9-1.3 3.2-1.3s2.4.5 3.2 1.3c.8.8 1.3 1.9 1.3 3.1 0 2.5-2 4.5-4.5 4.5zm-6-8c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm12 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6-6c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
        </svg>
        <svg className="absolute bottom-1/3 right-1/5 w-5 h-5 text-[#b79cff] opacity-20 animate-[float_6s_infinite]" viewBox="0 0 24 24" fill="url(#paw-gradient)">
          <path d="M12 20c-2.5 0-4.5-2-4.5-4.5 0-1.2.5-2.3 1.3-3.1.8-.8 1.9-1.3 3.2-1.3s2.4.5 3.2 1.3c.8.8 1.3 1.9 1.3 3.1 0 2.5-2 4.5-4.5 4.5zm-6-8c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm12 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6-6c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
        </svg>
        <defs>
          <linearGradient id="paw-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#7b3fe4' }} />
            <stop offset="100%" style={{ stopColor: '#b79cff' }} />
          </linearGradient>
        </defs>
      </div>

      {/* Header */}
      <nav ref={navRef} className="relative z-50 flex justify-between items-center p-6 bg-transparent">
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="Catcentsio Logo"
            width={50}
            height={50}
            priority
            className="w-auto h-auto transition-transform hover:scale-110"
          />
        </div>
        <div className="flex items-center space-x-3">
          <a
            href="https://x.com/CatCentsio/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-[#f9fafb] hover:from-[#6d28d9] hover:to-[#9ca3af] transition-all transform hover:scale-105 shadow-[0_0_10px_rgba(123,63,228,0.5)]"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="currentColor" viewBox="0 0 23 23">
              <path d="M13.2492 9.43523L21.4392 0.124512H19.4985L12.3871 8.20887L6.70726 0.124512H0.15625L8.74527 12.3495L0.15625 22.1132H2.09713L9.60692 13.5759L15.6052 22.1132H22.1562L13.2488 9.43523H13.2492ZM10.5909 12.4572L9.72069 11.2399L2.79645 1.55343H5.77752L11.3655 9.3707L12.2357 10.588L19.4994 20.7493H16.5183L10.5909 12.4577V12.4572Z" />
            </svg>
            Follow X
          </a>
          <a
            href="https://discord.gg/TXPbt7ztMC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-[#f9fafb] hover:from-[#6d28d9] hover:to-[#9ca3af] transition-all transform hover:scale-105 shadow-[0_0_10px_rgba(123,63,228,0.5)]"
          >
            Join Discord
            <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-6">
        <div className="text-center max-w-md w-full space-y-6">
          {account ? (
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#f9fafb] text-shadow-[0_2px_4px_rgba(123,63,228,0.3)]">
                Connected: {account}
              </h1>
              <div className="space-y-4 opacity-0 translate-y-10" ref={contentRef}>
                <div className="w-24 h-0.5 bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] mx-auto animate-[slideInLeft_0.5s_ease-out]"></div>
                <div className="p-4 bg-[rgba(30,41,59,0.5)] backdrop-blur-md border border-[rgba(123,63,228,0.2)] rounded-lg">
                  <p className="text-lg text-[#cbd5e1] font-light leading-relaxed">
                    Welcome to the playground where clicks turn into culture.
                  </p>
                </div>
                <div className="w-24 h-0.5 bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] mx-auto animate-[slideInRight_0.5s_ease-out]"></div>
              </div>
              <div ref={buttonRef} className="relative group">
                <svg className="absolute top-1/2 left-1/2 w-28 h-28 text-[#b79cff] opacity-10 transform -translate-x-1/2 -translate-y-1/2 animate-[pulse_3s_infinite]" viewBox="0 0 24 24" fill="url(#paw-gradient)">
                  <path d="M12 20c-2.5 0-4.5-2-4.5-4.5 0-1.2.5-2.3 1.3-3.1.8-.8 1.9-1.3 3.2-1.3s2.4.5 3.2 1.3c.8.8 1.3 1.9 1.3 3.1 0 2.5-2 4.5-4.5 4.5zm-6-8c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm12 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6-6c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
                </svg>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] px-6 py-3 sm:px-8 sm:py-4 rounded-full text-base sm:text-lg font-semibold text-[#f9fafb] hover:from-[#6d28d9] hover:to-[#9ca3af] transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(123,63,228,0.5)] animate-[pulseGlow_2s_infinite] group-hover:cursor-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTYgMjhDNS45NjIgMjggMiAyNC4wMzggMiAxNVM1Ljk2MiA0IDE2IDRjMTAuMDM4IDAgMTQgMy45NjIgMTQgMTVzLTMuOTYyIDE0LTE0IDE0eiIgZmlsbD0iIzc4MWZmZiIvPjxwYXRoIGQ9Ik0xNiAyMGMtMi4yIDAtNC0xLjgtNC00IDAtMS4xLjQtMi4xIDEuMi0yLjguNy0uNyAxLjctMS4yIDIuOC0xLjJzMi4xLjQgMi44IDEuMi44LjcgMS4yIDEuOCAwIDIuMi00IDR6bS02LTljMC0xLjEuOS0yIDItMnMyIC45IDIgMi0uOSAyLTIgMi0yLS45LTIgMnptMTIgMGMwLTEuMS45LTIgMi0yczItLjkgMiAyLS45IDItMiAyLTIgLjktMiAyem0tNi02YzAtMS4xLjktMiAyLTJzMiAuOSAyIDItLjkgMi0yIDItMi0uOS0yIDJ6bS02IDBjMC0xLjEuOS0yIDItMnMyIC45IDIgMi0uOSAyLTIgMi0yLS45LTIgMnoiIGZpbGw9IiM3YjNmZTQiLz48L3N2Zz4=')_16_16,auto]"
                >
                  Go to Dashboard
                </button>
              </div>
              <div ref={usersRef} className="space-y-2">
                <div className="inline-block px-4 py-2 bg-[rgba(30,41,59,0.5)] backdrop-blur-md border border-[rgba(57,215,255,0.2)] rounded-full text-[#cbd5e1] text-base font-medium">
                  50K+ Users Meownaded
                </div>
                <div className="inline-block px-4 py-2 bg-[rgba(30,41,59,0.5)] backdrop-blur-md border border-[rgba(57,215,255,0.2)] rounded-full text-[#cbd5e1] text-base font-medium">
                  1M+ Txns on Games
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center space-x-2 text-[#cbd5e1] mb-4">
                  <Loader size={32} />
                  <span>Connecting...</span>
                </div>
              ) : null}
              <h1
                ref={titleRef}
                className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-[#f9fafb] text-shadow-[0_2px_4px_rgba(123,63,228,0.3)]"
              ></h1>
              <div ref={contentRef} className="space-y-4 opacity-0 translate-y-10">
                <div className="w-24 h-0.5 bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] mx-auto animate-[slideInLeft_0.5s_ease-out]"></div>
                <div className="p-4 bg-[rgba(30,41,59,0.5)] backdrop-blur-md border border-[rgba(123,63,228,0.2)] rounded-lg">
                  <p className="text-lg text-[#cbd5e1] font-light leading-relaxed">
                    The playground where clicks turn into culture. Come for the games, stay for the grind.
                  </p>
                  {refCode && <p className="text-sm text-[#9ca3af] italic mt-2">Referred by: {refCode}</p>}
                </div>
                <div className="w-24 h-0.5 bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] mx-auto animate-[slideInRight_0.5s_ease-out]"></div>
              </div>
              <div ref={buttonRef} className="relative group">
                <svg className="absolute top-1/2 left-1/2 w-28 h-28 text-[#b79cff] opacity-10 transform -translate-x-1/2 -translate-y-1/2 animate-[pulse_3s_infinite]" viewBox="0 0 24 24" fill="url(#paw-gradient)">
                  <path d="M12 20c-2.5 0-4.5-2-4.5-4.5 0-1.2.5-2.3 1.3-3.1.8-.8 1.9-1.3 3.2-1.3s2.4.5 3.2 1.3c.8.8 1.3 1.9 1.3 3.1 0 2.5-2 4.5-4.5 4.5zm-6-8c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm12 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6-6c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
                </svg>
                <button
                  onClick={() => open()}
                  className="inline-flex items-center bg-gradient-to-r from-[#7b3fe4] to-[#b79cff] px-6 py-3 sm:px-8 sm:py-4 rounded-full text-base sm:text-lg font-semibold text-[#f9fafb] hover:from-[#6d28d9] hover:to-[#9ca3af] transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(123,63,228,0.5)] animate-[pulseGlow_2s_infinite] group-hover:cursor-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTYgMjhDNS45NjIgMjggMiAyNC4wMzggMiAxNVM1Ljk2MiA0IDE2IDRjMTAuMDM4IDAgMTQgMy45NjIgMTQgMTVzLTMuOTYyIDE0LTE0IDE0eiIgZmlsbD0iIzc4MWZmZiIvPjxwYXRoIGQ9Ik0xNiAyMGMtMi4yIDAtNC0xLjgtNC00IDAtMS4xLjQtMi4xIDEuMi0yLjguNy0uNyAxLjctMS4yIDIuOC0xLjJzMi4xLjQgMi44IDEuMi44LjcgMS4yIDEuOCAwIDIuMi00IDR6bS02LTljMC0xLjEuOS0yIDItMnMyIC45IDIgMi0uOSAyLTIgMi0yLS45LTIgMnptMTIgMGMwLTEuMS45LTIgMi0yczItLjkgMiAyLS45IDItMiAyLTIgLjktMiAyem0tNi02YzAtMS4xLjktMiAyLTJzMiAuOSAyIDItLjkgMi0yIDItMi0uOS0yIDJ6bS02IDBjMC0xLjEuOS0yIDItMnMyIC45IDIgMi0uOSAyLTIgMi0yLS45LTIgMnoiIGZpbGw9IiM3YjNmZTQiLz48L3N2Zz4=')_16_16,auto]"
                >
                  Connect Wallet
                </button>
              </div>
              <div ref={usersRef} className="space-y-2">
                <div className="inline-block px-4 py-2 bg-[rgba(30,41,59,0.5)] backdrop-blur-md border border-[rgba(57,215,255,0.2)] rounded-full text-[#cbd5e1] text-base font-medium">
                  50K+ Users Meownaded
                </div>
                <div className="inline-block px-4 py-2 bg-[rgba(30,41,59,0.5)] backdrop-blur-md border border-[rgba(57,215,255,0.2)] rounded-full text-[#cbd5e1] text-base font-medium">
                  1M+ Txns on Games
                </div>
              </div>
            </div>
          )}
        </div>
      </div>



      

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 15px rgba(123, 63, 228, 0.5);
          }
          50% {
            box-shadow: 0 0 25px rgba(123, 63, 228, 0.8);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-10px);
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}