'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useWriteContract, useSwitchChain, useReadContract } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';
import Loader from '../../../components/Loader';

const MINESWEEPER_CONTRACT_ADDRESS = '0xd9145CCE52D386f254917e481eB44e9943F39138';
const ADMIN_WALLET = '0x6D54EF5Fa17d69717Ff96D2d868e040034F26024'.toLowerCase();
const minesweeperContractAbi = [
  {
    type: 'function',
    name: 'withdrawFunds',
    inputs: [],
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
];

interface GameError {
  message: string;
  code?: string;
}

export default function Withdraw() {
  const { address, isConnecting } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { data: contractBalance, error: balanceError, isLoading: balanceLoading, refetch } = useReadContract({
    address: MINESWEEPER_CONTRACT_ADDRESS as `0x${string}`,
    abi: minesweeperContractAbi,
    functionName: 'getContractBalance',
    query: { enabled: !!address && address.toLowerCase() === ADMIN_WALLET },
  });
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const router = useRouter();

  // Log debugging info
  console.log('Withdraw page rendered');
  console.log('Connected address:', address);
  console.log('Monad Testnet chain ID:', monadTestnet.id);
  console.log('Contract balance:', contractBalance);
  console.log('Balance error:', balanceError);
  console.log('Balance loading:', balanceLoading);

  // Redirect non-admin users or unauthenticated users
  useEffect(() => {
    if (isConnecting) return;
    if (!address) {
      toast.error('Please connect your wallet');
      router.push('/');
      return;
    }
    if (address?.toLowerCase() !== ADMIN_WALLET.toLowerCase()) {
      toast.error('Only the admin can access this page');
      router.push('/dashboard');
    }
  }, [address, isConnecting, router]);

  // Ensure Monad Testnet and handle stuck loading
  useEffect(() => {
    if (address && !isConnecting) {
      switchChain({ chainId: monadTestnet.id });
      // Timeout if loading takes too long (e.g., 10 seconds)
      const timer = setTimeout(() => {
        if (balanceLoading) {
          setLoadingTimeout(true);
          toast.error('Balance fetch timed out. Please retry or check your network.', { duration: 5000 });
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [address, isConnecting, switchChain, balanceLoading]);

  const checkBalance = async () => {
    if (!address || address.toLowerCase() !== ADMIN_WALLET) {
      toast.error('Only admin can check balance');
      return;
    }

    if (balanceError) {
      toast.error(`Failed to fetch balance: ${balanceError.message}`, { duration: 5000 });
      return;
    }

    if (contractBalance !== undefined) {
      const balanceInMON = Number(contractBalance) / 1e18;
      toast.success(`Contract balance: ${balanceInMON.toFixed(4)} MON`, { duration: 5000 });
    } else {
      toast.error('Balance not yet loaded. Try again.', { duration: 5000 });
      await refetch();
    }
  };

  const withdrawFunds = async () => {
    if (!address || address.toLowerCase() !== ADMIN_WALLET) {
      toast.error('Only admin can withdraw funds');
      return;
    }

    if (!contractBalance || Number(contractBalance) === 0) {
      toast.error('No funds available to withdraw');
      return;
    }

    const pendingToast = toast.loading('Withdrawing funds...');
    try {
      await switchChain({ chainId: monadTestnet.id });
      writeContract(
        {
          address: MINESWEEPER_CONTRACT_ADDRESS as `0x${string}`,
          abi: minesweeperContractAbi,
          functionName: 'withdrawFunds',
        },
        {
          onSuccess: async (txHash) => {
            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Funds withdrawn!{' '}
                <a
                  href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-cyan-400"
                >
                  View on MonadExplorer
                </a>
              </div>,
              { duration: 5000 }
            );
          },
          onError: (error: Error) => {
            toast.dismiss(pendingToast);
            const errorMessage = error.message.toLowerCase();
            if (errorMessage.includes('no funds to withdraw')) {
              toast.error('No funds available to withdraw', { duration: 5000 });
            } else if (errorMessage.includes('only admin')) {
              toast.error('Only admin can withdraw funds', { duration: 5000 });
            } else {
              toast.error(`Withdrawal failed: ${error.message}`, { duration: 5000 });
            }
          },
        }
      );
    } catch (error: unknown) {
      const typedError = error as GameError;
      console.error('Failed to withdraw funds:', typedError.message);
      toast.dismiss(pendingToast);
      toast.error(`Failed to withdraw: ${typedError.message}`, { duration: 5000 });
    }
  };

  const handleRetry = async () => {
    setLoadingTimeout(false);
    await refetch();
  };

  if (isConnecting || (balanceLoading && !loadingTimeout)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <Loader size={48} />
      </div>
    );
  }

  if (!address || address.toLowerCase() !== ADMIN_WALLET.toLowerCase()) return null;

  if (balanceError || loadingTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">
            {balanceError ? `Failed to load balance: ${balanceError.message}` : 'Balance fetch timed out'}
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-lg mr-2"
          >
            Retry
          </button>
          <button
            onClick={() => switchChain({ chainId: monadTestnet.id })}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-lg"
          >
            Switch to Monad Testnet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <main className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />

        <h2 className="text-2xl md:text-3xl font-bold text-purple-300 mb-6">Withdraw Catsweeper Funds</h2>

        <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-md shadow-purple-500/20 mb-6 w-full max-w-md">
          <p className="text-gray-300 mb-2">
            Connected Wallet: <span className="text-cyan-400">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
          </p>
          <p className="text-gray-300 mb-4">
            Contract Balance:{' '}
            <span className="text-cyan-400 font-bold">
              {contractBalance !== undefined ? `${(Number(contractBalance) / 1e18).toFixed(4)} MON` : 'Loading...'}
            </span>
          </p>
          <button
            onClick={checkBalance}
            disabled={isPending || balanceError}
            className={`w-full px-4 py-2 rounded-lg text-sm md:text-base font-semibold text-white transition-all duration-200 mb-2 ${
              isPending || balanceError
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300'
            }`}
          >
            Check Balance
          </button>
          <button
            onClick={withdrawFunds}
            disabled={isPending || balanceError || contractBalance === undefined || Number(contractBalance) === 0}
            className={`w-full px-4 py-2 rounded-lg text-sm md:text-base font-semibold text-white transition-all duration-200 ${
              isPending || balanceError || contractBalance === undefined || Number(contractBalance) === 0
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 to-red-400 hover:from-red-500 hover:to-red-300'
            }`}
          >
            {isPending ? 'Withdrawing...' : 'Withdraw Funds'}
          </button>
          <button
            onClick={handleRetry}
            className="w-full px-4 py-2 mt-2 bg-gray-600 text-white rounded-lg text-sm md:text-base font-semibold"
          >
            Refresh Balance
          </button>
        </div>

        <Link href="/dashboard" className="text-purple-300 hover:text-cyan-400 mt-4">
          Back to Dashboard
        </Link>
      </main>
    </div>
  );
}