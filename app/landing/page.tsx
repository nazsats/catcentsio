'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useRef } from 'react';

// Image paths (moved to landing/ folder, hero and CTA use videos)
const images = [
  '/landing/cat1.png', // Feature 1 cat
  '/landing/cat2.png', // Feature 2 cat
  '/landing/cat3.png', // Feature 3 cat
  '/landing/cat4.png', // Not used (CTA background is now video)
  '/landing/cat5.png', // CTA mascot
];

// Social media links
const socials = [
  { icon: '/x.png', url: 'https://x.com/CatCentsio/', alt: 'X' },
  { icon: '/discord.png', url: 'https://discord.com/invite/TXPbt7ztMC', alt: 'Discord' },
  { icon: '/telegram.png', url: 'https://t.me/catcentsio', alt: 'Telegram' },
];

// Letter-by-letter animation for title
const title = 'Catcents'.split('');

export default function LandingPage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });

  // Parallax and animation effects
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -150]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 1.3]);
  const featureOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.6, 0.9], [100, 0]);

  return (
    <div ref={ref} className="bg-black text-white overflow-hidden font-mono">
      {/* Hero Section */}
      <motion.section
        style={{ y: heroY, scale: heroScale }}
        className="relative h-screen flex items-center justify-center z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 to-black" />
        <video
          src="/landing/hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-20 text-center space-y-8">
          <motion.h1
            className="text-6xl md:text-8xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent relative title-glow"
            style={{
              textShadow:
                '0 0 20px rgba(168, 85, 247, 0.9), 0 0 40px rgba(168, 85, 247, 0.6), 0 0 60px rgba(168, 85, 247, 0.4)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          >
            {title.map((letter, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 60, rotate: -10 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                style={{
                  display: 'inline-block',
                  textShadow: 'inherit',
                }}
              >
                {letter}
              </motion.span>
            ))}
          </motion.h1>
          <motion.div
            animate={{ textShadow: ['0 0 20px rgba(168, 85, 247, 0.9)', '0 0 30px rgba(168, 85, 247, 0.7)', '0 0 20px rgba(168, 85, 247, 0.9)'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.p
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="text-lg md:text-xl text-gray-200 px-4"
            >
              Meow-powered DeFi on{' '}
              <span className="text-purple-400 underline decoration-wavy">Monad Blockchain</span>
            </motion.p>
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.15, boxShadow: '0 0 25px rgba(168, 85, 247, 0.7)' }}
            whileTap={{ scale: 0.9 }}
            className="mt-6 px-8 py-3 bg-purple-700 rounded-lg text-lg font-semibold border-2 border-purple-400 hover:bg-purple-800 transition-all"
          >
            Join the Meow-volution
          </motion.button>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        style={{ opacity: featureOpacity }}
        className="py-20 px-4 md:px-8 z-10"
      >
        <h2 className="text-3xl md:text-5xl font-bold text-center text-purple-300 mb-12">
          Why Catcents?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <motion.div
            initial={{ opacity: 0, x: -120 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="relative bg-purple-900/30 p-6 rounded-xl bg-opacity-30 backdrop-blur-lg border border-purple-500/50 hover:border-purple-500"
          >
            <Image
              src={images[0]}
              alt="Fast Transactions"
              width={280}
              height={280}
              className="rounded-lg mb-4 object-cover"
            />
            <h3 className="text-lg font-semibold text-purple-200">Blazing Fast Meows</h3>
            <p className="text-gray-300 text-sm">
              Transactions on Monad are quicker than a cat chasing a laser pointer.
            </p>
            <motion.div
              className="absolute -top-3 -right-3 w-10 h-10 bg-purple-600 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            initial={{ opacity: 0, x: 120 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative bg-purple-900/30 p-6 rounded-xl bg-opacity-30 backdrop-blur-lg border border-purple-500/50 hover:border-purple-500"
          >
            <Image
              src={images[1]}
              alt="Secure Vaults"
              width={280}
              height={280}
              className="rounded-lg mb-4 object-cover"
            />
            <h3 className="text-lg font-semibold text-purple-200">Secure Cat Vaults</h3>
            <p className="text-gray-300 text-sm">
              Your assets are safer than a kitten in a quantum-encrypted blanket.
            </p>
            <motion.div
              className="absolute -top-3 -right-3 w-10 h-10 bg-purple-600 rounded-full"
              animate={{ scale: [1, 1.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            initial={{ opacity: 0, y: 120 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative bg-purple-900/30 p-6 rounded-xl bg-opacity-30 backdrop-blur-lg border border-purple-500/50 hover:border-purple-500"
          >
            <Image
              src={images[2]}
              alt="Decentralized Paws"
              width={280}
              height={280}
              className="rounded-lg mb-4 object-cover"
            />
            <h3 className="text-lg font-semibold text-purple-200">Decentralized Paws</h3>
            <p className="text-gray-300 text-sm">
              Full control, no middleman—just you and the blockchain.
            </p>
            <motion.div
              className="absolute -top-3 -right-3 w-10 h-10 bg-purple-600 rounded-full"
              animate={{ y: [-10, 10] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        style={{ y: ctaY }}
        className="relative min-h-[70vh] flex items-center justify-center z-20 py-12"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900 to-black" />
        <video
          src="/landing/cta.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-15"
        />
        <div className="relative text-center space-y-6 z-30">
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="flex justify-center mb-4"
          >
            <Image
              src={images[4]}
              alt="Catcents Mascot"
              width={180}
              height={180}
              className="rounded-full border-4 border-purple-400"
            />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="text-3xl md:text-5xl font-bold text-purple-300"
          >
            Ready to Meow?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="text-base text-gray-200 px-4"
          >
            Join Catcents and unleash the power of Monad blockchain.
          </motion.p>
          <motion.button
            whileHover={{ scale: 1.15, rotate: 5, boxShadow: '0 0 25px rgba(168, 85, 247, 0.8)' }}
            whileTap={{ scale: 0.9 }}
            className="px-10 py-4 bg-purple-700 rounded-lg text-lg font-semibold border-2 border-purple-400 hover:bg-purple-800 transition-all"
          >
            Start Purring Now
          </motion.button>
        </div>
      </motion.section>

      {/* Footer with Social Icons */}
      <footer className="py-10 text-center text-gray-400 bg-purple-900/20 z-10">
        <div className="flex justify-center space-x-6 mb-4">
          {socials.map((social) => (
            <motion.a
              key={social.url}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.2, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
            >
              <Image
                src={social.icon}
                alt={social.alt}
                width={36}
                height={36}
                className="hover:brightness-125"
              />
            </motion.a>
          ))}
        </div>
        <p>© 2025 Catcents. All rights reserved. Meow.</p>
      </footer>
    </div>
  );
}