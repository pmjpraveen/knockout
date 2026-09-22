import assert from 'node:assert/strict';
import { currentDay, dayLabels, eventDays } from './schedule.ts';

assert.deepEqual(eventDays('2027-01-30', '2027-02-01'), ['2027-01-30', '2027-01-31', '2027-02-01'], 'a range crosses a month end');
assert.deepEqual(eventDays('2027-01-10', '2027-01-10'), ['2027-01-10'], 'a one-day event has one day');
assert.deepEqual(eventDays(null, null), [], 'a draft has no days yet');
assert.deepEqual(eventDays('2027-01-10', '2027-01-11', ['2027-01-09', '2027-01-10', null]), ['2027-01-09', '2027-01-10', '2027-01-11'], 'a category left on a day outside the dates keeps its day');
assert.equal(eventDays('2027-01-01', '2031-01-01').length, 62, 'a mistyped range stays a short list');
assert.equal(dayLabels(['2027-01-10', '2027-01-11'])['2027-01-11'], 'Day 2 · 11-01-2027');
assert.equal(currentDay(['2027-01-10', '2027-01-11'], ['2027-01-11', null]), '2027-01-11', 'day one is done, so day two is being run');
assert.equal(currentDay(['2027-01-10', '2027-01-11'], []), '2027-01-10', 'with nothing queued, start at day one');
assert.equal(currentDay([], []), null);
console.log('schedule ok');
