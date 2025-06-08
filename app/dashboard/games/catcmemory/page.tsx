'use client';

import React, { useState, useEffect, useRef } from 'react';
import Profile from '@/components/Profile';
import { useAccount, useDisconnect } from 'wagmi';
import { Toaster, toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment } from 'firebase/firestore';

// Constants
const ROWS = 8;
const COLUMNS = 9;
const BASE_SCORES = [10, 20, 50, 100, 200, 100, 50, 20, 10];
const DROP_INTERVAL = 150; // ms per row

export default function WhiskerSnatchDropPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // Shuffle bins each round
  const shuffleBins = () => BASE_SCORES.sort(() => Math.random() - 0.5);

  const [binScores, setBinScores] = useState<number[]>(shuffleBins());
  const [selectedBins, setSelectedBins] = useState<Set<number>>(new Set());
  const [dropCol, setDropCol] = useState(Math.floor(COLUMNS / 2));
  const [col, setCol] = useState<number | null>(null);
  const [row, setRow] = useState(0);
  const [falling, setFalling] = useState(false);
  const dropTimer = useRef<NodeJS.Timeout | null>(null);

  // Place a bet on a bin
  const toggleBin = (i: number) => {
    if (falling) return;
    setSelectedBins(sb => {
      const next = new Set(sb);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // Start drop
  const startDrop = () => {
    if (falling || selectedBins.size === 0) {
      toast.error('Select at least one bin to bet');
      return;
    }
    setBinScores(shuffleBins());
    setCol(dropCol);
    setRow(0);
    setFalling(true);
  };

  // Animate
  useEffect(() => {
    if (falling && col !== null) {
      dropTimer.current = setInterval(() => {
        setRow(r => {
          if (r >= ROWS) {
            finalizeDrop(col);
            if (dropTimer.current) clearInterval(dropTimer.current);
            return r;
          }
          return r + 1;
        });
      }, DROP_INTERVAL);
    }
    return () => { if (dropTimer.current) clearInterval(dropTimer.current); };
  }, [falling, col]);

  // Finalize result
  const finalizeDrop = (finalCol: number) => {
    setFalling(false);
    const score = binScores[finalCol];
    const hitBet = selectedBins.has(finalCol);
    const payout = hitBet ? score * 5 : 0; // 5x if correct
    toast(
      hitBet
        ? `🎉 You won ${payout} MeowMiles! 🎉`
        : `😿 You lost. Bin was ${score}`
    );
    if (address && hitBet) {
      const ref = doc(db, 'users', address);
      runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error();
        tx.update(ref, { gamesGmeow: increment(payout), updatedAt: new Date().toISOString() });
      }).catch(() => toast.error('Award failed'));
    }
    // Reset bets
    setSelectedBins(new Set());
  };

  if (!isConnected) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
      <button onClick={() => toast.error('Connect wallet')} className="px-6 py-3 bg-purple-600 rounded-lg">
        Connect Wallet
      </button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Toaster position="top-right" />
      <header className="flex items-center justify-between p-6">
        <h2 className="text-3xl font-bold text-purple-300">Whisker-Snatch Drop</h2>
        <Profile account={address} onCopyAddress={() => navigator.clipboard.writeText(address!)} onDisconnect={disconnect} />
      </header>

      <main className="flex-1 p-6 flex flex-col items-center md:flex-row md:justify-center gap-8">
        {/* Game Board */}
        <div className="relative w-80 h-96 bg-gray-900 rounded-xl shadow-lg overflow-hidden">
          {/* Pegs */}
          {[...Array(ROWS)].map((_, r) => (
            [...Array(COLUMNS - 1)].map((__, c) => (
              <div
                key={`${r}-${c}`}
                className="absolute w-2 h-2 bg-purple-500 rounded-full"
                style={{ top: `${((r + 1) / (ROWS + 2)) * 100}%`, left: `${((c + 0.5) / COLUMNS) * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))
          ))}
          {/* Bins at bottom */}
          <div className="absolute bottom-0 flex w-full">
            {binScores.map((s, i) => (
              <div key={i} className="flex-1 h-12 border-t-2 border-purple-700 flex items-end justify-center pb-1 text-sm text-gray-200">
                {s}
              </div>
            ))}
          </div>
          {/* Token */}
          {!falling && (
            <div className="absolute top-6 left-0 right-0 flex justify-center">
              <div
                className="w-10 h-10 bg-pink-500 rounded-full"
                style={{ left: `calc(${(dropCol / (COLUMNS - 1)) * 100}% - 1.25rem)` }}
              />
            </div>
          )}
          {/* Falling Token */}
          {falling && col !== null && (
            <div
              className="absolute w-10 h-10 bg-pink-500 rounded-full"
              style={{
                left: `calc(${(col / (COLUMNS - 1)) * 100}% - 1.25rem)`,
                top: `calc(${(row / (ROWS + 1)) * 100}% - 1.25rem)`,
                transition: `top ${DROP_INTERVAL}ms linear`,
              }}
            />
          )}
        </div>

        {/* Controls */}
        <div className="w-80 flex flex-col items-center">
          <p className="mb-2 text-gray-300">Choose your bins to bet (5x payout)</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {binScores.map((s, i) => (
              <button
                key={i}
                onClick={() => toggleBin(i)}
                disabled={falling}
                className={`px-2 py-1 rounded-lg border text-xs transition-colors ${
                  selectedBins.has(i)
                    ? 'bg-cyan-500 border-cyan-400 text-black'
                    : 'bg-gray-800 border-purple-700 text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mb-2 text-gray-300">Select Launch Column</p>
          <input
            type="range"
            min={0}
            max={COLUMNS - 1}
            value={dropCol}
            onChange={e => setDropCol(Number(e.target.value))}
            disabled={falling}
            className="w-full mb-4"
          />
          <button
            onClick={startDrop}
            disabled={falling}
            className="px-6 py-2 bg-green-500 hover:bg-green-400 rounded-full font-semibold transition"
          >
            {falling ? 'Dropping...' : 'Drop Token'}
          </button>
        </div>
      </main>
    </div>
  );
}
