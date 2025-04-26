'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import Profile from '../../../../components/Profile';
import Loader from '../../../../components/Loader';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect, useWriteContract, useReadContract, useSwitchChain, useBalance } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';

const GRID_SIZE = 10;
const TOTAL_MINES = 5; // 5% of 100 cells
const INITIAL_BET = 0.001; // 0.001 MON
const ADMIN_WALLET = '0x6D54EF5Fa17d69717Ff96D2d868e040034F26024'.toLowerCase();
const MAX_REVEALS_PER_CLICK = 10; // Max cells revealed per click
const MULTI_REVEAL_PROBABILITY = 0.2; // 20% chance for multiple reveals
const MAX_EXTRA_REVEALS = 4; // Max extra cells when multi-reveal triggers

const CONTRACT_ADDRESS = '0xd9145CCE52D386f254917e481eB44e9943F39138';
const contractAbi = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
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
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

interface GameError {
  message: string;
  code?: string;
}

const catEmojis = ['😺', '🐱', '🐾', '🐈', '😻', '🙀', '🐯', '🦁', '😸', '😽'];

export default function Catsweeper() {
  const { address, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { data: balanceData } = useBalance({ address, chainId: monadTestnet.id });
  const { data: contractBalance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractAbi,
    functionName: 'getContractBalance',
    query: { enabled: !!address && address.toLowerCase() === ADMIN_WALLET },
  });
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [gameStarted, setGameStarted] = useState(false);
  const [points, setPoints] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const router = useRouter();

  const initializeGrid = useCallback(() => {
    const newGrid: Cell[][] = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => ({
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
      }))
    );

    // Place mines
    let minesPlaced = 0;
    while (minesPlaced < TOTAL_MINES) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      if (!newGrid[row][col].isMine) {
        newGrid[row][col].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbor mines
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (newGrid[row][col].isMine) continue;
        let count = 0;
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c++) {
            const nr = row + r;
            const nc = col + c;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && newGrid[nr][nc].isMine) {
              count++;
            }
          }
        }
        newGrid[row][col].neighborMines = count;
      }
    }

    setGrid(newGrid);
    setPoints(0);
    setGameStatus('playing');
    setGameStarted(false);
  }, []);

  const fetchUserData = useCallback(async (userAddress: string) => {
    try {
      const userRef = doc(db, 'users', userAddress);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        setBestScore(data.minesweeperBestScore || 0);
      }
    } catch (error: unknown) {
      const typedError = error as GameError;
      console.error('Failed to fetch user data:', typedError.message);
      toast.error('Failed to load game stats.');
    }
  }, []);

  useEffect(() => {
    console.log('Catsweeper useEffect - Address:', address, 'IsConnecting:', isConnecting, 'HasRedirected:', hasRedirected);
    if (isConnecting) return;
    if (!address && !hasRedirected) {
      console.log('Catsweeper - Redirecting to /');
      setHasRedirected(true);
      router.push('/');
      return;
    }
    if (address) {
      fetchUserData(address);
      initializeGrid();
      setIsAdminMode(address.toLowerCase() === ADMIN_WALLET);
    }
  }, [address, isConnecting, router, hasRedirected, fetchUserData, initializeGrid]);

  const placeBet = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    const pendingToast = toast.loading('Placing bet...');
    try {
      await switchChain({ chainId: monadTestnet.id });
      if (!balanceData || balanceData.value < BigInt(INITIAL_BET * 1e18)) {
        throw new Error('Insufficient MON balance.');
      }
      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: contractAbi,
          functionName: 'placeBet',
          value: BigInt(INITIAL_BET * 1e18),
        },
        {
          onSuccess: async (txHash) => {
            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Bet placed! Game started!{' '}
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
            setGameStarted(true);
          },
          onError: (error: Error) => {
            throw error;
          },
        }
      );
    } catch (error: unknown) {
      const typedError = error as GameError;
      console.error('Failed to place bet:', typedError.message);
      toast.dismiss(pendingToast);
      if (typedError.message.includes('insufficient funds')) {
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
      } else {
        toast.error(`Failed to place bet: ${typedError.message}`, { duration: 5000 });
      }
    }
  };

  const revealCell = (row: number, col: number) => {
    if (gameStatus !== 'playing' || !gameStarted || grid[row][col].isRevealed || grid[row][col].isFlagged) return;

    const updatedGrid = [...grid.map((r) => [...r])];
    const revealedCells: { row: number; col: number }[] = [];

    // Reveal the clicked cell
    updatedGrid[row][col].isRevealed = true;
    revealedCells.push({ row, col });

    if (updatedGrid[row][col].isMine) {
      setGameStatus('lost');
      setGrid(updatedGrid);
      toast.error('Game Over! You hit a mine.');
      return;
    }

    // Randomly decide to reveal extra cells (20% chance)
    if (Math.random() < MULTI_REVEAL_PROBABILITY && revealedCells.length < MAX_REVEALS_PER_CLICK) {
      const extraReveals = Math.floor(Math.random() * MAX_EXTRA_REVEALS) + 1; // 1 to 4 extra
      const availableCells = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (
            !updatedGrid[r][c].isRevealed &&
            !updatedGrid[r][c].isFlagged &&
            !updatedGrid[r][c].isMine && // Skip mines
            !(r === row && c === col)
          ) {
            availableCells.push({ row: r, col: c });
          }
        }
      }

      // Shuffle available cells and pick up to extraReveals
      for (let i = availableCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
      }

      const toReveal = availableCells.slice(0, Math.min(extraReveals, MAX_REVEALS_PER_CLICK - revealedCells.length));
      for (const { row: r, col: c } of toReveal) {
        updatedGrid[r][c].isRevealed = true;
        revealedCells.push({ row: r, col: c });
      }
    }

    setPoints((prev) => prev + revealedCells.length);
    setGrid(updatedGrid);

    // Check win condition
    const revealedCount = updatedGrid.flat().filter((cell) => cell.isRevealed).length;
    if (revealedCount >= GRID_SIZE * GRID_SIZE - TOTAL_MINES) {
      setGameStatus('won');
      cashOut(points + revealedCells.length); // Auto cash out on win
    }
  };

  const toggleFlag = (row: number, col: number) => {
    if (gameStatus !== 'playing' || !gameStarted || grid[row][col].isRevealed) return;
    const updatedGrid = [...grid.map((r) => [...r])];
    updatedGrid[row][col].isFlagged = !updatedGrid[row][col].isFlagged;
    setGrid(updatedGrid);
  };

  const cashOut = async (currentPoints: number) => {
    if (!address) return;

    setShowCashOutModal(false);
    const pendingToast = toast.loading('Cashing out...');
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', address);
        const userDoc = await transaction.get(userRef);
        const data = userDoc.data() || {};
        const newScore = Math.max(data.minesweeperBestScore || 0, currentPoints);
        const meowMiles = Math.max(0, currentPoints);

        transaction.set(
          userRef,
          {
            minesweeperBestScore: newScore,
            gamesGmeow: increment(meowMiles),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      setBestScore(currentPoints);
      setGameStatus('won');
      toast.dismiss(pendingToast);
      toast.success(`Cashed out ${currentPoints} Meow Miles!`);
    } catch (error: unknown) {
      const typedError = error as GameError;
      console.error('Failed to cash out:', typedError.message);
      toast.dismiss(pendingToast);
      toast.error(`Failed to cash out: ${typedError.message}`);
    }
  };

  const withdrawFunds = async () => {
    if (!address || address.toLowerCase() !== ADMIN_WALLET) {
      toast.error('Only admin can withdraw funds');
      return;
    }

    const pendingToast = toast.loading('Withdrawing funds...');
    try {
      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: contractAbi,
          functionName: 'withdrawFunds',
        },
        {
          onSuccess: async (txHash) => {
            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Funds withdrawn!{' '}
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
          onError: (error: Error) => {
            throw error;
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

  const checkBalance = async () => {
    if (!address || address.toLowerCase() !== ADMIN_WALLET) {
      toast.error('Only admin can check balance');
      return;
    }

    if (contractBalance !== undefined) {
      const balanceInMON = Number(contractBalance) / 1e18;
      toast.success(`Contract balance: ${balanceInMON.toFixed(4)} MON`, { duration: 5000 });
    } else {
      toast.error('Failed to fetch contract balance.', { duration: 5000 });
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied!');
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

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">

      <main className="flex-1 p-4 md:p-8">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-purple-300">Cat Sweeper</h1>
          <div className="ml-auto flex items-center gap-4">
            {isAdminMode && (
              <span className="text-sm text-cyan-400 font-semibold">Admin Mode</span>
            )}
            <Profile account={address} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
          </div>
        </div>

        <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-md shadow-purple-500/20 mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-semibold text-purple-400 mb-4">Game Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="text-gray-300">
              Points: <span className="text-cyan-400 font-bold">{points}</span>
            </p>
            <p className="text-gray-300">
              Best Score: <span className="text-cyan-400 font-bold">{bestScore}</span>
            </p>
          </div>
          <p className="text-center mt-4 text-lg font-semibold text-purple-400">
            Status: {gameStatus === 'playing' ? 'Playing' : gameStatus === 'won' ? 'You Won!' : 'Game Over'}
          </p>
        </div>

        <div className="flex justify-center mb-6 md:mb-8">
          <div
            className="grid gap-0.5 bg-gray-900/80 p-2 rounded-xl border border-purple-900 w-full max-w-[400px]"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
          >
            {grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => revealCell(rowIndex, colIndex)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleFlag(rowIndex, colIndex);
                  }}
                  className={`aspect-square text-sm font-semibold transition-all duration-200 border border-purple-900/50 rounded-md flex items-center justify-center animate-pulse ${
                    cell.isRevealed
                      ? cell.isMine
                        ? 'bg-red-600/80 text-white'
                        : 'bg-gray-700/80 text-cyan-400'
                      : cell.isFlagged
                      ? 'bg-yellow-600/80 text-black'
                      : 'bg-gray-800/80 hover:bg-purple-900/50'
                  } ${gameStatus !== 'playing' ? 'opacity-75 cursor-not-allowed' : ''}`}
                  style={{ width: '100%', maxWidth: '40px', height: '40px' }}
                  disabled={gameStatus !== 'playing' || !gameStarted}
                >
                  {cell.isRevealed
                    ? cell.isMine
                      ? '💣'
                      : cell.neighborMines > 0
                      ? cell.neighborMines
                      : catEmojis[Math.floor(Math.random() * catEmojis.length)]
                    : cell.isFlagged
                    ? '🚩'
                    : ''}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {!gameStarted ? (
            <button
              onClick={placeBet}
              disabled={isPending || !address}
              className={`px-6 py-3 rounded-lg text-base font-semibold text-white transition-all duration-200 ${
                isPending || !address
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400'
              }`}
            >
              {isPending ? (
                <span className="flex items-center">
                  <Loader size={16} className="mr-2" />
                  Placing Bet...
                </span>
              ) : (
                `Start Game (${INITIAL_BET} MON)`
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowCashOutModal(true)}
                disabled={gameStatus !== 'playing' || points === 0}
                className={`px-6 py-3 rounded-lg text-base font-semibold text-white transition-all duration-200 ${
                  gameStatus !== 'playing' || points === 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-green-400 hover:from-green-500 hover:to-green-300'
                }`}
              >
                Cash Out
              </button>
              <button
                onClick={() => {
                  setGameStarted(false);
                  initializeGrid();
                }}
                className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition-all duration-200"
              >
                New Game
              </button>
              {isAdminMode && (
                <>
                  <button
                    onClick={withdrawFunds}
                    disabled={isPending}
                    className={`px-6 py-3 rounded-lg text-base font-semibold text-white transition-all duration-200 ${
                      isPending
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-red-400 hover:from-red-500 hover:to-red-300'
                    }`}
                  >
                    Withdraw Funds
                  </button>
                  <button
                    onClick={checkBalance}
                    className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 transition-all duration-200"
                  >
                    Check Balance
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Cash Out Modal */}
        {showCashOutModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-md shadow-purple-500/20 w-full max-w-sm">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">Confirm Cash Out</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to cash out <span className="text-cyan-400 font-bold">{points}</span> Meow Miles?
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowCashOutModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-600 hover:bg-gray-500 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => cashOut(points)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-green-400 hover:from-green-500 hover:to-green-300 transition-all duration-200"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}