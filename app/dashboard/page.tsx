'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import Sidebar from '@/components/Sidebar';
import Profile from '@/components/Profile';
import Badges from '@/components/Badges';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Loader from '@/components/Loader'; // Import Loader
import { useAccount, useDisconnect, useBalance, useSendTransaction } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';

export default function DashboardPage() {
  const { address: account, isConnecting: loading } = useAccount();
  const { disconnect } = useDisconnect();
  const { sendTransaction } = useSendTransaction();
  const { data: balanceData } = useBalance({ address: account, chainId: monadTestnet.id });
  const [meowMiles, setMeowMiles] = useState({ quests: 0, proposals: 0, games: 0, referrals: 0, total: 0 });
  const [monBalance, setMonBalance] = useState<string>('0');
  const [lastCheckIn, setLastCheckIn] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('24:00:00');
  const [checkingIn, setCheckingIn] = useState(false);
  const [referralsList, setReferralsList] = useState<string[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [hasRedirected, setHasRedirected] = useState(false);

  const CHECK_IN_ADDRESS = '0xfF8b7625894441C26fEd460dD21360500BF4E767';

  // Fetch user data with React Query
  const fetchUserData = async (address: string) => {
    console.log('fetchUserData called with address:', address);
    const userRef = doc(db, 'users', address);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      console.log('Firebase data:', data);
      return {
        quests: Math.floor(data.meowMiles || 0),
        proposals: Math.floor(data.proposalsGmeow || 0),
        games: Math.floor(data.gamesGmeow || 0),
        referrals: Math.floor(data.referrals?.length || 0),
        total: Math.floor((data.meowMiles || 0) + (data.proposalsGmeow || 0) + (data.gamesGmeow || 0) + (data.referrals?.length || 0)),
        lastCheckIn: data.lastCheckIn || null,
        referralsList: data.referrals || [],
      };
    }
    return null;
  };

  const { data: userData, isLoading: userDataLoading } = useQuery({
    queryKey: ['userData', account],
    queryFn: () => fetchUserData(account!),
    enabled: !!account,
  });

  useEffect(() => {
    if (userData) {
      setMeowMiles({
        quests: userData.quests,
        proposals: userData.proposals,
        games: userData.games,
        referrals: userData.referrals,
        total: userData.total,
      });
      setLastCheckIn(userData.lastCheckIn);
      setReferralsList(userData.referralsList);
      if (userData.lastCheckIn) startCountdown(userData.lastCheckIn);
    }
  }, [userData]);

  // Update MON balance
  useEffect(() => {
    if (balanceData) {
      setMonBalance(Number(balanceData.formatted).toFixed(6));
    } else {
      setMonBalance('N/A');
    }
  }, [balanceData]);

  // Handle redirect to landing if not connected
  useEffect(() => {
    console.log('Dashboard - useEffect - Account:', account, 'Loading:', loading);
    if (!account && !loading && !hasRedirected) {
      console.log('No account, redirecting to /');
      setHasRedirected(true);
      router.replace('/');
    }
  }, [account, loading, router, hasRedirected]);

  // Handle daily check-in with Wagmi
  const handleDailyCheckIn = async () => {
    console.log('Check-in initiated:', { account, checkingIn });
    if (!account || checkingIn) {
      console.warn('Check-in aborted: missing account or already checking in');
      toast.error('Please ensure a wallet is connected.');
      return;
    }
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (lastCheckIn && now - lastCheckIn < oneDay) {
      console.log('Check-in not allowed yet:', { lastCheckIn, timeLeft: oneDay - (now - lastCheckIn) });
      toast.error('Check-in not available yet.');
      return;
    }

    setCheckingIn(true);
    const pendingToast = toast.loading('Processing check-in...');
    try {
      sendTransaction(
        {
          to: CHECK_IN_ADDRESS,
          value: BigInt(0),
          gas: BigInt(21000),
          gasPrice: BigInt(1000000000),
        },
        {
          onSuccess: async (hash) => {
            console.log('Transaction confirmed:', hash);
            const userRef = doc(db, 'users', account);
            await setDoc(userRef, { lastCheckIn: now, meowMiles: increment(10) }, { merge: true });

            setLastCheckIn(now);
            startCountdown(now);
            queryClient.invalidateQueries({ queryKey: ['userData', account] });

            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Check-in completed! You earned 10 MeowMiles.{' '}
                <a
                  href={`https://testnet.monadscan.com/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-cyan-400 hover:text-cyan-300"
                >
                  View on MonadScan
                </a>
              </div>,
              { duration: 5000 }
            );
          },
          onError: (err) => {
            console.error('Check-in error:', err);
            toast.dismiss(pendingToast);
            if (err.message.includes('insufficient funds')) {
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
            } else {
              toast.error(`Failed to check-in: ${err.message}`, { duration: 5000 });
            }
          },
        }
      );
    } catch (error: unknown) {
        console.error('Daily check-in failed:', error);
        toast.dismiss(pendingToast);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to check-in: ${errorMessage}`, { duration: 5000 });
      }finally {
      setCheckingIn(false);
    }
  };

  const startCountdown = (lastCheckInTime: number) => {
    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = 24 * 60 * 60 * 1000 - (now - lastCheckInTime);
      if (timeLeft <= 0) {
        setCountdown('00:00:00');
        setLastCheckIn(null);
        return;
      }
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  };

  const handleCopyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      toast.success('Address copied!');
    }
  };

  const handleCopyReferralLink = () => {
    if (account) {
      const referralLink = `${window.location.origin}/?ref=${account}`;
      navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied!');
    }
  };

  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 7)}...${address.slice(-6)}`;
  };

  if (userDataLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <Loader size={48} />
      </div>
    );
  }
  if (!account) return null;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Sidebar onDisconnect={disconnect} />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Toaster position="top-right" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold text-purple-300">Dashboard</h2>
          <div className="ml-auto">
            <Profile account={account} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-3">
            <h4 className="text-lg font-semibold text-purple-400 mb-4">Daily Check-In</h4>
            <div className="space-y-4">
              <p className="text-center text-gray-300 text-sm md:text-base">
                Next check-in: <span className="font-mono text-cyan-400">{countdown}</span>
              </p>
              <button
                onClick={handleDailyCheckIn}
                className="w-full bg-gradient-to-r from-purple-700 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-cyan-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                disabled={checkingIn || (lastCheckIn !== null && Date.now() - lastCheckIn < 24 * 60 * 60 * 1000)}
              >
                {checkingIn ? (
                  <span className="flex items-center justify-center">
                    <Loader size={20} className="mr-2" />
                    Checking In...
                  </span>
                ) : (
                  'Check In'
                )}
              </button>
            </div>
          </div>

          <div className="bg-black/90 rounded-xl p-6 text-center border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-1 md:col-span-2">
            <h3 className="text-xl md:text-2xl font-bold text-purple-400 mb-2">Total Meow Miles</h3>
            <p className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 bg-clip-text text-transparent animate-pulse-slow">
              {meowMiles.total}
            </p>
          </div>

          <div className="hidden md:block bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-2">
            <h4 className="text-lg font-semibold text-purple-400 mb-2">Assets</h4>
            <p className="text-xl md:text-2xl font-bold text-cyan-400">MON: {monBalance}</p>
          </div>

          <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-4 md:col-span-2">
            <h4 className="text-lg md:text-xl font-semibold text-purple-400 mb-4">Score Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-purple-900/20 rounded-lg hover:bg-purple-900/30 transition-colors">
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  {meowMiles.quests}
                </p>
                <p className="text-sm text-gray-300">Quest Miles</p>
              </div>
              <div className="text-center p-4 bg-purple-900/20 rounded-lg hover:bg-purple-900/30 transition-colors">
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  {meowMiles.proposals}
                </p>
                <p className="text-sm text-gray-300">Proposal Miles</p>
              </div>
              <div className="text-center p-4 bg-purple-900/20 rounded-lg hover:bg-purple-900/30 transition-colors">
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  {meowMiles.games}
                </p>
                <p className="text-sm text-gray-300">Game Miles</p>
              </div>
              <div className="text-center p-4 bg-purple-900/20 rounded-lg hover:bg-purple-900/30 transition-colors">
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  {meowMiles.referrals}
                </p>
                <p className="text-sm text-gray-300">Referral Miles</p>
              </div>
            </div>
          </div>

          <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-5">
            <h4 className="text-lg font-semibold text-purple-400 mb-4">Invite Friends</h4>
            <button
              onClick={handleCopyReferralLink}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-700 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-cyan-400 transition-all duration-300 mb-6"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy Referral Link</span>
            </button>
            <div className="space-y-4">
              <p className="text-sm text-gray-300 font-semibold">Referred Wallets ({referralsList.length})</p>
              {referralsList.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-purple-900/50 bg-gray-900/80 shadow-inner">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-900 to-cyan-900 sticky top-0 text-white">
                        <th className="py-2 px-4 text-left font-semibold">Wallet</th>
                        <th className="py-2 px-4 text-right font-semibold">Ref #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralsList.map((wallet, index) => (
                        <tr
                          key={index}
                          className="border-t border-purple-900/30 hover:bg-purple-900/20 transition-colors duration-200"
                        >
                          <td className="py-3 px-4 text-cyan-400 font-mono">{shortenAddress(wallet)}</td>
                          <td className="py-3 px-4 text-right text-gray-300">{index + 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-900/50 rounded-lg">No referrals yet.</p>
              )}
            </div>
          </div>

          <div className="md:order-6 md:col-span-2">
            <Badges totalMeowMiles={meowMiles.total} />
          </div>
        </div>
      </main>
    </div>
  );
}