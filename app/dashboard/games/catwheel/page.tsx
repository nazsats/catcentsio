'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import Confetti from 'react-confetti';
import styles from './Maintenance.module.css'; // We'll create this CSS module

const Maintenance = () => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Optional: Show confetti on page load for a fun effect
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleNotifyMe = () => {
    toast.success('You will be notified when we are back online!', {
      style: {
        background: '#1a1a1a',
        color: '#fff',
        border: '1px solid #9333ea',
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white relative overflow-hidden">
      {/* Particle Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className={styles.particle}
            style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 4}s` }}
          />
        ))}
      </div>

      {/* Toaster for Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #9333ea',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            zIndex: 50,
          },
          success: {
            style: {
              borderLeft: '4px solid #4caf50',
            },
          },
          error: {
            style: {
              borderLeft: '4px solid #f44336',
            },
          },
          duration: 6000,
        }}
      />

      {/* Confetti Effect */}
      {showConfetti && (
        <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} />
      )}

      <main className="flex-1 p-4 sm:p-6 md:p-8 relative z-10 flex flex-col items-center justify-center">
        {/* Logo or Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="mb-8"
        >
          <Image
            src="/games/icons/catwheel-logo.png" // Replace with your logo or icon
            alt="CatWheel Logo"
            width={150}
            height={150}
            className="object-contain"
          />
        </motion.div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-4 text-center">
          Under Maintenance
        </h1>

        {/* Message */}
        <motion.div
          className="bg-gradient-to-r from-black/90 to-purple-900/90 rounded-xl p-6 border border-pink-500 shadow-md shadow-pink-500/20 mb-8 max-w-lg text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeInOut' }}
        >
          <p className="text-gray-300 text-base sm:text-lg mb-4">
            The Wheel of Meow Miles is getting a purr-fect upgrade! We will be back soon with even more exciting rewards.
          </p>
          <p className="text-gray-300 text-sm sm:text-base">
            <span className="font-semibold text-purple-400">Estimated Return:</span>{' '}
            <span className="text-cyan-400 font-bold">Soon™</span>
          </p>
        </motion.div>

        {/* Call-to-Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <motion.button
            onClick={handleNotifyMe}
            className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]"
            animate={{
              scale: [1, 1.03, 1],
              boxShadow: [
                '0 0 5px rgba(147,51,234,0.5)',
                '0 0 12px rgba(147,51,234,0.7)',
                '0 0 5px rgba(147,51,234,0.5)',
              ],
            }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            whileHover={{ scale: 1.08, boxShadow: '0 0 18px rgba(147,51,234,0.7)' }}
            whileTap={{ scale: 0.95 }}
            aria-label="Notify me when maintenance is complete"
          >
            Notify Me
          </motion.button>
          <motion.a
            href="https://discord.gg/TXPbt7ztMC" // Replace with your Discord link
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-500 hover:from-pink-500 hover:to-purple-400 shadow-[0_0_15px_rgba(236,72,153,0.5)]"
            animate={{
              scale: [1, 1.03, 1],
              boxShadow: [
                '0 0 5px rgba(236,72,153,0.5)',
                '0 0 12px rgba(236,72,153,0.7)',
                '0 0 5px rgba(236,72,153,0.5)',
              ],
            }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            whileHover={{ scale: 1.08, boxShadow: '0 0 18px rgba(236,72,153,0.7)' }}
            whileTap={{ scale: 0.95 }}
            aria-label="Join our Discord community"
          >
            Join Discord
          </motion.a>
        </div>
      </main>
    </div>
  );
};

export default Maintenance;

