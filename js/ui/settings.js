// Settings: GitHub connection, units, export, reset.

import * as store from '../storage.js';
import { testConnection } from '../github.js';
import { syncOnOpen, saveSplit } from '../sync.js';
import { sessionRows, toCSV } from '../csv.js';
import { h, confirmButton, toast, localDate, mount } from './dom.js';

export function renderSettings(root, { navigate }) {
  const settings = store.getSettings();
  const split = store.getSplit();

  const field = (label, attrs) => {
    const input = h('input', attrs);
    return { input, el: h('div', { class: 'field' }, h('label', { for: attrs.id }, label), input) };
  };

  const token = field('Personal access token', {
    id: 'gh-token', type: 'password', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'github_pat_…', value: settings.token || '',
  });
  const owner = field('Repo owner', {
    id: 'gh-owner', type: 'text', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'your GitHub username', value: settings.owner || '',
  });
  const repo = field('Repo name', {
    id: 'gh-repo', type: 'text', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'coach-data', value: settings.repo || 'coach-data',
  });

  const status = h('p', { class: 'status-line', 'aria-live': 'polite' },
    store.isConnected() ? 'Connected. Sessions save to GitHub.' : 'Not connected. Everything stays on this phone.');

  const read = () => ({
    token: token.input.value.trim(),
    owner: owner.input.value.trim(),
    repo: repo.input.value.trim() || 'coach-data',
  });

  const testBtn = h('button', {
    class: 'btn primary block',
    onclick: async () => {
      const s = read();
      if (!s.token || !s.owner) {
        status.className = 'status-line err';
        status.textContent = 'Add a token and the repo owner first.';
        return;
      }
      testBtn.disabled = true;
      status.className = 'status-line muted';
      status.textContent = 'Testing…';
      try {
        await testConnection(s);
        store.setSettings(s);
        status.className = 'status-line ok';
        status.textContent = `Connected to ${s.owner}/${s.repo}. Syncing…`;
        const r = await syncOnOpen();
        status.textContent = r === 'synced'
          ? `Connected to ${s.owner}/${s.repo}. Split and weights are up to date.`
          : `Connected, but the first sync didn't finish. It will retry.`;
      } catch (err) {
        status.className = 'status-line err';
        status.textContent = err.status === 401
          ? 'GitHub rejected the token. Check it was copied in full and hasn’t expired.'
          : err.message;
      } finally {
        testBtn.disabled = false;
      }
    },
  }, 'Test connection');

  const disconnect = store.isConnected() && h('button', {
    class: 'btn ghost block',
    onclick: () => {
      store.setSettings({ token: '', owner: settings.owner, repo: settings.repo });
      toast('Disconnected. Data stays on this phone.');
      renderSettings(root, { navigate });
    },
  }, 'Disconnect');

  // Units live in split.json so Claude and the logs agree.
  const units = split?.units || 'lb';
  const unitBtn = (u) => h('button', {
    class: units === u ? 'on' : '',
    'aria-pressed': String(units === u),
    onclick: async () => {
      if (!split || split.units === u) return;
      await saveSplit({ ...split, units: u });
      toast(`Units set to ${u}. Weights aren't converted.`);
      renderSettings(root, { navigate });
    },
  }, u);

  const exportCSV = () => {
    const history = store.getHistory();
    if (!history.length) return toast('No sessions to export yet');
    const rows = [...history].reverse().flatMap((s) => sessionRows(s, s.unit || units));
    const blob = new Blob([toCSV(rows)], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `coach-logs-${localDate()}.csv` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  mount(root,
    h('h1', {}, 'Settings'),

    h('h2', {}, 'GitHub'),
    h('div', { class: 'card' },
      h('div', { class: 'explainer' },
        h('p', { style: 'margin-top:0' }, 'Coach saves each session to a private GitHub repo. Without a token, everything stays on this phone.'),
        h('ol', {},
          h('li', {}, h('a', { class: 'link', href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'Create a fine-grained token'), '.'),
          h('li', {}, 'Under Repository access, choose Only select repositories and pick your data repo (coach-data).'),
          h('li', {}, 'Under Permissions, set Contents to Read and write.'),
          h('li', {}, 'Generate it, copy it, and paste it below. It stays on this device.'),
        ),
      ),
      token.el, owner.el, repo.el,
      testBtn,
      status,
      disconnect,
    ),

    h('h2', {}, 'Units'),
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Units' }, unitBtn('lb'), unitBtn('kg')),

    h('h2', {}, 'Your data'),
    h('button', { class: 'btn block', onclick: exportCSV }, 'Export all logs (CSV)'),

    h('h2', {}, 'Reset'),
    h('p', { class: 'small muted' }, 'Erases the split, weights, history and token from this phone. Nothing on GitHub is deleted.'),
    confirmButton('Reset the app', 'Tap again to erase this phone’s data', () => {
      store.resetAll();
      location.hash = '#/today';
      location.reload();
    }),
  );
}
