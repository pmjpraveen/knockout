import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { ResultConfirm, ScoreboardRow, ScoreButton, ScorePanel } from '@/components/ScoreboardParts';
import { Text } from '@/components/Text';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { haptic } from '@/lib/haptics';
import { kataOutcome, kataState, Outcome } from '@/lib/scoring';
import { theme } from '@/theme/tokens';

const valid = (text: string) => {
  const value = Number(text);
  return text.trim() !== '' && value >= 5 && value <= 10 && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
};

/** Multi-judge technical scoring (5.0-10.0, 0.1 steps; high and low trimmed) or an elimination flag vote. */
export function KataScoreboard({ row, eventId, onDone }: { row: ScoreboardRow; eventId: string; onDone: () => void }) {
  const scoring = useMatchScoring({ eventId, matchId: row.match_id });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<Outcome | null>(null);
  const { athlete_a_id: a, athlete_b_id: b, judge_panel: panel } = row;
  const flags = row.scoring_mode === 'kata_flags';
  const names = { [a]: row.athlete_a, [b]: row.athlete_b };
  const state = kataState(scoring.events, a, b, panel);
  const outcome = kataOutcome(state, a, b, flags ? 'kata_flags' : 'kata_scores', panel);
  const judges = Array.from({ length: panel }, (_, i) => i + 1);
  const editable = scoring.started && !scoring.finalized;

  if (scoring.finalized) {
    return (
      <View style={{ gap: theme.spacing[12] }}>
        <Text variant="heading">{names[scoring.finalized.winner]} wins</Text>
        <Text color="slateGray">Recorded on this device. It syncs when a connection is available.</Text>
        <Button title="Back to the queue" onPress={onDone} />
      </View>
    );
  }

  const commit = (side: 'a' | 'b', judge: number) => {
    const key = `${side}${judge}`;
    const text = drafts[key];
    if (text === undefined || !valid(text)) return;
    if (Number(text) === state.scores[side][judge - 1]) return;
    haptic.tap();
    scoring.record('kata_score', side === 'a' ? a : b, Number(text), { judge });
  };

  const entries = (side: 'a' | 'b') =>
    judges.map((judge) =>
      flags ? (
        <ScoreButton
          key={judge}
          title={`Judge ${judge}: flag${state.scores[side][judge - 1] !== null ? ' ✓' : ''}`}
          disabled={!editable}
          onPress={() => scoring.record('kata_score', side === 'a' ? a : b, 1, { judge })}
        />
      ) : (
        <View key={judge} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }}>
          <Text variant="body" color="paperWhite">J{judge}</Text>
          <TextInput
            editable={editable}
            accessibilityLabel={`Judge ${judge} score, ${side === 'a' ? 'Aka' : 'Ao'} corner, ${side === 'a' ? row.athlete_a : row.athlete_b}`}
            keyboardType="decimal-pad"
            value={drafts[`${side}${judge}`] ?? (state.scores[side][judge - 1]?.toFixed(1) ?? '')}
            onChangeText={(text) => setDrafts((d) => ({ ...d, [`${side}${judge}`]: text }))}
            onEndEditing={() => commit(side, judge)}
            placeholder="5.0–10.0"
            placeholderTextColor={theme.colors.slateGray}
            style={[theme.type.bodyLg, {
              flex: 1, minHeight: theme.touchTarget.minimum, borderRadius: theme.radii.chip, backgroundColor: theme.colors.paperWhite,
              paddingHorizontal: theme.spacing[8], color: theme.colors.inkBlack, fontFamily: theme.fonts.sans.regular,
              borderWidth: 2, borderColor: drafts[`${side}${judge}`] !== undefined && !valid(drafts[`${side}${judge}`]) ? theme.colors.danger : 'transparent',
            }]}
          />
        </View>
      ),
    );

  const total = (side: 'a' | 'b') => (flags ? String(state.votes[side]) : state.totals[side] === null ? '–' : state.totals[side]!.toFixed(1));

  return (
    <View style={{ gap: theme.spacing[16] }}>
      <ScorePanel
        totalStyle="timerDisplay"
        aka={{ name: row.athlete_a, total: total('a'), children: <>{entries('a')}</> }}
        ao={{ name: row.athlete_b, total: total('b'), children: <>{entries('b')}</> }}
      />
      <Text variant="body" color="slateGray">
        {flags ? `Flag vote: each of the ${panel} judges raises one flag.` : `${panel} judges. The highest and lowest scores are dropped and the rest summed.`}
      </Text>

      {!scoring.started && <Button title="Start match" onPress={() => { haptic.start(); scoring.start(); }} />}
      {scoring.started && outcome && !confirming && <Button title="Review result" onPress={() => setConfirming(outcome)} />}
      {scoring.started && !outcome && !flags && state.totals.a !== null && state.totals.a === state.totals.b && (
        <View style={{ gap: theme.spacing[8] }}>
          <Text>Totals are level. Record the judges&apos; decision.</Text>
          {[a, b].map((id) => (
            <Button key={id} title={`Decision: ${names[id]}`} variant="secondary" onPress={() => setConfirming({ winner: id, method: 'decision' })} />
          ))}
        </View>
      )}
      {confirming && <ResultConfirm outcome={confirming} names={names} onCancel={() => setConfirming(null)} onConfirm={async () => { await scoring.finalize(confirming.winner, confirming.method); }} />}
      {scoring.conflict && <Text color="danger">This match conflicted with the server ({scoring.conflict}). A tournament director will review it.</Text>}
    </View>
  );
}
