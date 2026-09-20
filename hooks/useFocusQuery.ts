import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { cachedRows } from '@/lib/offline';

type Response<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Runs `query` each time the screen gains focus or `deps` change; `reload` re-runs it on demand.
 * With a `cacheKey` the last good answer is kept on the device, and `stale` says it is being shown offline.
 * `loading` is true until the first answer arrives (and again when the `cacheKey` changes), so screens can show a
 * skeleton instead of an empty state. While `enabled` is false nothing is fetched and `loading` stays true, for
 * queries that need something that is not known yet, such as the signed-in user.
 */
export function useFocusQuery<T>(query: () => PromiseLike<Response<T>>, deps: unknown[] = [], cacheKey?: string, enabled = true) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryRef = useRef(query);
  queryRef.current = query;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const answeredKey = useRef<string | undefined>(undefined);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!enabledRef.current) return;
    const request = ++latest.current;
    const { data, error: failure, stale: offline } = cacheKey
      ? await cachedRows(cacheKey, () => queryRef.current())
      : { ...(await queryRef.current()), stale: false };
    if (request !== latest.current) return; // a newer query has been started; drop this stale answer
    setRows(data ?? []);
    setError(failure?.message ?? null);
    setStale(offline);
    answeredKey.current = cacheKey ?? '';
    setLoading(false);
  }, [cacheKey]);

  useFocusEffect(useCallback(() => { reload(); }, [reload, ...deps]));

  return { rows, error, stale, loading: loading || !enabled || answeredKey.current !== (cacheKey ?? ''), reload };
}
