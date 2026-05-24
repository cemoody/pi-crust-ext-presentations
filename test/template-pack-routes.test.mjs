import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import activate from '../server.mjs';
import { makeFakePrc } from './_fakes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PACK = path.join(here, 'fixtures', 'pack-alpha');

async function tmpConfigDir(initial) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcx-presentations-'));
  if (initial !== undefined) {
    await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify(initial));
  }
  return dir;
}

async function call(prc, method, routePath, request = {}) {
  const route = prc._findRoute(method, routePath);
  assert.ok(route, `route ${method} ${routePath} should be registered`);
  return route.handler({ params: {}, ...request });
}

test('GET /api/presentations/templates lists packs from settings.json', async () => {
  const configDir = await tmpConfigDir({
    presentations: { templateDirs: [FIXTURE_PACK] },
  });
  const prc = makeFakePrc({ configDir });
  await activate(prc);

  const res = await call(prc, 'GET', '/api/presentations/templates');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.packs));
  assert.equal(res.body.packs.length, 1);
  const [pack] = res.body.packs;
  assert.equal(pack.id, 'alpha');
  assert.equal(pack.name, 'Alpha Pack');
  assert.deepEqual(pack.layouts, ['title', 'bullets']);
  assert.equal(pack.dir, FIXTURE_PACK);
});

test('GET /api/presentations/templates is empty when no templateDirs configured', async () => {
  const configDir = await tmpConfigDir({});
  const prc = makeFakePrc({ configDir });
  await activate(prc);

  const res = await call(prc, 'GET', '/api/presentations/templates');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.packs, []);
});

test('POST /api/presentations/templates/reload re-reads settings.json', async () => {
  const configDir = await tmpConfigDir({});
  const prc = makeFakePrc({ configDir });
  await activate(prc);

  // Before reload: empty.
  let res = await call(prc, 'GET', '/api/presentations/templates');
  assert.equal(res.body.packs.length, 0);

  // Mutate settings.json and ask the extension to rescan.
  await fs.writeFile(
    path.join(configDir, 'settings.json'),
    JSON.stringify({ presentations: { templateDirs: [FIXTURE_PACK] } }),
  );

  const reload = await call(prc, 'POST', '/api/presentations/templates/reload');
  assert.equal(reload.status, 200);
  assert.deepEqual(reload.body.scanned, [FIXTURE_PACK]);
  assert.equal(reload.body.loaded.length, 1);
  assert.equal(reload.body.loaded[0].id, 'alpha');

  res = await call(prc, 'GET', '/api/presentations/templates');
  assert.equal(res.body.packs.length, 1);
  assert.equal(res.body.packs[0].id, 'alpha');
});

test('POST /api/presentations/templates/:packId/render/:layout invokes the pack renderer', async () => {
  const configDir = await tmpConfigDir({
    presentations: { templateDirs: [FIXTURE_PACK] },
  });
  const prc = makeFakePrc({ configDir });
  await activate(prc);

  const res = await call(
    prc,
    'POST',
    '/api/presentations/templates/:packId/render/:layout',
    {
      params: { packId: 'alpha', layout: 'title' },
      async json() { return { slots: { heading: 'Hi' } }; },
    },
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.packId, 'alpha');
  assert.equal(res.body.layout, 'title');
  assert.match(res.body.html, /data-layout="title"/);
  assert.match(res.body.html, /"heading":"Hi"/);
});

test('preview/render routes 404 for unknown packs', async () => {
  const configDir = await tmpConfigDir({});
  const prc = makeFakePrc({ configDir });
  await activate(prc);

  const res = await call(
    prc,
    'GET',
    '/api/presentations/templates/:packId/preview/:layout',
    { params: { packId: 'missing', layout: 'title' } },
  );
  assert.equal(res.status, 404);
});
