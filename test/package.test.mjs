import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

async function readPkg() {
  return JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
}

test('package.json declares the web settings module under both host fields', async () => {
  const pkg = await readPkg();
  assert.equal(pkg.piRemoteControl?.extension, './server.mjs');
  assert.equal(pkg.piRemoteControl?.web, './presentations.web.mjs');
  assert.equal(pkg.piCrust?.extension, './server.mjs');
  assert.equal(pkg.piCrust?.web, './presentations.web.mjs');
});

test('package.json exports the web settings module for explicit subpath imports', async () => {
  const pkg = await readPkg();
  assert.ok(pkg.exports, 'exports map exists');
  assert.equal(pkg.exports['./presentations.web.mjs'], './presentations.web.mjs');
  // Subpath for package.json must remain (host resolver depends on it).
  assert.equal(pkg.exports['./package.json'], './package.json');
});

test('package.json `files` includes the shipped runtime + web module + templates', async () => {
  const pkg = await readPkg();
  assert.ok(Array.isArray(pkg.files));
  for (const required of ['server.mjs', 'presentations.web.mjs', 'README.md', 'LICENSE', 'templates']) {
    assert.ok(pkg.files.includes(required), `files must include ${required}`);
  }
});

test('shipped web module file exists on disk', async () => {
  const stat = await fs.stat(path.join(root, 'presentations.web.mjs'));
  assert.ok(stat.isFile());
});

test('package.json version is at least 0.1.2 (Settings section contract)', async () => {
  const pkg = await readPkg();
  const [major, minor, patch] = String(pkg.version).split('.').map((n) => Number(n));
  const numeric = major * 1_000_000 + minor * 1_000 + patch;
  assert.ok(numeric >= 0 * 1_000_000 + 1 * 1_000 + 2, `version ${pkg.version} must be >= 0.1.2`);
});
