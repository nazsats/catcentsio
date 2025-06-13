'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import Profile from '../../../../components/Profile';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useDisconnect, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { monadTestnet } from '@reown/appkit/networks';
import Confetti from 'react-confetti';
import styles from './CatTetris.module.css';

// Tetris dimensions
const COLS = 10;
const ROWS = 15; // 15 rows
const BASE_DROP_INTERVAL = 800;
const INITIAL_POS = { x: 3, y: 0 };
const BET_AMOUNT = 0.01;

// Tetromino shapes type
type TetrominoShape =
  | readonly [readonly [1, 1, 1, 1]]
  | readonly [readonly [1, 0, 0], readonly [1, 1, 1]]
  | readonly [readonly [0, 0, 1], readonly [1, 1, 1]]
  | readonly [readonly [1, 1], readonly [1, 1]]
  | readonly [readonly [0, 1, 1], readonly [1, 1, 0]]
  | readonly [readonly [0, 1, 0], readonly [1, 1, 1]]
  | readonly [readonly [1, 1, 0], readonly [0, 1, 1]]
  // Rotated shapes (3x2 for J, L, S, T, Z; 4x1 for I)
  | readonly [readonly [1, 1], readonly [1, 0], readonly [1, 0]]
  | readonly [readonly [0, 1], readonly [0, 1], readonly [1, 1]]
  | readonly [readonly [1, 0], readonly [1, 1], readonly [0, 1]]
  | readonly [readonly [0, 1], readonly [1, 1], readonly [1, 0]]
  | readonly [readonly [1, 0], readonly [1, 1], readonly [1, 0]]
  | readonly [readonly [1, 1, 1, 1]];

// Tetrominoes with colors
const TETROMINOES = {
  I: { shape: [[1, 1, 1, 1]] as const, color: 'bg-cyan-400' },
  J: { shape: [[1, 0, 0], [1, 1, 1]] as const, color: 'bg-blue-400' },
  L: { shape: [[0, 0, 1], [1, 1, 1]] as const, color: 'bg-orange-400' },
  O: { shape: [[1, 1], [1, 1]] as const, color: 'bg-yellow-400' },
  S: { shape: [[0, 1, 1], [1, 1, 0]] as const, color: 'bg-green-400' },
  T: { shape: [[0, 1, 0], [1, 1, 1]] as const, color: 'bg-purple-400' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]] as const, color: 'bg-red-400' },
} as const;
type Key = keyof typeof TETROMINOES;

// Helper to validate and construct TetrominoShape
const validateShape = (shape: number[][]): TetrominoShape => {
  const rows = shape.length;
  const cols = shape[0]?.length || 0;

  // Validate content (only 0s and 1s, consistent row lengths)
  for (const row of shape) {
    if (row.length !== cols) throw new Error('Inconsistent row lengths');
    for (const cell of row) {
      if (cell !== 0 && cell !== 1) throw new Error('Invalid cell value; must be 0 or 1');
    }
  }

  // Construct shape based on dimensions
  if (rows === 1 && cols === 4) {
    return [[shape[0][0], shape[0][1], shape[0][2], shape[0][3]]] as TetrominoShape; // I
  }
  if (rows === 4 && cols === 1) {
    return [[shape[0][0], shape[1][0], shape[2][0], shape[3][0]]] as TetrominoShape; // I rotated
  }
  if (rows === 2 && cols === 3) {
    return [
      [shape[0][0], shape[0][1], shape[0][2]],
      [shape[1][0], shape[1][1], shape[1][2]],
    ] as TetrominoShape; // J, L, S, T, Z
  }
  if (rows === 3 && cols === 2) {
    return [
      [shape[0][0], shape[0][1]],
      [shape[1][0], shape[1][1]],
      [shape[2][0], shape[2][1]],
    ] as TetrominoShape; // J, L, S, T, Z rotated
  }
  if (rows === 2 && cols === 2) {
    return [
      [shape[0][0], shape[0][1]],
      [shape[1][0], shape[1][1]],
    ] as TetrominoShape; // O
  }
  throw new Error(`Invalid tetromino shape dimensions: ${rows}x${cols}`);
};

const rotate = (m: TetrominoShape): TetrominoShape => {
  // Transpose and reverse rows to rotate 90 degrees clockwise
  const rotated: number[][] = Array.from({ length: m[0].length }, (_, i) =>
    m.map(row => row[i]).reverse()
  );
  return validateShape(rotated);
};

// Smart contract
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CATTETRIS_CONTRACT_ADDRESS || '0xD00C45AC031F20c8931B25fDb937A830f891b967';
const contractAbi = [
  { type: 'function', name: 'placeBet', inputs: [], outputs: [], stateMutability: 'payable' },
  { type: 'event', name: 'GameResult', inputs: [{ name: 'player', type: 'address', indexed: true }, { name: 'score', type: 'uint256', indexed: false }] },
];

export default function Tetris() {
  const { address, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending } = useWriteContract();
  const { data: balanceData } = useBalance({ address, chainId: monadTestnet.id });

  // State
  const [grid, setGrid] = useState<string[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill('bg-black')));
  const [current, setCurrent] = useState({ key: 'T' as Key, rot: 0, pos: { ...INITIAL_POS } });
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'gameOver'>('idle');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [meowMiles, setMeowMiles] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [dropSpeed, setDropSpeed] = useState(BASE_DROP_INTERVAL);
  const raf = useRef<number | null>(null);
  const lastKeyPress = useRef<{ [key: string]: number }>({});
  const lastDropTime = useRef<number>(0);
  const isLocking = useRef<boolean>(false); // Prevent duplicate lockAndClear calls

  // Dynamic cell size
  const [cellSize, setCellSize] = useState(28);
  useEffect(() => {
    const updateCellSize = () => {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      setCellSize(Math.min(28, Math.floor(vw * 0.05)));
    };
    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, []);

  // Load user stats
  useEffect(() => {
    if (isConnecting || !address) return;
    (async () => {
      try {
        const ref = doc(db, 'users', address);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setBestScore(d.cattetrisBestScore || 0);
          setMeowMiles(d.gamesGmeow || 0);
        }
      } catch {
        toast.error('Failed to load game stats.');
      }
    })();
  }, [address, isConnecting]);

  // Save score
  const saveScore = useCallback(
    async (currentScore: number, currentMeowMiles: number) => {
      if (!address) return;
      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', address);
          const userDoc = await transaction.get(userRef);
          const data = userDoc.data() || {};
          const newScore = Math.max(data.cattetrisBestScore || 0, currentScore);
          transaction.set(
            userRef,
            {
              cattetrisBestScore: newScore,
              gamesGmeow: increment(currentMeowMiles),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        });
        setBestScore(currentScore);
      } catch (err) {
        console.error('Failed to save score:', err);
        toast.error('Failed to save score.');
      }
    },
    [address]
  );

  // Collision detection
  const collides = useCallback(
    (pos: { x: number; y: number }, shape: TetrominoShape) => {
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (shape[y][x]) {
            const nx = pos.x + x, ny = pos.y + y;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && grid[ny][nx] !== 'bg-black') return true;
          }
        }
      }
      return false;
    },
    [grid]
  );

  // Spawn new piece
  const spawnPiece = useCallback(() => {
    const k = (Object.keys(TETROMINOES) as Key[])[Math.floor(Math.random() * 7)];
    const newPiece = { key: k, rot: 0, pos: { ...INITIAL_POS } };
    console.log('Spawning piece:', newPiece); // Debug log
    setCurrent(newPiece);
  }, []);

  // Lock piece and clear lines
  const lockAndClear = useCallback(
    (shape: TetrominoShape, pos: { x: number; y: number }) => {
      if (isLocking.current) return; // Prevent duplicate calls
      isLocking.current = true;

      console.log('Locking piece at pos:', pos, 'Shape:', shape); // Debug log

      setGrid((g) => {
        const ng = g.map((r) => [...r]);

        // Place piece
        shape.forEach((r, y) =>
          r.forEach((c, x) => {
            if (c && pos.y + y >= 0 && pos.y + y < ROWS && pos.x + x >= 0 && pos.x + x < COLS) {
              ng[pos.y + y][pos.x + x] = TETROMINOES[current.key].color;
            }
          })
        );

        console.log('Grid after placement:', ng); // Debug log

        // Find cleared rows
        let cleared = 0;
        const clearedRows: number[] = [];
        for (let i = 0; i < ROWS; i++) {
          console.log(`Row ${i} contents:`, ng[i]); // Debug log
          if (ng[i].every((c) => c !== 'bg-black' && c.includes('bg-'))) {
            clearedRows.push(i);
            cleared++;
            console.log(`Row ${i} cleared`); // Debug log
          }
        }

        // Create new grid by shifting rows down
        const newGrid = Array.from({ length: ROWS }, () => Array(COLS).fill('bg-black'));
        let targetRow = ROWS - 1;
        for (let i = ROWS - 1; i >= 0; i--) {
          if (!clearedRows.includes(i)) {
            newGrid[targetRow] = [...ng[i]];
            targetRow--;
          }
        }

        console.log('Cleared lines:', cleared, 'New grid:', newGrid); // Debug log

        // Update score and Meow Miles
        if (cleared > 0) {
          const points = cleared * 10;
          const miles = cleared * 10;

          setScore((prev) => {
            const newScore = prev + points;
            console.log('Previous score:', prev, 'Points added:', points, 'New score:', newScore); // Debug log
            return newScore;
          });

          setMeowMiles((prev) => {
            const newMiles = prev + miles;
            console.log('Awarding miles:', miles, 'New Meow Miles:', newMiles); // Debug log
            return newMiles;
          });

          setDropSpeed((ds) => Math.max(200, ds - cleared * 50));
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2000);

          if (address) {
            const uref = doc(db, 'users', address);
            runTransaction(db, async (tx) => {
              await tx.update(uref, {
                gamesGmeow: increment(miles),
                updatedAt: new Date().toISOString(),
              });
            }).catch((err) => {
              console.error('Firestore update failed:', err);
              toast.error('Failed to update Meow Miles.');
            });
          }
        }

        return newGrid;
      });

      // Check for game over
      const baseShape = TETROMINOES[current.key].shape;
      let shapeAtLock: TetrominoShape = baseShape;
      for (let i = 0; i < current.rot % 4; i++) {
        try {
          shapeAtLock = rotate(shapeAtLock);
        } catch (err) {
          console.error('Rotation failed in lockAndClear:', err);
          toast.error('Error rotating piece.');
          return;
        }
      }
      if (collides({ x: INITIAL_POS.x, y: INITIAL_POS.y }, shapeAtLock)) {
        console.warn('Game over: Cannot spawn new piece');
        setGameStatus('gameOver');
        setShowModal(true);
        if (raf.current) cancelAnimationFrame(raf.current);
        saveScore(score, meowMiles);
        isLocking.current = false;
        return;
      }

      // Spawn new piece
      spawnPiece();
      isLocking.current = false;
    },
    [current, address, score, meowMiles, saveScore, spawnPiece, collides]
  );

  // Game loop
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    console.log('Game loop started'); // Debug log
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 100); // Cap delta time
      last = now;
      lastDropTime.current += dt;
      if (lastDropTime.current >= dropSpeed) {
        console.log('Attempting to drop piece:', current); // Debug log
        const base = TETROMINOES[current.key].shape;
        let shape: TetrominoShape = base;
        for (let i = 0; i < current.rot % 4; i++) {
          try {
            shape = rotate(shape);
          } catch (err) {
            console.error('Rotation failed in game loop:', err);
            toast.error('Error rotating piece.');
            return;
          }
        }
        const np = { x: current.pos.x, y: current.pos.y + 1 };
        if (!collides(np, shape)) {
          setCurrent(c => ({ ...c, pos: np }));
        } else {
          lockAndClear(shape, current.pos);
        }
        lastDropTime.current = 0;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      console.log('Game loop stopped'); // Debug log
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [gameStatus, current, dropSpeed, collides, lockAndClear]);

  // Keyboard controls with debouncing
  useEffect(() => {
    const DEBOUNCE_MS = 100;
    const onKey = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing') return;
      const now = Date.now();
      if (e.key.startsWith('Arrow') || e.key === 'p') {
        if (lastKeyPress.current[e.key] && now - lastKeyPress.current[e.key] < DEBOUNCE_MS) return;
        lastKeyPress.current[e.key] = now;
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const np = { ...current.pos };
        let nr = current.rot;
        if (e.key === 'ArrowLeft') np.x--;
        if (e.key === 'ArrowRight') np.x++;
        if (e.key === 'ArrowDown') np.y++;
        if (e.key === 'ArrowUp') nr++;
        const base = TETROMINOES[current.key].shape;
        let shape: TetrominoShape = base;
        try {
          for (let i = 0; i < nr % 4; i++) {
            shape = rotate(shape);
          }
          if (!collides(np, shape)) setCurrent(c => ({ ...c, pos: np, rot: nr }));
        } catch (err) {
          console.error('Rotation failed in keyboard handler:', err);
          toast.error('Error rotating piece.');
        }
      }
      if (e.key === 'p') setGameStatus(s => (s === 'playing' ? 'idle' : 'playing'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStatus, current, collides]);

  // Start game
  const startGame = useCallback(async () => {
    if (gameStatus === 'playing') return;
    if (!address) return toast.error('Please connect your wallet');
    const pendingToast = toast.loading('Placing bet...');
    try {
      await switchChain({ chainId: monadTestnet.id });
      if (!balanceData || balanceData.value < BigInt(BET_AMOUNT * 1e18))
        throw new Error('Insufficient MON balance.');
      writeContract(
        {
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: contractAbi,
          functionName: 'placeBet',
          value: BigInt(BET_AMOUNT * 1e18),
        },
        {
          onSuccess: async (txHash) => {
            toast.dismiss(pendingToast);
            toast.success(
              <div>
                Bet placed! Game started!{' '}
                <a href={`https://testnet.monadexplorer.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline text-cyan-400">
                  View on MonadExplorer
                </a>
              </div>,
              { duration: 4000 }
            );
            setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill('bg-black')));
            setScore(0);
            setMeowMiles(0);
            setGameStatus('playing');
            setDropSpeed(BASE_DROP_INTERVAL);
            lastDropTime.current = 0;
            spawnPiece();
            setShowModal(false);
            isLocking.current = false;
          },
          onError: (error) => {
            toast.dismiss(pendingToast);
            const message = error.message.includes('insufficient funds')
              ? <div>Insufficient MON balance. <a href="https://faucet.monad.xyz/" target="_blank" rel="noopener noreferrer" className="underline text-cyan-400">Claim MON tokens</a></div>
              : `Bet failed: ${error.message}`;
            toast.error(message, { duration: 4000 });
          },
        }
      );
    } catch (error) {
      toast.dismiss(pendingToast);
      toast.error(`Bet failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { duration: 4000 });
    }
  }, [address, balanceData, writeContract, switchChain, spawnPiece, gameStatus]);

  // Render cell
  const renderCell = (y: number, x: number) => {
    const base = TETROMINOES[current.key].shape;
    let shape: TetrominoShape = base;
    for (let i = 0; i < current.rot % 4; i++) {
      try {
        shape = rotate(shape);
      } catch (err) {
        console.error('Rotation failed in renderCell:', err);
        return null;
      }
    }
    const ry = y - current.pos.y, rx = x - current.pos.x;
    if (ry >= 0 && ry < shape.length && rx >= 0 && rx < shape[0].length && shape[ry][rx]) {
      return <div className={`${TETROMINOES[current.key].color} w-full h-full rounded-sm shadow-md`} />;
    }
    if (grid[y][x] !== 'bg-black') {
      return <div className={`${grid[y][x]} w-full h-full rounded-sm shadow-md`} />;
    }
    return null;
  };

  // Modal component
  const Modal = ({ isOpen, onClose, score }: { isOpen: boolean; onClose: () => void; score: number }) => {
    if (!isOpen) return null;
    return (
      <motion.div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gray-900/80 backdrop-blur-md rounded-2xl p-8 border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 max-w-md w-full mx-4 text-white"
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-cyan-400">Game Over</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4 text-center">
            <p className="text-lg">
              <span className="font-semibold text-purple-400">Final Score:</span>{' '}
              <span className="text-2xl text-cyan-300 font-bold">{score}</span>
            </p>
            <p className="text-lg">
              <span className="font-semibold text-purple-400">Meow Miles:</span>{' '}
              <span className="text-2xl text-pink-400 font-bold">{meowMiles}</span>
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <motion.button
              onClick={() => {
                onClose();
                startGame();
              }}
              className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 shadow-lg shadow-cyan-500/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Play Again
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  if (isConnecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white text-lg">
        Loading...
      </div>
    );
  }

  if (!address) return null;

  console.log('Rendering score:', score); // Debug render

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className={styles.particle}
            style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 4}s` }}
          />
        ))}
        {gameStatus === 'playing' &&
          [...Array(10)].map((_, i) => (
            <div
              key={`sparkle-${i}`}
            className={styles.sparkle}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 1}s`,
            }}
            />
          ))}
      </div>

      <main className="flex-1 p-6 sm:p-8 md:p-12 relative z-10">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(17, 24, 39, 0.9)',
              color: '#fff',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 500,
              backdropFilter: 'blur(4px)',
            },
            success: { style: { borderLeft: '4px solid #22c55e' } },
            error: { style: { borderLeft: '4px solid #ef4444' } },
            loading: { style: { borderLeft: '4px solid #3b82f6' } },
            duration: 4000,
          }}
        />

        {showConfetti && (
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} />
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} score={score} />

        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            Cat Tetris
          </h1>
          <Profile
            account={address}
            onCopyAddress={() => navigator.clipboard.writeText(address).then(() => toast.success('Address copied!'))}
            onDisconnect={disconnect}
          />
        </div>

        <div className="bg-gray-900/80 backdrop-blur-md rounded-2xl p-6 border border-cyan-500/30 shadow-xl shadow-cyan-500/10 mb-8">
          <h3 className="text-lg sm:text-xl font-semibold text-purple-400 mb-4">Game Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <p className="text-gray-300 text-sm sm:text-base">
              Score: <span className="text-cyan-400 font-bold">{score}</span>
            </p>
            <p className="text-gray-300 text-sm sm:text-base">
              Best Score: <span className="text-cyan-400 font-bold">{bestScore}</span>
            </p>
            <p className="text-gray-300 text-sm sm:text-base">
              Meow Miles: <span className="text-pink-400 font-bold">{meowMiles}</span>
            </p>
          </div>
          <p className="text-center mt-4 text-sm sm:text-base font-semibold text-purple-400" aria-live="polite">
            Status:{' '}
            {gameStatus === 'idle'
              ? 'Ready to Play'
              : gameStatus === 'playing'
              ? 'Playing...'
              : 'Game Over'}
          </p>
        </div>

        <section className="flex justify-center mt-6 mb-6 bg-gray-800/50 rounded-2xl border border-cyan-500/20 shadow-lg p-6">
          <div
            className="grid mt-6 mb-6 gap-[2px]"
            style={{ gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`, gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)` }}
          >
            {Array.from({ length: ROWS }).map((_, y) =>
              Array.from({ length: COLS }).map((_, x) => (
                <div
                  key={`${y}-${x}-${grid[y][x]}`}
                  className={`${styles.cell} ${grid[y][x] !== 'bg-black' ? styles.filled : ''}`}
                  aria-label={grid[y][x] !== 'bg-black' ? 'Locked piece' : renderCell(y, x) ? 'Current piece' : 'Empty cell'}
                >
                  {renderCell(y, x)}
                </div>
              ))
            )}
          </div>
        </section>

        <div className="flex justify-center mt-6">
          <motion.button
            onClick={startGame}
            disabled={isPending || gameStatus === 'playing'}
            className={`px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 shadow-lg shadow-cyan-500/30 transition-all ${
              isPending || gameStatus === 'playing' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`Start game for ${BET_AMOUNT} MON`}
          >
            {isPending ? 'Placing Bet...' : gameStatus === 'playing' ? 'Playing...' : `Play (${BET_AMOUNT} MON)`}
          </motion.button>
        </div>
      </main>
    </div>
  );
}