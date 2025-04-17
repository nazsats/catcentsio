'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface QueryParamsHandlerProps {
  account: string | undefined;
  loading: boolean;
  completeQuest: (questId: string) => void;
  onParamsProcessed: () => void;
}

export default function QueryParamsHandler({
  account,
  loading,
  completeQuest,
  onParamsProcessed,
}: QueryParamsHandlerProps) {
  const searchParams = useSearchParams();
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    if (hasProcessed || !account || loading) return;

    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'twitter_connected') {
      toast.success('Twitter connected successfully!');
      completeQuest('connect_twitter');
      onParamsProcessed();
    } else if (success === 'discord_connected') {
      toast.success('Discord connected successfully!');
      completeQuest('connect_discord');
      onParamsProcessed();
    } else if (error === 'twitter_failed') {
      toast.error('Failed to connect Twitter.');
      onParamsProcessed();
    } else if (error === 'discord_failed') {
      toast.error('Failed to connect Discord.');
      onParamsProcessed();
    }

    setHasProcessed(true);
  }, [account, loading, searchParams, completeQuest, hasProcessed, onParamsProcessed]);

  return null; // This component renders nothing
}