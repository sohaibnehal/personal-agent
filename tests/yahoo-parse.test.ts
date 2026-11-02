import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAddress, htmlToText, makeSnippet, pickTextPart, planFetch, toRawItem } from '../src/sources/yahoo/parse.js';

const now = new Date('2026-11-02T12:00:00Z');

test('planFetch: first run uses a 24h window', () => {
  const p = planFetch(undefined, '111', now);
  assert.equal(p.kind, 'since');
  if (p.kind === 'since') {
    assert.equal(p.reason, 'first_run');
    assert.equal(p.since.toISOString(), '2026-11-01T12:00:00.000Z');
  }
});

test('planFetch: same UIDVALIDITY continues after lastUid', () => {
  assert.deepEqual(planFetch({ uidValidity: '111', lastUid: 41 }, '111', now), { kind: 'uids', fromUid: 42 });
});

test('planFetch: changed UIDVALIDITY restarts instead of trusting old UIDs', () => {
  const p = planFetch({ uidValidity: '111', lastUid: 41 }, '222', now);
  assert.equal(p.kind, 'since');
  if (p.kind === 'since') assert.equal(p.reason, 'uidvalidity_changed');
});

test('pickTextPart: prefers text/plain, skips attachments', () => {
  const pick = pickTextPart({
    type: 'multipart/mixed',
    childNodes: [
      { type: 'multipart/alternative', childNodes: [
        { part: '1.1', type: 'text/plain' },
        { part: '1.2', type: 'text/html' },
      ] },
      { part: '2', type: 'text/plain', disposition: 'attachment' },
    ],
  });
  assert.deepEqual(pick, { part: '1.1', html: false });
});

test('pickTextPart: falls back to html; single part uses "1"', () => {
  assert.deepEqual(
    pickTextPart({ type: 'multipart/alternative', childNodes: [{ part: '1', type: 'text/html' }] }),
    { part: '1', html: true },
  );
  assert.deepEqual(pickTextPart({ type: 'text/plain' }), { part: '1', html: false });
  assert.equal(pickTextPart({ type: 'multipart/mixed', childNodes: [{ part: '1', type: 'image/png' }] }), null);
});

test('htmlToText + makeSnippet produce a clean, capped preview', () => {
  const text = htmlToText('<style>x{}</style><p>Your&nbsp;order <b>#123</b> &amp; receipt</p><div>Total: &#36;5</div>');
  assert.equal(makeSnippet(text), 'Your order #123 & receipt Total: $5');
  const long = makeSnippet('a '.repeat(400), 20);
  assert.equal(long.length, 20);
  assert.ok(long.endsWith('…'));
});

test('toRawItem: id combines UIDVALIDITY and UID; payload has no bigint', () => {
  const item = toRawItem({
    uid: 7,
    uidValidity: '1700000000',
    folder: 'INBOX',
    envelope: { subject: 'Hi', from: [{ name: 'Ann', address: 'ann@example.com' }], messageId: '<m1>' },
    internalDate: '2026-11-02T10:00:00Z',
    snippet: 'hello',
  });
  assert.equal(item.externalId, '1700000000:7');
  assert.equal(item.title, 'Hi');
  assert.equal(item.occurredAt.toISOString(), '2026-11-02T10:00:00.000Z');
  assert.equal((item.payload as Record<string, unknown>).from, 'Ann <ann@example.com>');
  assert.doesNotThrow(() => JSON.stringify(item.payload));
  assert.equal(formatAddress(undefined), '');
});
