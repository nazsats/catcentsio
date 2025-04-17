import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

// In-memory store for walletAddress (for local testing only)
const tokenStore = new Map<string, string>();

export async function GET(request: NextRequest) {
  try {
    console.log('Starting Discord auth flow');
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    console.log('Wallet Address:', walletAddress);
    console.log('Code:', code);
    console.log('State:', state);

    if (!code) {
      // Initial request to start OAuth flow
      if (!walletAddress) {
        console.log('No wallet address provided in initial request');
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/quests?error=discord_failed`);
      }

      const state = Math.random().toString(36).substring(2);
      tokenStore.set(state, walletAddress);
      console.log('Stored walletAddress in tokenStore:', walletAddress);

      const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
        `${process.env.NEXTAUTH_URL}/api/discord/auth`
      )}&response_type=code&scope=identify&state=${state}`;
      console.log('Redirecting to:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    // Handle OAuth callback
    if (!state) {
      console.log('State parameter missing in callback');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/quests?error=discord_failed`);
    }

    const storedWalletAddress = tokenStore.get(state);
    console.log('Retrieved stored walletAddress:', storedWalletAddress);
    if (!storedWalletAddress) {
      console.log('No stored wallet address found for this state');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/quests?error=discord_failed`);
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/discord/auth`,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response:', tokenData);
    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    console.log('User data:', userData);
    if (!userResponse.ok) {
      throw new Error('Failed to fetch user data');
    }

    const username = userData.username;
    console.log('Extracted username:', username);

    const userRef = doc(db, 'users', storedWalletAddress);
    await setDoc(
      userRef,
      {
        discordUsername: username,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log('Stored Discord username in Firebase:', username);

    tokenStore.delete(state);

    console.log('Redirecting to success');
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/quests?success=discord_connected`);
  } catch (error) {
    console.error('Discord auth error:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/quests?error=discord_failed`);
  }
}