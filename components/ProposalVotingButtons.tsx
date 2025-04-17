'use client';

import { useWriteContract, useReadContract, useAccount } from 'wagmi';
import { useState, useEffect } from 'react';

// Contract ABI based on provided Solidity code
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

export function ProposalVotingButtons() {
  const { isConnected } = useAccount();
  const { writeContract, isPending, error, data: txHash } = useWriteContract();
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [txHashState, setTxHash] = useState<string | null>(null);
  const [proposalId] = useState<bigint>(BigInt(4)); // Default proposal ID (change as needed)

  // Fetch vote counts
  const { data: voteCounts, refetch: refetchVoteCounts } = useReadContract({
    address: '0x9C451d8065314504Bb90f37c8b6431c57Fc655C4',
    abi: contractAbi,
    functionName: 'getVoteCount',
    args: [proposalId],
  });

  // Refetch vote counts after a successful vote
  useEffect(() => {
    if (txHash && voteStatus === 'success') {
      refetchVoteCounts();
    }
  }, [txHash, voteStatus, refetchVoteCounts]);

  const handleVote = (voteYes: boolean) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    writeContract(
      {
        address: '0x9C451d8065314504Bb90f37c8b6431c57Fc655C4',
        abi: contractAbi,
        functionName: voteYes ? 'voteYes' : 'voteNo',
        args: [proposalId],
      },
      {
        onSuccess: (hash) => {
          setVoteStatus('success');
          setTxHash(hash);
        },
        onError: (err) => {
          setVoteStatus('error');
          console.error('Vote error:', err);
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-lg font-semibold">Proposal #{Number(proposalId)}</div>
      <div className="flex gap-4">
        <button
          onClick={() => handleVote(true)}
          disabled={isPending || !isConnected}
          className={`px-4 py-2 rounded text-white ${
            isPending || !isConnected ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isPending ? 'Voting...' : 'Vote Yes'}
        </button>
        <button
          onClick={() => handleVote(false)}
          disabled={isPending || !isConnected}
          className={`px-4 py-2 rounded text-white ${
            isPending || !isConnected ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {isPending ? 'Voting...' : 'Vote No'}
        </button>
      </div>
      {voteCounts && (
        <div className="mt-2 text-sm">
          Current Votes: Yes = {voteCounts[0].toString()}, No = {voteCounts[1].toString()}
        </div>
      )}
      {txHashState && voteStatus === 'success' && (
        <div className="mt-2 text-sm">
          Vote recorded! Transaction Hash:{' '}
          <a
            href={`https://testnet.monadexplorer.com/tx/${txHashState}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {txHashState.slice(0, 6)}...{txHashState.slice(-4)}
          </a>
        </div>
      )}
      {error && voteStatus === 'error' && (
        <div className="mt-2 text-sm text-red-500">
          Error: {error.message.includes('Already voted') ? 'You have already voted on this proposal' : error.message}
        </div>
      )}
    </div>
  );
}