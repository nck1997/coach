// History: past sessions, one session's sets, and one exercise over time.

import * as store from '../storage.js';
import { pullHistory } from '../sync.js';
import { setMark } from '../progression.js';
import { h, icon, formatDate, fmtNum, toast, mount } from './dom.js';

let pulledThisOpen = false;

export function renderHistory(root, { navigate }) {
  const draw = () => {
    const history = store.getHistory();
    mount(root,
      h('h1', {}, 'History'),
      history.length
        ? h('div', { class: 'list' }, history.map((s) => {
            const sets = s.exercises.flatMap((e) => e.sets);
            const done = sets.filter((x) => x.done).length;
            return h('a', { class: 'row-link', href: `#/history/${encodeURIComponent(s.id)}` },
              h('div', {},
                h('div', { class: 'title' }, s.dayName),
                h('div', { class: 'small muted num' }, `${formatDate(s.date)} · ${done} sets`),
              ),
              h('div', { style: 'display:flex;align-items:center;gap:8px' },
                !s.synced && store.isConnected() && h('span', { class: 'pill purple' }, 'Not synced'),
                h('span', { class: 'chev' }, icon('chev', 18)),
              ),
            );
          }))
        : h('div', { class: 'empty' }, 'No sessions yet. ', h('a', { class: 'link', href: '#/today' }, 'Start today’s workout.')),
    );
  };
  draw();

  // Once per app open, pick up logs that exist on GitHub but not on this phone.
  if (store.isConnected() && !pulledThisOpen) {
    pulledThisOpen = true;
    pullHistory()
      .then((n) => { if (n && location.hash.startsWith('#/history')) { draw(); toast(`Loaded ${n} session${n === 1 ? '' : 's'} from GitHub`); } })
      .catch(() => {});
  }
}

export function renderSessionDetail(root, id) {
  const s = store.getHistory().find((x) => x.id === id);
  const unit = s?.unit || store.getSplit()?.units || 'lb';
  if (!s) {
    mount(root, backLink('#/history', 'History'), h('div', { class: 'empty' }, 'Session not found.'));
    return;
  }
  mount(root,
    backLink('#/history', 'History'),
    h('div', { class: 'small muted' }, formatDate(s.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })),
    h('h1', {}, s.dayName),
    s.exercises.map((ex) => h('div', { class: 'card' },
      h('a', { class: 'link', href: `#/exercise/${encodeURIComponent(ex.id)}`, style: 'font-weight:600;font-size:17px' }, ex.name),
      h('div', { class: 'small muted' },
        `${ex.repMin}–${ex.repMax} reps`,
        ex.offPlan ? ' · added' : '',
        ex.swappedFrom ? ' · swapped' : ''),
      h('table', { class: 'set-table', style: 'margin-top:8px' },
        h('tbody', {}, ex.sets.map((set, i) => {
          const mark = setMark(set, ex.repMin, ex.repMax);
          return h('tr', { class: `${set.done ? '' : 'skipped'} ${mark === 'below' ? 'below' : ''}` },
            h('td', {}, `Set ${i + 1}`),
            h('td', {}, set.done
              ? `${fmtNum(set.weight)} ${unit} × ${set.reps}`
              : 'Skipped'),
            h('td', {}, mark === 'top' ? h('span', { class: 'pill green' }, `${ex.repMax} ✓`) : ''),
          );
        })),
      ),
      ex.note && h('p', { class: 'small muted', style: 'margin:8px 0 0' }, ex.note),
    )),
  );
}

// One exercise's top working weight per session, as a line chart.
export function renderExercise(root, id) {
  const history = store.getHistory();
  const unit = store.getSplit()?.units || 'lb';
  const points = [];
  let name = id;
  for (const s of [...history].reverse()) {
    const ex = s.exercises.find((e) => e.id === id);
    if (!ex) continue;
    name = ex.name;
    const done = ex.sets.filter((x) => x.done && x.weight != null);
    if (!done.length) continue;
    const top = Math.max(...done.map((x) => x.weight));
    points.push({ date: s.date, weight: top, reps: done.filter((x) => x.weight === top).map((x) => x.reps) });
  }

  const readout = h('div', { class: 'chart-readout num', 'aria-live': 'polite' });
  mount(root,
    h('a', { class: 'back', href: 'javascript:history.back()' }, icon('back', 20), 'Back'),
    h('h1', {}, name),
    points.length
      ? h('div', { class: 'card' }, readout, lineChart(points, unit, readout))
      : h('div', { class: 'empty' }, 'No completed sets for this exercise yet.'),
    points.length > 0 && h('h2', {}, 'Sessions'),
    points.length > 0 && h('div', { class: 'card' }, h('table', { class: 'set-table' }, h('tbody', {},
      [...points].reverse().map((p) => h('tr', {},
        h('td', {}, formatDate(p.date)),
        h('td', {}, `${fmtNum(p.weight)} ${unit}`),
        h('td', {}, p.reps.join(', ') + ' reps'),
      )),
    ))),
  );
}

// Plain SVG line chart. One series, so no legend: the title names it.
function lineChart(points, unit, readout) {
  const W = 340, H = 200, padL = 40, padR = 12, padT = 12, padB = 26;
  const ws = points.map((p) => p.weight);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  if (lo === hi) { lo -= 10; hi += 10; }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.1);
  hi = hi + span * 0.1;

  const x = (i) => points.length === 1 ? (padL + W - padR) / 2 : padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (w) => padT + (1 - (w - lo) / (hi - lo)) * (H - padT - padB);

  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${unit} over time` });

  // Recessive grid: 3 horizontal lines with labels.
  for (let k = 0; k <= 2; k++) {
    const w = lo + ((hi - lo) * k) / 2;
    svg.append(el('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(w), y2: y(w) }));
    svg.append(el('text', { class: 'axis-label', x: padL - 6, y: y(w) + 4, 'text-anchor': 'end' }, fmtNum(Math.round(w))));
  }
  // First and last dates on the x axis.
  svg.append(el('text', { class: 'axis-label', x: x(0), y: H - 6, 'text-anchor': points.length === 1 ? 'middle' : 'start' }, formatDate(points[0].date, { month: 'short', day: 'numeric' })));
  if (points.length > 1) {
    svg.append(el('text', { class: 'axis-label', x: x(points.length - 1), y: H - 6, 'text-anchor': 'end' }, formatDate(points.at(-1).date, { month: 'short', day: 'numeric' })));
  }

  svg.append(el('path', { class: 'line', d: points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.weight)}`).join(' ') }));

  const crosshair = el('line', { class: 'crosshair', y1: padT, y2: H - padB, x1: -10, x2: -10 });
  svg.append(crosshair);

  const markers = points.map((p, i) => {
    const m = el('circle', { class: 'marker', cx: x(i), cy: y(p.weight), r: 4.5 });
    svg.append(m);
    return m;
  });

  const show = (i) => {
    const p = points[i];
    markers.forEach((m, k) => m.classList.toggle('active', k === i));
    crosshair.setAttribute('x1', x(i));
    crosshair.setAttribute('x2', x(i));
    readout.textContent = `${formatDate(p.date)} · ${fmtNum(p.weight)} ${unit} × ${p.reps.join(', ')}`;
  };

  // Tap or drag anywhere: snap to the nearest session.
  const pick = (evt) => {
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    show(best);
  };
  svg.addEventListener('pointerdown', pick);
  svg.addEventListener('pointermove', (e) => e.buttons && pick(e));
  show(points.length - 1);
  return svg;
}

function backLink(href, label) {
  return h('a', { class: 'back', href }, icon('back', 20), label);
}
