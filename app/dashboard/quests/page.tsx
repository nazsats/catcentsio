'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { db } from '../../../lib/firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import Profile from '../../../components/Profile'
import confetti from 'canvas-confetti'
import { useAccount, useDisconnect } from 'wagmi'
import toast, { Toaster } from 'react-hot-toast'
import Image from 'next/image'

const DEPLOYED_DOMAIN = 'https://catcents.io'

const INITIAL_QUESTS = [
  { id: 'connect_twitter', title: 'Connect Twitter', description: 'Link your Twitter account', meowMiles: 30, completed: false, icon: '/quest/link.png' },
  { id: 'connect_discord', title: 'Connect Discord', description: 'Link your Discord account', meowMiles: 30, completed: false, icon: '/quest/discord.png' },
  { id: 'follow_twitter', title: 'Follow Twitter', description: 'Follow @catcentsio on Twitter', meowMiles: 30, completed: false, icon: '/quest/x.png', taskUrl: 'https://twitter.com/catcentsio' },
  { id: 'follow_anselmeow', title: 'Follow Anselmeow', description: 'Follow @Anselmeow_ on Twitter', meowMiles: 30, completed: false, icon: '/quest/x.png', taskUrl: 'https://x.com/Anselmeow_' },
  { 
    id: 'share_post', 
    title: 'Share a Post', 
    description: 'Tweet: I Just started earning Meow Miles on @catcentsio', 
    meowMiles: 30, 
    completed: false, 
    icon: '/quest/post.png', 
    taskUrl: 'https://twitter.com/intent/tweet?text=I%20Just%20started%20earning%20meow%20Miles%20on%20@catcentsio%20The%20degen%20playground%20built%20on%20@Monad_xyz.%20Quests,%20games,%20votes,%20and%20chaos.%20You%20in?%20https://www.catcents.io/%20#CatCents%20#Monad'
  },
  { id: 'like_rt_1', title: 'Like and RT', description: 'Like and retweet our post', meowMiles: 30, completed: false, icon: '/quest/like.png', taskUrl: 'https://x.com/CatCentsio/status/1914732794489790663' },
  { id: 'like_rt_2', title: 'Like and RT', description: 'Like and retweet our post', meowMiles: 30, completed: false, icon: '/quest/like.png', taskUrl: 'https://x.com/CatCentsio/status/1912899580703940891?t=foyVa-E-zlfDZx4b-lo0IA&s=19' },
  { id: 'like_rt_3', title: 'Like and RT', description: 'Like and retweet our post', meowMiles: 30, completed: false, icon: '/quest/like.png', taskUrl: 'https://x.com/CatCentsio/status/1916909155111342482?t=G5xpvxgx0uXmffQtVCqpYg&s=19' },
  { id: 'like_rt_4', title: 'Like and RT', description: 'Like and retweet our post', meowMiles: 30, completed: false, icon: '/quest/like.png', taskUrl: 'https://x.com/CatCentsio/status/1916747840446927058?t=7iENoJ8EwPQgCdCTMcsMUA&s=19' },
  { id: 'like_rt_5', title: 'Like and RT', description: 'Like and retweet our post', meowMiles: 30, completed: false, icon: '/quest/like.png', taskUrl: 'https://x.com/CatCentsio/status/1919808963748757547' },
  { id: 'like_rt_6', title: 'Like and RT', description: 'Like and retweet our post', meowMiles: 30, completed: false, icon: '/quest/like.png', taskUrl: 'https://x.com/CatCentsio/status/1920051353054830954' },
  { id: 'check_testnet_guide', title: 'Check Testnet Guide', description: 'Read the Catcents Testnet Guide', meowMiles: 30, completed: false, icon: '/quest/guide.png', taskUrl: 'https://medium.com/@catcentsio/catcents-how-to-testnet-48de3fa6cca2' },
  { id: 'join_catcents_server', title: 'Join Catcents Server', description: 'Join our Discord server', meowMiles: 30, completed: false, icon: '/quest/server.png', taskUrl: 'https://discord.gg/TXPbt7ztMC' },
  { id: 'join_telegram', title: 'Join Telegram', description: 'Join our Telegram channel', meowMiles: 30, completed: false, icon: '/quest/telegram.png', taskUrl: 'https://t.me/catcentsio' },
]

export default function QuestsPage() {
  const { address: account, isConnecting: loading } = useAccount()
  const { disconnect } = useDisconnect()
  const [quests, setQuests] = useState(INITIAL_QUESTS)
  const [meowMiles, setMeowMiles] = useState(0)
  const [referrals, setReferrals] = useState(0)
  const [referralLink, setReferralLink] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [processingQuestId, setProcessingQuestId] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const hasRedirected = useRef(false) // Use useRef to prevent re-renders

  // Track effect runs to detect loops
  const effectRunCount = useRef(0)

  const fetchUserData = async (address: string) => {
    setIsLoading(true)
    try {
      console.log('fetchUserData: Starting for address:', address)
      const userRef = doc(db, 'users', address)
      const userSnap = await getDoc(userRef)
      
      if (userSnap.exists()) {
        const data = userSnap.data()
        console.log('fetchUserData: Existing user data:', data)
        const storedQuests = data.quests || {}
        setQuests(
          INITIAL_QUESTS.map((quest) => ({
            ...quest,
            completed: storedQuests[quest.id] || false,
          }))
        )
        setMeowMiles(data.meowMiles || 0)
        setReferrals(data.referrals?.length || 0)

        const newReferralLink = `${DEPLOYED_DOMAIN}/?ref=${address}`
        setReferralLink(newReferralLink)

        if (data.referralLink && data.referralLink !== newReferralLink) {
          await setDoc(userRef, { referralLink: newReferralLink }, { merge: true })
          console.log('fetchUserData: Updated referral link:', newReferralLink)
        }
      } else {
        console.log('fetchUserData: Creating new user document for:', address)
        const newReferralLink = `${DEPLOYED_DOMAIN}/?ref=${address}`
        const referralCode = sessionStorage.getItem('referralCode')
        console.log('fetchUserData: Referral code retrieved:', referralCode)

        await setDoc(userRef, {
          walletAddress: address,
          meowMiles: 0,
          referrals: [],
          quests: {},
          referralLink: newReferralLink,
          referralCode: referralCode || null,
        })
        console.log('fetchUserData: New user document created:', address)

        setReferralLink(newReferralLink)
        sessionStorage.removeItem('referralCode')
        console.log('fetchUserData: Cleared referral code from sessionStorage')
      }
    } catch (error) {
      console.error('fetchUserData: Error fetching user data:', error)
      toast.error('Failed to load quests. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const completeQuest = useCallback(async (questId: string) => {
    if (!account) {
      console.error('completeQuest: No account available')
      return
    }
    const quest = quests.find((q) => q.id === questId)
    if (!quest) {
      console.error(`completeQuest: Quest ${questId} not found`)
      return
    }
    if (quest.completed) {
      console.log(`completeQuest: Quest ${questId} already completed locally`)
      return
    }

    const userRef = doc(db, 'users', account)
    const userSnap = await getDoc(userRef)
    const currentData = userSnap.exists() ? userSnap.data() : {}
    const currentQuests = currentData.quests || {}
    if (currentQuests[questId]) {
      console.log(`completeQuest: Quest ${questId} already completed in Firebase`)
      return
    }

    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })

    const newQuests = quests.map((q) => (q.id === questId ? { ...q, completed: true } : q))
    const newMeowMiles = (currentData.meowMiles || 0) + quest.meowMiles

    setQuests(newQuests)
    setMeowMiles(newMeowMiles)
    setProcessingQuestId(null)

    try {
      console.log(`completeQuest: Completing quest ${questId}: Updating Firebase with ${newMeowMiles} Meow Miles`)
      await setDoc(
        userRef,
        {
          meowMiles: newMeowMiles,
          quests: { ...currentQuests, [questId]: true },
        },
        { merge: true }
      )
      toast.success(`${quest.title} completed! +${quest.meowMiles} Meow Miles`)
    } catch (error) {
      console.error('completeQuest: Failed to complete quest:', error)
      toast.error('Failed to complete quest.')
      setQuests(quests)
    } finally {
      sessionStorage.removeItem('pendingQuest')
    }
  }, [account, quests]) // Removed setQuests, setMeowMiles, setProcessingQuestId to prevent loop

  const handleTaskStart = async (quest: typeof INITIAL_QUESTS[0]) => {
    if (quest.completed || processingQuestId) {
      console.log('handleTaskStart: Quest completed or processing', { questId: quest.id, processingQuestId })
      return
    }

    setProcessingQuestId(quest.id)

    if (quest.id === 'connect_twitter') {
      window.location.href = `/api/twitter/auth?walletAddress=${account}`
    } else if (quest.id === 'connect_discord') {
      window.location.href = `/api/discord/auth?walletAddress=${account}`
    } else if (quest.taskUrl) {
      window.open(quest.taskUrl, '_blank')
      await new Promise((resolve) => setTimeout(resolve, 10000))
      await completeQuest(quest.id)
    }
  }

  const handleCopyReferralLink = () => {
    if (account) {
      const referralLinkToCopy = `${DEPLOYED_DOMAIN}/?ref=${account}`
      navigator.clipboard.writeText(referralLinkToCopy)
      toast.success('Referral link copied!')
    }
  }

  const handleCopyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account)
      toast.success('Address copied!')
    }
  }

  useEffect(() => {
    effectRunCount.current += 1
    console.log(`Navigation useEffect run count: ${effectRunCount.current} - Account: ${account}, Loading: ${loading}, Pathname: ${pathname}`)

    if (effectRunCount.current > 10) {
      console.error('Potential infinite loop detected in Navigation useEffect')
      return
    }

    if (loading) {
      console.log('Navigation useEffect: Skipping due to loading')
      return
    }

    if (!account && !hasRedirected.current) {
      console.log('Navigation useEffect: Redirecting to / (no account)')
      hasRedirected.current = true
      router.push('/')
      return
    }

    if (account) {
      fetchUserData(account)

      const urlParams = new URLSearchParams(window.location.search)
      const success = urlParams.get('success')
      const error = urlParams.get('error')

      if (success) {
        console.log('Navigation useEffect: Processing success param:', success)
        if (success === 'twitter_connected') {
          toast.success('Twitter connected successfully!')
          completeQuest('connect_twitter')
        } else if (success === 'discord_connected') {
          toast.success('Discord connected successfully!')
          completeQuest('connect_discord')
        }
        if (pathname !== '/dashboard/quests' && !hasRedirected.current) {
          console.log('Navigation useEffect: Replacing to /dashboard/quests after auth')
          hasRedirected.current = true
          router.replace('/dashboard/quests')
        }
        return
      }

      if (error) {
        console.log('Navigation useEffect: Processing error param:', error)
        if (error === 'twitter_failed') {
          toast.error('Failed to connect Twitter.')
        } else if (error === 'discord_failed') {
          toast.error('Failed to connect Discord.')
        }
      }

      const returnUrl = sessionStorage.getItem('returnUrl')
      if (returnUrl && pathname !== returnUrl && !hasRedirected.current) {
        console.log(`Navigation useEffect: Redirecting to stored returnUrl: ${returnUrl}`)
        hasRedirected.current = true
        router.replace(returnUrl)
        return
      }

      if (pathname === '/dashboard' && !hasRedirected.current) {
        console.log('Navigation useEffect: Force redirecting to /dashboard/quests from /dashboard')
        hasRedirected.current = true
        router.replace('/dashboard/quests')
      }
    }
  }, [account, loading, pathname]) // Removed router, hasRedirected, completeQuest to stabilize

  useEffect(() => {
    if (!account || loading) return

    const pendingQuest = sessionStorage.getItem('pendingQuest')
    if (pendingQuest) {
      try {
        const { questId, startTime } = JSON.parse(pendingQuest)
        const quest = quests.find((q) => q.id === questId)
        if (quest && !quest.completed) {
          const elapsed = Date.now() - startTime
          if (elapsed >= 10000) {
            console.log(`PendingQuest useEffect: Completing pending quest ${questId} from sessionStorage`)
            completeQuest(questId)
          } else {
            const remaining = 10000 - elapsed
            console.log(`PendingQuest useEffect: Waiting ${remaining}ms to complete pending quest ${questId}`)
            setProcessingQuestId(questId)
            setTimeout(() => completeQuest(questId), remaining)
          }
        }
      } catch (error) {
        console.error('PendingQuest useEffect: Error processing pending quest:', error)
        sessionStorage.removeItem('pendingQuest')
      }
    }
  }, [account, loading, completeQuest]) // Removed quests to prevent loop

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <svg className="animate-spin h-8 w-8 text-purple-400" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      </div>
    )
  }

  if (!account) return null

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <main className="flex-1 p-4 md:p-8">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #9333ea' } }} />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
            Catcents Quests
          </h1>
          <div className="ml-auto">
            <Profile account={account} onCopyAddress={handleCopyAddress} onDisconnect={disconnect} />
          </div>
        </div>

        <div className="space-y-8 md:space-y-10">
          <div className="text-center bg-black/80 rounded-xl p-6 md:p-8 border border-purple-900/50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow duration-300">
            <h2 className="text-2xl md:text-3xl font-semibold text-purple-300 mb-4">Your Meow Miles</h2>
            <p className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent animate-bounce-slow">
              {meowMiles}
            </p>
            <p className="text-sm md:text-base text-gray-400 mt-2">Complete quests to earn more!</p>
          </div>

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
                      onError={(e) => {
                        console.error(`Failed to load image: ${quest.icon}`)
                        e.currentTarget.src = '/quest/fallback.png'
                      }}
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

          <div>
            <h3 className="text-xl md:text-2xl font-semibold mb-6 text-purple-300">Refer Friends</h3>
            <div className="bg-gradient-to-br from-black/90 to-purple-950/90 rounded-xl p-6 md:p-8 border border-purple-700 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow duration-300">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-lg md:text-xl font-semibold text-purple-200">Invite Your Friends</p>
                  <p className="text-sm md:text-base text-gray-300 mt-2">
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
  )
}