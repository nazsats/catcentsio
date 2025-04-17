'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Sidebar from '@/components/Sidebar';
import Profile from '@/components/Profile';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect } from 'wagmi';
import Image from 'next/image';

const DEPLOYED_DOMAIN = 'https://catcentsio.com';

const INITIAL_QUESTS = [
  { id: 'connect_twitter', title: 'Connect Twitter', description: 'Link your Twitter account', meowMiles: 30, completed: false, icon: '/quest/link.png' },
  { id: 'connect_discord', title: 'Connect Discord', description: 'Link your Discord account', meowMiles: 30, completed: false, icon: '/quest/discord.png' },
  { id: 'follow_twitter', title: 'Follow Twitter', description: 'Follow @CatCentsio on Twitter', meowMiles: 30, completed: false, icon: '/quest/x.png', taskUrl: 'https://x.com/CatCentsio' },
  { id: 'share_post', title: 'Share a Post', description: 'Tweet: I love @CatCentsio 🐱', meowMiles: 30, completed: false, icon: '/quest/post.png', taskUrl: 'https://x.com/intent/tweet?text=I%20love%20@CatCentsio%20🐱' },
  { id: 'like_rt', title: 'Like and RT', description: 'Like and retweet our post', meowMiles: 30, completed: false, icon: '/quest/Like.png', taskUrl: 'https://x.com/CatCentsio' },
  { id: 'join_catcents_server', title: 'Join Catcents Server', description: 'Join our Discord server', meowMiles: 30, completed: false, icon: '/quest/server.png', taskUrl: 'https://discord.gg/TXPbt7ztMC' },
  { id: 'join_telegram', title: 'Join Telegram', description: 'Join our Telegram channel', meowMiles: 30, completed: false, icon: '/quest/telegram.png', taskUrl: 'https://t.me/catcentsio' },
];

export default function QuestsPage() {
  const { address: account, isConnecting: loading } = useAccount();
  const { disconnect } = useDisconnect();
  const [quests, setQuests] = useState(INITIAL_QUESTS);
  const [meowMiles, setMeowMiles] = useState(0);
  const [referrals, setReferrals] = useState(0);
  const [referralLink, setReferralLink] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [processingQuestId, setProcessingQuestId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [hasProcessedParams, setHasProcessedParams] = useState(false);

  const fetchUserData = async (address: string) => {
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', address);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        console.log('Fetched Firebase data:', data);
        const storedQuests = data.quests || {};
        setQuests(
          INITIAL_QUESTS.map((quest) => ({
            ...quest,
            completed: storedQuests[quest.id] || false,
          }))
        );
        setMeowMiles(data.meowMiles || 0);
        setReferrals(data.referrals?.length || 0);

        const newReferralLink = `${DEPLOYED_DOMAIN}/?ref=${address}`;
        setReferralLink(newReferralLink);

        if (data.referralLink && data.referralLink !== newReferralLink) {
          await setDoc(userRef, { referralLink: newReferralLink }, { merge: true });
        }
      } else {
        const newReferralLink = `${DEPLOYED_DOMAIN}/?ref=${address}`;
        await setDoc(userRef, {
          walletAddress: address,
          meowMiles: 0,
          referrals: [],
          quests: {},
          referralLink: newReferralLink,
        });
        setReferralLink(newReferralLink);
      }
    } catch (error: unknown) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load quests. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const completeQuest = useCallback(async (questId: string) => {
    if (!account) return;
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.completed) return;

    const userRef = doc(db, 'users', account);
    const userSnap = await getDoc(userRef);
    const currentData = userSnap.exists() ? userSnap.data() : {};
    const currentQuests = currentData.quests || {};
    if (currentQuests[questId]) {
      console.log(`Quest ${questId} already completed in Firebase`);
      return;
    }

    const newQuests = quests.map((q) => (q.id === questId ? { ...q, completed: true } : q));
    const newMeowMiles = (currentData.meowMiles || 0) + quest.meowMiles;

    setQuests(newQuests);
    setMeowMiles(newMeowMiles);
    setProcessingQuestId(null);

    try {
      await setDoc(
        userRef,
        {
          meowMiles: newMeowMiles,
          quests: { ...currentQuests, [questId]: true },
        },
        { merge: true }
      );
      toast.success(`${quest.title} completed! +${quest.meowMiles} Meow Miles`);
    } catch (error: unknown) {
      console.error('Failed to complete quest:', error);
      toast.error('Failed to complete quest.');
      setQuests(quests); // Revert local state on failure
    }
  }, [account, quests]);

  const handleTaskStart = async (quest: typeof INITIAL_QUESTS[0]) => {
    if (quest.completed || processingQuestId) return;

    setProcessingQuestId(quest.id);
    console.log('Starting quest:', quest.id, 'URL:', quest.taskUrl);

    try {
      if (quest.id === 'connect_twitter') {
        window.location.href = `/api/twitter/auth?walletAddress=${account}`;
      } else if (quest.id === 'connect_discord') {
        window.location.href = `/api/discord/auth?walletAddress=${account}`;
      } else if (quest.taskUrl) {
        const newWindow = window.open(quest.taskUrl, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          throw new Error('Failed to open window. Please allow pop-ups.');
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await completeQuest(quest.id);
      }
    } catch (error: unknown) {
      console.error('Error in handleTaskStart:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start quest.';
      toast.error(errorMessage);
      setProcessingQuestId(null);
    }
  };

  const handleCopyReferralLink = () => {
    if (account) {
      const referralLinkToCopy = `${DEPLOYED_DOMAIN}/?ref=${account}`;
      navigator.clipboard.writeText(referralLinkToCopy);
      toast.success('Referral link copied!');
    }
  };

  const handleCopyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      toast.success('Address copied!');
    }
  };

  // Handle query parameters (success/error) in a separate useEffect
  useEffect(() => {
    if (hasProcessedParams || !account || loading) return;

    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'twitter_connected') {
      toast.success('Twitter connected successfully!');
      completeQuest('connect_twitter');
      router.replace('/dashboard/quests');
      setHasProcessedParams(true);
    } else if (success === 'discord_connected') {
      toast.success('Discord connected successfully!');
      completeQuest('connect_discord');
      router.replace('/dashboard/quests');
      setHasProcessedParams(true);
    } else if (error === 'twitter_failed') {
      toast.error('Failed to connect Twitter.');
      router.replace('/dashboard/quests');
      setHasProcessedParams(true);
    } else if (error === 'discord_failed') {
      toast.error('Failed to connect Discord.');
      router.replace('/dashboard/quests');
      setHasProcessedParams(true);
    }
  }, [account, loading, searchParams, completeQuest, router, hasProcessedParams]);

  // Main useEffect for fetching user data and handling redirects
  useEffect(() => {
    console.log('Quests useEffect - Account:', account, 'Loading:', loading, 'HasRedirected:', hasRedirected);
    if (loading) return;

    if (!account && !hasRedirected) {
      console.log('Quests - Redirecting to /');
      setHasRedirected(true);
      router.push('/');
      return;
    }

    if (account) {
      fetchUserData(account);
    }
  }, [account, loading, router, hasRedirected]);

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <svg className="animate-spin h-8 w-8 text-purple-400" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Sidebar onDisconnect={disconnect} />
      <main className="flex-1 p-4 md:p-8">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
            Catcentsio Quests
          </h1>
          <div className="ml-auto">
            <Profile account={account} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
          </div>
        </div>

        <div className="space-y-8 md:space-y-10">
          {/* Meow Miles Section */}
          <div className="text-center bg-black/80 rounded-xl p-6 md:p-8 border border-purple-900/50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow duration-300">
            <h2 className="text-2xl md:text-3xl font-semibold text-purple-300 mb-4">Your Meow Miles</h2>
            <p className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent animate-pulse-slow">
              {meowMiles}
            </p>
            <p className="text-sm md:text-base text-gray-400 mt-2">Complete quests to earn more!</p>
          </div>

          {/* Quests Section */}
          <div>
            <h3 className="text-xl md:text-2xl font-semibold mb-6 text-purple-300">Quests</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {quests.map((quest) => (
                <div
                  key={quest.id}
                  className={`bg-black/90 rounded-xl p-5 border border-purple-900/50 shadow-md shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 ${
                    quest.completed ? 'opacity-80' : 'hover:-translate-y-1'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <Image
                      src={quest.icon}
                      alt={`${quest.title} Icon`}
                      width={48}
                      height={48}
                      className="w-12 h-12 object-contain"
                    />
                    <div className="flex-1">
                      <p className="text-lg md:text-xl font-semibold text-purple-200">{quest.title}</p>
                      <p className="text-sm text-gray-300">{quest.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-cyan-400 font-medium text-base">{quest.meowMiles} Miles</p>
                    <button
                      onClick={() => handleTaskStart(quest)}
                      disabled={quest.completed || processingQuestId === quest.id}
                      className={`px-4 py-2 rounded-lg font-medium text-base transition-all duration-200 ${
                        quest.completed
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : processingQuestId === quest.id
                          ? 'bg-yellow-600 text-white cursor-not-allowed animate-pulse'
                          : 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:from-purple-500 hover:to-cyan-400 hover:scale-105'
                      }`}
                    >
                      {quest.completed
                        ? 'Completed'
                        : processingQuestId === quest.id
                        ? 'Processing'
                        : quest.id === 'connect_twitter'
                        ? 'Connect Twitter'
                        : quest.id === 'connect_discord'
                        ? 'Connect Discord'
                        : 'Start'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Referral Section */}
          <div>
            <h3 className="text-xl md:text-2xl font-semibold mb-6 text-purple-300">Refer Friends</h3>
            <div className="bg-gradient-to-br from-black/90 to-purple-950/90 rounded-xl p-6 md:p-8 border border-purple-700 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow duration-300">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-lg md:text-xl font-semibold text-purple-200">Invite Your Friends</p>
                  <p className="text-sm md:text-base text-gray-400 mt-2">
                    Earn <span className="text-cyan-400 font-bold">500 Meow Miles</span> per referral! (
                    {referrals} referrals,{' '}
                    <span className="text-cyan-400 font-bold">{referrals * 500} Miles</span> earned)
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    className="w-full sm:w-64 p-3 bg-gray-800/80 text-gray-200 rounded-lg border border-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                  <button
                    onClick={handleCopyReferralLink}
                    className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-purple-700 to-cyan-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-cyan-400 hover:scale-105 transition-all duration-300"
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
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}