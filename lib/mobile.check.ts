import assert from 'node:assert/strict';
import { mobileDigits, mobileProblem } from './mobile.ts';

assert.equal(mobileDigits('+91 98765 43210'), '9876543210');
assert.equal(mobileDigits('09876543210'), '9876543210');
assert.equal(mobileDigits('98765432109999'), '9876543210');
assert.equal(mobileDigits('ab12'), '12');
assert.equal(mobileProblem('9876543210'), null);
assert.notEqual(mobileProblem('98765'), null);
console.log('mobile ok');
