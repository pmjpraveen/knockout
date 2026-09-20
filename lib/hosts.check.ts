import assert from 'node:assert/strict';
import { withHost } from './withHost.ts';

assert.equal(withHost('http://127.0.0.1:54321', '192.168.1.20'), 'http://192.168.1.20:54321', 'loopback becomes the LAN host');
assert.equal(withHost('http://localhost:54321/rest', '192.168.1.20'), 'http://192.168.1.20:54321/rest');
assert.equal(withHost('https://abc.supabase.co', '192.168.1.20'), 'https://abc.supabase.co', 'a real host is left alone');
assert.equal(withHost('http://127.0.0.1:54321', undefined), 'http://127.0.0.1:54321', 'no serving host: unchanged');
console.log('hosts ok');
