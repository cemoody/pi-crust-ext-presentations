import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import activate from '../server.mjs';
import { makeFakePrc } from './_fakes.mjs';

/**
 * Validator tests for the PUT /api/sessions/:sessionId/presentations/:deckId/deck.json
 * endpoint, which forwards each deck through validateDeck() before persisting.
 *
 * Background: validateDeck only counted `title`/`subtitle`/`body`/`quote`/`html`
 * /`bullets`/`columns`/`stats`/`image` as visible content. A
 * template-pack-driven slide that ships only `{ layout: "title-light" }`
 * — perfectly valid because the resolver fills in `html` at render time —
 * was being rejected with `slides[i] must contain visible content`.
 *
 * Fix: when the deck declares a `templatePack`, a slide that carries a
 * non-empty `layout` string is treated as having visible content.
 */

async function tmpConfigDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'pcep-validator-'));
}

/**
 * Helpers for calling the PUT route the way the host would, with a fake
 * session whose cwd lives under a tmpdir so any persisted deck.json is
 * isolated.
 */
async function activated() {
  const configDir = await tmpConfigDir();
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pcep-validator-cwd-'));
  const prc = makeFakePrc({ configDir, sessions: { 'sess-1': { cwd } } });
  await activate(prc);
  return { prc, cwd };
}

async function putDeck(prc, deck) {
  const route = prc._findRoute('PUT', '/api/sessions/:sessionId/presentations/:deckId/deck.json');
  assert.ok(route, 'PUT deck route registered');
  return route.handler({
    params: { sessionId: 'sess-1', deckId: 'd1' },
    async json() { return { deck }; },
  });
}

test('deck with layout-only slide and a templatePack validates', async () => {
  const { prc } = await activated();
  const res = await putDeck(prc, {
    title: 'BrainCo deck',
    templatePack: 'brainco',
    slides: [{ layout: 'title-light' }],
  });
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
});

test('deck with layout-only slide AND no templatePack still rejects', async () => {
  // Without a templatePack there is no renderer to resolve `layout` to
  // HTML, so the slide would render blank. Keep the strict behaviour
  // here so missing-templatePack typos surface early.
  const { prc } = await activated();
  const res = await putDeck(prc, {
    title: 'No pack',
    slides: [{ layout: 'title-light' }],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /must contain visible content/);
});

test('a slide with empty-string layout does NOT count as content', async () => {
  const { prc } = await activated();
  const res = await putDeck(prc, {
    title: 'Whitespace layout',
    templatePack: 'brainco',
    slides: [{ layout: '   ' }],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /must contain visible content/);
});

test('existing content fields still validate without a templatePack', async () => {
  // Regression: nothing about the layout change should affect plain decks.
  const { prc } = await activated();
  const res = await putDeck(prc, {
    title: 'Plain deck',
    slides: [{ title: 'Hello', body: 'World' }],
  });
  assert.equal(res.status, 200);
});

test('mixed slides: layout-only + content slide all pass when templatePack is set', async () => {
  const { prc } = await activated();
  const res = await putDeck(prc, {
    title: 'Mixed',
    templatePack: 'brainco',
    slides: [
      { layout: 'title-light' },
      { title: 'Plain title-only slide' },
      { layout: 'pull-quote', slots: { quote1: 'hi' } },
    ],
  });
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
});

test('an empty deck (no slides) is still rejected', async () => {
  const { prc } = await activated();
  const res = await putDeck(prc, {
    title: 'Empty',
    templatePack: 'brainco',
    slides: [],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /slides must be a non-empty array/);
});

test('missing title is still rejected even with templatePack + layout slides', async () => {
  const { prc } = await activated();
  const res = await putDeck(prc, {
    templatePack: 'brainco',
    slides: [{ layout: 'title-light' }],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /title is required/);
});
