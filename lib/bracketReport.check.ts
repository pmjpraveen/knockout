import assert from 'node:assert/strict';
import { buildBracketReportHtml } from './bracketReport.ts';

const html = buildBracketReportHtml({
  eventName: 'ZZ Event',
  categoryLabel: 'Kumite Male U16',
  bracketFormat: 'Single elim repechage',
  participants: [
    { athlete_id: 'a1', full_name: 'Athlete 1', club_name: 'Dojo A', seed: 1 },
    { athlete_id: 'a2', full_name: 'Athlete 2', club_name: 'Dojo B', seed: null },
  ],
  matches: [
    { id: 'm1', round: 1, position: 1, bracket_side: 'main', pool: null, status: 'bye', is_repechage: false, athlete_a_id: 'a1', athlete_a: 'Athlete 1', athlete_b_id: null, athlete_b: null, winner_id: 'a1' },
    { id: 'm2', round: 1, position: 2, bracket_side: 'main', pool: null, status: 'completed', is_repechage: false, athlete_a_id: 'a2', athlete_a: 'Athlete 2', athlete_b_id: 'a3', athlete_b: 'Athlete <3>', winner_id: 'a2' },
  ],
  podium: [
    { place: 1, athlete_id: 'a1', athlete_name: 'Athlete 1', club_name: 'Dojo A' },
    { place: 3, athlete_id: 'a2', athlete_name: 'Athlete 2', club_name: 'Dojo B' },
    { place: 3, athlete_id: 'a4', athlete_name: 'Athlete 4', club_name: 'Dojo C' },
  ],
});

assert.match(html, /<title>Kumite Male U16<\/title>/);
assert.match(html, /ZZ Event/);
assert.match(html, /Participants \(2\)/, 'the participant count is included');
assert.match(html, /Athlete &lt;3&gt;/, 'names are HTML-escaped');
assert.match(html, /Round 1 byes/, 'a round-1 bye is listed');
const byesSection = (html.split('Round 1 byes')[1] ?? '').split('<section>')[0];
assert.doesNotMatch(byesSection, /Athlete 2/, 'only the bye itself is listed, not the played match');
assert.match(byesSection, /Athlete 1/, 'the bye recipient is named');
assert.match(html, /Podium/);
assert.equal((html.match(/1st/g) ?? []).length, 1, 'one 1st place');
assert.equal((html.match(/3rd/g) ?? []).length, 2, 'two shared 3rd places');
assert.match(html, /Main bracket/);
console.log('bracketReport ok');
