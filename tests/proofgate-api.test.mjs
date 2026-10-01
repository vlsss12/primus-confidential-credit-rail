import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/proofgate.js';

function response() {
  return { headers: {}, code: 200, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(value) { this.body = value; return this; } };
}
test('public readiness does not expose secrets', async () => {
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 200); assert.equal(res.body.ready, false);
  assert.equal(res.body.scope, 'source-attestation-only');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.secret, undefined);
});
test('rejects unsupported methods', async () => {
  const res = response();
  await handler({ method: 'DELETE', headers: {} }, res);
  assert.equal(res.code, 405); assert.equal(res.headers.Allow, 'GET, POST');
});
test('API validates configuration, origin, content type, JSON and size before Redis', async () => {
  const names = ['PROOFGATE_SECRET', 'PROOFGATE_ORIGIN', 'PROOFGATE_RPC_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const previous = names.map(name => process.env[name]);
  try {
    for (const name of names) delete process.env[name];
    let res = response();
    await handler({ method: 'POST', headers: {} }, res);
    assert.equal(res.code, 503);
    Object.assign(process.env, { PROOFGATE_SECRET: 'test-only-secret-'.repeat(4), PROOFGATE_ORIGIN: 'https://example.test', PROOFGATE_RPC_URL: 'https://rpc.test', UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'test' });
    for (const [headers, body, expected] of [
      [{ origin: 'https://attacker.test' }, {}, 403],
      [{ origin: 'https://example.test', 'content-type': 'text/plain' }, '{}', 415],
      [{ origin: 'https://example.test', 'content-type': 'application/json' }, '{', 400],
      [{ origin: 'https://example.test', 'content-type': 'application/json' }, 'x'.repeat(8193), 413],
      [{ origin: 'https://example.test', 'content-type': 'application/json' }, [], 400],
      [{ origin: 'https://example.test', 'content-type': 'application/json' }, { action: 'wrong' }, 400],
      [{ origin: 'https://example.test', 'content-type': 'application/json' }, { action: 'challenge', wallet: 'bad', audience: 'credit-rail' }, 400],
      [{ origin: 'https://example.test', 'content-type': 'application/json' }, { action: 'challenge', text: 'x'.repeat(8193) }, 413],
    ]) {
      res = response(); await handler({ method: 'POST', headers, body }, res); assert.equal(res.code, expected);
    }
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});
