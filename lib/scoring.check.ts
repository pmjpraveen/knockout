import assert from 'node:assert/strict';
import { activeEvents, clockState, kataOutcome, kataState, kumiteOutcome, kumiteState, nextPenaltyLevel, trimmedTotal, winLossOutcome, type ScoreEvent } from './scoring.ts';

let n = 0;
const ev = (type: ScoreEvent['type'], athlete: string | null, value: number | null, extra: Partial<ScoreEvent> = {}): ScoreEvent => ({
  id: `e${n++}`, match_id: 'm', athlete_id: athlete, type, value, detail: null, voids: null, client_timestamp: new Date(1_000_000 + n * 1000).toISOString(), device_id: 'd', ...extra,
});

// kumite totals, undo, penalties
const yuko = ev('yuko', 'A', 1);
const events = [ev('ippon', 'A', 3), yuko, ev('waza_ari', 'B', 2), ev('void', null, null, { voids: yuko.id }), ev('penalty', 'B', 0, { detail: { category: 1 } })];
assert.equal(activeEvents(events).length, 3, 'a void removes itself and its target');
const state = kumiteState(events, 'A', 'B');
assert.deepEqual(state.points, { a: 3, b: 2 });
assert.deepEqual(state.penalties.b, { 1: 1, 2: 0 });
assert.equal(nextPenaltyLevel(1), 'Keikoku');
assert.equal(nextPenaltyLevel(9), 'Hansoku');

// win conditions
assert.equal(kumiteOutcome(state, 'A', 'B', 60), null, 'a close match runs on');
assert.deepEqual(kumiteOutcome(state, 'A', 'B', 0), { winner: 'A', method: 'points' }, 'time up: higher score wins');
assert.equal(kumiteOutcome(kumiteState([ev('ippon', 'A', 3), ev('ippon', 'B', 3)], 'A', 'B'), 'A', 'B', 0), null, 'a tie at time needs a referee decision');
const lead = kumiteState([ev('ippon', 'A', 3), ev('ippon', 'A', 3), ev('waza_ari', 'A', 2)], 'A', 'B');
assert.deepEqual(kumiteOutcome(lead, 'A', 'B', 100), { winner: 'A', method: 'lead' }, '8-point lead ends the match');
const dq = kumiteState(Array.from({ length: 4 }, () => ev('penalty', 'A', 0, { detail: { category: 2 } })), 'A', 'B');
assert.deepEqual(kumiteOutcome(dq, 'A', 'B', 100), { winner: 'B', method: 'disqualification' }, 'Hansoku disqualifies');

// clock survives a restart: derived from logged events
const t0 = 5_000_000;
const clock = [ev('clock', null, 120, { detail: { action: 'start' }, client_timestamp: new Date(t0).toISOString() })];
assert.equal(clockState(clock, 120, t0 + 30_000).remaining, 90);
assert.equal(clockState(clock, 120, t0 + 500_000).remaining, 0, 'never below zero');
const paused = [...clock, ev('clock', null, 90, { detail: { action: 'pause' }, client_timestamp: new Date(t0 + 30_000).toISOString() })];
assert.deepEqual(clockState(paused, 120, t0 + 90_000), { remaining: 90, running: false, started: true }, 'a paused clock holds');
assert.equal(clockState([], 120, t0).remaining, 120);

// kata: drop high and low, sum the rest
assert.equal(trimmedTotal([7.0, 7.1, 7.2, 7.3, 7.4]), 21.6);
assert.equal(trimmedTotal([7.0, 7.0, 7.0, 9.9, 5.0]), 21.0);
assert.equal(trimmedTotal([6.1, 6.2, 6.3]), 6.2, 'a 3-judge panel keeps the middle score');
const judge = (athlete: string, j: number, v: number) => ev('kata_score', athlete, v, { detail: { judge: j } });
const scored = (a: number[], b: number[]) => kataState([...a.map((v, i) => judge('A', i + 1, v)), ...b.map((v, i) => judge('B', i + 1, v))], 'A', 'B', 5);
assert.deepEqual(kataOutcome(scored([7, 7.1, 7.2, 7.3, 7.4], [7, 7, 7, 7, 7]), 'A', 'B', 'kata_scores', 5), { winner: 'A', method: 'judges' });
assert.equal(kataOutcome(scored([7, 7, 7, 7, 7], [7, 7, 7, 7, 7]), 'A', 'B', 'kata_scores', 5), null, 'equal totals need a decision');
assert.equal(kataOutcome(scored([7, 7, 7], [7, 7, 7, 7, 7]), 'A', 'B', 'kata_scores', 5), null, 'an incomplete panel has no result');
const corrected = kataState([judge('A', 1, 6), judge('A', 1, 8)], 'A', 'B', 3);
assert.equal(corrected.scores.a[0], 8, 'the latest score from a judge replaces the earlier one');

// kata flags: majority wins, one vote per judge
const flag = (athlete: string, j: number) => ev('kata_score', athlete, 1, { detail: { judge: j } });
assert.deepEqual(kataOutcome(kataState([flag('A', 1), flag('B', 2), flag('A', 3)], 'A', 'B', 3), 'A', 'B', 'kata_flags', 3), { winner: 'A', method: 'flags' });
assert.equal(kataOutcome(kataState([flag('A', 1), flag('B', 2)], 'A', 'B', 3), 'A', 'B', 'kata_flags', 3), null, 'flags wait for every judge');
assert.equal(kataState([flag('A', 1), flag('B', 1)], 'A', 'B', 3).votes.b, 1, 'a judge changing their vote counts once');

// win/loss with a note
assert.deepEqual(winLossOutcome([ev('win_loss', 'B', null, { detail: { note: 'no-show' } })]), { winner: 'B', method: 'win_loss', note: 'no-show' });
assert.equal(winLossOutcome([]), null);
console.log('scoring ok');
