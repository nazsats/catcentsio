import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import Twitter from 'twitter-lite';

// Define Twitter error interface
interface TwitterError {
  message?: string;
  stack?: string;
  response?: {
    data?: {
      errors?: { message: string; code: number }[];
    };
  };
}

// Ensure environment variables are present at build time
if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.NEXTAUTH_URL) {
  throw new Error('Missing required Twitter API environment variables');
}

const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET,
});

export async function GET(request: NextRequest) {
  try {
    console.log('Starting Twitter auth flow');
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');
    const CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || `${process.env.NEXTAUTH_URL}/api/twitter/auth`;

    console.log('Wallet Address:', walletAddress);
    console.log('OAuth Token:', oauthToken);
    console.log('OAuth Verifier:', oauthVerifier);
    console.log('Callback URL sent to Twitter:', CALLBACK_URL);

    if (!oauthToken || !oauthVerifier) {
      if (!walletAddress) {
        console.log('No wallet address provided');
        return NextResponse.redirect(new URL('/dashboard/quests?error=twitter_failed', request.url));
      }

      console.log('Generating request token');
      const response = await twitterClient.getRequestToken(CALLBACK_URL);
      console.log('Request token response:', response);

      if (response.oauth_callback_confirmed !== 'true') {
        console.log('OAuth callback not confirmed');
        throw new Error('OAuth callback not confirmed');
      }

      const tempRef = doc(db, 'twitter_auth_temp', response.oauth_token);
      await setDoc(tempRef, { walletAddress, createdAt: new Date().toISOString() });
      console.log('Stored walletAddress in Firebase:', walletAddress);

      const redirectUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${response.oauth_token}`;
      console.log('Redirecting to:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    const tempRef = doc(db, 'twitter_auth_temp', oauthToken);
    const tempSnap = await getDoc(tempRef);
    const storedWalletAddress = tempSnap.exists() ? tempSnap.data().walletAddress : null;
    console.log('Retrieved stored walletAddress:', storedWalletAddress);

    if (!storedWalletAddress) {
      console.log('No stored wallet address found');
      return NextResponse.redirect(new URL('/dashboard/quests?error=twitter_failed', request.url));
    }

    console.log('Handling callback with token and verifier');
    const accessTokenResponse = await twitterClient.getAccessToken({
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
    });
    console.log('Access token response:', accessTokenResponse);

    const username = accessTokenResponse.screen_name;
    console.log('Extracted username:', username);

    const userRef = doc(db, 'users', storedWalletAddress);
    await setDoc(userRef, { twitterUsername: username, updatedAt: new Date().toISOString() }, { merge: true });
    console.log('Stored username in Firebase:', username);

    await deleteDoc(tempRef);
    console.log('Cleaned up temporary storage');

    console.log('Redirecting to success');
    return NextResponse.redirect(new URL('/dashboard/quests?success=twitter_connected', request.url));
  } catch (error: unknown) {
    // Type assertion with defined interface
    const errorDetails: TwitterError = {};

    if (error instanceof Error) {
      errorDetails.message = error.message;
      errorDetails.stack = error.stack;
    }

    // Safely check for response property
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object'
    ) {
      errorDetails.response = (error as TwitterError).response;
    } else {
      errorDetails.response = undefined;
    }

    console.error('Twitter auth error:', errorDetails);
    return NextResponse.redirect(new URL('/dashboard/quests?error=twitter_failed', request.url));
  }
}