// Split builder: templates, days, exercises, drag to reorder.
// Edits a working copy; "Save split" writes split.json (and GitHub if connected).

import * as store from '../storage.js';
import { saveSplit } from '../sync.js';
import { TEMPLATES } from '../templates.js';
import { LIBRARY, makeExercise, toId } from '../library.js';
import { h, icon, sheet, toast, confirmButton, WEEKDAYS, WEEKDAY_NAMES, mount } from './dom.js';

let draft = null; // working copy, survives switching tabs until saved or discarded

const clone = (o) => JSON.parse(JSON.stringify(o));

export function renderSplit(root, { navigate }) {
  if (!draft) draft = clone(store.getSplit() || { version: 1, name: 'My Split', units: 'lb', days: [] });
  const dirty = JSON.stringify(draft) !== JSON.stringify(store.getSplit());
  const units = draft.units || 'lb';
  const redraw = () => renderSplit(root, { navigate });

  // ---------- Templates / from scratch ----------

  function openTemplates() {
    const s = sheet('Start from', [
      h('div', { class: 'list' },
        TEMPLATES.map((t) => h('button', {
          class: 'row-link',
          onclick: () => {
            draft = t.build();
            draft.units = units;
            s.close();
            redraw();
            toast(`Loaded ${t.name}. Save to keep it.`);
          },
        }, h('div', {}, h('div', { class: 'title' }, t.name), h('div', { class: 'small muted' }, t.detail)), icon('chev', 18))),
        h('button', { class: 'row-link', onclick: () => { s.close(); openScratch(); } },
          h('div', {}, h('div', { class: 'title' }, 'From scratch'), h('div', { class: 'small muted' }, 'Choose how many days, then add exercises')),
          icon('chev', 18)),
      ),
    ]);
  }

  function openScratch() {
    let n = 3;
    const value = h('div', { class: 'num', style: 'font-size:28px;font-weight:700;text-align:center' }, n);
    const set = (v) => { n = Math.min(7, Math.max(1, v)); value.textContent = n; };
    const s = sheet('Training days', [
      h('div', { class: 'stepper', style: 'max-width:240px;margin:8px auto 16px' },
        h('button', { 'aria-label': 'Fewer days', onclick: () => set(n - 1) }, '−'),
        value,
        h('button', { 'aria-label': 'More days', onclick: () => set(n + 1) }, '+'),
      ),
      h('button', {
        class: 'btn primary block',
        onclick: () => {
          draft = {
            version: 1, name: 'My Split', units,
            days: Array.from({ length: n }, (_, i) => ({ id: `day-${i + 1}`, name: `Day ${i + 1}`, weekday: null, exercises: [] })),
          };
          s.close();
          redraw();
        },
      }, 'Create days'),
    ]);
  }

  // ---------- Exercise picker and editor ----------

  function openPicker(day) {
    const results = h('div', { class: 'lib-list' });
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Search or type a name', 'aria-label': 'Search exercises', autocomplete: 'off' });
    const add = (ex) => {
      day.exercises.push(ex);
      s.close();
      redraw();
    };
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const matches = LIBRARY.filter((e) => !q || e.name.toLowerCase().includes(q));
      const exact = LIBRARY.some((e) => e.name.toLowerCase() === q);
      mount(results,
        q && !exact && h('button', { class: 'lib-item', onclick: () => add(makeExercise(search.value.trim(), units)) },
          h('span', {}, `Add “${search.value.trim()}”`), icon('plus', 18)),
        ...matches.map((e) => h('button', { class: 'lib-item', onclick: () => add(makeExercise(e, units)) },
          h('span', {}, e.name), h('span', { class: 'small muted' }, `${e.equipment} · ${e.repMin}–${e.repMax}`))),
      );
    };
    search.addEventListener('input', draw);
    draw();
    const s = sheet('Add exercise', [search, results]);
    setTimeout(() => search.focus(), 50);
  }

  function openEditor(day, idx) {
    const ex = day.exercises[idx];
    const num = (label, key, step = 1) => {
      const input = h('input', { type: 'number', inputmode: 'decimal', min: '0', step, value: ex[key], id: `f-${key}` });
      input.addEventListener('change', () => { ex[key] = Number(input.value) || 0; });
      return h('div', { class: 'field' }, h('label', { for: `f-${key}` }, label), input);
    };
    const nameInput = h('input', { type: 'text', value: ex.name, id: 'f-name' });
    nameInput.addEventListener('change', () => {
      ex.name = nameInput.value.trim() || ex.name;
      // Keep ids stable once logged; only re-derive for brand-new custom names.
      if (!store.getState()[ex.id]) ex.id = toId(ex.name);
    });
    const caution = h('input', { type: 'text', value: ex.caution || '', placeholder: 'Optional, for example: stop at any pinch', id: 'f-caution' });
    caution.addEventListener('change', () => { ex.caution = caution.value.trim() || null; });

    const allExercises = new Map();
    for (const d of draft.days) for (const e of d.exercises) allExercises.set(e.id, e.name);
    for (const e of LIBRARY) if (!allExercises.has(e.id)) allExercises.set(e.id, e.name);
    allExercises.delete(ex.id);
    const swap = h('select', { id: 'f-swap' },
      h('option', { value: '' }, 'None'),
      [...allExercises].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => h('option', { value: id, selected: ex.swap === id }, name)),
    );
    swap.addEventListener('change', () => { ex.swap = swap.value || null; });

    const s = sheet('Edit exercise', [
      h('div', { class: 'field' }, h('label', { for: 'f-name' }, 'Name'), nameInput),
      h('div', { class: 'field-row' }, num('Sets', 'sets'), num('Rep min', 'repMin'), num('Rep max', 'repMax')),
      num(`Increment (${units})`, 'increment', 'any'),
      h('div', { class: 'field' }, h('label', { for: 'f-caution' }, 'Caution note'), caution),
      h('div', { class: 'field' }, h('label', { for: 'f-swap' }, 'Swap option'), swap),
      h('button', { class: 'btn primary block', onclick: () => s.close() }, 'Done'),
      h('div', { style: 'height:8px' }),
      h('button', {
        class: 'btn danger block',
        onclick: () => { day.exercises.splice(idx, 1); s.close(); },
      }, 'Remove from day'),
    ], { onClose: () => {
      if (ex.repMax < ex.repMin) [ex.repMin, ex.repMax] = [ex.repMax, ex.repMin];
      ex.sets = Math.max(1, Math.round(ex.sets));
      redraw();
    } });
  }

  // ---------- Drag to reorder ----------

  function makeDraggable(list, day) {
    list.querySelectorAll('.drag-handle').forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const row = handle.closest('.ex-row');
        const rows = [...list.children];
        const from = rows.indexOf(row);
        const startY = e.clientY;
        const rects = rows.map((r) => r.getBoundingClientRect());
        let to = from;
        row.classList.add('dragging');
        handle.setPointerCapture(e.pointerId);

        const move = (ev) => {
          const dy = ev.clientY - startY;
          row.style.transform = `translateY(${dy}px)`;
          const mid = rects[from].top + rects[from].height / 2 + dy;
          to = rects.findIndex((r) => mid < r.top + r.height / 2);
          if (to === -1) to = rows.length - 1;
          // Slide the other rows out of the way.
          rows.forEach((r, k) => {
            if (k === from) return;
            let shift = 0;
            if (from < to && k > from && k <= to) shift = -rects[from].height;
            if (from > to && k < from && k >= to) shift = rects[from].height;
            r.style.transform = shift ? `translateY(${shift}px)` : '';
            r.style.transition = 'transform var(--motion)';
          });
        };
        const end = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', end);
          handle.removeEventListener('pointercancel', end);
          rows.forEach((r) => { r.style.transform = ''; r.style.transition = ''; });
          row.classList.remove('dragging');
          if (to !== from) {
            const [moved] = day.exercises.splice(from, 1);
            day.exercises.splice(to, 0, moved);
            redraw();
          }
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
      });
    });
  }

  // ---------- Days ----------

  function dayCard(day, di) {
    const name = h('input', { class: 'day-name', type: 'text', value: day.name, 'aria-label': 'Day name' });
    name.addEventListener('change', () => { day.name = name.value.trim() || day.name; redraw(); });

    const weekday = h('select', { 'aria-label': 'Weekday' },
      h('option', { value: '' }, 'Any day'),
      [...WEEKDAYS.slice(1), 'sun'].map((w) => h('option', { value: w, selected: day.weekday === w }, WEEKDAY_NAMES[w].slice(0, 3))),
    );
    weekday.addEventListener('change', () => { day.weekday = weekday.value || null; redraw(); });

    const list = h('div', {},
      day.exercises.map((ex, idx) => h('div', { class: 'ex-row' },
        h('div', { class: 'drag-handle', 'aria-label': `Drag to reorder ${ex.name}`, role: 'button' }, icon('grip', 20)),
        h('button', { class: 'ex-row-main', onclick: () => openEditor(day, idx) },
          h('div', { style: 'font-weight:600' }, ex.name),
          h('div', { class: 'small muted num' },
            `${ex.sets} × ${ex.repMin}–${ex.repMax} · +${ex.increment} ${units}`,
            ex.swap ? ' · swap' : '', ex.caution ? ' · caution' : ''),
        ),
      )),
    );
    makeDraggable(list, day);

    return h('div', { class: 'card day-card' },
      h('div', { class: 'day-head' },
        name,
        weekday,
        h('button', {
          class: 'icon-btn danger',
          'aria-label': `Delete ${day.name}`,
          onclick: () => {
            if (day.exercises.length && !confirm(`Delete ${day.name} and its ${day.exercises.length} exercises?`)) return;
            draft.days.splice(di, 1);
            redraw();
          },
        }, icon('trash', 20)),
      ),
      list,
      !day.exercises.length && h('p', { class: 'small muted' }, 'No exercises yet.'),
      h('button', { class: 'btn ghost block', onclick: () => openPicker(day) }, icon('plus', 18), 'Add exercise'),
    );
  }

  const splitName = h('input', { class: 'search', type: 'text', value: draft.name, 'aria-label': 'Split name', style: 'font-weight:600' });
  splitName.addEventListener('change', () => { draft.name = splitName.value.trim() || draft.name; redraw(); });

  const save = async () => {
    // Day ids must be unique and stable; derive new ones from names.
    const seen = new Set();
    for (const d of draft.days) {
      if (!d.id || seen.has(d.id)) d.id = `${toId(d.name) || 'day'}-${seen.size + 1}`;
      seen.add(d.id);
    }
    const ok = await saveSplit(clone(draft));
    draft = null;
    toast(ok ? 'Split saved to GitHub' : store.isConnected() ? 'Split saved on phone, will sync' : 'Split saved');
    redraw();
  };

  mount(root,
    h('div', { class: 'topbar' },
      h('h1', { style: 'margin:8px 0' }, 'Split'),
      h('button', { class: 'btn ghost', onclick: openTemplates }, 'Templates'),
    ),
    splitName,
    h('div', { style: 'height:12px' }),
    draft.days.map(dayCard),
    h('button', {
      class: 'btn block',
      onclick: () => {
        draft.days.push({ id: `day-${Date.now()}`, name: `Day ${draft.days.length + 1}`, weekday: null, exercises: [] });
        redraw();
      },
    }, icon('plus', 18), 'Add day'),
    dirty && h('div', { style: 'height:8px' }),
    dirty && confirmButton('Discard changes', 'Tap again to discard', () => { draft = null; redraw(); }, 'btn ghost block'),
    dirty && h('div', { class: 'dock' }, h('div', { class: 'dock-inner' },
      h('button', { class: 'btn primary block big', onclick: save }, 'Save split'))),
  );
}
