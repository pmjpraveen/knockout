import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { MatchDone, ResultConfirm, ScoreboardRow } from '@/components/ScoreboardParts';
import { Text } from '@/components/Text';
import { inputText } from '@/components/TextField';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { haptic } from '@/lib/haptics';
import { pressFeedback } from '@/lib/press';
import { kataOutcome, kataState, Outcome } from '@/lib/scoring';
import { theme } from '@/theme/tokens';

// WKF 5.4.1: 5.0 to 10.0 in 0.1 steps, or 0.0 for a disqualification.
const valid = (text: string) => {
  const value = Number(text);
  return text.trim() !== '' && (value === 0 || (value >= 5 && value <= 10)) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
};

/** WKF kata: each judge marks both athletes and votes for the higher mark; the majority of judges wins. Or a manual flag vote. */
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

  if (scoring.finalized) return <MatchDone winner={names[scoring.finalized.winner]} onDone={onDone} />;

  const commit = (side: 'a' | 'b', judge: number) => {
    const key = `${side}${judge}`;
    const text = drafts[key];
    if (text === undefined || !valid(text)) return;
    if (Number(text) === state.scores[side][judge - 1]) return;
    haptic.tap();
    scoring.record('kata_score', side === 'a' ? a : b, Number(text), { judge });
  };

  const votes = flags ? state.flagVotes : state.markVotes;
  const tint = { a: theme.colors.akaTint, b: theme.colors.aoTint } as const;
  const colour = { a: theme.colors.aka, b: theme.colors.ao } as const;
  const ties = state.judgeVotes.map((vote, index) => (vote === 'tie' ? index + 1 : null)).filter((judge) => judge !== null);

  const disqualify = (side: 'a' | 'b') => {
    haptic.warning();
    judges.forEach((judge) => scoring.record('kata_score', side === 'a' ? a : b, 0, { judge }));
  };

  const cell = (side: 'a' | 'b', judge: number) => {
    const key = `${side}${judge}`;
    const mark = state.scores[side][judge - 1];
    const bad = (drafts[key] !== undefined && !valid(drafts[key])) || state.judgeVotes[judge - 1] === 'tie';
    const won = state.judgeVotes[judge - 1] === side;
    if (flags) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Judge ${judge} flag for ${side === 'a' ? row.athlete_a : row.athlete_b}`}
          disabled={!editable}
          onPress={() => scoring.record('kata_score', side === 'a' ? a : b, 1, { judge })}
          style={({ pressed }) => [{ flex: 1, minHeight: theme.touchTarget.minimum, borderRadius: theme.radii.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: mark !== null ? colour[side] : tint[side], opacity: editable ? 1 : 0.5 }, pressFeedback(pressed)]}
        >
          <Text color={mark !== null ? 'paperWhite' : 'inkBlack'}>{mark !== null ? 'Flag ✓' : 'Flag'}</Text>
        </Pressable>
      );
    }
    return (
      <TextInput
        editable={editable}
        accessibilityLabel={`Judge ${judge} score, ${side === 'a' ? 'Aka' : 'Ao'} corner, ${side === 'a' ? row.athlete_a : row.athlete_b}`}
        keyboardType="decimal-pad"
        value={drafts[key] ?? (mark?.toFixed(1) ?? '')}
        onChangeText={(text) => setDrafts((d) => ({ ...d, [key]: text }))}
        onEndEditing={() => commit(side, judge)}
        placeholder="–"
        placeholderTextColor={theme.colors.steelGray}
        style={[inputText, {
          flex: 1, minHeight: theme.touchTarget.minimum, borderRadius: theme.radii.chip, textAlign: 'center', fontFamily: theme.fonts.sans.medium,
          backgroundColor: won ? colour[side] : editable ? tint[side] : theme.colors.cloud, color: won ? theme.colors.paperWhite : theme.colors.inkBlack, borderWidth: 2, borderColor: bad ? theme.colors.danger : 'transparent',
        }]}
      />
    );
  };

  const corner = (side: 'a' | 'b') => (
    <View style={{ flex: 1, gap: theme.spacing[4], padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: colour[side] }}>
      <Text variant="label" color="paperWhite" style={{ textTransform: 'uppercase', opacity: 0.85 }}>{side === 'a' ? 'Aka · performs first' : 'Ao'}</Text>
      <Text variant="bodyLg" color="paperWhite" numberOfLines={2}>{side === 'a' ? row.athlete_a : row.athlete_b}</Text>
      <Text variant="timerDisplay" color="paperWhite">{votes[side]}</Text>
      <Text variant="body" color="paperWhite" style={{ opacity: 0.85 }}>{votes[side] === 1 ? 'vote' : 'votes'}</Text>
    </View>
  );

  return (
    <View style={{ gap: theme.spacing[16] }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
        {corner('a')}
        {corner('b')}
      </View>

      <View style={{ gap: theme.spacing[8], padding: theme.spacing[16], borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.mist, backgroundColor: theme.colors.paperWhite }}>
        {judges.map((judge) => (
          <View key={judge} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }}>
            <Text variant="label" color="slateGray" style={{ width: 28 }}>J{judge}</Text>
            {cell('a', judge)}
            {cell('b', judge)}
          </View>
        ))}
      </View>
      <Text variant="body" color="slateGray">
        {flags
          ? `Flag vote: each of the ${panel} judges raises one flag. The most flags wins.`
          : `Each of the ${panel} judges marks both athletes, 5.0 to 10.0 (0.0 disqualifies). The higher mark is that judge's vote, and the most votes wins.`}
      </Text>
      {!flags && state.scores.a.every((mark) => mark === 0) && state.scores.b.every((mark) => mark === 0) && (
        <View style={{ padding: theme.spacing[12], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
          <Text variant="body" color="warning">Both athletes are disqualified. They perform an additional kata to decide the result, so there is no winner yet.</Text>
        </View>
      )}
      {ties.length > 0 && (
        <View style={{ padding: theme.spacing[12], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
          <Text variant="body" color="warning">{ties.length === 1 ? `Judge ${ties[0]} gave both athletes the same mark.` : `Judges ${ties.join(', ')} gave both athletes the same mark.`} A judge must pick a winner, so one mark has to change.</Text>
        </View>
      )}

      {!scoring.started && <Button size="large" title="Start match" onPress={() => { haptic.start(); scoring.start(); }} />}
      {scoring.started && outcome && !confirming && <Button size="large" title="Review result" onPress={() => setConfirming(outcome)} />}
      {editable && !flags && !outcome && (
        <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
          {(['a', 'b'] as const).map((side) => (
            <View key={side} style={{ flex: 1 }}>
              <Button size="medium" variant="danger" title={`Disqualify ${side === 'a' ? 'Aka' : 'Ao'}`} confirmTitle="Tap again: 0.0 from every judge" onPress={() => disqualify(side)} />
            </View>
          ))}
        </View>
      )}
      {confirming && <ResultConfirm outcome={confirming} names={names} onCancel={() => setConfirming(null)} onConfirm={async () => { await scoring.finalize(confirming.winner, confirming.method, confirming.note); }} />}
      {scoring.conflict && <Text color="danger">This match conflicted with the server ({scoring.conflict}). A tournament director will review it.</Text>}
    </View>
  );
}
