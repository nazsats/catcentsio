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
  const logoRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Handle referral code from URL
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const ref = queryParams.get('ref');
    setRefCode(ref);
    console.log('Ref code:', ref);
  }, []);

  // Redirect to dashboard if connected
  useEffect(() => {
    console.log('Checking redirect - Account:', account, 'Loading:', loading);
    if (account && !loading) {
      console.log('Redirecting to /dashboard');
      router.replace('/dashboard');
    }
  }, [account, loading, router]);

  // GSAP animations
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

    if (chars && chars.length && logoRef.current) {
      tl.from([chars, logoRef.current], {
        filter: 'blur(10px)',
        opacity: 0,
        duration: 0.5,
        ease: 'power1.inOut',
        stagger: 0.05,
      });
    }

    if (contentRef.current) {
      tl.to(
        contentRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power1.out',
        },
        '-=0.5'
      );
    }

    if (buttonRef.current) {
      tl.fromTo(
        buttonRef.current,
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: 'back.out(1.7)',
        },
        '-=0.5'
      );
    }

    if (navRef.current) {
      gsap.set(navRef.current, { opacity: 1, y: 0 });
    }
  }, [account, loading]);

  console.log('Rendering page - Loading:', loading, 'Account:', account);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />
      <Image
        src="/landing.jpg"
        alt="Landing Background"
        fill
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
        priority
      />
      <div className="absolute inset-0 bg-black/50 z-10"></div>

      <nav ref={navRef} className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-6 bg-transparent">
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="Catcentsio Logo"
            width={60}
            height={60}
            priority
            style={{ width: 'auto', height: 'auto' }}
          />
        </div>
        <div className="flex items-center space-x-4">
          <a href="https://x.com/CatCentsio/" target="_blank" rel="noopener noreferrer">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 23 23">
              <path d="M13.2492 9.43523L21.4392 0.124512H19.4985L12.3871 8.20887L6.70726 0.124512H0.15625L8.74527 12.3495L0.15625 22.1132H2.09713L9.60692 13.5759L15.6052 22.1132H22.1562L13.2488 9.43523H13.2492ZM10.5909 12.4572L9.72069 11.2399L2.79645 1.55343H5.77752L11.3655 9.3707L12.2357 10.588L19.4994 20.7493H16.5183L10.5909 12.4577V12.4572Z" />
            </svg>
          </a>
          <a
            href="https://discord.gg/TXPbt7ztMC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-purple-600 px-4 py-2 rounded-full text-sm font-semibold text-white hover:bg-purple-700 transition-all"
          >
            Join Discord
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </nav>

      <div className="relative z-20 flex min-h-screen items-center justify-center p-6">
        <div className="text-center max-w-lg w-full">
          {account ? (
            <div className="space-y-6">
              <p className="text-xl text-white">Connected: {account}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center bg-purple-600 px-8 py-4 rounded-full text-lg font-semibold text-white hover:bg-purple-700 transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {loading ? (
                <div className="flex items-center justify-center space-x-2 text-white mb-4">
                  <Loader size={32} />
                  <span>Connecting...</span>
                </div>
              ) : null}
              <div className="flex items-center justify-center space-x-4">
                <h1 ref={titleRef} className="text-5xl md:text-6xl font-bold text-white"></h1>
                <div ref={logoRef}>
                  <Image
                    src="/logo.png"
                    alt="Catcentsio Logo"
                    width={60}
                    height={60}
                    priority
                    style={{ width: 'auto', height: 'auto' }}
                  />
                </div>
              </div>

              <div ref={contentRef} className="space-y-6 opacity-0 translate-y-10">
                <p className="text-xl text-gray-200">
                  The playground where clicks turn into culture. Come for the games, stay for the grind.
                </p>
                {refCode && <p className="text-sm text-gray-400">Referred by: {refCode}</p>}
              </div>

              <div ref={buttonRef}>
                <button
                  onClick={() => open()}
                  className="inline-flex items-center bg-purple-600 px-8 py-4 rounded-full text-lg font-semibold text-white hover:bg-purple-700 transition-all"
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}