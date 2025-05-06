'use client';

import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import Profile from '../../../../components/Profile';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';
import Confetti from 'react-confetti';
import styles from './Catslots.module.css';

const SYMBOLS = ['/cats/cat1.png', '/cats/cat2.png', '/cats/cat3.png', '/cats/wild.png', '/cats/fish.png', '/cats/star.png'];
const WILD_SYMBOL = '/cats/wild.png';
const REEL_SIZE = 3;
const SPIN_DURATION = 2600; // Covers staggered stop (third reel at 2.6s)
const MODAL_DELAY = 3000; // 3 seconds after animation ends for confetti
const INITIAL_BET = 0.001;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CASLOTS_CONTRACT_ADDRESS || '0xd9145CCE52D386f254917e481eB44e9943F39138';
const contractAbi = [
  { type: 'function', name: 'placeBet', inputs: [], outputs: [], stateMutability: 'payable' },
  { type: 'event', name: 'BetPlaced', inputs: [{ name: 'player', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }, { name: 'timestamp', type: 'uint256', indexed: false }] },
];

interface Reel {
  symbols: string[];
  offset: number;
}

interface WinInfo {
  points: number;
  type: string;
}

export default function CatSlots() {
  const { address, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { data: balanceData } = useBalance({ address, chainId: monadTestnet.id });
  const [reels, setReels] = useState<Reel[]>([]);
  const [gameStatus, setGameStatus] = useState<'idle' | 'spinning' | 'won' | 'lost'>('idle');
  const [points, setPoints] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [highlightWin, setHighlightWin] = useState<WinInfo | null>(null);
  const router = useRouter();

  const initializeReels = useCallback(() => {
    const newReels = Array(REEL_SIZE)
      .fill(null)
      .map(() => ({
        symbols: Array(50)
          .fill(null)
          .map(() => {
            const rand = Math.random();
            return rand < 0.05
              ? WILD_SYMBOL
              : SYMBOLS[Math.floor(Math.random() * (SYMBOLS.length - 1))];
          }),
        offset: 0,
      }));
    setReels(newReels);
  }, []);

  useEffect(() => {
    if (isConnecting) return;
    if (!address) return router.push('/');
    initializeReels();
    (async () => {
      try {
        const userRef = doc(db, 'users', address);
        const userDoc = await getDoc(userRef);
        setBestScore(userDoc.exists() ? userDoc.data().catslotsBestScore || 0 : 0);
      } catch {
        toast.error('Failed to load game stats.');
      }
    })();
  }, [address, isConnecting, router, initializeReels]);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  const playSound = (type: 'spin' | 'win') =>
    new Audio(`/sounds/${type}.mp3`).play().catch((err) => console.error('Audio failed:', err));

  const cashOut = async (currentPoints: number) => {
    if (!address || demoMode) return;
    const pendingToast = toast.loading('Cashing out...');
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', address);
        const userDoc = await transaction.get(userRef);
        const data = userDoc.data() || {};
        const newScore = Math.max(data.catslotsBestScore || 0, currentPoints);
        transaction.set(
          userRef,
          { catslotsBestScore: newScore, gamesGmeow: increment(currentPoints), updatedAt: new Date().toISOString() },
          { merge: true }
        );
      });
      setBestScore(currentPoints);
      toast.dismiss(pendingToast);
      toast.success(`Cashed out ${currentPoints} Meow Miles!`);
    } catch {
      toast.dismiss(pendingToast);
      toast.error('Failed to cash out.');
    }
  };

  const getWinningCells = (winType: string): string[] => {
    switch (winType) {
      case 'Top Straight':
        return ['0-0', '1-0', '2-0'];
      case 'Middle Straight':
        return ['0-1', '1-1', '2-1'];
      case 'Bottom Straight':
        return ['0-2', '1-2', '2-2'];
      case 'Cross (Left Down to Right Up)':
        return ['0-2', '1-1', '2-0'];
      case 'Cross (Right Down to Left Up)':
        return ['2-2', '1-1', '0-0'];
      case 'Top Straight (Wild)':
        return ['0-0', '1-0', '2-0'];
      case 'Middle Straight (Wild)':
        return ['0-1', '1-1', '2-1'];
      case 'Bottom Straight (Wild)':
        return ['0-2', '1-2', '2-2'];
      default:
        return [];
    }
  };

  const checkPaylineWin = useCallback(
    (symbols: string[], lineName: string): WinInfo | null => {
      const isWildLine = symbols.every((s) => s === WILD_SYMBOL);
      if (isWildLine) {
        return lineName.includes('Straight') ? { points: 500, type: `${lineName} (Wild)` } : null;
      }

      const nonWildSymbol = symbols.find((s) => s !== WILD_SYMBOL);
      if (!nonWildSymbol) return null;

      const isWin = symbols.every((s) => s === nonWildSymbol || s === WILD_SYMBOL);
      if (isWin) {
        const points = lineName.includes('Straight') ? 100 : 50;
        return { points, type: lineName };
      }
      return null;
    },
    []
  );

  const generateRandomReel = () =>
    Array(50)
      .fill(null)
      .map(() => {
        const rand = Math.random();
        return rand < 0.05
          ? WILD_SYMBOL
          : SYMBOLS[Math.floor(Math.random() * (SYMBOLS.length - 1))];
      });

  const spinReels = useCallback(() => {
    if (gameStatus === 'spinning') return;
    setGameStatus('spinning');
    setShowConfetti(false);
    setPoints(0);
    setHighlightWin(null);
    playSound('spin');

    // During animation, show temporary random symbols
    const tempReels = Array(REEL_SIZE)
      .fill(null)
      .map(() => ({
        symbols: generateRandomReel(),
        offset: Math.floor(Math.random() * 10) + 10,
      }));
    setReels(tempReels);

    setTimeout(() => {
      // At animation end, generate final symbols
      const finalReels = Array(REEL_SIZE)
        .fill(null)
        .map(() => ({
          symbols: generateRandomReel(),
          offset: 0, // Reset offset for final position
        }));
      setReels(finalReels);

      const grid = finalReels.map((reel) => [
        reel.symbols[0],
        reel.symbols[1],
        reel.symbols[2],
      ]);

      const paylines = [
        { symbols: [grid[0][0], grid[1][0], grid[2][0]], name: 'Top Straight' },
        { symbols: [grid[0][1], grid[1][1], grid[2][1]], name: 'Middle Straight' },
        { symbols: [grid[0][2], grid[1][2], grid[2][2]], name: 'Bottom Straight' },
        {
          symbols: [grid[0][2], grid[1][1], grid[2][0]],
          name: 'Cross (Left Down to Right Up)',
        },
        {
          symbols: [grid[2][2], grid[1][1], grid[0][0]],
          name: 'Cross (Right Down to Left Up)',
        },
      ];

      let highestWin: WinInfo | null = null;
      for (const payline of paylines) {
        const win = checkPaylineWin(payline.symbols, payline.name);
        if (win && (!highestWin || win.points > highestWin.points)) {
          highestWin = win;
        }
      }

      // Apply highlight immediately after animation ends
      setHighlightWin(highestWin);

      // Trigger confetti and final status 3 seconds after animation ends
      setTimeout(() => {
        setPoints(highestWin?.points || 0);
        setGameStatus(highestWin ? 'won' : 'lost');
        if (highestWin && !demoMode) {
          setShowConfetti(true);
          playSound('win');
          cashOut(highestWin.points);
        } else if (!highestWin) {
          toast.error('No win this time!');
        }
      }, MODAL_DELAY);
    }, SPIN_DURATION);
  }, [reels, gameStatus, demoMode, cashOut, checkPaylineWin]);

  const placeBet = async () => {
    if (!address) return toast.error('Please connect your wallet');
    const pendingToast = toast.loading('Placing bet...');
    try {
      await switchChain({ chainId: monadTestnet.id });
      if (!balanceData || balanceData.value < BigInt(INITIAL_BET * 1e18))
        throw new Error('Insufficient MON balance.');
      writeContract(
        {
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: contractAbi,
          functionName: 'placeBet',
          value: BigInt(INITIAL_BET * 1e18),
        },
        {
          onSuccess: async (txHash) => {
            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Bet placed!{' '}
                <a
                  href={`https://testnet.monadscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-cyan-400"
                >
                  View on MonadScan
                </a>
              </div>,
              { duration: 5000 }
            );
            setGameStarted(true);
            setDemoMode(false);
            spinReels();
          },
          onError: (error) => {
            throw error;
          },
        }
      );
    } catch (error: any) {
      toast.dismiss(pendingToast);
      const reason = error.reason || error.message || 'Unknown error';
      if (reason.includes('insufficient funds') || reason.includes('Insufficient MON balance')) {
        toast.error(
          <div>
            Insufficient MON balance.{' '}
            <a
              href="https://faucet.monad.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-cyan-400"
            >
              Claim MON tokens
            </a>
          </div>,
          { duration: 5000 }
        );
      } else if (reason.includes('revert')) {
        toast.error('Bet failed: Transaction reverted.', { duration: 5000 });
      } else {
        toast.error(`Bet failed: ${reason}`, { duration: 5000 });
      }
    }
  };

  const startDemoGame = () => {
    setGameStarted(true);
    setDemoMode(true);
    spinReels();
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => toast.success('Address copied!'));
    }
  };

  const memoizedReels = useMemo(() => reels, [reels]);

  if (isConnecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white text-lg text-cyan-400">
        Connecting...
      </div>
    );
  }

  if (!address) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className={styles.particle}
            style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 4}s` }}
          />
        ))}
        {gameStatus === 'spinning' &&
          [...Array(10)].map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className={styles.sparkle}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1}s`,
              }}
            />
          ))}
      </div>

      <main className="flex-1 p-4 md:p-8 relative z-10">
        <Toaster
          position="top-right"
          toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }}
        />
        {showConfetti && (
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} />
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            Cat Slots
          </h1>
          <Profile account={address} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
        </div>

        <motion.div
          className="bg-gradient-to-r from-black/90 to-purple-900/90 rounded-xl p-6 border border-pink-500 shadow-md shadow-pink-500/20 mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-lg md:text-xl font-semibold text-purple-400 mb-4">Game Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <p className="text-gray-300">
              Spin Points:{' '}
              <motion.span
                className="text-cyan-400 font-bold"
                key={points}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {points}
              </motion.span>
            </p>
            <p className="text-gray-300">
              Best Score:{' '}
              <motion.span
                className="text-cyan-400 font-bold"
                key={bestScore}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {bestScore}
              </motion.span>
            </p>
            <p className="text-gray-300">
              Mode: <span className="text-cyan-400 font-bold">{demoMode ? 'Demo' : 'Real'}</span>
            </p>
          </div>
          <p className="text-center mt-4 text-lg font-semibold text-purple-400">
            Status:{' '}
            {gameStatus === 'idle'
              ? 'Ready to Spin'
              : gameStatus === 'spinning'
              ? 'Spinning...'
              : gameStatus === 'won'
              ? 'You Won!'
              : 'Try Again!'}
          </p>
        </motion.div>

        <div className="flex justify-center mb-6 relative">
          <motion.div
            className="bg-gray-900/80 rounded-xl p-8 border border-purple-900 w-full max-w-[800px] min-h-[450px] mx-auto overflow-hidden"
            style={{ boxSizing: 'border-box' }}
            animate={
              gameStatus === 'won'
                ? { scale: [1, 1.05, 1], transition: { duration: 0.5, repeat: 2 } }
                : {}
            }
          >
            <div
              className="grid grid-cols-3 gap-6 relative"
              style={{ gridTemplateColumns: 'repeat(3, 120px)', justifyContent: 'center', alignItems: 'center' }}
            >
              {memoizedReels.map((reel, reelIndex) => (
                <div key={reelIndex} className={styles.reelContainer} style={{ width: '120px', height: '360px' }}>
                  <motion.div
                    animate={
                      gameStatus === 'spinning'
                        ? { y: [0, -720, 0] }
                        : { y: (reel.offset % 3) * 120 }
                    }
                    transition={{
                      duration: gameStatus === 'spinning' ? 0.2 : SPIN_DURATION / 1000,
                      ease: gameStatus === 'spinning' ? 'linear' : 'easeOut',
                      repeat: gameStatus === 'spinning' ? Infinity : 0,
                      delay: gameStatus === 'spinning' ? reelIndex * 0.05 : reelIndex * 0.3,
                    }}
                    className="flex flex-col gap-6"
                    style={{ paddingTop: '6px', paddingBottom: '6px' }}
                  >
                    {reel.symbols.slice(0, 3).map((symbol, index) => (
                      <div
                        key={`${reelIndex}-${index}`}
                        className={`flex items-center justify-center w-[120px] h-[120px] border border-purple-900/50 rounded-lg box-border ${
                          highlightWin && getWinningCells(highlightWin.type).includes(`${reelIndex}-${index}`)
                            ? 'bg-gradient-to-r from-cyan-500 to-pink-500 animate-pulse border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]'
                            : 'bg-gray-800/80'
                        }`}
                      >
                        <motion.div>
                          <Image
                            src={symbol}
                            alt={`Slot symbol ${symbol.split('/').pop()?.replace('.png', '')}`}
                            width={60}
                            height={60}
                            style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                            onError={(e) => (e.currentTarget.src = '/cats/fallback.png')}
                          />
                        </motion.div>
                      </div>
                    ))}
                  </motion.div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {!gameStarted ? (
            <>
              <motion.button
                onClick={placeBet}
                disabled={isPending || !address || gameStatus === 'spinning'}
                className={`px-6 py-3 rounded-lg text-base font-semibold text-white ${
                  isPending || !address || gameStatus === 'spinning'
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                }`}
                animate={
                  gameStatus === 'spinning'
                    ? { rotate: 360, transition: { duration: 1, repeat: Infinity, ease: 'linear' } }
                    : {
                        scale: [1, 1.05, 1],
                        boxShadow: [
                          '0 0 5px rgba(147,51,234,0.5)',
                          '0 0 15px rgba(147,51,234,0.7)',
                          '0 0 5px rgba(147,51,234,0.5)',
                        ],
                      }
                }
                transition={{
                  repeat: gameStatus !== 'spinning' ? Infinity : 0,
                  duration: gameStatus === 'spinning' ? 1 : 1.5,
                }}
                whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(147,51,234,0.7)' }}
                whileTap={{ scale: 0.9 }}
                aria-label={`Spin reels for ${INITIAL_BET} MON`}
              >
                {isPending ? 'Placing Bet...' : `Spin (${INITIAL_BET} MON)`}
              </motion.button>
              <motion.button
                onClick={startDemoGame}
                disabled={gameStatus === 'spinning'}
                className={`px-6 py-3 rounded-lg text-base font-semibold text-white ${
                  gameStatus === 'spinning'
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                }`}
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    '0 0 5px rgba(59,130,246,0.5)',
                    '0 0 15px rgba(59,130,246,0.7)',
                    '0 0 5px rgba(59,130,246,0.5)',
                  ],
                }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(59,130,246,0.7)' }}
                whileTap={{ scale: 0.9 }}
                aria-label="Play demo game"
              >
                Play Demo
              </motion.button>
            </>
          ) : (
            <motion.button
              onClick={() => {
                setGameStarted(false);
                initializeReels();
                setGameStatus('idle');
                setPoints(0);
                setHighlightWin(null);
                setShowConfetti(false);
              }}
              className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]"
              animate={{
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 0 5px rgba(147,51,234,0.5)',
                  '0 0 15px rgba(147,51,234,0.7)',
                  '0 0 5px rgba(147,51,234,0.5)',
                ],
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(147,51,234,0.7)' }}
              whileTap={{ scale: 0.9 }}
              aria-label="Start new game"
            >
              New Game
            </motion.button>
          )}
        </div>
      </main>
    </div>
  );
}