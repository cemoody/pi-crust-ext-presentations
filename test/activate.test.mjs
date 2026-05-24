import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import activate from '../server.mjs';
import { makeFakePrc } from './_fakes.mjs';

async function tmpConfigDir(initial) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcx-presentations-'));
  if (initial !== undefined) {
    await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify(initial));
  }
  return dir;
}

test('activate() registers a Presentation templates Settings section', async () => {
  const configDir = await tmpConfigDir({});
  const prc = makeFakePrc({ configDir });

  await activate(prc);

  assert.equal(prc._settingsSections.length, 1, 'one settings section is registered');
  const [section] = prc._settingsSections;
  assert.equal(section.id, 'core.presentations.settings');
  assert.equal(section.title, 'Presentation templates');
  assert.equal(typeof section.description, 'string');
  assert.ok(section.description.length > 0, 'description is non-empty');
  // The section MUST NOT hardcode webModuleUrl; the host injects it from
  // package.json's piRemoteControl.web / piCrust.web fields.
  assert.equal(section.webModuleUrl, undefined);
});

test('activate() is resilient when prc.settings is missing (older host)', async () => {
  const configDir = await tmpConfigDir({});
  const prc = makeFakePrc({ configDir });
  // Simulate an older host that doesn't expose settings.registerSection.
  delete prc.settings;

  await assert.doesNotReject(activate(prc));
});

test('activate() wires the core template-pack API routes', async () => {
  const configDir = await tmpConfigDir({});
  const prc = makeFakePrc({ configDir });

  await activate(prc);

  assert.ok(prc._findRoute('GET', '/api/presentations/templates'), 'GET /templates registered');
  assert.ok(prc._findRoute('POST', '/api/presentations/templates/reload'), 'POST /templates/reload registered');
  assert.ok(prc._findRoute('GET', '/api/presentations/templates/:packId/preview/:layout'), 'GET preview route registered');
  assert.ok(prc._findRoute('POST', '/api/presentations/templates/:packId/render/:layout'), 'POST render route registered');
});

test('activate() returns a disposer that closes watchers without throwing', async () => {
  const configDir = await tmpConfigDir({});
  const prc = makeFakePrc({ configDir });

  const result = await activate(prc);
  // Either the activate() resolves to an object with dispose(), or it resolves
  // to undefined (older contract). Both must be safe.
  if (result && typeof result.dispose === 'function') {
    assert.doesNotThrow(() => result.dispose());
  }
});
