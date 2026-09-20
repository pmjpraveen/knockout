import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Json } from '@/lib/database.types';
import type { ScoreEvent } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';

// Everything a scorekeeper needs offline lives in AsyncStorage: the outbox of queued operations,
// each match's local event log, and the last-synced copy of what the screens read.

export type Op = {
  op_id: string;
  kind: 'start' | 'event' | 'finalize';
  event_id: string;
  match_id: string;
  client_timestamp: string;
  user_id: string;
  [field: string]: unknown;
};

export type LocalMatch = {
  events: ScoreEvent[];
  started: boolean;
  finalized: { winner: string; method: string; note: string | null } | null;
  conflict: string | null;
};

const emptyMatch: LocalMatch = { events: [], started: false, finalized: null, conflict: null };
const staleAfterMinutes = 10;

// ponytail: Math.random ids. They only need to be unique per device, not unguessable.
export const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

// Read-modify-write on storage must not interleave.
let chain: Promise<unknown> = Promise.resolve();
const serial = <T>(work: () => Promise<T>): Promise<T> => {
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

let deviceId: string | null = null;
export async function getDeviceId() {
  deviceId ??= (await AsyncStorage.getItem('device-id')) ?? null;
  if (!deviceId) {
    deviceId = uuid();
    await AsyncStorage.setItem('device-id', deviceId);
  }
  return deviceId;
}

export const loadMatch = (matchId: string) => read<LocalMatch>(`match:${matchId}`, emptyMatch);

/** Applies a change to a match's local state, and optionally queues an operation, in one durable step. */
export function saveLocal(matchId: string, change: (match: LocalMatch) => LocalMatch, op?: Op) {
  return serial(async () => {
    await write(`match:${matchId}`, change(await loadMatch(matchId)));
    if (op) await write('outbox', [...(await read<Op[]>('outbox', [])), op]);
    notify();
  });
}

export const outbox = () => read<Op[]>('outbox', []);

export async function syncStatus() {
  const ops = await outbox();
  const oldest = ops.length ? Date.parse(ops[0].client_timestamp) : null;
  return {
    pending: ops.length,
    lastSync: await read<string | null>('last-sync', null),
    stale: oldest !== null && Date.now() - oldest > staleAfterMinutes * 60_000,
  };
}

type SyncResult = { op_id: string; status: 'ok' | 'duplicate' | 'conflict'; reason: string | null };

/** Sends queued operations for the signed-in user. Returns false when the server could not be reached. */
export function flush() {
  return serial(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return false;

    const queue = await read<Op[]>('outbox', []);
    const batch = queue.filter((op) => op.user_id === userId).slice(0, 100);
    if (batch.length === 0) return true;

    const { data, error } = await supabase.rpc('sync_scoring', { p_device_id: await getDeviceId(), p_ops: batch as unknown as Json });
    // A response with a code means the server rejected the batch itself; retrying it would loop forever.
    if (error && !error.code) return false;
    if (error) {
      await write('dead-letter', [...(await read<Op[]>('dead-letter', [])), ...batch]);
    }

    const results = (data ?? []) as SyncResult[];
    const done = new Set(batch.map((op) => op.op_id));
    await write('outbox', queue.filter((op) => !done.has(op.op_id)));

    for (const result of results.filter((r) => r.status === 'conflict')) {
      const op = batch.find((b) => b.op_id === result.op_id);
      if (op) await write(`match:${op.match_id}`, { ...(await loadMatch(op.match_id)), conflict: result.reason });
    }
    if (!error) await write('last-sync', new Date().toISOString());
    notify();
    return !error;
  });
}

let loop: ReturnType<typeof setInterval> | null = null;
/** Retries the outbox every few seconds while the app is open. */
export function startSyncLoop() {
  if (!loop) loop = setInterval(() => { flush(); }, 8000);
  flush();
  return () => {
    if (loop) clearInterval(loop);
    loop = null;
  };
}

type Loaded<T> = { data: T[] | null; error: { message: string } | null };

/** Runs a query and remembers the answer; if the network fails, returns the last remembered answer. */
export async function cachedRows<T>(key: string, load: () => PromiseLike<Loaded<T>>): Promise<Loaded<T> & { stale: boolean }> {
  const { data: auth } = await supabase.auth.getSession();
  const storageKey = `cache:${auth.session?.user.id ?? 'anon'}:${key}`;
  const result = await load();
  if (!result.error) {
    await write(storageKey, result.data);
    return { ...result, stale: false };
  }
  const remembered = await read<T[] | null>(storageKey, null);
  return remembered ? { data: remembered, error: null, stale: true } : { ...result, stale: false };
}
