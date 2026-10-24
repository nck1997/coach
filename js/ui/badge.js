// "1 session waiting to sync" badge. Tap to retry.

import { pendingCount, syncOnOpen } from '../sync.js';
import { isConnected, getOutbox } from '../storage.js';
import { h, toast } from './dom.js';

export function syncBadge() {
  const wrap = h('div', { class: 'sync-badge', 'aria-live': 'polite' });

  const draw = () => {
    const n = pendingCount();
    if (!n || !isConnected()) return wrap.replaceChildren();
    const sessions = getOutbox().length;
    const label = sessions === 0 ? 'Split waiting to sync'
      : sessions === 1 ? '1 session waiting to sync'
      : `${sessions} sessions waiting to sync`;
    wrap.replaceChildren(h('button', {
      style: 'min-height:48px;display:flex;align-items:center',
      'aria-label': `${label}. Tap to sync now`,
      onclick: async () => {
        toast('Syncing…');
        const r = await syncOnOpen();
        toast(r === 'synced' ? 'Synced to GitHub' : 'Still offline. Will retry.');
      },
    }, h('span', { class: 'pill purple' }, label)));
  };

  draw();
  const onSync = () => (wrap.isConnected ? draw() : window.removeEventListener('coach:sync', onSync));
  window.addEventListener('coach:sync', onSync);
  return wrap;
}
