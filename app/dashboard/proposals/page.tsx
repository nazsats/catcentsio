'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  increment,
  addDoc,
} from 'firebase/firestore';
import Sidebar from '../../../components/Sidebar';
import Profile from '../../../components/Profile';
import Loader from '../../../components/Loader';
import toast, { Toaster } from 'react-hot-toast';
import Image from 'next/image';
import {
  useAccount,
  useWriteContract,
  useReadContracts,
  useSwitchChain,
  useBalance,
  useDisconnect,
} from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';

const DEMO_PROPOSALS = [
  {
    author: 'CatLord',
    title: 'Decentralized Node Hub',
    content: 'Deploy validator nodes.',
    date: new Date().toISOString(),
    image: '/proposals/1.png',
    yesVotes: 0,
    noVotes: 0,
    contractProposalId: 0,
  },
  {
    author: 'PurrMaster',
    title: 'DeFi Incubator',
    content: 'Fund DeFi development.',
    date: new Date(Date.now() - 86400000).toISOString(),
    image: '/proposals/2.png',
    yesVotes: 0,
    noVotes: 0,
    contractProposalId: 1,
  },
  {
    author: 'WhiskerWizard',
    title: 'Cross-Chain Bridge',
    content: 'Connect Monad to other chains.',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    image: '/proposals/3.png',
    yesVotes: 0,
    noVotes: 0,
    contractProposalId: 2,
  },
];

const catEmojis = ['😺', '🐱', '🐾', '🐈', '😻', '🙀', '🐯', '🦁', '🐰', '🐾'];
const getRandomCatEmoji = (seed: string) => {
  const index = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % catEmojis.length;
  return catEmojis[index];
};

const CONTRACT_ADDRESS: `0x${string}` = '0x9C451d8065314504Bb90f37c8b6431c57Fc655C4';
const contractAbi = [
  {
    type: 'function',
    name: 'voteYes',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'voteNo',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getVoteCount',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'yes', type: 'uint256' },
      { name: 'no', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Voted',
    inputs: [
      { name: 'voter', type: 'address', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: false },
      { name: 'voteYes', type: 'bool', indexed: false },
    ],
  },
] as const;

export default function Proposals() {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { data: balanceData } = useBalance({ address, chainId: monadTestnet.id });
  const [proposals, setProposals] = useState<
    {
      id: string;
      author: string;
      title: string;
      content: string;
      date: string;
      image?: string;
      yesVotes: number;
      noVotes: number;
      likedByUser: boolean;
      votedByUser: 'yes' | 'no' | null;
      isExpanded: boolean;
      isLiking?: boolean;
      isVoting?: boolean;
      contractProposalId: number;
      isVotable: boolean;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('Latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [votesCast, setVotesCast] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const cardsPerPage = 20;
  const router = useRouter();
  const contentPreviewLength = 100;
  const [hasRedirected, setHasRedirected] = useState(false);

  // Fetch vote counts for all proposals using useReadContracts
  const voteCountQueries = useMemo(
    () =>
      proposals.map((proposal) => ({
        address: CONTRACT_ADDRESS,
        abi: contractAbi,
        functionName: 'getVoteCount',
        args: [BigInt(proposal.contractProposalId)],
      })),
    [proposals]
  );

  const { data: voteCountsData } = useReadContracts({
    contracts: voteCountQueries,
    query: {
      enabled: proposals.length > 0,
    },
  });

  const fetchProposalsAndUserData = async (userAddress: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const propQuery = query(collection(db, 'proposals'), orderBy('date', 'desc'));
      const propSnapshot = await getDocs(propQuery);
      console.log('Fetched proposals:', propSnapshot.docs.map((doc) => doc.data()));

      if (propSnapshot.empty) {
        console.log('Initializing demo proposals...');
        const addPromises = DEMO_PROPOSALS.map((prop) =>
          addDoc(collection(db, 'proposals'), {
            ...prop,
            date: Timestamp.fromDate(new Date(prop.date)),
            likes: 0,
          })
        );
        await Promise.all(addPromises);
      }

      const updatedPropSnapshot = await getDocs(propQuery);
      const fetchedProposals = await Promise.all(
        updatedPropSnapshot.docs.map(async (propDoc) => {
          const propData = propDoc.data();
          const likesCollection = collection(db, 'proposals', propDoc.id, 'likes');
          const likesSnap = await getDocs(likesCollection);
          const userLiked = likesSnap.docs.some((doc) => doc.id === userAddress);
          const userVoteDoc = await getDoc(doc(db, 'proposals', propDoc.id, 'votes', userAddress));
          const userVote = userVoteDoc.exists() ? userVoteDoc.data().vote : null;

          const date = propData.date instanceof Timestamp ? propData.date.toDate() : new Date(propData.date || Date.now());
          return {
            id: propDoc.id,
            author: propData.author,
            title: propData.title,
            content: propData.content,
            date: date.toISOString(),
            image: propData.image || '/proposals/placeholder.png',
            yesVotes: propData.yesVotes || 0,
            noVotes: propData.noVotes || 0,
            likedByUser: userLiked,
            votedByUser: userVote,
            isExpanded: false,
            isLiking: false,
            isVoting: false,
            contractProposalId: Number(propData.contractProposalId) || 0,
            isVotable: true,
          };
        })
      );

      // Check for duplicate contractProposalId values
      const proposalIdMap = new Map<number, string[]>();
      fetchedProposals.forEach((prop) => {
        if (!proposalIdMap.has(prop.contractProposalId)) {
          proposalIdMap.set(prop.contractProposalId, []);
        }
        proposalIdMap.get(prop.contractProposalId)!.push(prop.id);
      });

      const updatedProposals = fetchedProposals.map((prop) => {
        const idsWithSameContractId = proposalIdMap.get(prop.contractProposalId);
        const isVotable = !!idsWithSameContractId && idsWithSameContractId.length === 1 && !prop.votedByUser;
        if (!isVotable && idsWithSameContractId && idsWithSameContractId.length > 1) {
          console.warn(
            `Duplicate contractProposalId ${prop.contractProposalId} found for proposals: ${idsWithSameContractId.join(', ')}`
          );
        }
        return { ...prop, isVotable };
      });

      console.log('Mapped proposals:', updatedProposals);
      setProposals(updatedProposals);

      let totalVotes = 0;
      await Promise.all(
        updatedPropSnapshot.docs.map(async (propDoc) => {
          const voteDoc = await getDoc(doc(db, 'proposals', propDoc.id, 'votes', userAddress));
          if (voteDoc.exists()) totalVotes += 1;
        })
      );
      setVotesCast(totalVotes);

      const userRef = doc(db, 'users', userAddress);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : { proposalsGmeow: 0 };
      setPointsEarned(userData.proposalsGmeow || 0);
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
      setError('Failed to load proposals: ' + (error as Error).message);
      toast.error('Failed to load proposals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('Proposals useEffect - Address:', address, 'IsConnecting:', isConnecting, 'HasRedirected:', hasRedirected);
    if (isConnecting) return;
    if (!address && !hasRedirected) {
      console.log('Proposals - Redirecting to /');
      setHasRedirected(true);
      router.push('/');
      return;
    }
    if (address) {
      fetchProposalsAndUserData(address);
    }
  }, [address, isConnecting, router, hasRedirected]);

  const handleLike = async (propId: string) => {
    if (!address) return;
    const index = proposals.findIndex((p) => p.id === propId);
    if (index === -1 || proposals[index].likedByUser) return;

    setProposals((prev) => prev.map((prop, i) => (i === index ? { ...prop, isLiking: true } : prop)));

    const likeRef = doc(db, 'proposals', propId, 'likes', address);

    try {
      const likeSnap = await getDoc(likeRef);
      if (!likeSnap.exists()) {
        await setDoc(likeRef, { likedAt: new Date().toISOString() });
        setProposals((prev) =>
          prev.map((prop, i) => (i === index ? { ...prop, likedByUser: true, isLiking: false } : prop))
        );
        toast.success('Liked proposal!');
      }
    } catch (error) {
      console.error('Failed to like proposal:', error);
      toast.error('Failed to like proposal.');
      setProposals((prev) => prev.map((prop, i) => (i === index ? { ...prop, isLiking: false } : prop)));
    }
  };

  const handleVote = async (propId: string, vote: 'yes' | 'no') => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }
    const index = proposals.findIndex((p) => p.id === propId);
    if (index === -1 || proposals[index].votedByUser || proposals[index].isVoting || !proposals[index].isVotable) {
      if (!proposals[index].isVotable && !proposals[index].votedByUser) {
        toast.error('Voting is disabled due to an invalid proposal ID.', { duration: 5000 });
      }
      return;
    }

    const proposal = proposals[index];
    const contractProposalId = BigInt(proposal.contractProposalId);

    setProposals((prev) => prev.map((prop, i) => (i === index ? { ...prop, isVoting: true } : prop)));

    const pendingToast = toast.loading(`Processing ${vote} vote...`);

    try {
      // Switch to Monad Testnet
      await switchChain({ chainId: monadTestnet.id });

      // Check balance
      if (!balanceData || balanceData.value === BigInt(0)) {
        throw new Error('Insufficient MON balance. Please claim testnet tokens from the Monad faucet.');
      }

      // Vote using writeContract
      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: contractAbi,
          functionName: vote === 'yes' ? 'voteYes' : 'voteNo',
          args: [contractProposalId],
        },
        {
          onSuccess: async (txHash) => {
            // Update Firestore
            const propRef = doc(db, 'proposals', propId);
            const voteRef = doc(db, 'proposals', propId, 'votes', address);
            const userRef = doc(db, 'users', address);

            await setDoc(voteRef, { vote, votedAt: new Date().toISOString(), txHash });
            await setDoc(propRef, { [vote === 'yes' ? 'yesVotes' : 'noVotes']: increment(1) }, { merge: true });
            await setDoc(userRef, { proposalsGmeow: increment(10) }, { merge: true });

            setProposals((prev) =>
              prev.map((prop, i) =>
                i === index
                  ? {
                      ...prop,
                      [vote === 'yes' ? 'yesVotes' : 'noVotes']: prop[vote === 'yes' ? 'yesVotes' : 'noVotes'] + 1,
                      votedByUser: vote,
                      isVoting: false,
                    }
                  : prop
              )
            );
            setVotesCast((prev) => prev + 1);
            setPointsEarned((prev) => prev + 10);

            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Voted {vote} successfully! +10 Meow Miles{' '}
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
          },
          onError: (error) => {
            throw error;
          },
        }
      );
    } catch (error: unknown) {
      console.error('Failed to vote:', error);
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
                className="underline text-cyan-400"
              >
                Claim MON tokens
              </a>
            </div>,
            { duration: 5000 }
          );
        } else if (errorMessage.includes('User rejected the request')) {
          toast.error('Transaction rejected by user.', { duration: 5000 });
        } else if (errorMessage.includes('Already voted')) {
          toast.error('You have already voted on this proposal.', { duration: 5000 });
          setProposals((prev) =>
            prev.map((prop, i) => (i === index ? { ...prop, isVotable: false, isVoting: false } : prop))
          );
        } else {
          toast.error(`Failed to vote: ${errorMessage}`, { duration: 5000 });
        }
      } else {
        toast.error(`Failed to vote: ${errorMessage}`, { duration: 5000 });
      }
      setProposals((prev) => prev.map((prop, i) => (i === index ? { ...prop, isVoting: false } : prop)));
    }
  };

  const handleShowMore = (propId: string) => {
    setProposals((prev) => prev.map((prop) => (prop.id === propId ? { ...prop, isExpanded: !prop.isExpanded } : prop)));
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied!');
    }
  };

  const sortProposals = useMemo(() => {
    const sorted = [...proposals];
    switch (category) {
      case 'All':
      case 'Latest':
        return sorted;
      case 'Trending':
        return sorted.sort((a, b) => b.yesVotes + b.noVotes - (a.yesVotes + a.noVotes));
      default:
        return sorted;
    }
  }, [proposals, category]);

  const totalPages = Math.ceil(sortProposals.length / cardsPerPage);
  const startIndex = (currentPage - 1) * cardsPerPage;
  const paginatedProposals = sortProposals.slice(startIndex, startIndex + cardsPerPage);

  if (isConnecting || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <Loader size={48} />
      </div>
    );
  }

  if (!address) return null;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Sidebar onDisconnect={disconnect} />
      <main className="flex-1 p-4 md:p-8">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <h2 className="text-2xl md:text-3xl font-bold text-purple-300">Proposals</h2>
          <div className="ml-auto">
            <Profile account={address} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg mb-6 bg-red-900/80 text-red-200 border border-red-500 text-center">{error}</div>
        )}

        <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-md shadow-purple-500/20 mb-6 md:mb-8 flex flex-col-reverse md:flex-row items-center gap-6">
          <div className="w-full md:w-2/3 text-center md:text-left">
            <h3 className="text-xl md:text-2xl font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 bg-clip-text text-transparent mb-3">
              Shape the Future of the Ecosystem
            </h3>
            <p className="text-sm md:text-base text-gray-300 leading-relaxed">
              <span className="text-cyan-400 font-semibold">Your voice matters here.</span> Vote on proposals that impact not just{' '}
              <span className="text-purple-400 font-semibold">Catcents</span>, but the entire ecosystem we’re building together.
            </p>
            <p className="text-sm md:text-base text-gray-300 mt-2 leading-relaxed">
              Earn <span className="text-pink-400 font-semibold">Meow Miles</span>. Influence what’s next.
            </p>
            <p className="text-base md:text-lg font-bold text-cyan-400 mt-2">Let’s shape it, together.</p>
          </div>
          <div className="w-full md:w-1/3 flex-shrink-0">
            <Image
              src="/proposals/character.png"
              alt="Proposals Character"
              width={300}
              height={300}
              className="w-full h-auto object-contain rounded-lg"
              priority
            />
          </div>
        </div>

        <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-md shadow-purple-500/20 mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-semibold text-purple-400 mb-4">Your Voting Stats</h3>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <p className="text-gray-300">
              Votes Cast: <span className="text-cyan-400 font-bold">{votesCast}</span>
            </p>
            <p className="text-gray-300">
              Points Earned: <span className="text-cyan-400 font-bold">{pointsEarned} Meow Miles</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-4 mb-6">
          {['All', 'Latest', 'Trending'].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-sm md:text-base font-semibold transition-all duration-200 ${
                category === cat
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {paginatedProposals.map((proposal) => {
            const voteCounts = voteCountsData?.[proposals.indexOf(proposal)]?.result;
            const yesVotes = voteCounts ? Number(voteCounts[0]) : proposal.yesVotes;
            const noVotes = voteCounts ? Number(voteCounts[1]) : proposal.noVotes;
            const totalVotes = yesVotes + noVotes;
            const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
            const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;
            const status = yesPercentage > noPercentage ? 'Winning' : yesPercentage === noPercentage ? 'Tied' : 'Losing';

            return (
              <div
                key={proposal.id}
                className="bg-black/90 rounded-xl border border-purple-900 shadow-md shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {proposal.image && (
                  <Image
                    src={proposal.image}
                    alt={proposal.title}
                    width={600}
                    height={192}
                    className="w-full h-40 sm:h-48 object-cover"
                    onError={(e) => (e.currentTarget.src = '/proposals/placeholder.png')}
                  />
                )}
                <div className="p-4 flex flex-col flex-grow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-xl md:text-2xl">
                        {getRandomCatEmoji(proposal.author)}
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-purple-400">{proposal.title}</h3>
                        <p className="text-xs md:text-sm text-cyan-400 italic">By {proposal.author}</p>
                      </div>
                    </div>
                    <div
                      className={`text-white text-xs font-bold px-2 py-1 rounded-full ${
                        status === 'Winning' ? 'bg-green-500' : status === 'Losing' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                    >
                      {status}
                    </div>
                  </div>
                  <div
                    className={`transition-all duration-500 ${proposal.isExpanded ? 'max-h-96' : 'max-h-16'} overflow-hidden whitespace-pre-wrap`}
                  >
                    <p className="text-gray-300 text-sm">{proposal.content}</p>
                  </div>
                  {proposal.content.length > contentPreviewLength && (
                    <button
                      onClick={() => handleShowMore(proposal.id)}
                      className="text-purple-400 hover:text-purple-300 text-sm mt-2"
                    >
                      {proposal.isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  )}
                </div>
                <div className="p-4 mt-auto border-t border-purple-900/50">
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-300 mb-1">
                        <span>Yes: {yesVotes}</span>
                        <span>{yesPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 md:h-3 overflow-hidden">
                        <div className="bg-green-500 h-full" style={{ width: `${yesPercentage}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-300 mb-1">
                        <span>No: {noVotes}</span>
                        <span>{noPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 md:h-3 overflow-hidden">
                        <div className="bg-red-500 h-full" style={{ width: `${noPercentage}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 mt-4">
                    {proposal.votedByUser ? (
                      <span className="text-gray-400 text-xs md:text-sm font-semibold px-3 py-1 md:px-4 md:py-2 bg-gray-800 rounded-full">
                        Vote Cast: {proposal.votedByUser === 'yes' ? 'Yes 👍' : 'No 👎'}
                      </span>
                    ) : !proposal.isVotable ? (
                      <span className="text-gray-400 text-xs md:text-sm font-semibold px-3 py-1 md:px-4 md:py-2 bg-gray-800 rounded-full">
                        Voting Disabled: Invalid Proposal ID
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleVote(proposal.id, 'yes')}
                          disabled={isPending || proposal.isVoting || !isConnected}
                          className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium text-white ${
                            isPending || proposal.isVoting || !isConnected
                              ? 'bg-gray-600 cursor-not-allowed'
                              : 'bg-gradient-to-r from-green-600 to-green-400 hover:from-green-500 hover:to-green-300'
                          }`}
                        >
                          {proposal.isVoting ? (
                            <span className="flex items-center">
                              <Loader size={16} className="mr-2" />
                              Voting...
                            </span>
                          ) : (
                            'Yes 👍'
                          )}
                        </button>
                        <button
                          onClick={() => handleVote(proposal.id, 'no')}
                          disabled={isPending || proposal.isVoting || !isConnected}
                          className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium text-white ${
                            isPending || proposal.isVoting || !isConnected
                              ? 'bg-gray-600 cursor-not-allowed'
                              : 'bg-gradient-to-r from-red-600 to-red-400 hover:from-red-500 hover:to-red-300'
                          }`}
                        >
                          {proposal.isVoting ? (
                            <span className="flex items-center">
                              <Loader size={16} className="mr-2" />
                              Voting...
                            </span>
                          ) : (
                            'No 👎'
                          )}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleLike(proposal.id)}
                      disabled={proposal.likedByUser || proposal.isLiking}
                      className={`px-2 py-1 md:px-3 md:py-2 rounded-full text-xs md:text-sm font-medium text-white ${
                        proposal.likedByUser
                          ? 'bg-purple-600 cursor-not-allowed'
                          : proposal.isLiking
                          ? 'bg-purple-700 animate-pulse'
                          : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400'
                      }`}
                    >
                      {proposal.isLiking ? (
                        <span className="flex items-center">
                          <Loader size={16} className="mr-2" />
                          Liking...
                        </span>
                      ) : (
                        '❤️'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-6 md:mt-8">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 md:px-4 md:py-2 bg-gray-800 text-gray-300 rounded-full text-sm md:text-base font-semibold disabled:opacity-50 hover:bg-gray-700 transition-all duration-200"
            >
              Previous
            </button>
            <span className="text-gray-300 text-sm md:text-base">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 md:px-4 md:py-2 bg-gray-800 text-gray-300 rounded-full text-sm md:text-base font-semibold disabled:opacity-50 hover:bg-gray-700 transition-all duration-200"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}