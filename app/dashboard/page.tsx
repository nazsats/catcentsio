'use client'

import { useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import {
  doc,
  getDoc,
  DocumentReference,
  DocumentSnapshot,
  FirestoreDataConverter,
  runTransaction,
} from 'firebase/firestore'
import Profile from '@/components/Profile'
import Badges from '@/components/Badges'
import toast, { Toaster } from 'react-hot-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Loader from '@/components/Loader'
import { useAccount, useDisconnect, useBalance, useSendTransaction, useChainId } from 'wagmi'
import { monadTestnet } from '@reown/appkit/networks'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPublicClient, http } from 'viem'
import pRetry from 'p-retry'

// Define the shape of the user data in Firestore
interface UserData {
  meowMiles: number
  proposalsGmeow: number
  gamesGmeow: number
  referrals: string[]
  lastCheckIn: number | null
  season0Points: number
  email: string | null
}

interface MeowMiles {
  quests: number
  proposals: number
  games: number
  referrals: number
  total: number
}

// Firestore data converter for UserData
const userDataConverter: FirestoreDataConverter<UserData> = {
  toFirestore(data: UserData) {
    return { ...data }
  },
  fromFirestore(snapshot: DocumentSnapshot, options?): UserData {
    const data = snapshot.data(options)
    return {
      meowMiles: data?.meowMiles || 0,
      proposalsGmeow: data?.proposalsGmeow || 0,
      gamesGmeow: data?.gamesGmeow || 0,
      referrals: data?.referrals || [],
      lastCheckIn: data?.lastCheckIn || null,
      season0Points: data?.season0Points || 0,
      email: data?.email || null,
    }
  },
}

export default function DashboardPage() {
  const { address: account, isConnecting: loading } = useAccount()
  const { disconnect } = useDisconnect()
  const { sendTransaction } = useSendTransaction()
  const { data: balanceData } = useBalance({ address: account, chainId: monadTestnet.id })
  const [meowMiles, setMeowMiles] = useState<MeowMiles>({ quests: 0, proposals: 0, games: 0, referrals: 0, total: 0 })
  const [season0Points, setSeason0Points] = useState<number>(0)
  const [monBalance, setMonBalance] = useState<string>('0')
  const [lastCheckIn, setLastCheckIn] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<string>('24:00:00')
  const [checkingIn, setCheckingIn] = useState(false)
  const [referralsList, setReferralsList] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isConnectingEmail, setIsConnectingEmail] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const chainId = useChainId()
  const hasRedirected = useRef(false) // To prevent redirect loops
  const effectRunCount = useRef(0) // For debugging potential loops

  const CHECK_IN_ADDRESS = '0xfF8b7625894441C26fEd460dD21360500BF4E767'

  // Initialize userEmail from localStorage
  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail')
    if (storedEmail) {
      setUserEmail(storedEmail)
      console.log('Dashboard: Initialized userEmail from localStorage:', storedEmail)
    }
  }, [])

  // Handle OAuth callback for email connection
  useEffect(() => {
    const email = searchParams.get('email')
    const points = searchParams.get('points')
    const warning = searchParams.get('warning')
    console.log('Dashboard: OAuth callback params:', { email, points, warning })

    if (warning) {
      toast.error(decodeURIComponent(warning))
      router.replace('/dashboard')
    } else if (email && points && account) {
      console.log('Dashboard: OAuth callback received:', { email, points })
      setSeason0Points(Number(points))
      setUserEmail(email)
      localStorage.setItem('userEmail', email)
      toast.success('Email connected successfully!')
      queryClient.invalidateQueries({ queryKey: ['userData', account] })
      queryClient.refetchQueries({ queryKey: ['userData', account] })
      router.replace('/dashboard')
    }
  }, [searchParams, account, queryClient, router])

  // Log Season 0 Points and Email for debugging
  useEffect(() => {
    console.log('Season 0 Points Card:', { userEmail, season0Points })
  }, [userEmail, season0Points])

  const fetchUserData = async (address: string): Promise<{
    quests: number
    proposals: number
    games: number
    referrals: number
    total: number
    lastCheckIn: number | null
    referralsList: string[]
    season0Points: number
    email: string | null
  }> => {
    console.log('fetchUserData (Dashboard): Fetching data for account:', address)
    try {
      const userRef: DocumentReference<UserData> = doc(db, 'users', address).withConverter(userDataConverter)
      const userSnap: DocumentSnapshot<UserData> = await Promise.race([
        getDoc(userRef),
        new Promise<DocumentSnapshot<UserData>>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore getDoc timed out')), 10000)
        ),
      ])

      if (userSnap.exists()) {
        const data = userSnap.data()
        const referralCount = data.referrals?.length || 0
        console.log('fetchUserData (Dashboard): Firebase data:', data)
        return {
          quests: Math.floor(data.meowMiles || 0),
          proposals: Math.floor(data.proposalsGmeow || 0),
          games: Math.floor(data.gamesGmeow || 0),
          referrals: referralCount * 500,
          total: Math.floor(
            (data.meowMiles || 0) +
            (data.proposalsGmeow || 0) +
            (data.gamesGmeow || 0) +
            (referralCount * 500)
          ),
          lastCheckIn: data.lastCheckIn || null,
          referralsList: data.referrals || [],
          season0Points: data.season0Points || 0,
          email: data.email || null,
        }
      } else {
        console.log('fetchUserData (Dashboard): No user data found in Firestore for address:', address)
        return {
          quests: 0,
          proposals: 0,
          games: 0,
          referrals: 0,
          total: 0,
          lastCheckIn: null,
          referralsList: [],
          season0Points: 0,
          email: null,
        }
      }
    } catch (error) {
      console.error('fetchUserData (Dashboard): Error fetching user data:', error)
      throw error
    }
  }

  const { data: userData, isLoading: userDataLoading, error: userDataError, refetch } = useQuery({
    queryKey: ['userData', account],
    queryFn: () => fetchUserData(account!),
    enabled: !!account,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 3000),
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  })

  // Update state based on fetched user data
  useEffect(() => {
    console.log('Dashboard: userData useEffect:', { userData, userDataLoading, userDataError })
    if (userData) {
      setMeowMiles({
        quests: userData.quests,
        proposals: userData.proposals,
        games: userData.games,
        referrals: userData.referrals,
        total: userData.total,
      })
      setLastCheckIn(userData.lastCheckIn)
      setReferralsList(userData.referralsList)
      setSeason0Points(userData.season0Points)
      if (userData.email && !userEmail) {
        setUserEmail(userData.email)
        localStorage.setItem('userEmail', userData.email)
        console.log('Dashboard: Set userEmail from Firestore:', userData.email)
      }
      console.log('Dashboard: Updated season0Points:', userData.season0Points, 'email:', userData.email, 'referralsList:', userData.referralsList)
    }
    if (userDataError) {
      console.error('Dashboard: userData query error:', userDataError)
      toast.error('Failed to load user data: ' + (userDataError.message || 'Unknown error'))
    }
  }, [userData, userDataLoading, userDataError, userEmail])

  // Update MON balance
  useEffect(() => {
    if (balanceData) {
      setMonBalance(Number(balanceData.formatted).toFixed(6))
    } else {
      setMonBalance('N/A')
    }
  }, [balanceData])

  // Invalidate and refetch queries when account changes
  useEffect(() => {
    if (account) {
      console.log('Dashboard: Invalidating and refetching userData query for account:', account)
      queryClient.invalidateQueries({ queryKey: ['userData', account] })
      queryClient.refetchQueries({ queryKey: ['userData', account] })
    }
  }, [account, queryClient])

  // Navigation and redirect logic
  useEffect(() => {
    effectRunCount.current += 1
    console.log(`Dashboard useEffect run count: ${effectRunCount.current} - Account: ${account}, Loading: ${loading}`)

    if (effectRunCount.current > 10) {
      console.error('Potential infinite loop detected in Dashboard useEffect')
      return
    }

    if (loading) {
      console.log('Dashboard useEffect: Skipping due to loading')
      return
    }

    if (!account && !hasRedirected.current) {
      console.log('Dashboard useEffect: Redirecting to / (no account)')
      hasRedirected.current = true
      router.push('/')
    }
  }, [account, loading, router])

  const handleDailyCheckIn = async () => {
    console.log('Dashboard: Check-in initiated:', { account, checkingIn })
    if (!account || checkingIn) {
      console.warn('Dashboard: Check-in aborted: missing account or already checking in')
      toast.error('Please ensure a wallet is connected.')
      return
    }
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    if (lastCheckIn && now - lastCheckIn < oneDay) {
      console.log('Dashboard: Check-in not allowed yet:', { lastCheckIn, timeLeft: oneDay - (now - lastCheckIn) })
      toast.error('You already checked in today. Try again tomorrow.')
      return
    }
    if (chainId !== monadTestnet.id) {
      console.warn('Dashboard: Wrong network:', chainId)
      toast.error('Please switch to Monad Testnet in your wallet.')
      return
    }

    setCheckingIn(true)
    const pendingToast = toast.loading('Processing check-in...')
    try {
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(monadTestnet.rpcUrls.default.http[0]),
      })
      const gasEstimate = await publicClient.estimateGas({
        account,
        to: CHECK_IN_ADDRESS,
        value: BigInt(0),
      })
      const gasPrice = await publicClient.getGasPrice()

      await pRetry(
        () =>
          sendTransaction(
            {
              to: CHECK_IN_ADDRESS,
              value: BigInt(0),
              gas: BigInt(Math.floor(Number(gasEstimate) * 1.2)), // Add 20% buffer
              gasPrice,
            },
            {
              onSuccess: async (hash) => {
                console.log('Dashboard: Transaction confirmed:', hash)
                try {
                  await runTransaction(db, async (transaction) => {
                    const userRef = doc(db, 'users', account).withConverter(userDataConverter)
                    const userDoc = await transaction.get(userRef)
                    if (!userDoc.exists()) throw new Error('User document does not exist')
                    // Double-check check-in eligibility in transaction
                    const currentLastCheckIn = userDoc.data().lastCheckIn || 0
                    if (currentLastCheckIn && now - currentLastCheckIn < oneDay) {
                      throw new Error('Check-in already performed today')
                    }
                    transaction.update(userRef, {
                      lastCheckIn: now,
                      meowMiles: (userDoc.data().meowMiles || 0) + 10,
                    })
                  })

                  // Only update state after Firestore success
                  setLastCheckIn(now)
                  startCountdown(now)
                  queryClient.invalidateQueries({ queryKey: ['userData', account] })

                  toast.dismiss(pendingToast)
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
                  )
                } catch (firestoreError: unknown) {
                  console.error('Dashboard: Firestore update failed:', firestoreError)
                  toast.dismiss(pendingToast)
                  const errorMessage = firestoreError instanceof Error ? firestoreError.message : 'Unknown error'
                  toast.error(`Check-in failed: ${errorMessage}`, { duration: 5000 })
                  setCheckingIn(false) // Reset checkingIn on Firestore failure
                }
              },
              onError: (err) => {
                console.error('Dashboard: Check-in transaction error:', err, JSON.stringify(err, null, 2))
                toast.dismiss(pendingToast)
                if (err.message.includes('Internal JSON-RPC error')) {
                  toast.error('Network error. Please try again later.', { duration: 5000 })
                } else if (err.message.includes('user denied') || err.message.includes('User rejected')) {
                  toast.error('You rejected the transaction.', { duration: 5000 })
                } else if (err.message.includes('insufficient funds')) {
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
                  )
                } else {
                  toast.error(`Failed to check-in: ${err.message}`, { duration: 5000 })
                }
                setCheckingIn(false) // Reset checkingIn on transaction failure
              },
            }
          ),
        {
          retries: 3,
          minTimeout: 1000,
          onFailedAttempt: (error) => {
            console.warn(`Retry attempt failed: ${error.message}`)
          },
        }
      )
    } catch (error: unknown) {
      console.error('Dashboard: Daily check-in failed:', error)
      toast.dismiss(pendingToast)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to check-in: ${errorMessage}`, { duration: 5000 })
      setCheckingIn(false) // Reset checkingIn on general failure
    }
  }

  const handleConnectEmail = async () => {
    if (!account) {
      console.log('Dashboard: No account for connect email')
      toast.error('Please connect your wallet first.')
      return
    }
    try {
      setIsConnectingEmail(true)
      console.log('Dashboard: Initiating Google OAuth at:', new Date().toISOString())

      const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      oauthUrl.searchParams.append('client_id', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '')
      oauthUrl.searchParams.append('redirect_uri', `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`)
      oauthUrl.searchParams.append('response_type', 'code')
      oauthUrl.searchParams.append('scope', 'email')
      oauthUrl.searchParams.append('state', account)

      window.location.href = oauthUrl.toString()
    } catch (error: unknown) {
      console.error('Dashboard: Error initiating Google OAuth:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to start authentication: ${errorMessage}`)
      setIsConnectingEmail(false)
    }
  }

  const startCountdown = (lastCheckInTime: number) => {
    const updateTimer = () => {
      const now = Date.now()
      const timeLeft = 24 * 60 * 60 * 1000 - (now - lastCheckInTime)
      if (timeLeft <= 0) {
        setCountdown('00:00:00')
        setLastCheckIn(null)
        setCheckingIn(false) // Ensure button is re-enabled
        return
      }
      const hours = Math.floor(timeLeft / (1000 * 60 * 60))
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)
      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`
      )
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }

  // Initialize countdown from Firestore data
  useEffect(() => {
    if (userData?.lastCheckIn) {
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      if (now - userData.lastCheckIn < oneDay) {
        startCountdown(userData.lastCheckIn)
      } else {
        setLastCheckIn(null)
        setCountdown('00:00:00')
        setCheckingIn(false)
      }
    }
  }, [userData])

  const handleCopyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account)
      toast.success('Address copied!')
    }
  }

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://catcents.io';
  }

  const handleCopyReferralLink = () => {
    if (account) {
      const referralLink = `${getBaseUrl()}/?ref=${account}`
      navigator.clipboard.writeText(referralLink)
      toast.success('Referral link copied!')
    }
  }

  const shortenAddress = (address: string) => {
    if (!address) return ''
    return `${address.slice(0, 7)}...${address.slice(-6)}`
  }

  console.log('Dashboard: Rendering - Loading:', loading, 'userDataLoading:', userDataLoading, 'Account:', account, 'UserEmail:', userEmail)

  if (userDataLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <Loader size={48} />
      </div>
    )
  }

  if (userDataError) {
    console.log('Dashboard: Rendering error state due to userDataError:', userDataError.message)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <div className="text-center">
          <h2 className="text-xl text-red-400">Failed to load dashboard</h2>
          <p className="text-gray-300">Error: {userDataError.message || 'Unknown error'}</p>
          <p className="text-gray-300">Please try refreshing the page or reconnecting your wallet.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 bg-purple-600 px-4 py-2 rounded-full text-white hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  console.log('Dashboard: Rendering main content', { season0Points, userEmail, referralsList })
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #9333ea',
          },
          duration: 5000,
        }}
      />
      <main className="flex-1 p-4 md:p-8">
        <div className="flex flex-row flex-wrap justify-between items-center mb-6 md:mb-8 gap-4">
          <h2 className="mt-20 text-xl md:text-2xl font-semibold text-purple-300">Dashboard</h2>
          <div className="ml-auto">
            <Profile account={account ?? null} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/90 rounded-xl p-6 text-center border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-1 md:col-span-2">
            <h3 className="text-xl md:text-2xl font-bold text-purple-400 mb-2">Total Meow Miles</h3>
            <p className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 bg-clip-text text-transparent animate-pulse-slow">
              {meowMiles.total}
            </p>
            <button
              onClick={() => router.push('/dashboard/quests')}
              className="mt-4 bg-gradient-to-r from-purple-700 to-cyan-500 text-white py-2 px-4 rounded-lg font-semibold hover:from-purple-600 hover:to-cyan-400 transition-all duration-300"
            >
              Go to Quests
            </button>
          </div>

          <div className="bg-black/90 rounded-xl p-6 text-center border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-2 md:col-span-1">
            <h4 className="text-lg md:text-xl font-semibold text-purple-400 mb-4">Season 0 Points</h4>
            {userEmail ? (
              <p className="text-2xl md:text-3xl font-bold text-cyan-400">{season0Points}</p>
            ) : (
              <button
                onClick={handleConnectEmail}
                className="bg-cyan-600 text-white px-6 py-2 rounded-md hover:bg-cyan-500 transition-colors font-semibold"
                disabled={isConnectingEmail}
              >
                {isConnectingEmail ? 'Connecting...' : 'Connect Email to View Points'}
              </button>
            )}
          </div>

          <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-3 md:col-span-2">
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

          <div className="hidden md:block bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-4 md:col-span-1">
            <h4 className="text-lg font-semibold text-purple-400 mb-2">Assets</h4>
            <p className="text-xl md:text-2xl font-bold text-cyan-400">MON: {monBalance}</p>
          </div>

          <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-5 md:col-span-2">
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

          <div className="bg-black/90 rounded-xl p-6 border border-purple-900 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow duration-300 md:order-6 md:col-span-1">
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 0 00-2-2h-8a2 0 00-2 2v8a2 2 0 002 2z"
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
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-900/50 rounded-lg">
                  No referrals yet. Invite friends to earn more Meow Miles!
                </p>
              )}
            </div>
          </div>

          <div className="md:order-7 md:col-span-2">
            <Badges totalMeowMiles={meowMiles.total} />
          </div>

          <div className="md:order-8 md:col-span-1"></div>
        </div>
      </main>
    </div>
  )
}