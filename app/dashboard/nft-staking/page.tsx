'use client';

import { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract
} from 'wagmi';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast, Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { ethers } from 'ethers';
import nftAbi from '../../abis/CatcentsNFT.json';
import stakingAbi from '../../abis/NFTStaking.json';

const NFTStakingPage = () => {
  const { address, isConnected, status } = useAccount();
  const router = useRouter();

  const [nfts, setNfts] = useState<number[]>([]);
  const [stakedNfts, setStakedNfts] = useState<number[]>([]);
  const [pendingRewards, setPendingRewards] = useState<string>('0');
  const [nftImages, setNftImages] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // TODO: replace with your deployed addresses
  const NFT_CONTRACT_ADDRESS = '0xfa28a33f198dc84454881fbb14c9d69dea97efdb';
  const STAKING_CONTRACT_ADDRESS = '0x5f622919714aD0C7dAA9A220FC7bEbd8A24E3F8B';

  // Redirect if disconnected
  useEffect(() => {
    if (status === 'disconnected') router.push('/');
  }, [status, router]);

  // 1. Fetch balance
  const { data: balanceData } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: nftAbi,
    functionName: 'balanceOf',
    args: [address],
    chainId: 10143,
    query: { enabled: !!address && isConnected },
  });

  // 2. Fetch owned token IDs
  const ownedCount = balanceData ? Number(balanceData.toString()) : 0;
  const ownedQueries = ownedCount > 0
    ? Array.from({ length: ownedCount }, (_, i) => ({
        address: NFT_CONTRACT_ADDRESS,
        abi: nftAbi,
        functionName: 'tokenOfOwnerByIndex',
        args: [address, i],
        chainId: 10143,
      }))
    : [];
  const { data: ownedData } = useReadContracts({
    contracts: ownedQueries,
    query: { enabled: ownedQueries.length > 0 },
  });

  // 3. Fetch staked token IDs
  const { data: rawStaked } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: stakingAbi,
    functionName: 'getStakedTokens',
    args: [address],
    chainId: 10143,
    query: { enabled: !!address && isConnected },
  });

  // 4. Fetch pending rewards
  const { data: rewardsData } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: stakingAbi,
    functionName: 'getPendingRewards',
    args: [address],
    chainId: 10143,
    query: { enabled: !!address && isConnected },
  });

  // Assemble IDs and fetch URIs
  const ownedIds = ownedData
    ? ownedData.filter(r => r.status === 'success').map(r => Number((r.result as any).toString()))
    : [];
  const stakedIds = Array.isArray(rawStaked)
    ? (rawStaked as any[]).map(id => Number(id.toString()))
    : [];

  // Query URIs for all owned and staked IDs
  const uriQueries = [...ownedIds, ...stakedIds].map(id => ({
    address: NFT_CONTRACT_ADDRESS,
    abi: nftAbi,
    functionName: 'tokenURI',
    args: [id],
    chainId: 10143,
  }));
  const { data: uriData } = useReadContracts({
    contracts: uriQueries,
    query: { enabled: uriQueries.length > 0 },
  });

  const normalize = (uri: string) =>
    uri.startsWith('ipfs://')
      ? uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
      : uri;

  // Update state when data changes
  useEffect(() => {
    setNfts(ownedIds);
    setStakedNfts(stakedIds);
    if (rewardsData) setPendingRewards(ethers.utils.formatEther(rewardsData));
  }, [ownedIds, stakedIds, rewardsData]);

  // Fetch images
  useEffect(() => {
    if (!uriData) return;
    [...ownedIds, ...stakedIds].forEach((id, idx) => {
      const r = uriData[idx];
      if (r.status === 'success' && typeof r.result === 'string') {
        const metaUri = normalize(r.result);
        fetch(metaUri)
          .then(res => res.json())
          .then(meta =>
            setNftImages(prev => ({
              ...prev,
              [id]: normalize(meta.image || '/fallback-nft.png'),
            })),
          )
          .catch(() =>
            setNftImages(prev => ({ ...prev, [id]: '/fallback-nft.png' })),
          );
      } else {
        setNftImages(prev => ({ ...prev, [id]: '/fallback-nft.png' }));
      }
    });
  }, [uriData, ownedIds, stakedIds]);

  const { writeContractAsync } = useWriteContract();

  // Action handlers
  const handleApprove = async (tokenId: number) => {
    setIsLoading(true);
    try {
      await writeContractAsync({
        address: NFT_CONTRACT_ADDRESS,
        abi: nftAbi,
        functionName: 'approve',
        args: [STAKING_CONTRACT_ADDRESS, tokenId],
        chainId: 10143,
      });
      toast.success('Approved!');
    } catch (err: any) {
      toast.error(`Approve failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStake = async (tokenId: number) => {
    setIsLoading(true);
    try {
      await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: 'stake',
        args: [tokenId],
        chainId: 10143,
      });
      setNfts(prev => prev.filter(id => id !== tokenId));
      setStakedNfts(prev => [...prev, tokenId]);
      toast.success('Staked!');
      confetti({ particleCount: 100, spread: 70 });
    } catch (err: any) {
      toast.error(`Stake failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstake = async (tokenId: number) => {
    setIsLoading(true);
    try {
      await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: 'unstake',
        args: [tokenId],
        chainId: 10143,
      });
      setStakedNfts(prev => prev.filter(id => id !== tokenId));
      setNfts(prev => [...prev, tokenId]);
      toast.success('Unstaked!');
    } catch (err: any) {
      toast.error(`Unstake failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: 'claimRewards',
        chainId: 10143,
      });
      setPendingRewards('0');
      toast.success('Claimed!');
      confetti({ particleCount: 150, spread: 90 });
    } catch (err: any) {
      toast.error(`Claim failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading || status === 'connecting' || status === 'reconnecting') {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <svg className="animate-spin h-8 w-8 text-purple-400" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-black to-purple-950 text-white min-h-screen">
      <Toaster position="top-right" />
      <h1 className="text-center text-4xl font-bold mb-6 text-purple-300">
        Catcents NFT Staking
      </h1>

      <div className="max-w-4xl mx-auto">
        {/* Pending Rewards */}
        <div className="bg-black/80 p-6 rounded-xl mb-8 border border-purple-900">
          <h2 className="text-2xl font-semibold text-purple-400">
            Pending Rewards
          </h2>
          <p className="text-3xl font-bold text-cyan-400">
            {parseFloat(pendingRewards).toFixed(4)} $MEOW
          </p>
          <button
            onClick={handleClaim}
            disabled={pendingRewards === '0'}
            className="mt-4 w-full bg-purple-700 py-2 rounded-lg disabled:opacity-50"
          >
            Claim Rewards
          </button>
        </div>

        {/* Owned NFTs */}
        <section className="mb-8">
          <h2 className="text-2xl text-purple-400 mb-4">Your NFTs</h2>
          {nfts.length === 0 ? (
            <p className="text-gray-400 text-center">
              No NFTs owned. Mint or buy some to get started!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {nfts.map(id => (
                <div
                  key={id}
                  className="bg-black/80 p-4 rounded-xl border border-purple-900"
                >
                  <Image
                    src={nftImages[id] || '/fallback-nft.png'}
                    alt={`NFT ${id}`}
                    width={200}
                    height={200}
                    className="rounded"
                    loading="eager"
                  />
                  <p className="mt-2 text-gray-300">Token ID: {id}</p>
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={() => handleApprove(id)}
                      className="flex-1 bg-purple-700 py-1 rounded"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStake(id)}
                      className="flex-1 bg-purple-700 py-1 rounded"
                    >
                      Stake
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Staked NFTs */}
        <section>
          <h2 className="text-2xl text-purple-400 mb-4">Staked NFTs</h2>
          {stakedNfts.length === 0 ? (
            <p className="text-gray-400 text-center">
              You have no NFTs staked.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {stakedNfts.map(id => (
                <div
                  key={id}
                  className="bg-black/80 p-4 rounded-xl border border-purple-900"
                >
                  <Image
                    src={nftImages[id] || '/fallback-nft.png'}
                    alt={`NFT ${id}`}
                    width={200}
                    height={200}
                    className="rounded"
                    loading="eager"
                  />
                  <p className="mt-2 text-gray-300">Token ID: {id}</p>
                  <button
                    onClick={() => handleUnstake(id)}
                    className="mt-2 w-full bg-purple-700 py-1 rounded"
                  >
                    Unstake
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default NFTStakingPage;