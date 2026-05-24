/**
 * pi-crust web module for the Presentation templates Settings section.
 *
 * Loaded by the pi-crust host via the section's webModuleUrl. The host invokes
 * `renderSettingsSection({ section, extensions, api, React })`. We use the
 * supplied React (no bundled copy) and the host's `api.request` helper to
 * read/write `presentations.templateDirs` through the standard /api/settings
 * routes.
 */

export function renderSettingsSection({ section, api, React }) {
  return React.createElement(TemplateDirsEditor, { section, api, React });
}
export default renderSettingsSection;

function TemplateDirsEditor({ api, React }) {
  const { useEffect, useState } = React;
  const [dirs, setDirs] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    if (!api || typeof api.request !== 'function') return;
    try {
      const settings = await api.request('/api/extensions/settings');
      const list = Array.isArray(settings?.presentations?.templateDirs)
        ? settings.presentations.templateDirs.filter((d) => typeof d === 'string' && d.length > 0)
        : [];
      setDirs(list);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function save(next) {
    if (!api || typeof api.request !== 'function') return;
    setBusy(true);
    setError(null);
    try {
      await api.request('/api/settings', {
        method: 'POST',
        body: { key: 'presentations.templateDirs', value: next },
      });
      setDirs(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || dirs.includes(trimmed)) { setDraft(''); return; }
    void save([...dirs, trimmed]).then(() => setDraft(''));
  }

  function remove(dir) {
    void save(dirs.filter((d) => d !== dir));
  }

  return React.createElement(
    'div',
    { 'aria-label': 'Presentation template directories' },
    error ? React.createElement('p', { role: 'alert' }, error) : null,
    dirs.length === 0
      ? React.createElement('p', null, 'No template directories configured.')
      : React.createElement(
          'ul',
          null,
          dirs.map((dir) =>
            React.createElement(
              'li',
              { key: dir },
              React.createElement('code', null, dir),
              ' ',
              React.createElement(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: () => remove(dir),
                  'aria-label': `Remove ${dir}`,
                },
                'Remove',
              ),
            ),
          ),
        ),
    React.createElement('input', {
      type: 'text',
      'aria-label': 'New presentation template directory',
      placeholder: '/path/to/templates',
      value: draft,
      disabled: busy,
      onChange: (event) => setDraft(event.target.value),
      onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } },
    }),
    ' ',
    React.createElement(
      'button',
      { type: 'button', disabled: busy || !draft.trim(), onClick: add },
      busy ? 'Saving…' : 'Add directory',
    ),
  );
}
