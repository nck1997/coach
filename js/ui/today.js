// Today (home): date, suggested day, day chips, Start or Resume.

import * as store from '../storage.js';
import { newSession, findExerciseDef } from '../session.js';
import { suggest } from '../progression.js';
import { h, formatDate, localDate, todayWeekday, WEEKDAY_NAMES, confirmButton, fmtNum, mount } from './dom.js';
import { syncBadge } from './badge.js';

// Pick today's day: a weekday match for fixed splits; for rotation splits
// (no weekdays), the day after the last one trained.
export function suggestedDay(split, history) {
  const days = split?.days || [];
  if (!days.length) return null;
  const hasWeekdays = days.some((d) => d.weekday);
  if (hasWeekdays) return days.find((d) => d.weekday === todayWeekday()) || null;
  const last = history.find((s) => days.some((d) => d.id === s.dayId));
  if (!last) return days[0];
  if (last.date === localDate()) return days.find((d) => d.id === last.dayId);
  const i = days.findIndex((d) => d.id === last.dayId);
  return days[(i + 1) % days.length];
}

let picked = null; // day id the user tapped, kept while the app is open

export function renderToday(root, { navigate }) {
  const split = store.getSplit();
  const history = store.getHistory();
  const current = store.getCurrent();
  const suggested = suggestedDay(split, history);
  const days = split?.days || [];

  if (picked && !days.some((d) => d.id === picked)) picked = null;
  const selected = days.find((d) => d.id === picked) || suggested;

  const weekday = WEEKDAY_NAMES[todayWeekday()];
  const title = suggested ? `${weekday} · ${suggested.name}` : `${weekday} · Rest day`;

  const start = (day) => {
    store.setCurrent(newSession(day, split, store.getState(), store.getVariants()));
    navigate('#/workout');
  };

  const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Workout day' },
    days.map((d) => h('button', {
      class: `chip${selected && d.id === selected.id ? ' selected' : ''}`,
      role: 'radio',
      'aria-checked': String(!!selected && d.id === selected.id),
      onclick: () => { picked = d.id; renderToday(root, { navigate }); },
    }, d.id === suggested?.id && h('span', { class: 'dot', 'aria-hidden': 'true' }), d.name)),
  );

  // Preview of the selected day with the weights it will prefill.
  // A remembered variation shows in place of the planned exercise.
  const state = store.getState();
  const variants = store.getVariants();
  const preview = selected && h('div', { class: 'card' },
    h('ul', { class: 'preview-list' },
      selected.exercises.map((planned) => {
        const alt = variants[planned.id] && findExerciseDef(variants[planned.id], split);
        const ex = alt ? { ...alt, sets: planned.sets } : planned;
        const sug = suggest(state[ex.id], ex);
        return h('li', {},
          h('span', {}, ex.name),
          h('span', { class: `num small ${sug.increased ? '' : 'muted'}`, style: sug.increased ? 'color:var(--green)' : '' },
            sug.weight != null
              ? `${sug.increased ? '↑ ' : ''}${fmtNum(sug.weight)} ${split.units} · ${ex.sets}×`
              : `${ex.sets} × ${ex.repMin}–${ex.repMax}`),
        );
      }),
    ),
  );

  let dock;
  if (current) {
    dock = [
      h('button', { class: 'btn primary block big', onclick: () => navigate('#/workout') },
        `Resume ${current.dayName}`),
      confirmButton('Discard session', 'Tap again to discard', () => {
        store.clearCurrent();
        renderToday(root, { navigate });
      }, 'btn danger block'),
    ];
  } else if (selected) {
    dock = [h('button', { class: 'btn primary block big', onclick: () => start(selected) }, `Start ${selected.name}`)];
  } else {
    dock = [];
  }

  mount(root,
    h('div', { class: 'topbar' },
      h('div', { class: 'wordmark', 'aria-label': 'Coach' }, h('span', {}, 'C'), 'oach'),
      syncBadge(),
    ),
    h('div', { class: 'small muted' }, formatDate(localDate(), { month: 'long', day: 'numeric', year: 'numeric' })),
    h('h1', {}, title),
    days.length
      ? chips
      : h('div', { class: 'empty' }, 'No split yet. ', h('a', { class: 'link', href: '#/split' }, 'Build one')),
    current && h('p', { class: 'small muted' }, `${current.dayName} from ${formatDate(current.date)} isn't saved yet.`),
    !current && !suggested && !picked && days.length > 0 && h('p', { class: 'muted' }, 'Rest day. Pick a day above if you want to train anyway.'),
    !current && preview,
    h('div', { class: 'dock' }, h('div', { class: 'dock-inner' }, dock)),
  );
}
