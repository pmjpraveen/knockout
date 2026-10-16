import assert from 'node:assert/strict';
import { categoryProblem, labelTaken } from './categoryRules.ts';

const none = { discipline: 'kumite', gender: null, age_min: null, age_max: null, weight_min: null, weight_max: null, belt_min: null, belt_max: null };
const belts = ['white', 'yellow', 'orange', 'green'];

assert.equal(categoryProblem(none, belts), null, 'no limits is fine');
assert.equal(categoryProblem({ ...none, age_min: 10, age_max: 12, weight_max: 40, belt_min: 'white', belt_max: 'orange' }, belts), null);
assert.equal(categoryProblem({ ...none, age_min: 12, age_max: 12 }, belts), null, 'an equal minimum and maximum is one value');
assert.match(categoryProblem({ ...none, age_min: Number.NaN }, belts)!, /numbers/);
assert.match(categoryProblem({ ...none, weight_min: -5 }, belts)!, /negative/);
assert.match(categoryProblem({ ...none, age_max: 10.5 }, belts)!, /whole number/);
assert.equal(categoryProblem({ ...none, weight_min: 40.5, weight_max: 50 }, belts), null, 'weights may have decimals');
assert.match(categoryProblem({ ...none, age_min: 13, age_max: 12 }, belts)!, /age is above/);
assert.match(categoryProblem({ ...none, weight_min: 60, weight_max: 50 }, belts)!, /weight is above/);
assert.match(categoryProblem({ ...none, belt_min: 'green', belt_max: 'white' }, belts)!, /Belt from/);
assert.equal(categoryProblem({ ...none, belt_min: 'white', belt_max: 'white' }, belts), null);
assert.equal(categoryProblem({ ...none, belt_min: 'green' }, belts), null, 'one end only is fine');
assert.equal(categoryProblem({ ...none, belt_min: 'pink', belt_max: 'white' }, belts), null, 'a belt no longer on the ladder is left to the importer to flag');

assert.equal(labelTaken('Kata Male', [{ label: 'kata male ' }]), true);
assert.equal(labelTaken('Kata Female', [{ label: 'Kata Male' }]), false);
assert.equal(labelTaken('Kata', []), false);
console.log('categoryRules ok');
