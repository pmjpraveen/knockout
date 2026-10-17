import assert from 'node:assert/strict';
import { activeEvents, clockState, kataOutcome, kataState, kumiteOutcome, kumiteState, nextPenaltyLevel, winLossOutcome, type ScoreEvent } from './scoring.ts';

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
const lead = kumiteState([ev('ippon', 'A', 3), ev('ippon', 'A', 3), ev('waza_ari', 'A', 2)], 'A', 'B');
assert.deepEqual(kumiteOutcome(lead, 'A', 'B', 100), { winner: 'A', method: 'lead' }, '8-point lead ends the match');
const dq = kumiteState(Array.from({ length: 4 }, () => ev('penalty', 'A', 0, { detail: { category: 2 } })), 'A', 'B');
assert.deepEqual(kumiteOutcome(dq, 'A', 'B', 100), { winner: 'B', method: 'disqualification' }, 'Hansoku disqualifies');

// senshu: the first score wins a tie, unless it is undone or forfeited by a Keikoku
const firstA = ev('yuko', 'A', 1);
const tied = kumiteState([firstA, ev('yuko', 'B', 1)], 'A', 'B');
assert.equal(tied.senshu, 'a');
assert.deepEqual(kumiteOutcome(tied, 'A', 'B', 60), null, 'Senshu decides nothing while time remains');
assert.deepEqual(kumiteOutcome(tied, 'A', 'B', 0), { winner: 'A', method: 'decision', note: 'Senshu: first unopposed score' }, 'a tie at time up goes to Senshu');
assert.equal(kumiteState([], 'A', 'B').senshu, null);
assert.equal(kumiteOutcome(kumiteState([], 'A', 'B'), 'A', 'B', 0), null, '0-0 with no Senshu still needs a decision');
const undone = kumiteState([firstA, ev('yuko', 'B', 1), ev('void', null, null, { voids: firstA.id })], 'A', 'B');
assert.equal(undone.senshu, 'b', 'undoing the first score passes Senshu on');
const forfeited = kumiteState([firstA, ev('yuko', 'B', 1), ev('penalty', 'A', 0, { detail: { category: 1 } }), ev('penalty', 'A', 0, { detail: { category: 1 } })], 'A', 'B');
assert.equal(forfeited.senshu, null, 'Keikoku forfeits Senshu');
assert.equal(kumiteOutcome(forfeited, 'A', 'B', 0), null, 'no Senshu, so a referee decides');
assert.equal(kumiteState([firstA, ev('yuko', 'B', 1), ev('penalty', 'A', 0, { detail: { category: 1 } })], 'A', 'B').senshu, 'a', 'a Chukoku keeps Senshu');
const ahead = kumiteState([firstA, ev('yuko', 'B', 1), ev('yuko', 'B', 1)], 'A', 'B');
assert.deepEqual(kumiteOutcome(ahead, 'A', 'B', 0), { winner: 'B', method: 'points' }, 'a higher score beats Senshu');

// clock survives a restart: derived from logged events
const t0 = 5_000_000;
const clock = [ev('clock', null, 120, { detail: { action: 'start' }, client_timestamp: new Date(t0).toISOString() })];
assert.equal(clockState(clock, 120, t0 + 30_000).remaining, 90);
assert.equal(clockState(clock, 120, t0 + 500_000).remaining, 0, 'never below zero');
const paused = [...clock, ev('clock', null, 90, { detail: { action: 'pause' }, client_timestamp: new Date(t0 + 30_000).toISOString() })];
assert.deepEqual(clockState(paused, 120, t0 + 90_000), { remaining: 90, running: false, started: true }, 'a paused clock holds');
assert.equal(clockState([], 120, t0).remaining, 120);

// kata (WKF 2026): each judge votes for whoever they marked higher; the majority of judges wins
const judge = (athlete: string, j: number, v: number) => ev('kata_score', athlete, v, { detail: { judge: j } });
const scored = (a: number[], b: number[], panel = 5) => kataState([...a.map((v, i) => judge('A', i + 1, v)), ...b.map((v, i) => judge('B', i + 1, v))], 'A', 'B', panel);
assert.deepEqual(kataOutcome(scored([7.5, 7.5, 7.5, 7.0, 7.0], [7.0, 7.0, 7.0, 7.1, 9.5]), 'A', 'B', 'kata_scores', 5), { winner: 'A', method: 'judges', note: "Judges' votes 3-2" }, 'A wins on votes although B has the higher total');
assert.deepEqual(kataOutcome(scored([7.6, 7.5, 7.6, 7.1, 7.1, 7.7, 7.2], [8.0, 7.3, 7.4, 7.3, 7.4, 7.3, 7.5], 7), 'A', 'B', 'kata_scores', 7), { winner: 'B', method: 'judges', note: "Judges' votes 4-3" }, "WKF's own example: AO wins 4-3 on a seven judge panel");
assert.equal(kataOutcome(scored([7, 7, 7, 7, 7], [7, 7, 7, 7, 7]), 'A', 'B', 'kata_scores', 5), null, 'equal marks from a judge are not a vote');
assert.equal(scored([7, 7, 7, 7, 7], [7, 7.1, 7, 7, 7]).judgeVotes[0], 'tie', 'the judge who marked both equally is flagged');
assert.equal(kataOutcome(scored([7, 7, 7], [6, 6, 6, 6, 6]), 'A', 'B', 'kata_scores', 5), null, 'an incomplete panel has no result');
assert.deepEqual(kataOutcome(scored([0, 0, 0, 0, 0], []), 'A', 'B', 'kata_scores', 5), { winner: 'B', method: 'disqualification', note: 'Disqualified (0.0 from every judge)' }, 'a 0.0 from every judge disqualifies, with no opponent marks needed');
assert.equal(kataOutcome(scored([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]), 'A', 'B', 'kata_scores', 5), null, 'both disqualified: no winner, an additional kata is performed');
const corrected = kataState([judge('A', 1, 6), judge('A', 1, 8)], 'A', 'B', 3);
assert.equal(corrected.scores.a[0], 8, 'the latest score from a judge replaces the earlier one');

// kata flags: majority wins, one vote per judge
const flag = (athlete: string, j: number) => ev('kata_score', athlete, 1, { detail: { judge: j } });
assert.deepEqual(kataOutcome(kataState([flag('A', 1), flag('B', 2), flag('A', 3)], 'A', 'B', 3), 'A', 'B', 'kata_flags', 3), { winner: 'A', method: 'flags', note: 'Flags 2-1' });
assert.equal(kataOutcome(kataState([flag('A', 1), flag('B', 2)], 'A', 'B', 3), 'A', 'B', 'kata_flags', 3), null, 'flags wait for every judge');
assert.equal(kataState([flag('A', 1), flag('B', 1)], 'A', 'B', 3).flagVotes.b, 1, 'a judge changing their vote counts once');

// win/loss with a note
assert.deepEqual(winLossOutcome([ev('win_loss', 'B', null, { detail: { note: 'no-show' } })]), { winner: 'B', method: 'win_loss', note: 'no-show' });
assert.equal(winLossOutcome([]), null);
console.log('scoring ok');
