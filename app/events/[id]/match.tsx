import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { KataScoreboard } from '@/components/KataScoreboard';
import { KumiteScoreboard } from '@/components/KumiteScoreboard';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { SyncBanner } from '@/components/ScoreboardParts';
import { Text } from '@/components/Text';
import { WinLossScoreboard } from '@/components/WinLossScoreboard';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { matchLabel } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

/** Runs from the last-synced queue plus the local event log, so it works with no connection. */
export default function Match() {
  const { id, tatamiId, matchId } = useLocalSearchParams<{ id: string; tatamiId: string; matchId: string }>();
  const router = useRouter();
  const { rows, loading } = useFocusQuery(() => supabase.rpc('tatami_scoreboard', { p_tatami_id: tatamiId }), [tatamiId], `scoreboard:${tatamiId}`);
  const row = rows.find((r) => r.match_id === matchId);
  const done = () => router.replace({ pathname: '/events/[id]/scoreboard', params: { id } });

  if (!row) {
    return (
      <Screen animate={false}>
        <SyncBanner />
        {loading ? (
          <>
            <Skeleton height={420} radius={theme.radii.scorePanel} />
            <Skeleton height={theme.touchTarget.minimum} radius={theme.radii.button} />
          </>
        ) : (
          <Text color="slateGray">This match is no longer in the queue.</Text>
        )}
      </Screen>
    );
  }

  const props = { row, eventId: id, onDone: done };
  if (row.scoring_mode === 'kumite_points') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <KumiteScoreboard {...props} />
      </>
    );
  }
  return (
    <Screen animate={false}>
      <SyncBanner />
      <Text color="slateGray">{row.category_label} · {matchLabel(row.bracket_side, row.round)}</Text>
      {row.scoring_mode === 'win_loss' ? <WinLossScoreboard {...props} /> : <KataScoreboard {...props} />}
    </Screen>
  );
}
