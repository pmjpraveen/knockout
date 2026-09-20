export type ScoreEventType = 'ippon' | 'waza_ari' | 'yuko' | 'penalty' | 'kata_score' | 'win_loss' | 'void' | 'clock';

export type ScoreEvent = {
  id: string;
  match_id: string;
  athlete_id: string | null;
  type: ScoreEventType;
  value: number | null;
  detail: Record<string, unknown> | null;
  voids: string | null;
  client_timestamp: string;
  device_id: string;
};

export type Method = 'points' | 'lead' | 'decision' | 'disqualification' | 'withdrawal' | 'judges' | 'flags' | 'win_loss';
export type Outcome = { winner: string; method: Method; note?: string | null };

export const points = { ippon: 3, waza_ari: 2, yuko: 1 } as const;
export const penaltyLevels = ['Chukoku', 'Keikoku', 'Hansoku-chui', 'Hansoku'] as const;
export const leadToWin = 8;
// Senshu is forfeited at Keikoku, the second penalty in a category. The PRD does not cover Senshu; check this level against the ruleset in use.
const senshuForfeitedAt = 2;

/** Events still in force: void events and the events they cancel are dropped, history stays in the log. */
export function activeEvents(events: ScoreEvent[]) {
  const voided = new Set(events.filter((e) => e.type === 'void').map((e) => e.voids));
  return events.filter((e) => e.type !== 'void' && !voided.has(e.id));
}

const penaltyCategory = (e: ScoreEvent) => (e.detail?.category === 2 ? 2 : 1);

export function kumiteState(events: ScoreEvent[], a: string, b: string) {
  const active = activeEvents(events);
  const total = (id: string) => active.filter((e) => e.athlete_id === id && e.type in points).reduce((sum, e) => sum + (e.value ?? 0), 0);
  const penalties = (id: string) => ({
    1: active.filter((e) => e.athlete_id === id && e.type === 'penalty' && penaltyCategory(e) === 1).length,
    2: active.filter((e) => e.athlete_id === id && e.type === 'penalty' && penaltyCategory(e) === 2).length,
  });
  const result = { points: { a: total(a), b: total(b) }, penalties: { a: penalties(a), b: penalties(b) } };
  return { ...result, senshu: senshuHolder(active, a, b, result.penalties) };
}

/** Senshu goes to whoever scores first (undoing that score passes it on) and is lost to a Keikoku or worse. */
function senshuHolder(active: ScoreEvent[], a: string, b: string, penalties: { a: { 1: number; 2: number }; b: { 1: number; 2: number } }) {
  const first = active.find((e) => e.type in points && (e.athlete_id === a || e.athlete_id === b));
  if (!first) return null;
  const side = first.athlete_id === a ? 'a' : 'b';
  return Math.max(penalties[side][1], penalties[side][2]) >= senshuForfeitedAt ? null : side;
}

/** The level the next penalty in a category would be (capped at Hansoku). */
export const nextPenaltyLevel = (existing: number) => penaltyLevels[Math.min(existing, penaltyLevels.length - 1)];

/** Auto-detected results: disqualification, an 8-point lead, or time up with a higher score. A tie goes to Senshu; with no Senshu it needs a referee decision. */
export function kumiteOutcome(state: ReturnType<typeof kumiteState>, a: string, b: string, remainingSeconds: number): Outcome | null {
  const disqualified = (p: { 1: number; 2: number }) => p[1] >= penaltyLevels.length || p[2] >= penaltyLevels.length;
  if (disqualified(state.penalties.a)) return { winner: b, method: 'disqualification' };
  if (disqualified(state.penalties.b)) return { winner: a, method: 'disqualification' };
  const lead = state.points.a - state.points.b;
  if (Math.abs(lead) >= leadToWin) return { winner: lead > 0 ? a : b, method: 'lead' };
  if (remainingSeconds <= 0 && lead !== 0) return { winner: lead > 0 ? a : b, method: 'points' };
  if (remainingSeconds <= 0 && state.senshu) return { winner: state.senshu === 'a' ? a : b, method: 'decision', note: 'Senshu: first unopposed score' };
  return null;
}

/** Countdown derived from logged clock events, so it survives an app restart. */
export function clockState(events: ScoreEvent[], totalSeconds: number, nowMs: number) {
  const last = [...events].reverse().find((e) => e.type === 'clock');
  if (!last) return { remaining: totalSeconds, running: false, started: false };
  const running = last.detail?.action === 'start' || last.detail?.action === 'resume';
  const elapsed = running ? (nowMs - Date.parse(last.client_timestamp)) / 1000 : 0;
  return { remaining: Math.max(0, (last.value ?? totalSeconds) - elapsed), running, started: true };
}

/** Highest and lowest scores dropped, the rest summed (tenths, to avoid float drift). */
export function trimmedTotal(scores: number[]) {
  const tenths = scores.map((s) => Math.round(s * 10)).sort((x, y) => x - y);
  return tenths.slice(1, -1).reduce((sum, t) => sum + t, 0) / 10;
}

export function kataState(events: ScoreEvent[], a: string, b: string, panel: number) {
  const active = activeEvents(events).filter((e) => e.type === 'kata_score');
  const byJudge = (athlete: string) =>
    Array.from({ length: panel }, (_, j) => [...active].reverse().find((e) => e.athlete_id === athlete && e.detail?.judge === j + 1)?.value ?? null);
  const scores = { a: byJudge(a), b: byJudge(b) };
  const complete = (list: (number | null)[]) => list.every((s) => s !== null);
  const total = (list: (number | null)[]) => (complete(list) ? trimmedTotal(list as number[]) : null);

  // Flag vote: each judge's latest vote for either athlete counts once.
  const votes = { a: 0, b: 0 };
  for (let judge = 1; judge <= panel; judge++) {
    const vote = [...active].reverse().find((e) => e.detail?.judge === judge && (e.athlete_id === a || e.athlete_id === b));
    if (vote) votes[vote.athlete_id === a ? 'a' : 'b']++;
  }
  return { scores, totals: { a: total(scores.a), b: total(scores.b) }, votes };
}

export function kataOutcome(state: ReturnType<typeof kataState>, a: string, b: string, mode: 'kata_scores' | 'kata_flags', panel: number): Outcome | null {
  if (mode === 'kata_flags') {
    if (state.votes.a + state.votes.b < panel) return null;
    return { winner: state.votes.a > state.votes.b ? a : b, method: 'flags' };
  }
  const { a: ta, b: tb } = state.totals;
  if (ta === null || tb === null || ta === tb) return null;
  return { winner: ta > tb ? a : b, method: 'judges' };
}

export function winLossOutcome(events: ScoreEvent[]): (Outcome & { note: string | null }) | null {
  const pick = [...activeEvents(events)].reverse().find((e) => e.type === 'win_loss');
  return pick?.athlete_id ? { winner: pick.athlete_id, method: 'win_loss', note: (pick.detail?.note as string) ?? null } : null;
}
