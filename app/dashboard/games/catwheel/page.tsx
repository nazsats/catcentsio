'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, runTransaction, increment, FieldValue } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import Profile from '../../../../components/Profile';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';
import Confetti from 'react-confetti';
import styles from './CatWheel.module.css';

interface Segment {
  id: string;
  label: string;
  points?: number;
  monReward?: number;
  role?: string;
  color: string;
  icon: string;
}

const SEGMENTS: Segment[] = [
  { id: '0', label: 'Try Again', points: 0, color: '#4B0082', icon: '/games/icons/try-again.png' },
  { id: '1', label: 'Test Catlist Role', role: 'test_catlist', color: '#FF69B4', icon: '/games/icons/test-catlist.png' },
  { id: '2', label: '10 MM', points: 10, color: '#00CED1', icon: '/games/icons/10-mm.png' },
  { id: '3', label: '200 MM', points: 200, color: '#FFD700', icon: '/games/icons/200-mm.png' },
  { id: '4', label: '0.025 MON', monReward: 0.025, color: '#FF4500', icon: '/games/icons/025-mon.png' },
  { id: '5', label: '50 MM', points: 50, color: '#FF69B4', icon: '/games/icons/50-mm.png' },
  { id: '6', label: '100 MM', points: 100, color: '#00CED1', icon: '/games/icons/100-mm.png' },
  { id: '7', label: 'Try Again', points: 0, color: '#4B0082', icon: '/games/icons/try-again.png' },
  { id: '8', label: '150 MM', points: 150, color: '#9932CC', icon: '/games/icons/150-mm.png' },
  { id: '9', label: '300 MM', points: 300, color: '#00FA9A', icon: '/games/icons/300-mm.png' },
  { id: '10', label: '0.05 MON', monReward: 0.05, color: '#DC143C', icon: '/games/icons/05-mon.png' },
  { id: '11', label: '250 MM', points: 250, color: '#1E90FF', icon: '/games/icons/250-mm.png' },
];

const INITIAL_BET = 0.01;
const SPIN_DURATION = 5000;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CATWHEEL_CONTRACT_ADDRESS || '0x5798d359c65910458C2842A33B1fB03976c4ac17';
const contractAbi = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'claimReward',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPendingReward',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardClaimed',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
];

interface UpdateData {
  catwheelBestScore: number;
  gamesGmeow: FieldValue | number;
  updatedAt: string;
  discordRoles?: string[];
  pendingRole?: string;
  pendingRoleId?: string;
  pendingMonReward?: number;
  pendingMonRewardId?: string;
}

export default function CatWheel() {
  const { address, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { data: balanceData } = useBalance({ address, chainId: monadTestnet.id });
  const [gameStatus, setGameStatus] = useState<'idle' | 'spinning' | 'won' | 'lost'>('idle');
  const [points, setPoints] = useState(0);
  const [monReward, setMonReward] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultSegment, setResultSegment] = useState<Segment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Debug modal rendering
  useEffect(() => {
    if (showModal) {
      console.log('Rendering Modal:', { showModal, resultSegment });
    }
  }, [showModal, resultSegment]);

  useEffect(() => {
    if (isConnecting) return;
    if (!address) return router.push('/');
    (async () => {
      try {
        const userRef = doc(db, 'users', address);
        const userDoc = await getDoc(userRef);
        setBestScore(userDoc.exists() ? userDoc.data().catwheelBestScore || 0 : 0);
      } catch (error) {
        console.error('Failed to load game stats:', error);
        toast.error('Failed to load game stats.');
      }
    })();
  }, [address, isConnecting, router]);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  const playSound = (type: 'spin' | 'win') =>
    new Audio(`/sounds/${type}.mp3`).play().catch((err) => console.error('Audio failed:', err));

  const cashOut = useCallback(
    async (segment: Segment) => {
      if (!address) return;
      const pendingToast = toast.loading('Processing reward...');
      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', address);
          const userDoc = await transaction.get(userRef);
          const data = userDoc.data() || {};
          const newScore = Math.max(data.catwheelBestScore || 0, segment.points || 0);
          const updateData: UpdateData = {
            catwheelBestScore: newScore,
            gamesGmeow: increment(segment.points || 0),
            updatedAt: new Date().toISOString(),
          };

          if (segment.role) {
            const existingRoles = data.discordRoles || [];
            if (!existingRoles.includes(segment.role)) {
              updateData.discordRoles = [...existingRoles, segment.role];
            }
            updateData.pendingRole = segment.role;
            updateData.pendingRoleId = segment.id;
          } else if (segment.monReward) {
            updateData.pendingMonReward = segment.monReward;
            updateData.pendingMonRewardId = segment.id;
          }

          transaction.set(userRef, updateData, { merge: true });
        });

        if (segment.monReward) {
          try {
            writeContract(
              {
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: contractAbi,
                functionName: 'setPendingReward',
                args: [address, BigInt(segment.monReward * 1e18)],
              },
              {
                onSuccess: () => {
                  console.log('Set pending reward on contract:', segment.monReward, 'MON for', address);
                },
                onError: (error) => {
                  console.error('Failed to set pending reward on contract:', error);
                  throw new Error('Contract sync failed');
                },
              }
            );
          } catch (error) {
            console.error('SetPendingReward error:', error);
            throw error;
          }
        }

        setBestScore(segment.points || 0);
        setMonReward(segment.monReward || 0);
        console.log('CashOut: Set monReward to', segment.monReward || 0, 'for segment', segment.id);
        toast.dismiss(pendingToast);
        if (segment.role) {
          toast.success(`You won the ${segment.label} Discord role! Join our Discord to claim it.`);
        } else if (segment.monReward) {
          toast.success(`You won ${segment.monReward} MON! Claim it now.`);
        } else if (segment.points) {
          toast.success(`Cashed out ${segment.points} Meow Miles!`);
        } else {
          toast.success('Better luck next time!');
        }
      } catch (error) {
        console.error('CashOut error:', error);
        toast.dismiss(pendingToast);
        toast.error('Failed to process reward.');
      }
    },
    [address, writeContract]
  );

  const claimReward = useCallback(
    async (amount: number) => {
      if (!address) return toast.error('Please connect your wallet');
      const pendingToast = toast.loading('Claiming reward...');
      try {
        await switchChain({ chainId: monadTestnet.id });
        console.log('Claiming reward:', amount, 'MON');
        writeContract(
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: contractAbi,
            functionName: 'claimReward',
            args: [BigInt(amount * 1e18)],
          },
          {
            onSuccess: async (txHash) => {
              await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', address);
                transaction.set(
                  userRef,
                  {
                    pendingMonReward: 0,
                    pendingMonRewardId: null,
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                );
              });
              toast.dismiss(pendingToast);
              toast.success(
                <div>
                  Reward claimed: {amount} MON!{' '}
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
              setMonReward(0);
              setShowModal(false);
              console.log('Claim successful, txHash:', txHash);
            },
            onError: (error) => {
              throw error;
            },
          }
        );
      } catch (error) {
        console.error('Claim error:', error);
        toast.dismiss(pendingToast);
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Claim failed: ${message}`, { duration: 4000 });
      }
    },
    [address, switchChain, writeContract]
  );

  const spinWheel = useCallback(() => {
    if (gameStatus === 'spinning') return;
    setGameStatus('spinning');
    setShowConfetti(false);
    setPoints(0);
    setMonReward(0);
    setResultSegment(null);
    playSound('spin');

    const extraSpins = 1080 + Math.random() * 360;
    const finalRotation = extraSpins;

    setRotation(finalRotation);

    setTimeout(() => {
      try {
        console.log('Spin completed, setting showModal to true');
        const normalizedRotation = finalRotation % 360;
        const segmentAngle = 360 / SEGMENTS.length;
        const adjustedAngle = (360 - normalizedRotation) % 360;
        const segmentIndex = Math.floor(adjustedAngle / segmentAngle) % SEGMENTS.length;
        const selectedSegment = SEGMENTS[segmentIndex];
        // For testing modal: Force Test Catlist Role win
        // const selectedSegment = SEGMENTS.find(s => s.role === 'test_catlist') || SEGMENTS[0];

        console.log(
          `SpinWheel: Final rotation: ${finalRotation.toFixed(2)}°, Normalized: ${normalizedRotation.toFixed(
            2
          )}°, Adjusted: ${adjustedAngle.toFixed(2)}°, Segment index: ${segmentIndex}, Reward: ${
            selectedSegment.label
          }, monReward: ${selectedSegment.monReward || 0}, role: ${selectedSegment.role || 'none'}`
        );

        setResultSegment(selectedSegment);
        setPoints(selectedSegment.points || 0);
        setGameStatus((selectedSegment.points || 0) > 0 || selectedSegment.monReward || selectedSegment.role ? 'won' : 'lost');
        if ((selectedSegment.points || 0) > 0 || selectedSegment.monReward || selectedSegment.role) {
          setShowConfetti(true);
          playSound('win');
          cashOut(selectedSegment);
        }
        setShowModal(true);
      } catch (error) {
        console.error('Error in spinWheel callback:', error);
        toast.error('Failed to process spin result.');
      }
    }, SPIN_DURATION);
  }, [gameStatus, cashOut]);

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
            spinWheel();
          },
          onError: (error) => {
            throw error;
          },
        }
      );
    } catch (error) {
      console.error('PlaceBet error:', error);
      toast.dismiss(pendingToast);
      const message = error instanceof Error ? error.message : 'Unknown error';
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

  const handleNewGame = useCallback(() => {
    setGameStarted(false);
    setGameStatus('idle');
    setPoints(0);
    setMonReward(0);
    setShowConfetti(false);
    setResultSegment(null);
    setRotation(0);
    setShowModal(false);
  }, []);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => toast.success('Address copied!'));
    }
  };

  const Modal = ({
    isOpen,
    onClose,
    points,
    monReward,
    resultSegment,
  }: {
    isOpen: boolean;
    onClose: () => void;
    points: number;
    monReward: number;
    resultSegment: Segment | null;
  }) => {
    console.log('Modal props:', { isOpen, resultSegment, points, monReward });
    if (!isOpen || !resultSegment) return null;

    return (
      <motion.div
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
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
            {points > 0 || monReward > 0 || resultSegment.role ? 'Congratulations!' : 'Try Again'}
          </h2>
          <div className="space-y-2">
            {points > 0 && (
              <p className="text-base">
                <span className="font-semibold text-purple-400">Points:</span>{' '}
                <span className="text-cyan-400 font-bold">{points}</span>
              </p>
            )}
            {monReward > 0 && (
              <p className="text-base">
                <span className="font-semibold text-purple-400">MON Reward:</span>{' '}
                <span className="text-cyan-400 font-bold">{monReward} MON</span>
              </p>
            )}
            {resultSegment.role && (
              <p className="text-base">
                <span className="font-semibold text-purple-400">Role:</span>{' '}
                <span className="text-cyan-400 font-bold">{resultSegment.label}</span>
              </p>
            )}
            <p className="text-base">
              <span className="font-semibold text-purple-400">Result:</span>{' '}
              <span className="text-cyan-400 font-bold">{resultSegment.label}</span>
            </p>
          </div>
          <div className="mt-6 flex justify-center gap-4">
            {monReward > 0 ? (
              <motion.button
                className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-green-600 to-cyan-500 hover:from-green-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                onClick={() => claimReward(monReward)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isPending}
              >
                {isPending ? 'Claiming...' : `Claim ${monReward} MON`}
              </motion.button>
            ) : (
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
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const wheelSize = 350;
  const segmentAngle = 360 / SEGMENTS.length;

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
          points={points}
          monReward={monReward}
          resultSegment={resultSegment}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            Cat Wheel
          </h1>
          <Profile account={address} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
        </div>

        <motion.div
          className="bg-gradient-to-r from-black/90 to-purple-900/90 rounded-xl p-4 sm:p-6 border border-pink-500 shadow-md shadow-pink-500/20 mb-8"
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

        <div className="flex justify-center mb-8 relative">
          <motion.div
            className="relative"
            animate={
              gameStatus === 'won'
                ? { scale: [1, 1.03, 1], transition: { duration: 0.4, repeat: 2, ease: 'easeInOut' } }
                : {}
            }
          >
            <div
              ref={wheelRef}
              className={styles.wheel}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: gameStatus === 'spinning' ? `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0.1, 0.25, 1)` : 'none',
              }}
            >
              {SEGMENTS.map((segment, index) => (
                <div
                  key={segment.id}
                  className={styles.segmentText}
                  style={{
                    transform: `rotate(${index * segmentAngle + segmentAngle / 1.2}deg) translate(0, -${wheelSize * 0.0000005}px)`,
                  }}
                >
              <Image
  src={segment.icon}
  alt={segment.label}
  width={100} // Match source image size
  height={100}
  className={styles.segmentIcon}
/>
                </div>
              ))}
            </div>
            <div className={styles.pointer}>
              <Image
                src="/games/icons/arrow.png"
                alt="Wheel Pointer"
                width={50}
                height={50}
                className="object-contain"
              />
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
              aria-label={`Spin wheel for ${INITIAL_BET} MON`}
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