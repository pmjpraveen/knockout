import assert from 'node:assert/strict';
import { firstWithin } from './fitImage.ts';

const sizeOf = ({ edge, quality }: { edge: number; quality: number }) => 'x'.repeat(edge * quality * 100);
const attempts = [{ edge: 1200, quality: 0.6 }, { edge: 800, quality: 0.5 }, { edge: 400, quality: 0.4 }];

assert.equal((await firstWithin(attempts, async (a) => sizeOf(a), 100_000)).length, 72_000, 'the largest attempt is kept when it fits');
assert.equal((await firstWithin(attempts, async (a) => sizeOf(a), 50_000)).length, 40_000, 'a smaller attempt is used when the first is too big');
await assert.rejects(firstWithin(attempts, async (a) => sizeOf(a), 10_000), /too detailed/, 'nothing fits: say so instead of storing a bad row');
console.log('fitImage ok');
