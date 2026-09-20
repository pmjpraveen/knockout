import assert from 'node:assert/strict';
import { dateToIso, formatDate, formatDateRange, isDate, isoToDate, maskDate, parseDate } from './events.ts';

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
console.log('dates ok');
