import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { MatchClock, ResultConfirm, ScoreboardRow, ScoreButton, ScorePanel } from '@/components/ScoreboardParts';
import { Text } from '@/components/Text';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { haptic } from '@/lib/haptics';
import { activeEvents, clockState, kumiteOutcome, kumiteState, nextPenaltyLevel, Outcome, penaltyLevels, points } from '@/lib/scoring';
import { theme } from '@/theme/tokens';

const scoreTypes = [['ippon', 'Ippon +3'], ['waza_ari', 'Waza-ari +2'], ['yuko', 'Yuko +1']] as const;

export function KumiteScoreboard({ row, eventId, onDone }: { row: ScoreboardRow; eventId: string; onDone: () => void }) {
  const scoring = useMatchScoring({ eventId, matchId: row.match_id });
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState<Outcome | null>(null);
  const { athlete_a_id: a, athlete_b_id: b } = row;
  const names = { [a]: row.athlete_a, [b]: row.athlete_b };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const state = kumiteState(scoring.events, a, b);
  const clock = clockState(scoring.events, row.match_seconds, now);
  const outcome = scoring.started && !scoring.finalized ? kumiteOutcome(state, a, b, clock.remaining) : null;
  const timeUp = clock.started && clock.remaining <= 0;

  // Time expiry is logged once, when the running clock reaches zero.
  useEffect(() => {
    if (clock.running && clock.remaining <= 0) {
      haptic.warning();
      scoring.record('clock', null, 0, { action: 'expire' });
    }
  }, [clock.running, clock.remaining <= 0]);

  const undoTarget = [...activeEvents(scoring.events)].reverse().find((e) => e.type !== 'clock');
  const remainingNow = Math.round(clock.remaining);

  const corner = (side: 'a' | 'b') => {
    const id = side === 'a' ? a : b;
    const enabled = scoring.started && !scoring.finalized && !outcome;
    return {
      name: names[id],
      total: String(state.points[side]),
      children: (
        <>
          {([1, 2] as const).map((category) => {
            const count = state.penalties[side][category];
            return (
              <Text key={category} variant="body" color="paperWhite" maxFontSizeMultiplier={1.2} style={{ minHeight: 22 }}>
                {count ? `C${category}: ${penaltyLevels[Math.min(count, penaltyLevels.length) - 1]}` : ''}
              </Text>
            );
          })}
          {scoreTypes.map(([type, label]) => (
            <ScoreButton key={type} title={label} disabled={!enabled} onPress={() => scoring.record(type, id, points[type])} />
          ))}
          {([1, 2] as const).map((category) => (
            <ScoreButton
              key={category}
              title={`C${category}: ${nextPenaltyLevel(state.penalties[side][category])}`}
              penalty
              disabled={!enabled}
              onPress={() => scoring.record('penalty', id, 0, { category })}
            />
          ))}
        </>
      ),
    };
  };

  if (scoring.finalized) {
    return (
      <View style={{ gap: theme.spacing[12] }}>
        <Text variant="heading" weight="medium">{names[scoring.finalized.winner]} wins</Text>
        <Text color="slateGray">Recorded on this device. It syncs when a connection is available.</Text>
        <Button title="Back to the queue" onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing[16] }}>
      <ScorePanel clock={<MatchClock remaining={clock.remaining} />} aka={corner('a')} ao={corner('b')} />

      {!scoring.started ? (
        <Button
          title="Start match"
          onPress={async () => {
            haptic.start();
            await scoring.start();
            await scoring.record('clock', null, row.match_seconds, { action: 'start' });
          }}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: theme.spacing[8] }}>
            <View style={{ flex: 1 }}>
              <Button
                title={clock.running ? 'Pause clock' : 'Resume clock'}
                variant="secondary"
                disabled={timeUp || !!outcome}
                onPress={() => {
                  haptic.tap();
                  scoring.record('clock', null, remainingNow, { action: clock.running ? 'pause' : 'resume' });
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={undoTarget ? 'Undo last' : 'Nothing to undo'} variant="secondary" disabled={!undoTarget} onPress={() => {
                  haptic.tap();
                  scoring.record('void', null, null, null, undoTarget!.id);
                }}
              />
            </View>
          </View>

          {outcome && !confirming && (
            <View style={{ gap: theme.spacing[8] }}>
              <Text variant="bodyLg" weight="medium">{names[outcome.winner]} wins by {outcome.method === 'lead' ? 'an 8-point lead' : outcome.method}.</Text>
              <Button title="Review result" onPress={() => setConfirming(outcome)} />
            </View>
          )}
          {timeUp && !outcome && (
            <View style={{ gap: theme.spacing[8] }}>
              <Text weight="medium">Time is up and the score is level. Record the referee&apos;s decision.</Text>
              {[a, b].map((id) => (
                <Button key={id} title={`Decision: ${names[id]}`} variant="secondary" onPress={() => setConfirming({ winner: id, method: 'decision' })} />
              ))}
            </View>
          )}
          {confirming && (
            <ResultConfirm outcome={confirming} names={names} onCancel={() => setConfirming(null)} onConfirm={async () => { await scoring.finalize(confirming.winner, confirming.method); }} />
          )}
          {!confirming && !outcome && (
            <View style={{ gap: theme.spacing[8] }}>
              {[a, b].map((id) => (
                <Button key={id} title={`${names[id]} withdraws`} variant="danger" onPress={() => setConfirming({ winner: id === a ? b : a, method: 'withdrawal' })} />
              ))}
            </View>
          )}
        </>
      )}
      {scoring.conflict && <Text color="danger">This match conflicted with the server ({scoring.conflict}). A tournament director will review it.</Text>}
    </View>
  );
}
