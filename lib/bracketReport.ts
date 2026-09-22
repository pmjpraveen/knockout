import type { Database } from './database.types.ts';
import { matchLabel } from './schedule.ts';

type BracketMatch = Database['public']['Functions']['bracket_matches']['Returns'][number];
type Podium = Database['public']['Functions']['category_podium']['Returns'][number];
type Participant = Database['public']['Functions']['category_participants']['Returns'][number];

export type BracketReportData = {
  eventName: string;
  categoryLabel: string;
  bracketFormat: string;
  participants: Participant[];
  matches: BracketMatch[];
  podium: Podium[];
};

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const places: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const sideTitle: Record<string, string> = {
  main: 'Main bracket', winners: 'Winners bracket', losers: 'Losers bracket', grand_final: 'Grand final', reset: 'Bracket reset',
  repechage_top: 'Repechage: top half', repechage_bottom: 'Repechage: bottom half',
};
const sideOrder = Object.keys(sideTitle).concat('pool');

const nameOf = (m: BracketMatch, slot: 'a' | 'b') => {
  const name = slot === 'a' ? m.athlete_a : m.athlete_b;
  if (name) return escape(name) + (m.status === 'completed' && m.winner_id === (slot === 'a' ? m.athlete_a_id : m.athlete_b_id) ? ' <b>(won)</b>' : '');
  return m.status === 'bye' ? '<span class="muted">Bye</span>' : '<span class="muted">TBD</span>';
};

/** The bracket, podium and roster as one printable page. Built once and handed to the platform-specific printer. */
export function buildBracketReportHtml({ eventName, categoryLabel, bracketFormat, participants, matches, podium }: BracketReportData) {
  const byes = matches.filter((m) => m.round === 1 && m.status === 'bye' && (m.athlete_a || m.athlete_b));

  const groups = new Map<string, BracketMatch[]>();
  for (const m of matches) groups.set(m.bracket_side === 'pool' ? `pool:${m.pool}` : m.bracket_side, [...(groups.get(m.bracket_side === 'pool' ? `pool:${m.pool}` : m.bracket_side) ?? []), m]);
  const groupKeys = [...groups.keys()].sort((x, y) => {
    const [sx, sy] = [x.split(':')[0], y.split(':')[0]];
    return sideOrder.indexOf(sx) - sideOrder.indexOf(sy) || x.localeCompare(y);
  });

  const bracketHtml = groupKeys.map((key) => {
    const side = groups.get(key)!;
    const rounds = [...new Set(side.map((m) => m.round))].sort((a, b) => a - b);
    const title = key.startsWith('pool:') ? `Pool ${key.split(':')[1]}` : sideTitle[key];
    const roundsHtml = rounds.map((round) => {
      const inRound = side.filter((m) => m.round === round).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const rows = inRound.map((m) => `<tr><td>${nameOf(m, 'a')}</td><td class="vs">v</td><td>${nameOf(m, 'b')}</td></tr>`).join('');
      return `<div class="round"><h4>${escape(matchLabel(side[0].bracket_side, round))}</h4><table>${rows}</table></div>`;
    }).join('');
    return `<section><h3>${escape(title)}</h3><div class="rounds">${roundsHtml}</div></section>`;
  }).join('');

  const podiumHtml = podium.length
    ? `<section><h2>Podium</h2><table>${podium.map((p) => `<tr><td class="place">${places[p.place] ?? p.place}</td><td>${escape(p.athlete_name)}</td><td class="muted">${escape(p.club_name ?? '')}</td></tr>`).join('')}</table></section>`
    : '';

  const byesHtml = byes.length
    ? `<section><h2>Round 1 byes</h2><table>${byes.map((m) => `<tr><td>${escape(m.athlete_a ?? m.athlete_b ?? '')}</td></tr>`).join('')}</table></section>`
    : '';

  const participantsHtml = `<section><h2>Participants (${participants.length})</h2><table>${participants
    .map((p, i) => `<tr><td class="muted">${p.seed ?? i + 1}</td><td>${escape(p.full_name)}</td><td class="muted">${escape(p.club_name ?? '')}</td></tr>`)
    .join('')}</table></section>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escape(categoryLabel)}</title><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0F1115; padding: 24px; }
    h1 { font-size: 22px; margin-bottom: 2px; }
    h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; }
    h3 { font-size: 14px; margin: 16px 0 8px; }
    h4 { font-size: 11px; text-transform: uppercase; color: #6B7280; margin: 10px 0 4px; }
    .subtitle { color: #6B7280; margin-bottom: 4px; }
    .muted { color: #6B7280; }
    .place { font-weight: 600; width: 40px; }
    .vs { color: #9CA3AF; font-size: 11px; padding: 0 6px; }
    table { border-collapse: collapse; width: 100%; }
    td { padding: 3px 8px 3px 0; font-size: 13px; vertical-align: top; }
    .rounds { display: flex; flex-wrap: wrap; gap: 24px; }
    .round table { width: auto; min-width: 180px; }
    .round td { border-bottom: 1px solid #F3F4F6; padding: 4px 8px; }
    section { break-inside: avoid; }
  </style></head><body>
    <h1>${escape(categoryLabel)}</h1>
    <div class="subtitle">${escape(eventName)} · ${escape(bracketFormat)}</div>
    ${podiumHtml}
    ${participantsHtml}
    ${byesHtml}
    <section><h2>Bracket</h2>${bracketHtml}</section>
  </body></html>`;
}
