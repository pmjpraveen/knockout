import assert from 'node:assert/strict';
import { dateToIso, endOfDay, formatDate, formatDateRange, isDate, isoToDate, maskDate, parseDate, registrationCue } from './events.ts';

assert.equal(isDate('2026-09-19'), true);
assert.equal(isDate('2026-02-30'), false, 'a day past the end of the month is not a date');
assert.equal(isDate('2024-02-29'), true, 'leap day');
assert.equal(isDate('2026-13-01'), false);
assert.equal(isDate('19-09-2026'), false, 'storage format is ISO');

assert.equal(formatDateRange('2026-10-12', '2026-10-14', 2026), '12 Oct - 14 Oct');
assert.equal(formatDateRange('2026-10-12', '2026-10-12', 2026), '12 Oct', 'a one-day event shows one date');
assert.equal(formatDateRange('2026-12-30', '2027-01-02', 2026), '30 Dec 2026 - 2 Jan 2027', 'the year appears when it is not this year');
assert.equal(formatDateRange(null, null), 'Dates not set');

assert.equal(formatDate('2026-09-19'), '19-09-2026');
assert.equal(formatDate('nope'), 'nope', 'anything else is shown as typed');
assert.equal(parseDate('19-09-2026'), '2026-09-19');
assert.equal(parseDate('31-02-2026'), null);
assert.equal(parseDate('19-09-26'), null);
assert.equal(parseDate('2026-09-19'), null);

assert.equal(maskDate('1'), '1');
assert.equal(maskDate('190'), '19-0');
assert.equal(maskDate('19092026'), '19-09-2026');
assert.equal(maskDate('19/09/2026 extra'), '19-09-2026', 'separators and extras are dropped');
assert.equal(maskDate(''), '');

assert.equal(dateToIso(isoToDate('2026-01-01')), '2026-01-01', 'round trip keeps the day');
assert.equal(dateToIso(isoToDate('2026-12-31')), '2026-12-31');

const now = new Date(2026, 9, 16, 15);
const closing = (day: string, status = 'registration_open') => registrationCue(status, endOfDay(day), now);
assert.equal(closing('2026-10-16'), 'Closes today');
assert.equal(closing('2026-10-17'), 'Closes tomorrow');
assert.equal(closing('2026-10-19'), 'Closes in 3 days');
assert.equal(closing('2026-10-23'), 'Closes in 7 days', 'the last seven days are shown');
assert.equal(closing('2026-10-24'), null, 'eight days or more away stays quiet');
assert.equal(closing('2026-10-10'), 'The closing date has passed');
assert.equal(closing('2026-10-19', 'draft'), null, 'nothing is closing before registration is open');
assert.equal(registrationCue('registration_open', null, now), null, 'no closing date, no cue');
console.log('dates ok');
