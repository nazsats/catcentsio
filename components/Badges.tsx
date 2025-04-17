'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';

interface Badge {
  milestone: number;
  name: string;
  icon: string;
}

interface BadgesProps {
  totalMeowMiles: number;
}

const CONTRACT_ADDRESS = '0x64Dc82da10b09ECE5ab77d9432c42fFB3745DcA37';
const contractAbi = [
  {
    type: 'function',
    name: 'claimBadge',
    inputs: [{ name: 'milestone', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'BadgeClaimed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'milestone', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export default function Badges({ totalMeowMiles }: BadgesProps) {
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { data: balanceData } = useBalance({ address, chainId: monadTestnet.id });
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [claimedBadges, setClaimedBadges] = useState<number[]>([]);
  const [isClaiming, setIsClaiming] = useState<{ [key: number]: boolean }>({});
  const queryClient = useQueryClient();

  const badgeMilestones = useMemo<Badge[]>(() => [
    { milestone: 500, name: 'Whisker Initiate', icon: '/badges/whisker.png' },
    { milestone: 1000, name: 'Pawthfinder', icon: '/badges/pawthfinder.png' },
    { milestone: 2000, name: 'Claw Collector', icon: '/badges/claw.png' },
    { milestone: 5000, name: 'Yarnmaster', icon: '/badges/yarnmaster.png' },
    { milestone: 10000, name: 'Alley Alpha', icon: '/badges/alley.png' },
    { milestone: 50000, name: 'Shadow Stalker', icon: '/badges/shadow.png' },
    { milestone: 100000, name: 'Furion Elite', icon: '/badges/furion.png' },
    { milestone: 500000, name: 'Mythic Pouncer', icon: '/badges/mythic.png' },
    { milestone: 10000000, name: 'Catcents Legend', icon: '/badges/catcentslegend.png' },
  ], []);

  const fetchClaimedBadges = useCallback(async () => {
    if (!address) return;

    try {
      const userRef = doc(db, 'users', address);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const claimed = data.claimedBadges || [];
        setClaimedBadges(claimed);
      }
    } catch (error) {
      console.error('Failed to fetch claimed badges from Firebase:', error);
      toast.error('Failed to load claimed badges.');
    }
  }, [address]);

  useEffect(() => {
    const eligibleBadges = badgeMilestones.filter((badge) => totalMeowMiles >= badge.milestone);
    setEarnedBadges(eligibleBadges);

    if (address) {
      fetchClaimedBadges();
    }
  }, [totalMeowMiles, address, badgeMilestones, fetchClaimedBadges]);

  const handleClaimBadge = async (milestone: number) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet.');
      return;
    }

    setIsClaiming((prev) => ({ ...prev, [milestone]: true }));
    const pendingToast = toast.loading(`Claiming ${milestone} MeowMiles badge...`);

    try {
      // Switch to Monad Testnet
      await switchChain({ chainId: monadTestnet.id });

      // Check balance
      if (!balanceData || balanceData.value === BigInt(0)) {
        throw new Error('Insufficient MON balance. Please claim testnet tokens from the Monad faucet.');
      }

      // Claim badge using writeContract
      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: contractAbi,
          functionName: 'claimBadge',
          args: [BigInt(milestone)],
        },
        {
          onSuccess: async (txHash) => {
            // Update Firebase
            const userRef = doc(db, 'users', address);
            const userSnap = await getDoc(userRef);
            const existingClaims = userSnap.exists() ? userSnap.data().claimedBadges || [] : [];
            const updatedClaims = [...new Set([...existingClaims, milestone])];
            await setDoc(userRef, { claimedBadges: updatedClaims }, { merge: true });

            queryClient.invalidateQueries({ queryKey: ['userData', address] });

            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Badge claimed successfully!{' '}
                <a
                  href={`https://testnet.monadscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-cyan-400 hover:text-cyan-300"
                >
                  View on MonadScan
                </a>
              </div>,
              { duration: 5000 }
            );

            setClaimedBadges(updatedClaims);
          },
          onError: (error) => {
            throw error;
          },
        }
      );
    } catch (error: unknown) {
      console.error('Failed to claim badge:', error);
      toast.dismiss(pendingToast);

      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('insufficient funds') || errorMessage.includes('Insufficient MON balance')) {
          toast.error(
            <div>
              Insufficient MON balance.{' '}
              <a
                href="https://faucet.monad.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-cyan-400 hover:text-cyan-300"
              >
                Claim MON tokens
              </a>
            </div>,
            { duration: 5000 }
          );
        } else if (errorMessage.includes('User rejected the request')) {
          toast.error('Transaction rejected by user.', { duration: 5000 });
        } else {
          toast.error(`Failed to claim badge: ${errorMessage}`, { duration: 5000 });
        }
      } else if (typeof error === 'object' && error && 'reason' in error && typeof error.reason === 'string') {
        errorMessage = error.reason;
        toast.error(`Badge claim failed: ${errorMessage || 'Badge may already be claimed or milestone is invalid.'}`, { duration: 5000 });
      } else {
        toast.error(`Failed to claim badge: ${errorMessage}`, { duration: 5000 });
      }
    } finally {
      setIsClaiming((prev) => ({ ...prev, [milestone]: false }));
    }
  };

  return (
    <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300">
      <style>{`
        @keyframes glow-pulse {
          0% {
            box-shadow: 0 0 5px rgba(147, 51, 234, 0.5), 0 0 10px rgba(147, 51, 234, 0.3);
          }
          50% {
            box-shadow: 0 0 15px rgba(147, 51, 234, 0.8), 0 0 20px rgba(6, 182, 212, 0.5);
          }
          100% {
            box-shadow: 0 0 5px rgba(147, 51, 234, 0.5), 0 0 10px rgba(147, 51, 234, 0.3);
          }
        }
        .badge-container {
          position: relative;
          overflow: hidden;
          border-radius: 1rem;
          transition: transform 0.3s ease;
        }
        .badge-container:hover {
          transform: scale(1.05);
        }
        .badge-container::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 1rem;
          background: linear-gradient(45deg, rgba(147, 51, 234, 0.7), rgba(6, 182, 212, 0.7));
          z-index: -1;
          animation: glow-pulse 2s infinite;
        }
        .claimed::before {
          animation: glow-pulse 1.5s infinite;
        }
        .locked {
          opacity: 0.6;
        }
        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          padding: 0.5rem;
          color: white;
        }
        .overlay-text {
          background: rgba(0, 0, 0, 0.7);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          width: 100%;
          text-align: center;
        }
      `}</style>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />
      <h4 className="text-lg md:text-xl font-semibold text-purple-400 mb-6">Your Badges</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {badgeMilestones.map((badge) => {
          const isEligible = earnedBadges.some((earned) => earned.milestone === badge.milestone);
          const isClaimed = claimedBadges.includes(badge.milestone);
          const isClaimingBadge = isClaiming[badge.milestone];

          return (
            <div
              key={badge.milestone}
              className={`badge-container ${isClaimed ? 'claimed' : ''} ${!isEligible && !isClaimed ? 'locked' : ''}`}
            >
              <Image
                src={badge.icon}
                alt={badge.name}
                width={150}
                height={200}
                className={`w-full h-48 object-cover rounded-lg ${isClaimed ? '' : 'grayscale'}`}
              />
              <div className="overlay">
                <div className="mt-auto overlay-text">
                  <p className="text-sm md:text-base font-semibold text-purple-400">{badge.name}</p>
                  <p className="text-xs text-cyan-400">{badge.milestone.toLocaleString()} Meow Miles</p>
                </div>
                <div className="mt-2">
                  {!isClaimed && isEligible && (
                    <button
                      onClick={() => handleClaimBadge(badge.milestone)}
                      disabled={isPending || isClaimingBadge || !isConnected}
                      className={`px-4 py-1 text-sm font-semibold text-white rounded-full transition-all duration-200 ${
                        isPending || isClaimingBadge || !isConnected
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 hover:scale-105'
                      }`}
                    >
                      {isClaimingBadge ? 'Claiming...' : 'Claim'}
                    </button>
                  )}
                  {!isClaimed && !isEligible && (
                    <span className="text-xs font-bold text-white bg-gray-800 px-2 py-1 rounded-full shadow-md">
                      LOCKED
                    </span>
                  )}
                  {isClaimed && (
                    <span className="text-xs font-bold text-green-400 bg-gray-800 px-2 py-1 rounded-full shadow-md">
                      CLAIMED
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}