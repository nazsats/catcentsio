'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, QuerySnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAccount, useDisconnect } from 'wagmi';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Profile from '@/components/Profile';

interface UserData {
  walletAddress: string;
  totalMeowMiles: number; // Renamed to reflect the total
  meowMiles: number; // Quest and check-in miles
  proposalsGmeow: number;
  gamesGmeow: number;
  referrals: string[];
}

export default function LeaderboardPage() {
  const { address: connectedWallet } = useAccount();
  const { disconnect } = useDisconnect();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 20;
  const userRowRef = useRef<HTMLTableRowElement | null>(null);

  // Fetch all users from Firestore and calculate total Meow Miles
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        console.log('Leaderboard: Fetching users from Firestore');
        setIsLoading(true);
        const usersCollection = collection(db, 'users');
        const querySnapshot: QuerySnapshot = await getDocs(usersCollection);
        const usersData: UserData[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const referralCount = data.referrals?.length || 0;
          const totalMeowMiles = Math.floor(
            (Number(data.meowMiles) || 0) +
            (Number(data.proposalsGmeow) || 0) +
            (Number(data.gamesGmeow) || 0) +
            (referralCount * 500)
          );

          usersData.push({
            walletAddress: doc.id,
            totalMeowMiles,
            meowMiles: Number(data.meowMiles) || 0,
            proposalsGmeow: Number(data.proposalsGmeow) || 0,
            gamesGmeow: Number(data.gamesGmeow) || 0,
            referrals: data.referrals || [],
          });
        });

        // Sort by totalMeowMiles in descending order
        usersData.sort((a, b) => b.totalMeowMiles - a.totalMeowMiles);
        console.log('Leaderboard: Fetched and sorted users:', usersData);

        // If connected wallet is not in the list, add it with 0 points
        if (connectedWallet && !usersData.some(user => user.walletAddress.toLowerCase() === connectedWallet.toLowerCase())) {
          usersData.push({
            walletAddress: connectedWallet,
            totalMeowMiles: 0,
            meowMiles: 0,
            proposalsGmeow: 0,
            gamesGmeow: 0,
            referrals: [],
          });
          // Re-sort after adding the connected wallet
          usersData.sort((a, b) => b.totalMeowMiles - a.totalMeowMiles);
        }

        setUsers(usersData);
      } catch (error) {
        console.error('Leaderboard: Error fetching users:', error);
        toast.error('Failed to load leaderboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [connectedWallet]);

  // Scroll to the connected user's row on load
  useEffect(() => {
    if (userRowRef.current) {
      userRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [users, currentPage]);

  // Shorten wallet address for display
  const shortenAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Pagination logic (excluding top 3)
  const totalPages = Math.ceil((users.length - 3) / entriesPerPage); // Adjust for top 3
  const startIndex = 3 + (currentPage - 1) * entriesPerPage; // Start after top 3
  const endIndex = Math.min(startIndex + entriesPerPage, users.length);
  const paginatedUsers = users.slice(startIndex, endIndex);

  // Find the connected user's rank and data
  const connectedUserIndex = users.findIndex(
    (user) => connectedWallet && user.walletAddress.toLowerCase() === connectedWallet.toLowerCase()
  );
  const connectedUser = connectedUserIndex !== -1 ? users[connectedUserIndex] : null;

  // Animation variants for rows
  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
      },
    }),
  };

  // Animation for the connected user's row (pulsing effect)
  const pulseVariants = {
    pulse: {
      backgroundColor: ['rgba(34, 211, 238, 0.3)', 'rgba(34, 211, 238, 0.5)', 'rgba(34, 211, 238, 0.3)'],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  // Handle copy address for Profile component
  const handleCopyAddress = () => {
    if (connectedWallet) {
      navigator.clipboard.writeText(connectedWallet);
      toast.success('Address copied!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950 to-black text-gray-200 flex">
      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header Section: Title and Profile in the same row */}
          <div className="flex flex-row flex-wrap justify-between items-center mb-6 md:mb-8 gap-4">
            <h1 className="mt-20 text-xl md:text-2xl font-semibold text-purple-300">
              Leaderboard
            </h1>
            <Profile
              account={connectedWallet ?? null}
              onCopyAddress={handleCopyAddress}
              onDisconnect={disconnect}
            />
          </div>

          {/* Top 3 Podium with Images */}
          {!isLoading && users.length > 0 && (
            <div className="flex justify-center mb-12 mt-16 space-x-6 md:space-x-10">
              {/* Rank 2 (Silver) */}
              {users[1] && (
                <motion.div
                  className="flex flex-col items-center relative"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <span className="text-2xl md:text-3xl absolute -top-10 md:-top-10">🥈</span>
                  <div className="relative w-24 h-24 md:w-28 md:h-28">
                    <Image
                      src="/leaderboard/2.png"
                      alt="Rank 2"
                      layout="fill"
                      objectFit="cover"
                      className="rounded-t-full rounded-b-[40px] shadow-xl shadow-gray-500/50"
                    />
                  </div>
                  <p className="text-sm md:text-base text-gray-300 mt-2">{shortenAddress(users[1].walletAddress)}</p>
                  <p className="text-lg md:text-xl font-bold text-cyan-400">{users[1].totalMeowMiles}</p>
                </motion.div>
              )}

              {/* Rank 1 (Gold) */}
              {users[0] && (
                <motion.div
                  className="flex flex-col items-center relative"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="text-3xl md:text-4xl absolute -top-12 md:-top-10">🥇</span>
                  <div className="relative w-28 h-28 md:w-32 md:h-32">
                    <Image
                      src="/leaderboard/1.png"
                      alt="Rank 1"
                      layout="fill"
                      objectFit="cover"
                      className="rounded-t-full rounded-b-[50px] shadow-xl shadow-yellow-500/50"
                    />
                  </div>
                  <p className="text-sm md:text-base text-gray-300 mt-2">{shortenAddress(users[0].walletAddress)}</p>
                  <p className="text-xl md:text-2xl font-bold text-cyan-400">{users[0].totalMeowMiles}</p>
                </motion.div>
              )}

              {/* Rank 3 (Bronze) */}
              {users[2] && (
                <motion.div
                  className="flex flex-col items-center relative"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <span className="text-2xl md:text-3xl absolute -top-10 md:-top-10">🥉</span>
                  <div className="relative w-24 h-24 md:w-28 md:h-28">
                    <Image
                      src="/leaderboard/3.png"
                      alt="Rank 3"
                      layout="fill"
                      objectFit="cover"
                      className="rounded-t-full rounded-b-[40px] shadow-xl shadow-orange-500/50"
                    />
                  </div>
                  <p className="text-sm md:text-base text-gray-300 mt-2">{shortenAddress(users[2].walletAddress)}</p>
                  <p className="text-lg md:text-xl font-bold text-cyan-400">{users[2].totalMeowMiles}</p>
                </motion.div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
          ) : users.length <= 3 && !connectedWallet ? (
            <p className="text-center text-gray-400 text-lg">No additional ranks to display.</p>
          ) : (
            <>
              <div className="rounded-xl shadow-2xl shadow-purple-500/20 mb-6">
                <table className="w-full text-left border-collapse backdrop-blur-sm bg-black/80 table-auto">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-900 to-cyan-900 text-white">
                      <th className="py-4 px-6 text-sm md:text-base font-semibold">Rank</th>
                      <th className="py-4 px-6 text-sm md:text-base font-semibold">Wallet Address</th>
                      <th className="py-4 px-6 text-sm md:text-base font-semibold">Total Meow Miles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Active Wallet Section (Always Show if Connected) */}
                    {connectedWallet && (
                      <motion.tr
                        ref={userRowRef}
                        custom={connectedUserIndex}
                        initial="hidden"
                        animate="pulse"
                        variants={pulseVariants}
                        whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                        className="border-b border-purple-900/30 text-cyan-300 font-semibold relative"
                      >
                        <td className="py-4 px-6 text-sm md:text-base">
                          <span className="inline-block w-8 text-center">{connectedUserIndex + 1}</span>
                        </td>
                        <td className="py-4 px-6 text-sm md:text-base font-mono">
                          {shortenAddress(connectedWallet)}
                          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs bg-cyan-600 text-white px-2 py-1 rounded-full">
                            You
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm md:text-base text-cyan-400 font-medium">
                          {connectedUser ? connectedUser.totalMeowMiles : 0}
                        </td>
                      </motion.tr>
                    )}

                    {/* Ranks 4, 5, 6, ... */}
                    {paginatedUsers.map((user, index) => {
                      const globalIndex = startIndex + index;
                      return (
                        <motion.tr
                          key={user.walletAddress}
                          custom={globalIndex}
                          initial="hidden"
                          animate="visible"
                          variants={rowVariants}
                          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                          className="border-b border-purple-900/30 hover:bg-purple-900/20"
                        >
                          <td className="py-4 px-6 text-sm md:text-base">
                            <span className="inline-block w-8 text-center">{globalIndex + 1}</span>
                          </td>
                          <td className="py-4 px-6 text-sm md:text-base font-mono">
                            {shortenAddress(user.walletAddress)}
                          </td>
                          <td className="py-4 px-6 text-sm md:text-base text-cyan-400 font-medium">
                            {user.totalMeowMiles}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {users.length > 3 && (
                <div className="flex justify-center space-x-4 mt-6">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gradient-to-r from-purple-700 to-cyan-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-cyan-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-gray-300 self-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gradient-to-r from-purple-700 to-cyan-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-cyan-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}