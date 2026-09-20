import { useCallback, useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { flush, getDeviceId, LocalMatch, loadMatch, Op, saveLocal, subscribe, uuid } from '@/lib/offline';
import type { Method, ScoreEvent, ScoreEventType } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';

type Context = { eventId: string; matchId: string };

const emptyMatch: LocalMatch = { events: [], started: false, finalized: null, conflict: null };

/**
 * A match's scoring state on this device. Every action is written to local storage and queued for
 * sync first, then shown; nothing here needs a connection.
 */
export function useMatchScoring({ eventId, matchId }: Context) {
  const [match, setMatch] = useState<LocalMatch>(emptyMatch);

  useEffect(() => {
    const load = () => { loadMatch(matchId).then(setMatch); };
    load();
    return subscribe(load);
  }, [matchId]);

  useEffect(() => {
    if (match.conflict) haptic.error();
  }, [match.conflict]);

  const queue = useCallback(
    async (change: (m: LocalMatch) => LocalMatch, fields: { kind: Op['kind'] } & Record<string, unknown>) => {
      const { data } = await supabase.auth.getSession();
      const op = {
        ...fields,
        op_id: uuid(),
        event_id: eventId,
        match_id: matchId,
        client_timestamp: new Date().toISOString(),
        user_id: data.session?.user.id ?? '',
      } as Op;
      await saveLocal(matchId, change, op);
      flush();
      return op;
    },
    [eventId, matchId],
  );

  const start = () => queue((m) => ({ ...m, started: true }), { kind: 'start' });

  const record = async (type: ScoreEventType, athleteId: string | null, value: number | null, detail: Record<string, unknown> | null = null, voids: string | null = null) => {
    const id = uuid();
    const client_timestamp = new Date().toISOString();
    const device_id = await getDeviceId();
    const event: ScoreEvent = { id, match_id: matchId, athlete_id: athleteId, type, value, detail, voids, client_timestamp, device_id };
    await queue((m) => ({ ...m, events: [...m.events, event] }), { kind: 'event', id, type, athlete_id: athleteId, value, detail, voids });
  };

  const finalize = (winner: string, method: Method, note: string | null = null) =>
    queue((m) => ({ ...m, finalized: { winner, method, note } }), { kind: 'finalize', winner_id: winner, method, note });

  return { ...match, start, record, finalize };
}
