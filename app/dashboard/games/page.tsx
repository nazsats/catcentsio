'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '../../../lib/firebase';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import Profile from '../../../components/Profile';
import Loader from '../../../components/Loader';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect, useWriteContract, useSwitchChain } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';

const CLAIM_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CLAIM_CONTRACT_ADDRESS || '0xdC41856d92F1415AB55C2Ee76Eda305db1a61b77';
const claimContractAbi = [
  {
    type: 'function',
    name: 'claim',
    inputs: [{ name: 'points', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'tokensPerClaim',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pointsPerClaim',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolBalance',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

export default function Games() {
  const { address, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const [gamesGmeow, setGamesGmeow] = useState(0);
  const [gameScores, setGameScores] = useState<{ [key: string]: number }>({});
  const [claimCount, setClaimCount] = useState(0);
  const [lastClaimAmount, setLastClaimAmount] = useState<number | null>(null);
  const [claimedThresholds, setClaimedThresholds] = useState<number[]>([]);
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);

  const fetchGameScores = async (userAddress: string) => {
    try {
      const userDocRef = doc(db, 'users', userAddress);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        setGamesGmeow(Math.floor(data.gamesGmeow || 0));
        setGameScores({
          catsweeper: data.minesweeperBestScore || 0,
          catslots: data.catslotsBestScore || 0,
          catwheel: data.catwheelBestScore || 0, // Added Cat Wheel score
        });
        setClaimCount(data.claimCount || 0);
        setLastClaimAmount(data.lastClaimAmount || null);
        setClaimedThresholds(data.claimedThresholds || []);
      }
    } catch (error) {
      console.error('Failed to fetch game scores:', error);
      toast.error('Failed to load game stats.');
    }
  };

  useEffect(() => {
    console.log('Games useEffect - Address:', address, 'IsConnecting:', isConnecting, 'HasRedirected:', hasRedirected);
    if (isConnecting) return;
    if (!address && !hasRedirected) {
      console.log('Games - Redirecting to /');
      setHasRedirected(true);
      router.push('/');
      return;
    }
    if (address) {
      fetchGameScores(address);
    }
  }, [address, isConnecting, router, hasRedirected]);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied!');
    }
  };

  const handleClaim = async () => {
    if (!address) return toast.error('Please connect your wallet');

    const nextClaimThreshold = (claimCount + 1) * 1000;
    if (gamesGmeow < nextClaimThreshold) {
      return toast.error(`You need at least ${nextClaimThreshold} Meow Miles to claim 0.025 MON!`, { duration: 4000 });
    }

    const pointsToSend = nextClaimThreshold;
    const monToClaim = 0.025;
    const pendingToast = toast.loading('Claiming 0.025 MON tokens...');

    try {
      await switchChain({ chainId: monadTestnet.id });
      writeContract(
        {
          address: CLAIM_CONTRACT_ADDRESS as `0x${string}`,
          abi: claimContractAbi,
          functionName: 'claim',
          args: [pointsToSend],
        },
        {
          onSuccess: async (txHash) => {
            try {
              await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', address);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error('User not found');
                const currentThresholds = userDoc.data().claimedThresholds || [];
                transaction.update(userRef, {
                  claimedThresholds: [...currentThresholds, nextClaimThreshold],
                  claimCount: (userDoc.data().claimCount || 0) + 1,
                  lastClaimAmount: monToClaim,
                  updatedAt: new Date().toISOString(),
                });
              });
              setClaimCount((prev) => prev + 1);
              setLastClaimAmount(monToClaim);
              setClaimedThresholds((prev) => [...prev, nextClaimThreshold]);
              toast.dismiss(pendingToast);
              toast.success(
                <div>
                  Claimed 0.025 MON tokens!{' '}
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
            } catch (_error: unknown) {
              toast.dismiss(pendingToast);
              const message = _error instanceof Error ? _error.message : 'Unknown error';
              toast.error(`Claim failed: ${message}`, { duration: 4000 });
            }
          },
          onError: (error) => {
            toast.dismiss(pendingToast);
            const errorMessage = error.message.toLowerCase();
            if (errorMessage.includes('insufficient points')) {
              toast.error(`You need ${nextClaimThreshold} Meow Miles to claim!`, { duration: 4000 });
            } else if (errorMessage.includes('insufficient tokens')) {
              toast.error('Contract has insufficient funds. Try again later.', { duration: 4000 });
            } else {
              toast.error(`Claim failed: ${error.message}`, { duration: 4000 });
            }
          },
        }
      );
    } catch (_error: unknown) {
      toast.dismiss(pendingToast);
      const message = _error instanceof Error ? _error.message : 'Unknown error';
      toast.error(`Claim failed: ${message}`, { duration: 4000 });
    }
  };

  if (isConnecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <Loader size={48} />
      </div>
    );
  }

  if (!address) return null;

  const games = [
    {
      id: 'catsweeper',
      title: 'Cat Sweeper',
      description: 'Uncover safe cells and avoid bombs to earn Meow Miles!',
      image: '/games/catsweeper.png',
    },
    {
      id: 'catslots',
      title: 'Cat Slots',
      description: 'Spin the reels with cute cats to win Meow Miles!',
      image: '/games/catslots.png',
    },
        {
      id: 'tetris',
      title: 'Tetris Reborn',
      description: 'Clear the cells with your movements.',
      image: '/games/tetris.png',
    },
            {
      id: 'catwheel',
      title: 'Wheel Of Meow Miles',
      description: 'Spin that sheeeeeeeeee',
      image: '/games/catwheel.png',
    },
        {
      id: 'race',
      title: 'Kitty Race (Coming Soon)',
      description: 'Race your NFT cats for Meow Miles glory!',
      image: '/games/race.png',
      comingSoon: true,
    },
  ];

  const nextClaimThreshold = (claimCount + 1) * 1000;
  const hasClaimedAtCurrentLevel = claimedThresholds.includes(nextClaimThreshold);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <main className="flex-1 p-4 md:p-8">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />

        {/* Header and Profile */}
        <div className="flex flex-row flex-wrap justify-between items-center mb-6 md:mb-8 gap-4">
          <h2 className="mt-20 text-xl md:text-2xl font-semibold text-purple-300">Games</h2>
          <div className="ml-auto">
            <Profile account={address} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
          </div>
        </div>

        {/* Banner */}
        <div className="w-full max-w-4xl mx-auto mb-6 md:mb-8">
          <div className="relative w-full" style={{ paddingTop: '33.33%' /* 3:1 aspect ratio */ }}>
            <Image
              src="/games/gamebanner.png"
              alt="Catcents Playground Banner"
              layout="fill"
              objectFit="cover"
              className="rounded-xl border border-purple-900 shadow-lg shadow-purple-500/30"
              priority
            />
          </div>
        </div>

        {/* Welcome Content */}
        <div className="text-center mb-6 md:mb-8 px-4">
          <h1 className="text-xl md:text-2xl font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 bg-clip-text text-transparent mb-3">
            Welcome to the Catcents Playground
          </h1>
          <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed">
            <span className="text-cyan-400 font-semibold">This is your space</span> to{' '}
            <span className="text-purple-400 font-semibold">play, earn, and have fun</span>. Every game you try helps you collect{' '}
            <span className="text-pink-400 font-semibold">MeowMiles</span> and level up in the community.
          </p>
          <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto mt-1 leading-relaxed">
            No pressure, just <span className="text-cyan-400 font-semibold">good vibes</span>,{' '}
            <span className="text-purple-400 font-semibold">cool games</span>, and a chance to win some{' '}
            <span className="text-pink-400 font-semibold">real rewards</span> while you’re at it.
          </p>
          <p className="text-base md:text-lg font-bold text-cyan-400 mt-2">Let’s play and make it count!</p>
        </div>

        {/* Game Stats */}
        <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-md shadow-purple-500/20 mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-semibold text-purple-400 mb-4">Your Game Stats</h3>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-gray-300">
                Total Meow Miles: <span className="text-cyan-400 font-bold">{gamesGmeow}</span>
              </p>
              <p className="text-gray-300">
                Last Claimed:{' '}
                <span className="text-cyan-400 font-bold">
                  {lastClaimAmount ? `${lastClaimAmount.toFixed(3)} MON` : 'None'}
                </span>
              </p>
              <p className="text-gray-300">
                Next Claim: <span className="text-cyan-400 font-bold">{nextClaimThreshold} Meow Miles</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleClaim}
                disabled={isPending || hasClaimedAtCurrentLevel}
                className={`px-4 py-2 rounded-lg text-sm md:text-base font-semibold text-white transition-all duration-200 ${
                  isPending || hasClaimedAtCurrentLevel
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400'
                }`}
              >
                {isPending ? 'Claiming...' : `Claim $MON`}
              </button>
              {hasClaimedAtCurrentLevel && (
                <p className="text-sm text-yellow-400">
                  You already claimed at {nextClaimThreshold} Meow Miles! Earn {nextClaimThreshold + 1000} Meow Miles for your next claim.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-black/90 rounded-xl border border-purple-900 shadow-md shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 overflow-hidden flex flex-col"
            >
              <div className="w-full h-40 sm:h-48 relative">
                <Image
                  src={game.image}
                  alt={game.title}
                  width={300}
                  height={300}
                  className="w-full h-full object-cover rounded-t-xl"
                  onError={(e) => (e.currentTarget.src = 'https://picsum.photos/300/300?random=fallback')}
                />
                {game.comingSoon && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-yellow-400 font-bold text-base md:text-lg">Coming Soon</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-base md:text-lg font-semibold text-purple-400">{game.title}</h3>
                <p className="text-gray-300 text-sm mt-1">{game.description}</p>
                {!game.comingSoon && (
                  <p className="text-gray-300 text-sm mt-2">
                    Best Score: <span className="text-cyan-400 font-bold">{gameScores[game.id] || 0} Meow Miles</span>
                  </p>
                )}
                <Link
                  href={`/dashboard/games/${game.id}`}
                  className={`mt-4 inline-block px-4 py-2 md:px-6 md:py-2 rounded-lg text-sm md:text-base font-semibold text-white transition-all duration-200 transform hover:scale-105 ${
                    game.comingSoon
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400'
                  }`}
                  prefetch={true}
                >
                  {game.comingSoon ? 'Locked' : 'Play Now'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}