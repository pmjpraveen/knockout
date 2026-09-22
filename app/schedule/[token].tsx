import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { CardGrid } from '@/components/CardGrid';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { TatamiQueueCard } from '@/components/TatamiQueueCard';
import { Text } from '@/components/Text';
import { ChoiceChips } from '@/components/ChoiceChips';
import { currentDay, dayLabels, eventDays, matchLabel } from '@/lib/schedule';
import { supabaseUrl } from '@/lib/supabase';

type PublicSchedule = {
  event: { name: string; venue: string | null; start_date: string | null; end_date: string | null };
  updated_at: string;
  tatamis: {
    name: string;
    status: string;
    matches: {
      position: number;
      category: string;
      round: number;
      side: string;
      athlete_a: string | null;
      athlete_b: string | null;
      estimated_call_time: string | null;
      day: string | null;
    }[];
  }[];
};

const endpoint = `${supabaseUrl}/functions/v1/public-schedule`;

/** Public, no-login schedule. Polls every 10s: anonymous visitors cannot use Realtime. */
export default function PublicSchedulePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [schedule, setSchedule] = useState<PublicSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setSchedule(payload);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  if (!schedule) return <Screen>{error ? <Text color="danger">{error}</Text> : <SkeletonList count={2} />}</Screen>;

  const days = eventDays(schedule.event.start_date, schedule.event.end_date, schedule.tatamis.flatMap((t) => t.matches.map((m) => m.day)));
  const day = picked ?? currentDay(days, schedule.tatamis.flatMap((t) => t.matches.map((m) => m.day)));

  return (
    <Screen wide>
      <Text variant="heading" weight="medium">{schedule.event.name}</Text>
      {schedule.event.venue && <Text color="charcoal">{schedule.event.venue}</Text>}
      <Text variant="body" color="slateGray">
        Times are estimates and update live. Refreshed {new Date(schedule.updated_at).toLocaleTimeString()}.
      </Text>
      {error && <Text color="warning">Could not refresh. Showing the last update.</Text>}
      {days.length > 1 && day && <ChoiceChips label="Day" options={days} value={day} labels={dayLabels(days)} onChange={setPicked} />}
      <CardGrid>
      {schedule.tatamis.map((tatami) => (
        <TatamiQueueCard
          key={tatami.name}
          name={tatami.name}
          paused={tatami.status === 'paused'}
          items={tatami.matches.filter((m) => !day || m.day === day).map((m) => ({
            key: String(m.position),
            a: m.athlete_a,
            b: m.athlete_b,
            time: m.estimated_call_time,
            category: m.category,
            detail: matchLabel(m.side, m.round),
          }))}
        />
      ))}
      </CardGrid>
    </Screen>
  );
}
