import assert from 'node:assert/strict';
import { medalTally } from './medals.ts';

const tally = medalTally([
  { finishers: [{ place: 1, athlete: 'A', club: 'Tiger' }, { place: 2, athlete: 'B', club: 'Dragon' }, { place: 3, athlete: 'C', club: 'Dragon' }, { place: 3, athlete: 'D', club: 'Tiger' }] },
  { finishers: [{ place: 1, athlete: 'E', club: 'Dragon' }, { place: 2, athlete: 'F', club: null }, { place: 4, athlete: 'G', club: 'Tiger' }] },
]);
assert.deepEqual(tally.map((t) => [t.club, t.gold, t.silver, t.bronze]), [['Dragon', 1, 1, 1], ['Tiger', 1, 0, 1], ['No club', 0, 1, 0]]);
assert.deepEqual(medalTally([]), []);
console.log('medals ok');
