'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import Profile from '../../../../components/Profile';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';
import Confetti from 'react-confetti';
import styles from './Catslots.module.css';

const SYMBOLS = [
  '/cats/cat1.png',
  '/cats/cat2.png',
  '/cats/cat3.png',
  '/cats/fish.png',
  '/cats/star.png',
  '/cats/wild.png',
];
const WILD_SYMBOL = '/cats/wild.png';
const REEL_SIZE = 3;
const SPIN_DURATION = 3000;
const STOP_DURATION = 800; // eslint-disable-line @typescript-eslint/no-unused-vars
const STAGGER_DELAY = 100;
const HIGHLIGHT_DELAY = 300;
const TOAST_DELAY = 2000; // eslint-disable-line @typescript-eslint/no-unused-vars
const INITIAL_BET = 0.01;
const BASE_ICON_HEIGHT = 120;
const NUM_ICONS = SYMBOLS.length;
const SPIN_CYCLES = 5;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CASLOTS_CONTRACT_ADDRESS || '0xD00C45AC031F20c8931B25fDb937A830f891b967';
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
  positions: [number, number][];
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
  const [showConfetti, setShowConfetti] = useState(false);
  const [winningPositions, setWinningPositions] = useState<[number, number][]>([]);
  const [showModal, setShowModal] = useState(false);
  const [winInfo, setWinInfo] = useState<WinInfo | null>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Calculate icon height based on viewport width
  const [iconHeight, setIconHeight] = useState(BASE_ICON_HEIGHT);
  useEffect(() => {
    const updateIconHeight = () => {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const newIconHeight = Math.min(BASE_ICON_HEIGHT, Math.floor(vw * 0.25));
      setIconHeight(newIconHeight);
    };
    updateIconHeight();
    window.addEventListener('resize', updateIconHeight);
    return () => window.removeEventListener('resize', updateIconHeight);
  }, []);

  // Preload images
  useEffect(() => {
    SYMBOLS.forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
    });
  }, []);

  const generateRandomSymbols = (length: number) => {
    return Array(length)
      .fill(null)
      .map(() => {
        const rand = Math.random();
        return rand < 0.05
          ? WILD_SYMBOL
          : SYMBOLS[Math.floor(Math.random() * (SYMBOLS.length - 1))];
      });
  };

  const initializeReels = useCallback(() => {
    const newReels = Array(REEL_SIZE)
      .fill(null)
      .map(() => ({
        symbols: generateRandomSymbols(3),
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
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  useEffect(() => {
    const currentReels = reelRefs.current;
    const toastTimeout = toastTimeoutRef.current; // Copy ref value
    if (gameStatus !== 'spinning') {
      currentReels.forEach((reel) => {
        if (reel) {
          reel.style.transition = 'none';
          reel.style.transform = 'translateY(0)';
          reel.classList.remove(styles.spinning);
        }
      });
    }
    return () => {
      currentReels.forEach((reel) => {
        if (reel) {
          reel.style.transition = 'none';
          reel.style.transform = 'translateY(0)';
          reel.classList.remove(styles.spinning);
        }
      });
      if (toastTimeout) {
        clearTimeout(toastTimeout);
      }
    };
  }, [gameStatus]);

  const playSound = (type: 'spin' | 'win') =>
    new Audio(`/sounds/${type}.mp3`).play().catch((err) => console.error('Audio failed:', err));

  const cashOut = useCallback(async (currentPoints: number) => {
    if (!address) return;
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
  }, [address]);

  const checkPaylineWin = useMemo(
    () => (symbols: string[], lineName: string, positions: [number, number][]): WinInfo | null => {
      const isWildLine = symbols.every((s) => s === WILD_SYMBOL);
      if (isWildLine) {
        return lineName.includes('Straight') ? { points: 500, type: `${lineName} (Wild)`, positions } : null;
      }
      const nonWildSymbol = symbols.find((s) => s !== WILD_SYMBOL);
      if (!nonWildSymbol) return null;
      const isWin = symbols.every((s) => s === nonWildSymbol || s === WILD_SYMBOL);
      if (isWin) {
        const points = lineName.includes('Straight') ? 100 : 50;
        return { points, type: lineName, positions };
      }
      return null;
    },
    []
  );

  const handleNewGame = useCallback(() => {
    setGameStarted(false);
    initializeReels();
    setGameStatus('idle');
    setPoints(0);
    setShowConfetti(false);
    setWinningPositions([]);
    setShowModal(false);
    reelRefs.current.forEach((reel) => {
      if (reel) {
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';
        reel.classList.remove(styles.spinning);
      }
    });
  }, [initializeReels]);

  const spinReels = useCallback(() => {
    if (gameStatus === 'spinning') return;
    setGameStatus('spinning');
    setShowConfetti(false);
    setPoints(0);
    setWinningPositions([]);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    playSound('spin');

    const finalReels = Array(REEL_SIZE)
      .fill(null)
      .map(() => ({
        symbols: generateRandomSymbols(3),
        offset: 0,
      }));

    const totalSpinSymbols = SPIN_CYCLES * NUM_ICONS + 3;
    const extendedReels = finalReels.map((reel) => {
      const prependedSymbols = generateRandomSymbols(totalSpinSymbols - 3);
      return {
        symbols: [...prependedSymbols, ...reel.symbols],
        offset: 0,
      };
    });

    setReels(extendedReels);
    reelRefs.current.forEach((reel, reelIndex) => {
      if (reel) {
        const totalSpinSymbols = SPIN_CYCLES * NUM_ICONS + 3;
        const totalTranslateY = -(totalSpinSymbols - 3) * iconHeight;

        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';
        void reel.offsetWidth;

        setTimeout(() => {
          reel.style.transition = `transform ${SPIN_DURATION + reelIndex * STAGGER_DELAY}ms cubic-bezier(0.25, 1, 0.5, 1)`;
          reel.style.transform = `translateY(${totalTranslateY}px)`;
        }, 10);
      }
    });

    setTimeout(() => {
      setReels(finalReels);

      const grid = finalReels.map((reel) => [
        reel.symbols[0],
        reel.symbols[1],
        reel.symbols[2],
      ]);

      const paylines: { symbols: string[]; name: string; positions: [number, number][] }[] = [
        { symbols: [grid[0][0], grid[1][0], grid[2][0]], name: 'Top Straight', positions: [[0, 0], [1, 0], [2, 0]] },
        { symbols: [grid[0][1], grid[1][1], grid[2][1]], name: 'Middle Straight', positions: [[0, 1], [1, 1], [2, 1]] },
        { symbols: [grid[0][2], grid[1][2], grid[2][2]], name: 'Bottom Straight', positions: [[0, 2], [1, 2], [2, 2]] },
        {
          symbols: [grid[0][2], grid[1][1], grid[2][0]],
          name: 'Cross (Left Down to Right Up)',
          positions: [[0, 2], [1, 1], [2, 0]],
        },
        {
          symbols: [grid[2][2], grid[1][1], grid[0][0]],
          name: 'Cross (Right Down to Left Up)',
          positions: [[2, 2], [1, 1], [0, 0]],
        },
      ];

      let highestWin: WinInfo | null = null;
      for (const payline of paylines) {
        const win = checkPaylineWin(payline.symbols, payline.name, payline.positions);
        if (win && (!highestWin || win.points > highestWin.points)) {
          highestWin = win;
        }
      }

      setTimeout(() => {
        if (highestWin) {
          setWinningPositions(highestWin.positions);
          setPoints(highestWin.points);
          setGameStatus('won');
          setShowConfetti(true);
          setWinInfo(highestWin);
          playSound('win');
          cashOut(highestWin.points);
        } else {
          setGameStatus('lost');
          setWinInfo(null);
        }
        setTimeout(() => {
          setShowModal(true);
        }, 1500);
      }, HIGHLIGHT_DELAY);
    }, SPIN_DURATION + (REEL_SIZE - 1) * STAGGER_DELAY);
  }, [gameStatus, cashOut, checkPaylineWin, iconHeight]);

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
                  href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-cyan-400"
                >
                  View on MonadExplorer
                </a>
              </div>,
              { duration: 4000 }
            );
            setGameStarted(true);
            spinReels();
          },
          onError: (error) => {
            throw error;
          },
        }
      );
    } catch (_error: unknown) {
      toast.dismiss(pendingToast);
      const message = _error instanceof Error ? _error.message : 'Unknown error';
      if (message.includes('insufficient funds') || message.includes('Insufficient MON balance')) {
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
          { duration: 4000 }
        );
      } else if (message.includes('revert')) {
        toast.error('Bet failed: Transaction reverted.', { duration: 4000 });
      } else {
        toast.error(`Bet failed: ${message}`, { duration: 4000 });
      }
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => toast.success('Address copied!'));
    }
  };

  const memoizedReels = useMemo(() => reels, [reels]);

  // Modal Component
  const Modal = ({ isOpen, onClose, winInfo, points }: { isOpen: boolean; onClose: () => void; winInfo: WinInfo | null; points: number }) => {
    if (!isOpen) return null;

    return (
      <motion.div
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-br from-purple-900/90 to-black/90 rounded-xl p-6 border border-purple-500 shadow-lg shadow-purple-500/30 max-w-md w-full mx-4 text-gray-300"
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <h2 className="text-xl font-bold text-cyan-400 mb-4 text-center">
            {winInfo ? 'Congratulations!' : 'Try Again'}
          </h2>
          <div className="space-y-2">
            <p className="text-base">
              <span className="font-semibold text-purple-400">Points:</span>{' '}
              <span className="text-cyan-400 font-bold">{points}</span>
            </p>
            {winInfo && (
              <p className="text-base">
                <span className="font-semibold text-purple-400">Win Type:</span>{' '}
                <span className="text-cyan-400 font-bold">{winInfo.type}</span>
              </p>
            )}
          </div>
          <div className="mt-6 flex justify-center">
            <motion.button
              className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]"
              onClick={() => {
                onClose();
                handleNewGame();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Play Again
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  if (isConnecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white text-lg text-cyan-400">
        Loading...
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

      <main className="flex-1 p-4 sm:p-6 md:p-8 relative z-10">
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
            loading: {
              style: {
                borderLeft: '4px solid #2196f3',
              },
            },
            duration: 4000,
          }}
        />

        {showConfetti && (
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} />
        )}

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          winInfo={winInfo}
          points={points}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            Cat Slots
          </h1>
          <Profile account={address} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
        </div>

        <motion.div
          className="bg-gradient-to-r from-black/90 to-purple-900/90 rounded-xl p-4 sm:p-6 border border-pink-500 shadow-md shadow-pink-500/20 mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <h3 className="text-base sm:text-lg font-semibold text-purple-400 mb-4">Game Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="text-gray-300 text-sm sm:text-base">
              Spin Points:{' '}
              <motion.span
                className="text-cyan-400 font-bold"
                key={points}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {points}
              </motion.span>
            </p>
            <p className="text-gray-300 text-sm sm:text-base">
              Best Score:{' '}
              <motion.span
                className="text-cyan-400 font-bold"
                key={bestScore}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {bestScore}
              </motion.span>
            </p>
          </div>
          <p className="text-center mt-4 text-sm sm:text-base font-semibold text-purple-400" aria-live="polite">
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
            className="bg-gray-900/80 rounded-xl p-4 sm:p-8 border border-purple-900 w-full max-w-[90vw] sm:max-w-[800px] overflow-hidden"
            style={{ boxSizing: 'border-box' }}
            animate={
              gameStatus === 'won'
                ? { scale: [1, 1.03, 1], transition: { duration: 0.4, repeat: 2, ease: 'easeInOut' } }
                : {}
            }
          >
            <div
              className="grid grid-cols-3 gap-2 sm:gap-6"
              style={{
                gridTemplateColumns: `repeat(3, ${iconHeight}px)`,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {memoizedReels.map((reel, reelIndex) => (
                <div
                  key={reelIndex}
                  className={styles.reelContainer}
                  style={{ width: `${iconHeight}px`, height: `${iconHeight * 3}px` }}
                >
                  <motion.div
                    ref={(el) => {
                      reelRefs.current[reelIndex] = el;
                    }}
                    className={`${styles.reelEmoji} ${gameStatus === 'spinning' ? styles.spinning : ''}`}
                  >
                    {reel.symbols.map((symbol, index) => (
                      <motion.div
                        key={`${reelIndex}-${index}`}
                        className={styles.emojiSlot}
                        style={{ height: `${iconHeight}px` }}
                      >
                        <motion.div
                          className={`${styles.slot} ${
                            gameStatus === 'won' &&
                            winningPositions.some(
                              ([winReel, winIndex]) => winReel === reelIndex && winIndex === index
                            )
                              ? styles.winning
                              : ''
                          }`}
                          animate={
                            gameStatus === 'won' &&
                            winningPositions.some(
                              ([winReel, winIndex]) => winReel === reelIndex && winIndex === index
                            )
                              ? { scale: [1, 1.1, 1], transition: { duration: 0.4, repeat: 2, ease: 'easeInOut' } }
                              : {}
                          }
                        >
                          <Image
                            src={symbol}
                            alt="slot symbol"
                            width={iconHeight * 0.4}
                            height={iconHeight * 0.4}
                            style={{ objectFit: 'contain' }}
                          />
                        </motion.div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 mt-6">
          {!gameStarted && (
            <motion.button
              onClick={placeBet}
              disabled={isPending || !address || gameStatus === 'spinning'}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-sm sm:text-base font-semibold text-white ${
                isPending || !address || gameStatus === 'spinning'
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]'
              }`}
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
              aria-label={`Spin reels for ${INITIAL_BET} MON`}
            >
              {isPending ? 'Placing Bet...' : `Spin (${INITIAL_BET} MON)`}
            </motion.button>
          )}
          <motion.button
            onClick={handleNewGame}
            className="px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-sm sm:text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]"
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
            aria-label="Start new game"
          >
            New Game
          </motion.button>
        </div>
      </main>
    </div>
  );
}