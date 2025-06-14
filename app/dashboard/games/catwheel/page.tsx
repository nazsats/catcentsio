'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, runTransaction, increment, FieldValue } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import Profile from '../../../../components/Profile';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect, useWriteContract, useSwitchChain, useBalance, useReadContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { monadTestnet } from '@reown/appkit/networks';
import Confetti from 'react-confetti';
import styles from './CatWheel.module.css';
import type { Abi } from 'viem';

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
  { id: '2', label: '10 Meow Miles', points: 10, color: '#00CED1', icon: '/games/icons/10-mm.png' },
  { id: '3', label: '200 Meow Miles', points: 200, color: '#FFD700', icon: '/games/icons/200-mm.png' },
  { id: '4', label: '0.025 MON', monReward: 0.025, color: '#FF4500', icon: '/games/icons/025-mon.png' },
  { id: '5', label: '50 Meow Miles', points: 50, color: '#FF69B4', icon: '/games/icons/50-mm.png' },
  { id: '6', label: '100 Meow Miles', points: 100, color: '#00CED1', icon: '/games/icons/100-mm.png' },
  { id: '7', label: 'Try Again', points: 0, color: '#4B0082', icon: '/games/icons/try-again.png' },
  { id: '8', label: '150 Meow Miles', points: 150, color: '#9932CC', icon: '/games/icons/150-mm.png' },
  { id: '9', label: '300 Meow Miles', points: 300, color: '#00FA9A', icon: '/games/icons/300-mm.png' },
  { id: '10', label: '0.05 MON', monReward: 0.05, color: '#DC143C', icon: '/games/icons/05-mon.png' },
  { id: '11', label: '250 Meow Miles', points: 250, color: '#1E90FF', icon: '/games/icons/250-mm.png' },
];

const INITIAL_BET = 0.01;
const SPIN_DURATION = 5000;
const COUNTDOWN_DURATION = 10; // 10 seconds
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CATWHEEL_CONTRACT_ADDRESS || '0x7444aBF8C80836972BebcF31AB3B536Cd72a835d';

const catWheelAbi = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'recordWin',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'segmentId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimReward',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addFunds',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdrawFunds',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getContractBalance',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingRewards',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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
    name: 'RewardWon',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'segmentId', type: 'uint256', indexed: false },
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
  {
    type: 'event',
    name: 'FundsAdded',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FundsWithdrawn',
    inputs: [
      { name: 'admin', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi;

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
  const [countdown, setCountdown] = useState<number>(0);
  const [txPending, setTxPending] = useState<boolean>(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Read contract balance and pending rewards
  const { data: contractBalance } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: catWheelAbi,
    functionName: 'getContractBalance',
  });
  const { data: pendingReward, refetch: refetchPendingReward } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: catWheelAbi,
    functionName: 'pendingRewards',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: txPending ? 1000 : false, // Poll every 1s during txPending
    },
  });

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Start countdown timer
  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_DURATION);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (isConnecting) return;
    if (!address) return router.push('/');
    console.log('Contract state:', {
      contractBalance: contractBalance ? Number(contractBalance) / 1e18 : 'N/A',
      pendingReward: pendingReward ? Number(pendingReward) / 1e18 : 'N/A',
      userAddress: address,
    });
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
  }, [address, isConnecting, router, contractBalance, pendingReward]);

  useEffect(() => {
    if (showModal) {
      console.log('Rendering Modal:', { showModal, resultSegment, monReward, points, countdown, pendingReward: pendingReward ? Number(pendingReward) / 1e18 : 'N/A' });
    }
  }, [showModal, resultSegment, monReward, points, countdown, pendingReward]);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  const playSound = (type: 'spin' | 'win') => {
    try {
      // Placeholder path; update to your actual path
      const audio = new Audio(`/sounds/catwheel/${type}.mp3`);
      audio.play().catch((err) => {
        console.warn(`Audio failed for ${type}.mp3:`, err);
      });
    } catch (err) {
      console.warn(`Failed to initialize audio for ${type}.mp3:`, err);
    }
  };

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

        setBestScore(segment.points || 0);
        setMonReward(segment.monReward || 0);
        console.log('CashOut completed:', { monReward: segment.monReward || 0, segmentId: segment.id });
        toast.dismiss(pendingToast);
        if (segment.role) {
          toast.success(`You won the ${segment.label} Discord role! Join our Discord to claim it.`);
        } else if (segment.monReward) {
          toast.success(`You won ${segment.monReward} MON! Claim it after the countdown.`);
        } else if (segment.points) {
          toast.success(`Cashed out ${segment.points} Meow Miles!`);
        } else {
          toast.success('Better luck next time!');
        }
        if ((segment.points || 0) > 0 || segment.monReward || segment.role) {
          setShowConfetti(true);
        }
      } catch (error) {
        console.error('CashOut error:', error);
        toast.dismiss(pendingToast);
        const message = error instanceof Error ? error.message : 'Failed to process reward.';
        toast.error(message, { duration: 6000 });
      }
    },
    [address]
  );

  const placeBet = async (): Promise<boolean> => {
    if (!address) {
      toast.error('Please connect your wallet');
      return false;
    }
    const pendingToast = toast.loading('Placing bet...');
    try {
      await switchChain({ chainId: monadTestnet.id });
      if (!balanceData || balanceData.value < BigInt(INITIAL_BET * 1e18)) {
        throw new Error('Insufficient MON balance.');
      }
      console.log('Calling placeBet:', {
        value: (INITIAL_BET * 1e18).toString(),
        address,
      });
      return new Promise((resolve) => {
        writeContract(
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: catWheelAbi,
            functionName: 'placeBet',
            value: BigInt(INITIAL_BET * 1e18),
            gas: BigInt(100_000),
          },
          {
            onSuccess: (txHash) => {
              console.log('Place bet success:', { txHash, address });
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
                { duration: 6000 }
              );
              setGameStarted(true);
              resolve(true);
            },
            onError: (error: Error) => {
              console.error('PlaceBet error:', error);
              let message = error.message || 'Unknown error';
              if (typeof error.cause === 'object' && error.cause !== null && 'reason' in error.cause) {
                message = (error.cause as { reason: string }).reason;
              }
              toast.dismiss(pendingToast);
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
                  { duration: 6000 }
                );
              } else {
                toast.error(`Bet failed: ${message}`, { duration: 6000 });
              }
              resolve(false);
            },
          }
        );
      });
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
          { duration: 6000 }
        );
      } else {
        toast.error(`Bet failed: ${message}`, { duration: 6000 });
      }
      return false;
    }
  };

  const recordWin = async (segmentId: number) => {
    if (!address) {
      toast.error('Please connect your wallet');
      return false;
    }
    const pendingToast = toast.loading('Recording win...');
    setTxPending(true);
    try {
      await switchChain({ chainId: monadTestnet.id });
      console.log('Calling recordWin:', { segmentId, address });
      return new Promise<boolean>((resolve) => {
        writeContract(
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: catWheelAbi,
            functionName: 'recordWin',
            args: [address, BigInt(segmentId)],
            gas: BigInt(150_000),
          },
          {
            onSuccess: async (txHash) => {
              console.log('Record win success:', { txHash, address, segmentId });
              toast.dismiss(pendingToast);
              toast.success(
                <div>
                  Win recorded!{' '}
                  <a
                    href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-cyan-400"
                  >
                    View on MonadExplorer
                  </a>
                </div>,
                { duration: 6000 }
              );
              // Invalidate all wagmi readContract queries
              await queryClient.invalidateQueries({ queryKey: ['wagmi'] });
              // Force refetch with retry loop
              let attempts = 0;
              const maxAttempts = 10;
              while (attempts < maxAttempts) {
                const { data: updatedReward } = (await refetchPendingReward()) as { data: bigint | undefined };
                if (updatedReward && updatedReward > BigInt(0)) {
                  console.log('Pending reward updated:', { reward: Number(updatedReward) / 1e18 });
                  break;
                }
                await new Promise((r) => setTimeout(r, 1000));
                attempts++;
              }
              if (attempts === maxAttempts) {
                console.warn('Failed to update pendingReward after retries');
                toast.error('Reward not updated. Please refresh the page.', { duration: 6000 });
              }
              // Force modal re-render
              setShowModal(false);
              setTimeout(() => setShowModal(true), 0);
              setTxPending(false);
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                setCountdown(0);
              }
              resolve(true);
            },
            onError: (error: Error) => {
              console.error('RecordWin error:', error);
              let message = error.message || 'Unknown error';
              if (typeof error.cause === 'object' && error.cause !== null && 'reason' in error.cause) {
                message = (error.cause as { reason: string }).reason;
              }
              if (message.includes('Claim existing reward first')) {
                message = 'Please claim your existing MON reward before recording a new win.';
              }
              toast.dismiss(pendingToast);
              toast.error(`Failed to record win: ${message}`, { duration: 6000 });
              setTxPending(false);
              resolve(false);
            },
          }
        );
      });
    } catch (error) {
      console.error('RecordWin error:', error);
      toast.dismiss(pendingToast);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to record win: ${message}`, { duration: 6000 });
      setTxPending(false);
      return false;
    }
  };

  const claimReward = useCallback(
    async () => {
      if (!address) {
        toast.error('Please connect your wallet');
        return;
      }
      const pendingToast = toast.loading('Claiming reward...');
      try {
        await switchChain({ chainId: monadTestnet.id });
        if (!pendingReward || pendingReward === BigInt(0)) {
          throw new Error('No pending reward to claim');
        }
        if (contractBalance && contractBalance < pendingReward) {
          throw new Error(`Contract balance too low: ${Number(contractBalance) / 1e18} MON available`);
        }
        console.log('Calling claimReward:', {
          address,
          pendingReward: Number(pendingReward) / 1e18,
        });
        await writeContract(
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: catWheelAbi,
            functionName: 'claimReward',
            gas: BigInt(150_000),
          },
          {
            onSuccess: async (txHash) => {
              console.log('Claim reward success:', { txHash, address });
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
              await queryClient.invalidateQueries({ queryKey: ['wagmi'] });
              toast.dismiss(pendingToast);
              toast.success(
                <div>
                  Reward claimed: {Number(pendingReward) / 1e18} MON!{' '}
                  <a
                    href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-cyan-400"
                  >
                    View on MonadExplorer
                  </a>
                </div>,
                { duration: 6000 }
              );
              setMonReward(0);
              setShowModal(false);
              setGameStarted(false);
            },
            onError: (error: Error) => {
              console.error('ClaimReward failed:', error);
              let message = error.message || 'Unknown error';
              if (typeof error.cause === 'object' && error.cause !== null && 'reason' in error.cause) {
                message = (error.cause as { reason: string }).reason;
              }
              toast.dismiss(pendingToast);
              toast.error(`Claim failed: ${message}`, { duration: 6000 });
            },
          }
        );
      } catch (error) {
        console.error('Claim error:', error);
        toast.dismiss(pendingToast);
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Claim failed: ${message}`, { duration: 6000 });
      }
    },
    [address, switchChain, writeContract, pendingReward, contractBalance, queryClient]
  );

  const spinWheel = useCallback(async () => {
    if (gameStatus === 'spinning') {
      console.log('Spin blocked: Already spinning');
      return;
    }
    console.log('Starting spinWheel:', { gameStatus, gameStarted });
    const betSuccess = await placeBet();
    if (!betSuccess) {
      console.log('Spin aborted: placeBet failed');
      return;
    }

    console.log('Bet confirmed, starting spin animation');
    setGameStatus('spinning');
    setShowConfetti(false);
    setPoints(0);
    setMonReward(0);
    setResultSegment(null);
    setTxPending(false);
    setCountdown(0);
    playSound('spin');

    const extraSpins = 1080 + Math.random() * 360;
    const finalRotation = extraSpins;

    console.log('Setting rotation:', { finalRotation });
    setRotation(finalRotation);

    setTimeout(async () => {
      try {
        console.log('Spin completed, processing result');
        const normalizedRotation = finalRotation % 360;
        const segmentAngle = 360 / SEGMENTS.length;
        const adjustedAngle = (360 - normalizedRotation) % 360;
        const segmentIndex = Math.floor(adjustedAngle / segmentAngle) % SEGMENTS.length;
        const selectedSegment = SEGMENTS[segmentIndex];

        console.log('SpinWheel result:', {
          finalRotation: finalRotation.toFixed(2),
          normalizedRotation: normalizedRotation.toFixed(2),
          adjustedAngle: adjustedAngle.toFixed(2),
          segmentIndex,
          reward: selectedSegment.label,
          monReward: selectedSegment.monReward || 0,
          role: selectedSegment.role || 'none',
        });

        setResultSegment(selectedSegment);
        setPoints(selectedSegment.points || 0);
        setGameStatus((selectedSegment.points || 0) > 0 || selectedSegment.monReward || selectedSegment.role ? 'won' : 'lost');
        if ((selectedSegment.points || 0) > 0 || selectedSegment.monReward || selectedSegment.role) {
          setShowConfetti(true);
          playSound('win');
          await cashOut(selectedSegment);
        }

        // Record win for MON rewards
        if (selectedSegment.monReward) {
          if (typeof pendingReward === 'bigint' && pendingReward > BigInt(0)) {
            console.log('Cannot record new reward:', {
              pendingReward: Number(pendingReward) / 1e18,
            });
            toast.error('Claim your existing MON reward before winning another.', { duration: 6000 });
            setShowModal(true);
          } else {
            setMonReward(selectedSegment.monReward);
            startCountdown();
            const winSuccess = await recordWin(Number(selectedSegment.id));
            if (!winSuccess) {
              setCountdown(0);
              setTxPending(false);
            } else {
              await refetchPendingReward();
            }
            setShowModal(true);
          }
        } else {
          setGameStarted(false);
          setShowModal(true);
        }
      } catch (error) {
        console.error('Error in spinWheel callback:', error);
        toast.error('Failed to process spin result.', { duration: 6000 });
        setTxPending(false);
        setCountdown(0);
      }
    }, SPIN_DURATION);
  }, [gameStatus, cashOut, gameStarted, pendingReward, placeBet, recordWin, startCountdown, refetchPendingReward]);

  const handleNewGame = useCallback(() => {
    setGameStarted(false);
    setGameStatus('idle');
    setPoints(0);
    setMonReward(0);
    setShowConfetti(false);
    setResultSegment(null);
    setRotation(0);
    setShowModal(false);
    setCountdown(0);
    setTxPending(false);
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
    console.log('Modal props:', { isOpen, resultSegment, points, monReward, countdown, pendingReward: pendingReward ? Number(pendingReward) / 1e18 : 'N/A' });
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
            {monReward > 0 && (countdown > 0 || txPending) && (
              <p className="text-base text-center text-yellow-400 font-semibold">
                Claim in {countdown}s
              </p>
            )}
          </div>
          <div className="mt-6 flex justify-center gap-4">
            {monReward > 0 || (typeof pendingReward === 'bigint' && pendingReward > BigInt(0)) ? (
              <motion.button
                className={`px-6 py-3 rounded-lg text-base font-semibold text-white ${
                  isPending || typeof pendingReward !== 'bigint' || pendingReward === BigInt(0) || countdown > 0 || txPending
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-cyan-500 hover:from-green-500 hover:to-cyan-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                }`}
                onClick={claimReward}
                whileHover={{ scale: countdown > 0 || txPending || isPending || !pendingReward || pendingReward === BigInt(0) ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isPending || !pendingReward || pendingReward === BigInt(0) || countdown > 0 || txPending}
              >
                {isPending ? 'Claiming...' : countdown > 0 || txPending ? `Claim in ${countdown}s` : `Claim ${Number(pendingReward) / 1e18 || 0} MON`}
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
            duration: 6000,
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
            Wheel Of Meow Miles
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
            <p className="text-gray-300 text-sm sm:text-base right-align">
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
                    width={100}
                    height={100}
                    className={styles.segmentIcon}
                  />
                </div>
              ))}
            </div>
            <div className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 z-10">
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
              onClick={spinWheel}
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