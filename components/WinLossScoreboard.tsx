import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { ResultConfirm, ScoreboardRow, ScoreButton, ScorePanel } from '@/components/ScoreboardParts';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { haptic } from '@/lib/haptics';
import type { Outcome } from '@/lib/scoring';
import { theme } from '@/theme/tokens';

/** One tap picks the winner; an optional note (e.g. "won by default") is logged with it. */
export function WinLossScoreboard({ row, eventId, onDone }: { row: ScoreboardRow; eventId: string; onDone: () => void }) {
  const scoring = useMatchScoring({ eventId, matchId: row.match_id });
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState<(Outcome & { note: string | null }) | null>(null);
  const { athlete_a_id: a, athlete_b_id: b } = row;
  const names = { [a]: row.athlete_a, [b]: row.athlete_b };

  if (scoring.finalized) {
    return (
      <View style={{ gap: theme.spacing[12] }}>
        <Text variant="heading" weight="medium">{names[scoring.finalized.winner]} wins</Text>
        <Text color="slateGray">Recorded on this device. It syncs when a connection is available.</Text>
        <Button title="Back to the queue" onPress={onDone} />
      </View>
    );
  }

  const pick = (id: string) => setConfirming({ winner: id, method: 'win_loss', note: note.trim() || null });

  return (
    <View style={{ gap: theme.spacing[16] }}>
      <ScorePanel
        aka={{ name: row.athlete_a, total: '', children: <ScoreButton title="Wins" disabled={!scoring.started} onPress={() => pick(a)} /> }}
        ao={{ name: row.athlete_b, total: '', children: <ScoreButton title="Wins" disabled={!scoring.started} onPress={() => pick(b)} /> }}
      />
      {!scoring.started && <Button title="Start match" onPress={() => { haptic.start(); scoring.start(); }} />}
      <TextField label="Note (optional)" value={note} onChangeText={setNote} autoCapitalize="sentences" placeholder="e.g. won by default, no-show" />
      {confirming && (
        <ResultConfirm
          outcome={confirming}
          names={names}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            await scoring.record('win_loss', confirming.winner, null, confirming.note ? { note: confirming.note } : null);
            await scoring.finalize(confirming.winner, 'win_loss', confirming.note);
          }}
        />
      )}
      {scoring.conflict && <Text color="danger">This match conflicted with the server ({scoring.conflict}). A tournament director will review it.</Text>}
    </View>
  );
}
