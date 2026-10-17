import assert from 'node:assert/strict';
import { activityTitle } from './activity.ts';

assert.equal(activityTitle('withdraw_registration', { athlete_name: 'Asha', category_label: 'Kumite A' }), 'Asha withdrawn from Kumite A');
assert.equal(activityTitle('import_athletes', { athletes: 12 }), '12 participants imported');
assert.equal(activityTitle('some_new_action', null), 'some new action');
console.log('activity ok');
