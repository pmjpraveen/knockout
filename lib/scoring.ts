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
// WKF 2026 (10.2, 10.3): one ladder per athlete. Three Chui, then Hansoku chui, then Hansoku, which disqualifies from the bout.
export const penaltyLevels = ['Chui', 'Chui (2nd)', 'Chui (3rd)', 'Hansoku chui', 'Hansoku'] as const;
export const leadToWin = 8;

/** Events still in force: void events and the events they cancel are dropped, history stays in the log. */
export function activeEvents(events: ScoreEvent[]) {
  const voided = new Set(events.filter((e) => e.type === 'void').map((e) => e.voids));
  return events.filter((e) => e.type !== 'void' && !voided.has(e.id));
}

// A penalty event also carries `category: 1` because the scoring database requires it; since 2026 there is only one ladder, so
// every penalty counts the same. `senshu_annulled` rides on a penalty event too, but is the referee's TORIMASEN, not a penalty.
const isAnnulment = (e: ScoreEvent) => e.detail?.kind === 'senshu_annulled';

export function kumiteState(events: ScoreEvent[], a: string, b: string) {
  const active = activeEvents(events);
  const mine = (id: string) => active.filter((e) => e.athlete_id === id);
  const tally = (id: string, type: ScoreEventType) => mine(id).filter((e) => e.type === type).length;
  const total = (id: string) => mine(id).filter((e) => e.type in points).reduce((sum, e) => sum + (e.value ?? 0), 0);
  const penalties = (id: string) => mine(id).filter((e) => e.type === 'penalty' && !isAnnulment(e)).length;
  return {
    points: { a: total(a), b: total(b) },
    ippon: { a: tally(a, 'ippon'), b: tally(b, 'ippon') },
    wazaAri: { a: tally(a, 'waza_ari'), b: tally(b, 'waza_ari') },
    penalties: { a: penalties(a), b: penalties(b) },
    senshu: senshuHolder(events, a, b),
  };
}

/** Which stretch of play an event belongs to: the clock starting or resuming begins a new one. Scores in the same stretch happened in the same pause. */
const playWindows = (events: ScoreEvent[]) => {
  let window = 0;
  return events.map((e) => {
    if (e.type === 'clock' && (e.detail?.action === 'start' || e.detail?.action === 'resume')) window++;
    return window;
  });
};

/**
 * Each athlete can be given one score per pause (they may both be, WKF 12.1.2), so a scorer cannot tap twice by mistake.
 * Undoing a score frees that athlete's turn again. Pass the events as logged, voids included.
 */
export function scoredThisPause(events: ScoreEvent[], athlete: string) {
  const live = activeEvents(events);
  const windows = new Map(events.map((e, index) => [e.id, playWindows(events)[index]]));
  const latest = Math.max(0, ...live.map((e) => windows.get(e.id) ?? 0));
  return live.some((e) => e.athlete_id === athlete && e.type in points && windows.get(e.id) === latest);
}

/**
 * Senshu goes to the first score the opponent did not answer in the same pause (WKF 12.2.2). If both scored in that pause,
 * neither is unopposed and the next score can still earn it. Undoing a score passes it on; the referee's TORIMASEN removes it.
 */
function senshuHolder(events: ScoreEvent[], a: string, b: string) {
  const windows = playWindows(events);
  const live = new Set(activeEvents(events).map((e) => e.id));
  const scored = events.map((e, i) => ({ e, window: windows[i] })).filter(({ e }) => live.has(e.id) && e.type in points && (e.athlete_id === a || e.athlete_id === b));
  for (const window of [...new Set(scored.map((x) => x.window))]) {
    const inWindow = scored.filter((x) => x.window === window);
    const sides = new Set(inWindow.map((x) => x.e.athlete_id));
    if (sides.size === 1) {
      const holder = inWindow[0].e.athlete_id;
      return events.some((e) => live.has(e.id) && isAnnulment(e) && e.athlete_id === holder) ? null : holder === a ? 'a' : 'b';
    }
  }
  return null;
}

/** The level the next penalty would be (capped at Hansoku). */
export const nextPenaltyLevel = (existing: number) => penaltyLevels[Math.min(existing, penaltyLevels.length - 1)];

/**
 * Auto-detected results (WKF 12.2): Hansoku, an 8-point lead, or at time up the higher score; at equal score the first
 * unopposed score (Senshu), then the most Ippon, then the most Waza-ari. Level on all of that, it needs a Hantei vote by the
 * referee panel, which the scorer records.
 */
export function kumiteOutcome(state: ReturnType<typeof kumiteState>, a: string, b: string, remainingSeconds: number): Outcome | null {
  const disqualified = (count: number) => count >= penaltyLevels.length;
  if (disqualified(state.penalties.a)) return { winner: b, method: 'disqualification' };
  if (disqualified(state.penalties.b)) return { winner: a, method: 'disqualification' };
  const lead = state.points.a - state.points.b;
  if (Math.abs(lead) >= leadToWin) return { winner: lead > 0 ? a : b, method: 'lead' };
  if (remainingSeconds > 0) return null;
  if (lead !== 0) return { winner: lead > 0 ? a : b, method: 'points' };
  if (state.senshu) return { winner: state.senshu === 'a' ? a : b, method: 'decision', note: 'Senshu: first unopposed score' };
  for (const [kind, label] of [['ippon', 'Ippon'], ['wazaAri', 'Waza-ari']] as const) {
    const diff = state[kind].a - state[kind].b;
    if (diff !== 0) return { winner: diff > 0 ? a : b, method: 'decision', note: `More ${label} (${Math.max(state[kind].a, state[kind].b)}-${Math.min(state[kind].a, state[kind].b)})` };
  }
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

/**
 * WKF kata: every judge marks both athletes (5.0-10.0 in 0.1 steps, 0.0 for a disqualification) and votes for whoever
 * they marked higher. `judgeVotes` holds each judge's vote once both marks are in; 'tie' means a judge gave equal marks,
 * which the rules do not allow (no draws), so it has to be corrected. `flagVotes` is the manual flag vote.
 */
export function kataState(events: ScoreEvent[], a: string, b: string, panel: number) {
  const active = activeEvents(events).filter((e) => e.type === 'kata_score');
  const byJudge = (athlete: string) =>
    Array.from({ length: panel }, (_, j) => [...active].reverse().find((e) => e.athlete_id === athlete && e.detail?.judge === j + 1)?.value ?? null);
  const scores = { a: byJudge(a), b: byJudge(b) };
  const judgeVotes = scores.a.map((markA, j) => {
    const markB = scores.b[j];
    if (markA === null || markB === null) return null;
    return markA === markB ? 'tie' : markA > markB ? 'a' : 'b';
  });
  const count = (side: 'a' | 'b') => judgeVotes.filter((vote) => vote === side).length;

  const flagVotes = { a: 0, b: 0 };
  for (let judge = 1; judge <= panel; judge++) {
    const vote = [...active].reverse().find((e) => e.detail?.judge === judge && (e.athlete_id === a || e.athlete_id === b));
    if (vote) flagVotes[vote.athlete_id === a ? 'a' : 'b']++;
  }
  return { scores, judgeVotes, markVotes: { a: count('a'), b: count('b') }, flagVotes };
}

const disqualified = (marks: (number | null)[]) => marks.every((mark) => mark === 0);

export function kataOutcome(state: ReturnType<typeof kataState>, a: string, b: string, mode: 'kata_scores' | 'kata_flags', panel: number): Outcome | null {
  if (mode === 'kata_flags') {
    const { a: votesA, b: votesB } = state.flagVotes;
    if (votesA + votesB < panel) return null;
    return { winner: votesA > votesB ? a : b, method: 'flags', note: `Flags ${Math.max(votesA, votesB)}-${Math.min(votesA, votesB)}` };
  }
  // A disqualified athlete has 0.0 from every judge, and the opponent wins without needing marks. Both disqualified: no winner, they perform an additional kata (WKF 3.7.10).
  if (disqualified(state.scores.a) && disqualified(state.scores.b)) return null;
  if (disqualified(state.scores.a)) return { winner: b, method: 'disqualification', note: 'Disqualified (0.0 from every judge)' };
  if (disqualified(state.scores.b)) return { winner: a, method: 'disqualification', note: 'Disqualified (0.0 from every judge)' };
  if (state.judgeVotes.some((vote) => vote === null || vote === 'tie')) return null;
  const { a: votesA, b: votesB } = state.markVotes;
  return { winner: votesA > votesB ? a : b, method: 'judges', note: `Judges' votes ${Math.max(votesA, votesB)}-${Math.min(votesA, votesB)}` };
}

export function winLossOutcome(events: ScoreEvent[]): (Outcome & { note: string | null }) | null {
  const pick = [...activeEvents(events)].reverse().find((e) => e.type === 'win_loss');
  return pick?.athlete_id ? { winner: pick.athlete_id, method: 'win_loss', note: (pick.detail?.note as string) ?? null } : null;
}
