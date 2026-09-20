import { useCallback, useEffect, useState } from 'react';
import { flush, subscribe, syncStatus } from '@/lib/offline';

type Status = Awaited<ReturnType<typeof syncStatus>>;

/** Pending-operation count and last successful sync for this device; refreshes as the outbox changes. */
export function useSyncStatus() {
  const [status, setStatus] = useState<Status>({ pending: 0, lastSync: null, stale: false });
  const refresh = useCallback(() => { syncStatus().then(setStatus); }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    const unsubscribe = subscribe(refresh);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [refresh]);

  return { ...status, syncNow: () => flush().then(refresh) };
}
