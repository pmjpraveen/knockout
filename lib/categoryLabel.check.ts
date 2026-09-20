import assert from 'node:assert/strict';
import { defaultLabel } from './categoryLabel.ts';

const none = { gender: null, age_min: null, age_max: null, weight_min: null, weight_max: null, belt_min: null, belt_max: null };

assert.equal(defaultLabel({ ...none, discipline: 'kata' }), 'Kata');
assert.equal(
  defaultLabel({ ...none, discipline: 'kumite', gender: 'male', age_min: 12, age_max: 14, weight_max: 40, belt_min: 'orange', belt_max: 'green' }),
  'Kumite Male 12–14y -40kg orange–green',
);
assert.equal(defaultLabel({ ...none, discipline: 'team', weight_min: 60, belt_min: 'black', belt_max: 'black' }), 'Team +60kg black');
console.log('categoryLabel ok');
