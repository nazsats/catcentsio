import { NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseCSV } from '@/lib/parseCSV';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?error=${encodeURIComponent('Authentication failed')}`
    );
  }

  if (!code || typeof code !== 'string') {
    console.error('Callback: Missing or invalid authorization code');
    return NextResponse.json({ error: 'Missing or invalid authorization code' }, { status: 400 });
  }

  if (
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.NEXT_PUBLIC_BASE_URL
  ) {
    console.error('Callback: Missing environment variables:', {
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      NEXT_PUBLIC_BASE_URL: !!process.env.NEXT_PUBLIC_BASE_URL,
    });
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      console.error('Callback: Token exchange error:', tokenData.error_description);
      return NextResponse.json({ error: tokenData.error_description }, { status: 400 });
    }

    // Fetch user email
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();
    const email = userData.email;

    if (!email) {
      console.error('Callback: Unable to retrieve email');
      return NextResponse.json({ error: 'Unable to retrieve email' }, { status: 400 });
    }

    // Retrieve wallet address from state
    const walletAddress = state && typeof state === 'string' ? state : null;
    if (!walletAddress) {
      console.error('Callback: Missing wallet address');
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Fetch season0Points from points.csv
    let userPoints = 0;
    try {
      const csvData = await parseCSV('/points.csv');
      console.log('Callback: CSV data:', csvData);
      console.log('Callback: Searching for email:', email.toLowerCase());
      const matchingEntry = csvData.find(item => item.email.toLowerCase() === email.toLowerCase());
      console.log('Callback: Matching entry:', matchingEntry);
      userPoints = matchingEntry?.points || 0;
    } catch (csvError) {
      console.error('Callback: Error parsing CSV:', csvError);
      // Continue with userPoints = 0
    }

    // Save to Firestore
    console.log('Callback: Saving to Firestore:', { walletAddress, email: email.toLowerCase(), season0Points: userPoints });
    const userRef = doc(db, 'users', walletAddress);
    await setDoc(
      userRef,
      {
        email: email.toLowerCase(),
        season0Points: userPoints,
      },
      { merge: true }
    );

    // Add a delay to ensure Firestore write propagation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Redirect back to dashboard with success or warning
    const redirectUrl =
      userPoints === 0
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?email=${encodeURIComponent(
            email
          )}&points=${userPoints}&warning=${encodeURIComponent("You didn't participate in Season 0")}`
        : `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?email=${encodeURIComponent(email)}&points=${userPoints}`;
    console.log('Callback: Redirecting to:', redirectUrl);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback: Auth callback error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      query: Object.fromEntries(searchParams),
    });
    return NextResponse.json({ error: 'Failed to process authentication' }, { status: 500 });
  }
}