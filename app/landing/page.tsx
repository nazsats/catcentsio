'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useRef, useEffect } from 'react';

// Image paths
const images = [
  '/landing/cat1.png', // Feature 1 cat
  '/landing/cat2.png', // Feature 2 cat
  '/landing/cat3.png', // Feature 3 cat
  '/landing/cat4.png', // Feature 4 cat
  '/landing/cat5.png', // CTA mascot
];

// Social media links
const socials = [
  { icon: '/x.png', url: 'https://x.com/CatCentsio/', alt: 'X' },
  { icon: '/discord.png', url: 'https://discord.com/invite/TXPbt7ztMC', alt: 'Discord' },
  { icon: '/telegram.png', url: 'https://t.me/catcentsio', alt: 'Telegram' },
];

export default function LandingPage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });

  // Simplified parallax for Hero
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -50]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

  // Simplified parallax for CTA
  const ctaY = useTransform(scrollYProgress, [0.6, 0.9], [50, 0]);

  // Smooth scroll polyfill
  useEffect(() => {
    const smoothScroll = (target: number, duration: number) => {
      const start = window.pageYOffset;
      const distance = target - start;
      let startTime: number | null = null;

      const animation = (currentTime: number) => {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const ease = progress * (2 - progress); // Ease-in-out
        window.scrollTo(0, start + distance * ease);
        if (timeElapsed < duration) requestAnimationFrame(animation);
      };

      requestAnimationFrame(animation);
    };

    const links = document.querySelectorAll('a[href^="#"], button[data-scroll]');
    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href')?.slice(1) || link.getAttribute('data-scroll');
        const targetElement = document.getElementById(targetId || '');
        if (targetElement) {
          const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
          smoothScroll(targetPosition, 800);
        }
      });
    });

    return () => {
      links.forEach((link) => {
        link.removeEventListener('click', () => {});
      });
    };
  }, []);

  return (
    <div ref={ref} className="bg-black text-white overflow-hidden font-mono relative">
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-purple-950 to-purple-900 opacity-80 z-0" />
      <div className="fixed inset-0 particle-bg z-0" />

      {/* Hero Section */}
      <motion.section
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative min-h-screen flex items-center justify-center z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-black/50 to-purple-800/50 z-0" />
        <video
          src="/landing/hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="relative z-20 text-center space-y-8 px-4 max-w-4xl">
          {/* Title (No letter-by-letter animation) */}
          <motion.h1
            className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-purple-300 via-magenta-400 to-blue-400 bg-clip-text text-transparent title-glow"
            style={{
              textShadow:
                '0 0 40px rgba(168, 85, 247, 0.9), 0 0 60px rgba(236, 72, 153, 0.7), 0 0 80px rgba(59, 130, 246, 0.5)',
            }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            whileHover={{
              scale: 1.03,
              textShadow:
                '0 0 50px rgba(168, 85, 247, 1), 0 0 70px rgba(236, 72, 153, 0.9), 0 0 90px rgba(59, 130, 246, 0.7)',
            }}
          >
            Where Degens Play, <br /> Earn, and Decide the Future
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto"
          >
            Catcents is your onchain playground—bridging fun, strategy, and community power. From addictive games to DAO voting, daily rewards, and badge hunts—everything you do here shapes your journey (and flexes your grind).
          </motion.p>

          {/* Button */}
          <motion.button
            whileHover={{
              scale: 1.1,
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.8), 0 0 50px rgba(236, 72, 153, 0.6)',
              background: 'linear-gradient(45deg, #a855f7, #ec4899, #3b82f6)',
            }}
            whileTap={{ scale: 0.95 }}
            className="mt-8 px-10 py-4 bg-gradient-to-r from-purple-600 to-magenta-600 rounded-xl text-lg font-semibold border-2 border-purple-400 hover:border-magenta-400 transition-all"
            data-scroll="features"
          >
            Join the Meow-volution
          </motion.button>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        id="features"
        className="py-24 px-6 md:px-12 z-20 bg-gradient-to-b from-purple-950 via-black to-purple-900"
      >
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-bold text-center bg-gradient-to-r from-purple-300 to-magenta-400 bg-clip-text text-transparent mb-16"
        >
          Why Catcents?
        </motion.h2>
        <div className="flex flex-col items-center space-y-8">
          {[
            {
              title: 'Blazing Fast Meows',
              desc: 'Transactions on Monad are quicker than a cat chasing a laser pointer.',
              img: images[0],
              align: 'start',
            },
            {
              title: 'Secure Cat Vaults',
              desc: 'Your assets are safer than a kitten in a quantum-encrypted blanket.',
              img: images[1],
              align: 'end',
            },
            {
              title: 'Decentralized Paws',
              desc: 'Full control, no middleman—just you and the blockchain.',
              img: images[2],
              align: 'start',
            },
            {
              title: 'Community-Driven Meows',
              desc: 'Shape the future with DAO voting and community-led initiatives.',
              img: images[3],
              align: 'end',
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 80, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.1 }}
              className={`flex items-center bg-gradient-to-r from-purple-700 via-magenta-600 to-blue-600 p-8 rounded-2xl backdrop-blur-xl border border-purple-400/50 hover:border-magenta-400 max-w-2xl w-full shadow-lg hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] mx-4 md:mx-8 ${
                feature.align === 'start' ? 'self-start' : 'self-end'
              }`}
            >
              <div className="flex-1">
                <h3 className="text-3xl font-semibold bg-gradient-to-r from-purple-200 to-magenta-300 bg-clip-text text-transparent mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-200 text-lg">{feature.desc}</p>
              </div>
              <Image
                src={feature.img}
                alt={feature.title}
                width={140}
                height={140}
                className="rounded-xl object-cover ml-8 border-2 border-purple-400/50"
              />
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        style={{ y: ctaY }}
        className="relative min-h-[70vh] flex items-center justify-center z-20 py-16"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-purple-950 via-black to-purple-900" />
        <video
          src="/landing/cta.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative text-center space-y-8 z-30 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex justify-center mb-6"
          >
            <Image
              src={images[4]}
              alt="Catcents Mascot"
              width={220}
              height={220}
              className="rounded-full border-4 border-magenta-400 shadow-[0_0_30px_rgba(236,72,153,0.5)]"
            />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-300 to-blue-400 bg-clip-text text-transparent"
          >
            Ready to Meow?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg text-gray-200 max-w-lg mx-auto"
          >
            Join Catcents and unleash the power of Monad blockchain.
          </motion.p>
          <motion.button
            whileHover={{
              scale: 1.1,
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.8), 0 0 50px rgba(59, 130, 246, 0.6)',
              background: 'linear-gradient(45deg, #a855f7, #ec4899, #3b82f6)',
            }}
            whileTap={{ scale: 0.95 }}
            className="px-12 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-lg font-semibold border-2 border-purple-400 hover:border-blue-400 transition-all"
          >
            Start Purring Now
          </motion.button>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-16 text-center bg-gradient-to-t from-purple-950 to-black z-20 relative">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex justify-center space-x-10 mb-8"
        >
          {socials.map((social) => (
            <motion.a
              key={social.url}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{
                scale: 1.4,
                rotate: 10,
                filter: 'brightness(1.6)',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.7)',
              }}
              whileTap={{ scale: 0.9 }}
            >
              <Image
                src={social.icon}
                alt={social.alt}
                width={48}
                height={48}
                className="rounded-md hover:drop-shadow-[0_0_20px_rgba(236,72,153,0.7)]"
              />
            </motion.a>
          ))}
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg text-gray-200"
        >
          © 2025 Catcents. All rights reserved. Meow.
        </motion.p>
      </footer>
    </div>
  );
}