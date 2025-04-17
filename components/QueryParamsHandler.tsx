'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface QueryParamsHandlerProps {
  account: string | undefined;
  loading: boolean;
  completeQuest: (questId: string) => Promise<void>;
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
    if (hasProcessed || !account || loading) {
      console.log('QueryParamsHandler: Skipping processing', { hasProcessed, account, loading });
      return;
    }

    const processParams = async () => {
      const success = searchParams.get('success');
      const error = searchParams.get('error');

      console.log('QueryParamsHandler: Processing params', { success, error, account });

      if (success === 'twitter_connected') {
        try {
          toast.success('Twitter connected successfully!');
          console.log('QueryParamsHandler: Calling completeQuest for connect_twitter');
          await completeQuest('connect_twitter');
          console.log('QueryParamsHandler: Twitter quest completed');
          onParamsProcessed();
        } catch (error) {
          console.error('QueryParamsHandler: Failed to complete Twitter quest', error);
          toast.error('Failed to update Twitter quest.');
        }
      } else if (success === 'discord_connected') {
        try {
          toast.success('Discord connected successfully!');
          console.log('QueryParamsHandler: Calling completeQuest for connect_discord');
          await completeQuest('connect_discord');
          console.log('QueryParamsHandler: Discord quest completed');
          onParamsProcessed();
        } catch (error) {
          console.error('QueryParamsHandler: Failed to complete Discord quest', error);
          toast.error('Failed to update Discord quest.');
        }
      } else if (error === 'twitter_failed') {
        toast.error('Failed to connect Twitter.');
        console.log('QueryParamsHandler: Twitter connection failed');
        onParamsProcessed();
      } else if (error === 'discord_failed') {
        toast.error('Failed to connect Discord.');
        console.log('QueryParamsHandler: Discord connection failed');
        onParamsProcessed();
      } else {
        console.log('QueryParamsHandler: No relevant query params found');
      }

      setHasProcessed(true);
    };

    processParams();
  }, [account, loading, searchParams, completeQuest, hasProcessed, onParamsProcessed]);

  return null;
}