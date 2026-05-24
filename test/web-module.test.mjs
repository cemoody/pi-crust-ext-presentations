import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSettingsSection } from '../presentations.web.mjs';
import * as webModule from '../presentations.web.mjs';
import { makeFakeReact, findNode, findAll } from './_fakes.mjs';

/**
 * Helper: build a fake `api` that records every request() call and replies
 * with values from a queue keyed by URL.
 */
function makeFakeApi(responses = {}) {
  const calls = [];
  return {
    calls,
    async request(url, options) {
      calls.push({ url, options });
      const entry = responses[url];
      if (entry instanceof Error) throw entry;
      return typeof entry === 'function' ? entry(options) : entry;
    },
  };
}

/** Render the section once with the supplied React + api and return the tree. */
function renderOnce({ React, api, section = { id: 'core.presentations.settings' } }) {
  React._reset();
  const el = renderSettingsSection({ section, api, React });
  // The top-level element wraps a function component; call it to get the tree.
  if (typeof el.type === 'function') {
    return el.type(el.props);
  }
  return el;
}

test('web module exports renderSettingsSection (named + default)', () => {
  assert.equal(typeof webModule.renderSettingsSection, 'function');
  assert.equal(typeof webModule.default, 'function');
  assert.equal(webModule.default, webModule.renderSettingsSection);
});

test('first render fetches /api/extensions/settings on mount', async () => {
  const React = makeFakeReact();
  const api = makeFakeApi({ '/api/extensions/settings': {} });

  renderOnce({ React, api });
  assert.equal(React._effects.length, 1, 'one useEffect is registered on mount');
  await React._effects[0]();

  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].url, '/api/extensions/settings');
  // GET is the default; no method/body should be sent for the read.
  assert.equal(api.calls[0].options, undefined);
});

test('renders empty-state copy when no template directories are configured', () => {
  const React = makeFakeReact();
  const api = makeFakeApi({ '/api/extensions/settings': {} });

  const tree = renderOnce({ React, api });
  const emptyMsg = findNode(tree, (n) => n.type === 'p' && (n.children?.[0] === 'No template directories configured.'));
  assert.ok(emptyMsg, 'shows the empty-state paragraph');

  const addBtn = findNode(tree, (n) => n.type === 'button' && (n.children?.[0] === 'Add directory'));
  assert.ok(addBtn, 'shows an Add directory button');
});

test('renders one row with a Remove button per configured directory', () => {
  const React = makeFakeReact();
  React._seed([['/a', '/b'], '', false, null]);
  const api = makeFakeApi({ '/api/extensions/settings': { presentations: { templateDirs: ['/a', '/b'] } } });

  const tree = renderOnce({ React, api });
  const items = findAll(tree, (n) => n.type === 'li');
  assert.equal(items.length, 2);

  const codes = findAll(tree, (n) => n.type === 'code').map((n) => n.children?.[0]);
  assert.deepEqual(codes, ['/a', '/b']);

  const removeButtons = findAll(tree, (n) => n.type === 'button' && /^Remove/.test(String(n.props?.['aria-label'] ?? '')));
  assert.equal(removeButtons.length, 2);
});

test('clicking Remove POSTs the new templateDirs list to /api/settings', async () => {
  const React = makeFakeReact();
  React._seed([['/a', '/b'], '', false, null]);
  const api = makeFakeApi({
    '/api/extensions/settings': { presentations: { templateDirs: ['/a', '/b'] } },
    '/api/settings': {},
  });

  const tree = renderOnce({ React, api });
  const removeA = findNode(tree, (n) => n.type === 'button' && n.props?.['aria-label'] === 'Remove /a');
  assert.ok(removeA, 'Remove button for /a exists');

  await removeA.props.onClick();

  const settingsCall = api.calls.find((c) => c.url === '/api/settings');
  assert.ok(settingsCall, 'POST /api/settings was issued');
  assert.equal(settingsCall.options?.method, 'POST');
  assert.deepEqual(settingsCall.options?.body, {
    key: 'presentations.templateDirs',
    value: ['/b'],
  });
});

test('clicking Add directory POSTs the appended templateDirs list', async () => {
  const React = makeFakeReact();
  // [dirs, draft, busy, error]
  React._seed([['/a'], '/b', false, null]);
  const api = makeFakeApi({
    '/api/extensions/settings': { presentations: { templateDirs: ['/a'] } },
    '/api/settings': {},
  });

  const tree = renderOnce({ React, api });
  const addBtn = findNode(tree, (n) => n.type === 'button' && (n.children?.[0] === 'Add directory'));
  assert.ok(addBtn, 'Add directory button exists');

  await addBtn.props.onClick();

  const settingsCall = api.calls.find((c) => c.url === '/api/settings');
  assert.ok(settingsCall, 'POST /api/settings was issued');
  assert.equal(settingsCall.options?.method, 'POST');
  assert.deepEqual(settingsCall.options?.body, {
    key: 'presentations.templateDirs',
    value: ['/a', '/b'],
  });
});

test('does not duplicate a directory that is already configured', async () => {
  const React = makeFakeReact();
  React._seed([['/a'], '/a', false, null]);
  const api = makeFakeApi({
    '/api/extensions/settings': { presentations: { templateDirs: ['/a'] } },
    '/api/settings': {},
  });

  const tree = renderOnce({ React, api });
  const addBtn = findNode(tree, (n) => n.type === 'button' && (n.children?.[0] === 'Add directory'));
  await addBtn.props.onClick();

  const settingsCall = api.calls.find((c) => c.url === '/api/settings');
  assert.equal(settingsCall, undefined, 'no save request issued for a duplicate');
});

test('surfaces an error message when the initial fetch fails', async () => {
  const React = makeFakeReact();
  const api = makeFakeApi({ '/api/extensions/settings': new Error('boom') });

  renderOnce({ React, api });
  await React._effects[0]();

  // After the error, the state cell holding `error` should be set.
  // Re-render and look for an alert paragraph.
  const tree = renderOnce({ React, api });
  const alert = findNode(tree, (n) => n.type === 'p' && n.props?.role === 'alert');
  assert.ok(alert, 'shows an alert paragraph');
  assert.equal(alert.children?.[0], 'boom');
});
