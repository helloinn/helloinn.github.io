import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { signInWithPi } from '../pi-auth.js';

test('SDK initialization completes before authentication; concurrent clicks exchange once', async () => {
    const calls = [];
    let finishInit;
    const initialized = new Promise(resolve => { finishInit = resolve; });
    const pi = {
        init(options) { assert.deepEqual(options, { version: '2.0' }); calls.push('init'); return initialized; },
        async authenticate(scopes, callback) {
            calls.push('authenticate');
            assert.deepEqual(scopes, ['username']);
            assert.equal(typeof callback, 'function');
            return { accessToken: 'test-access', user: { uid: 'untrusted', username: 'untrusted' } };
        },
    };
    const request = async (url, options) => {
        calls.push('exchange');
        assert.equal(url, '/api/auth/pi');
        assert.deepEqual(JSON.parse(options.body), { accessToken: 'test-access' });
        return Response.json({ sessionToken: 'test-session', user: { username: 'verified' } });
    };
    const first = signInWithPi(pi, request);
    const second = signInWithPi(pi, request);
    assert.equal(first, second);
    assert.deepEqual(calls, ['init']);
    finishInit();
    assert.equal((await first).username, 'verified');
    assert.deepEqual(calls, ['init', 'authenticate', 'exchange']);
});

test('missing SDK and rejected login fail without establishing a session', async () => {
    await assert.rejects(signInWithPi(null), /Pi Browser/);
    const pi = { async init() {}, async authenticate() { return { accessToken: 'test-access' }; } };
    await assert.rejects(signInWithPi(pi, async () => Response.json({ error: 'Rejected' }, { status: 401 })), /Rejected/);
});

test('server trusts only App Studio identity and does not create sessions on failed verification', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'taxipic-auth-'));
    const originalFetch = globalThis.fetch;
    try {
        for (const file of ['http', 'pi-login']) {
            const source = await readFile(new URL(`../server/${file}.ts`, import.meta.url), 'utf8');
            await writeFile(join(dir, `${file}.js`), stripTypeScriptTypes(source, { mode: 'transform' }));
        }
        await writeFile(join(dir, 'package.json'), '{"type":"module"}');
        const { loginWithPi } = await import(pathToFileURL(join(dir, 'pi-login.js')));
        let exchanges = 0;
        let sessions = 0;
        globalThis.fetch = async (url, options) => {
            exchanges++;
            assert.equal(url, 'https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login');
            assert.equal(options.method, 'POST');
            assert.deepEqual(JSON.parse(options.body), { accessToken: 'test-access' });
            return Response.json({ sessionToken: 'upstream-session', user: { uid: 'verified-id', username: 'verified-name' } });
        };
        const request = () => new Request('https://example.test/api/auth/pi?uid=forged', {
            method: 'POST', headers: { 'Content-Type': 'application/json', uid: 'forged' },
            body: JSON.stringify({ accessToken: 'test-access', uid: 'forged', username: 'forged', role: 'MERCHANT' }),
        });
        await loginWithPi(request(), async identity => {
            sessions++;
            assert.deepEqual(identity, { uid: 'verified-id', username: 'verified-name' });
        });
        assert.equal(exchanges, 1);
        assert.equal(sessions, 1);
        globalThis.fetch = async () => Response.json({}, { status: 401 });
        await assert.rejects(loginWithPi(request(), async () => { sessions++; }), { status: 401 });
        globalThis.fetch = async () => Response.json({ user: { uid: 'x', username: 'x' } });
        await assert.rejects(loginWithPi(request(), async () => { sessions++; }), { status: 502 });
        await assert.rejects(loginWithPi(new Request('https://example.test', { method: 'POST', body: '{}' }), async () => { sessions++; }), { status: 400 });
        assert.equal(sessions, 1);
    } finally {
        globalThis.fetch = originalFetch;
        await rm(dir, { recursive: true, force: true });
    }
});

test('validation file has the exact static response bytes', async () => {
    const file = await readFile(new URL('../public/pi-app-validation.txt', import.meta.url));
    assert.equal(file.toString(), 'piappstudio-18OUnwGR6ppcOLo1OgvIhRo715GHDkBy');
});

test('subscription renewals stack on the current expiry', async () => {
    const source = await readFile(new URL('../server/subscriptions.ts', import.meta.url), 'utf8');
    const fn = source.match(/export function nextExpiry[\s\S]*?\n}\n/)[0];
    const dir = await mkdtemp(join(tmpdir(), 'taxipic-sub-'));
    try {
        await writeFile(join(dir, 'm.mjs'), stripTypeScriptTypes(fn, { mode: 'transform' }));
        const { nextExpiry } = await import(pathToFileURL(join(dir, 'm.mjs')));
        const now = new Date('2026-01-01T00:00:00Z');
        assert.equal(nextExpiry(null, 30, now).toISOString(), '2026-01-31T00:00:00.000Z');
        assert.equal(nextExpiry(new Date('2026-01-10T00:00:00Z'), 30, now).toISOString(), '2026-02-09T00:00:00.000Z');
        assert.equal(nextExpiry(new Date('2025-12-01T00:00:00Z'), 30, now).toISOString(), '2026-01-31T00:00:00.000Z');
    } finally { await rm(dir, { recursive: true, force: true }); }
});
