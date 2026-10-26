// Workout screen: one card per exercise, steppers, check-off, save.

import * as store from '../storage.js';
import { saveSession } from '../sync.js';
import { setMark, stepWeight } from '../progression.js';
import { findExerciseDef, sessionExercise, swappedExercise } from '../session.js';
import { LIBRARY, makeExercise, toId, variationsFor } from '../library.js';
import { h, icon, sheet, toast, pressable, formatDate, fmtNum, mount } from './dom.js';

let wakeLock = null;

async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* not supported or denied: fine */ }
}

function onVisible() {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/workout')) keepAwake();
}

export function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  document.removeEventListener('visibilitychange', onVisible);
}

export function renderWorkout(root, { navigate }) {
  let session = store.getCurrent();
  if (!session) {
    navigate('#/today');
    return;
  }
  const split = store.getSplit();
  const unit = split?.units || 'lb';

  keepAwake();
  document.addEventListener('visibilitychange', onVisible);

  const persist = () => store.setCurrent(session);

  const progressFill = h('div', { style: 'width:0%' });
  const updateProgress = () => {
    const all = session.exercises.flatMap((e) => e.sets);
    const done = all.filter((s) => s.done).length;
    progressFill.style.width = all.length ? `${(done / all.length) * 100}%` : '0%';
  };

  const cardsEl = h('div');

  function renderCards() {
    cardsEl.replaceChildren(...session.exercises.map((ex, i) => card(ex, i)));
    updateProgress();
  }

  function rerender(i) {
    // Commit a focused field first; its blur must not hit a detached card.
    if (cardsEl.children[i]?.contains(document.activeElement)) document.activeElement.blur();
    const old = cardsEl.children[i];
    const fresh = card(session.exercises[i], i);
    old ? old.replaceWith(fresh) : cardsEl.append(fresh);
    updateProgress();
  }

  // ---------- One exercise card ----------

  function card(ex, i) {
    const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done);
    const collapsed = ex.collapsed === true || (allDone && ex.collapsed !== false);

    const doneCount = ex.sets.filter((s) => s.done).length;
    const meta = collapsed
      ? `${doneCount} of ${ex.sets.length} sets · ${fmtNum(ex.sets.find((s) => s.done)?.weight)} ${unit}`
      : `${ex.sets.length} × ${ex.repMin}–${ex.repMax}${ex.offPlan ? ' · added today' : ''}${ex.swappedFrom && ex.original ? ` · instead of ${ex.original.name}` : ex.swappedFrom ? ' · swapped' : ''}`;

    const head = h('div', { class: 'ex-head' },
      h('div', {},
        h('h3', { class: 'ex-name' },
          h('button', {
            class: 'ex-name-btn',
            'aria-label': `${ex.name}. Change variation`,
            onclick: () => openVariations(i),
          }, h('span', {}, ex.name), icon('chevDown', 18)),
        ),
        h('div', { class: 'ex-meta small muted num' }, meta),
      ),
      (allDone || collapsed) && h('button', {
        class: 'collapse-toggle',
        'aria-label': collapsed ? 'Show sets' : 'Hide sets',
        'aria-expanded': String(!collapsed),
        onclick: () => { ex.collapsed = !collapsed; persist(); rerender(i); },
      }, icon(collapsed ? 'chevDown' : 'chevUp', 20)),
    );

    const body = h('div', { class: 'ex-body' },
      ex.caution && h('div', { class: 'caution' }, ex.caution),
      increaseRow(ex, i),
      h('div', { class: 'sets' }, ex.sets.map((s, si) => setRow(ex, i, s, si))),
      actions(ex, i),
      ex.noteOpen && h('input', {
        class: 'note-input',
        type: 'text',
        placeholder: 'Note for this exercise',
        value: ex.note || '',
        'aria-label': `Note for ${ex.name}`,
        oninput: (e) => { ex.note = e.target.value; persist(); },
      }),
    );

    return h('section', { class: `card ex-card${collapsed ? ' collapsed' : ''}`, 'aria-label': ex.name }, head, body);
  }

  // Green "↑ +5 lb" chip after topping out, with a one-tap revert.
  function increaseRow(ex, i) {
    if (!ex.increased || ex.lastWeight == null) return null;
    const upWeight = ex.lastWeight + ex.increment;
    const setWeights = (w) => {
      ex.sets.forEach((s) => { if (!s.done) s.weight = w; });
      persist();
      rerender(i);
    };
    if (ex.reverted) {
      return h('div', { class: 'increase' },
        h('span', { class: 'small muted' }, `Holding at ${fmtNum(ex.lastWeight)} ${unit}`),
        h('button', { class: 'btn ghost small', onclick: () => { ex.reverted = false; setWeights(upWeight); } },
          `Go up to ${fmtNum(upWeight)}`),
      );
    }
    return h('div', { class: 'increase' },
      h('span', { class: 'pill green' }, `↑ +${fmtNum(ex.increment)} ${unit}`),
      h('span', { class: 'small muted' }, `Topped out last time`),
      h('button', { class: 'btn ghost small', onclick: () => { ex.reverted = true; setWeights(ex.lastWeight); } },
        `Use ${fmtNum(ex.lastWeight)}`),
    );
  }

  function setRow(ex, i, s, si) {
    const mark = setMark(s, ex.repMin, ex.repMax);
    const isUp = ex.increased && !ex.reverted && s.weight != null && ex.lastWeight != null && s.weight > ex.lastWeight;

    // Weight: −/+ step by the increment; the number itself is typeable.
    const weightInput = h('input', {
      type: 'number',
      inputmode: 'decimal',
      step: 'any',
      min: '0',
      placeholder: 'Weight',
      value: s.weight ?? '',
      'aria-label': `Set ${si + 1} weight in ${unit}`,
      // Save as you type and update later sets in place. Redrawing the card
      // here would swallow a tap on the check button that caused the blur.
      oninput: (e) => {
        const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value));
        setWeight(ex, si, v);
        const inputs = cardsEl.children[i]?.querySelectorAll('.set input[type=number]') || [];
        ex.sets.forEach((set, j) => {
          if (j > si && inputs[j]) inputs[j].value = set.weight ?? '';
        });
      },
    });

    const weightStepper = h('div', { class: `stepper${isUp ? ' up' : ''}${s.weight == null ? ' needs' : ''}` },
      h('button', {
        'aria-label': 'Less weight',
        onclick: () => {
          if (s.weight == null) return weightInput.focus();
          setWeight(ex, si, stepWeight(s.weight, ex.increment, -1));
          rerender(i);
        },
      }, '−'),
      h('label', { class: 'value' }, weightInput, h('span', { class: 'unit' }, unit)),
      h('button', {
        'aria-label': 'More weight',
        onclick: () => {
          if (s.weight == null) return weightInput.focus();
          setWeight(ex, si, stepWeight(s.weight, ex.increment, 1));
          rerender(i);
        },
      }, '+'),
    );

    const repStepper = h('div', { class: 'stepper' },
      h('button', {
        'aria-label': 'Fewer reps',
        onclick: () => { s.reps = Math.max(0, (s.reps ?? 0) - 1); persist(); rerender(i); },
      }, '−'),
      h('div', { class: 'value' },
        h('span', { class: 'num', style: 'width:5ch;text-align:right', 'aria-live': 'polite' }, s.reps ?? '—'),
        h('span', { class: 'unit' }, 'reps'),
      ),
      h('button', {
        'aria-label': 'More reps',
        onclick: () => { s.reps = (s.reps ?? 0) + 1; persist(); rerender(i); },
      }, '+'),
    );

    // Check: tap marks done; long-press un-checks.
    const check = h('button', {
      class: 'check',
      'aria-label': s.done ? `Set ${si + 1} done. Long-press to undo` : `Mark set ${si + 1} done`,
      'aria-pressed': String(!!s.done),
    }, icon('check', 26));
    pressable(check, {
      onTap: () => {
        if (s.done) return toast('Long-press to undo a set');
        if (s.weight == null) {
          weightInput.focus();
          return toast('Enter a weight first');
        }
        s.done = true;
        persist();
        rerender(i);
      },
      onLong: () => {
        if (!s.done) return;
        s.done = false;
        if (ex.collapsed) ex.collapsed = false;
        persist();
        rerender(i);
      },
    });

    const lastReps = ex.lastReps?.[si];
    const lastText = ex.lastWeight != null && lastReps != null
      ? `Last: ${fmtNum(ex.lastWeight)} × ${lastReps}`
      : ex.lastWeight != null ? `Last: ${fmtNum(ex.lastWeight)}`
      : si === 0 && s.weight == null ? 'First time: enter a weight' : '';

    return h('div', { class: `set${s.done ? ' done' : ''}${mark === 'below' ? ' below' : ''}` },
      weightStepper,
      repStepper,
      check,
      (lastText || mark === 'top') && h('div', { class: 'set-last num' },
        h('span', {}, lastText),
        mark === 'top' && h('span', { class: 'pill green' }, `${ex.repMax} ✓`),
      ),
    );
  }

  // Changing a weight carries it to later sets that still match the old value.
  function setWeight(ex, si, value) {
    const old = ex.sets[si].weight;
    ex.sets[si].weight = value;
    for (let j = si + 1; j < ex.sets.length; j++) {
      const s = ex.sets[j];
      if (!s.done && (s.weight == null || s.weight === old)) s.weight = value;
    }
    persist();
  }

  function actions(ex, i) {
    const swapDef = ex.swap && !ex.swappedFrom ? findExerciseDef(ex.swap, split) : null;
    return h('div', { class: 'ex-actions' },
      h('button', {
        class: `btn ghost${ex.manualReady ? ' on' : ''}`,
        'aria-pressed': String(!!ex.manualReady),
        onclick: () => {
          ex.manualReady = !ex.manualReady;
          persist();
          rerender(i);
          if (ex.manualReady) toast(`Marked ready to go up next time`);
        },
      }, ex.manualReady ? `✓ Hit ${ex.repMax} clean` : `Hit ${ex.repMax} clean`),
      swapDef && h('button', { class: 'btn ghost', onclick: () => doSwap(i, swapDef) }, icon('swap', 18), `Swap: ${swapDef.name}`),
      ex.swappedFrom && ex.original && h('button', { class: 'btn ghost', onclick: () => undoSwap(i) }, icon('swap', 18), 'Undo swap'),
      h('button', {
        class: 'btn ghost',
        'aria-expanded': String(!!ex.noteOpen),
        onclick: () => {
          ex.noteOpen = !ex.noteOpen;
          persist();
          rerender(i);
          if (ex.noteOpen) cardsEl.children[i].querySelector('.note-input')?.focus();
        },
      }, icon('note', 18), ex.note ? 'Note added' : 'Note'),
      ex.offPlan && h('button', {
        class: 'btn ghost danger',
        onclick: () => {
          session.exercises.splice(i, 1);
          persist();
          renderCards();
        },
      }, 'Remove'),
    );
  }

  // Swapping keeps the planned exercise underneath, even across several
  // swaps, so "back to the plan" is always one tap.
  // Sets already checked off move with the swap, so a set logged under the
  // wrong name can be relabeled to the setup he actually used.
  const loggedSets = (ex) => (ex.sets.some((s) => s.done) ? ex.sets.map((s) => ({ ...s })) : null);

  function doSwap(i, def) {
    const current = session.exercises[i];
    const original = current.original || current;
    if (def.id === original.id) return undoSwap(i);
    if (def.id === current.id) return;
    const carry = loggedSets(current);
    const next = swappedExercise(original, def, store.getState());
    if (carry) next.sets = carry;
    session.exercises[i] = next;
    if (!original.offPlan) store.rememberVariant(original.id, def.id);
    persist();
    rerender(i);
    if (carry) toast(`Logged sets moved to ${def.name}`);
  }

  function undoSwap(i) {
    const current = session.exercises[i];
    const original = current.original;
    if (!original) return;
    const carry = loggedSets(current);
    session.exercises[i] = carry ? { ...original, sets: carry } : original;
    if (!original.offPlan) store.rememberVariant(original.id, null);
    persist();
    rerender(i);
  }

  // ---------- Variations ----------

  // Tap the exercise name: other setups of the same movement, then search.
  function openVariations(i) {
    const ex = session.exercises[i];
    const planned = ex.original || ex;
    const state = store.getState();

    const lastFor = (id) => {
      const w = state[id]?.weight;
      return w != null ? `Last ${fmtNum(w)} ${unit}` : 'New';
    };

    const row = (def, label) => {
      const current = def.id === ex.id;
      return h('button', {
        class: `lib-item${current ? ' current' : ''}`,
        'aria-current': current ? 'true' : null,
        onclick: () => { s.close(); if (!current) doSwap(i, def); },
      },
        h('span', {}, def.name, label && h('span', { class: 'small muted' }, ` · ${label}`)),
        current ? icon('check', 18) : h('span', { class: 'small muted' }, lastFor(def.id)),
      );
    };

    // The planned exercise, its family, and its shoulder-friendly swap.
    const ids = [planned.id, ...variationsFor(planned.id)];
    if (planned.swap && !ids.includes(planned.swap)) ids.push(planned.swap);
    const family = ids.map((id) => (id === planned.id ? planned : findExerciseDef(id, split))).filter(Boolean);

    const results = h('div', { class: 'lib-list' });
    const search = h('input', {
      class: 'search',
      type: 'search',
      placeholder: 'Search all exercises',
      'aria-label': 'Search all exercises',
      autocomplete: 'off',
    });
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      if (!q) {
        mount(results, family.map((def) => row(def, def.id === planned.id ? 'planned' : '')));
        return;
      }
      const matches = LIBRARY.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 30)
        .map((e) => findExerciseDef(e.id, split));
      const exact = LIBRARY.some((e) => e.name.toLowerCase() === q);
      mount(results,
        !exact && h('button', {
          class: 'lib-item',
          onclick: () => { s.close(); doSwap(i, makeExercise(search.value.trim(), unit)); },
        }, h('span', {}, `Use “${search.value.trim()}”`), icon('plus', 18)),
        matches.map((def) => row(def, '')),
      );
    };
    search.addEventListener('input', draw);
    draw();
    const s = sheet('Variations', [
      family.length < 2 && h('p', { class: 'small muted' }, 'No saved variations for this one. Search to swap in any exercise.'),
      results,
      search,
    ]);
  }

  // ---------- Add exercise ----------

  function openAddExercise() {
    const results = h('div', { class: 'lib-list' });
    const search = h('input', {
      class: 'search',
      type: 'search',
      placeholder: 'Search or type a name',
      'aria-label': 'Search exercises',
      autocomplete: 'off',
    });

    // Split exercises first, then the rest of the library.
    const seen = new Set();
    const options = [];
    for (const d of split?.days || []) for (const e of d.exercises) {
      if (!seen.has(e.id)) { seen.add(e.id); options.push({ def: e, where: d.name }); }
    }
    for (const e of LIBRARY) {
      if (!seen.has(e.id)) { seen.add(e.id); options.push({ def: makeExercise(e, unit), where: '' }); }
    }

    const add = (def) => {
      const inToday = session.exercises.some((e) => e.id === def.id);
      const ex = sessionExercise(def, store.getState(), { offPlan: true });
      if (inToday) toast('Already in this workout. Added another card.');
      session.exercises.push(ex);
      persist();
      renderCards();
      s.close();
      cardsEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const matches = options.filter((o) => !q || o.def.name.toLowerCase().includes(q)).slice(0, 40);
      const exact = options.some((o) => o.def.name.toLowerCase() === q);
      mount(results,
        q && !exact && h('button', {
          class: 'lib-item',
          onclick: () => add(findExerciseDef(toId(search.value), split) || makeExercise(search.value.trim(), unit)),
        }, h('span', {}, `Add “${search.value.trim()}”`), icon('plus', 18)),
        ...matches.map((o) => h('button', { class: 'lib-item', onclick: () => add(o.def) },
          h('span', {}, o.def.name),
          h('span', { class: 'small muted' }, o.where || `${o.def.repMin}–${o.def.repMax}`),
        )),
      );
    };
    search.addEventListener('input', draw);
    draw();
    const s = sheet('Add exercise', [search, results]);
    setTimeout(() => search.focus(), 50);
  }

  // ---------- Save ----------

  let saving = false;
  async function save() {
    if (saving) return;
    const doneSets = session.exercises.flatMap((e) => e.sets).filter((s) => s.done).length;
    if (doneSets === 0) return toast('Check off at least one set first');
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    const clean = {
      ...session,
      // Drop screen-only fields before saving.
      exercises: session.exercises.map((ex) => {
        const rest = { ...ex };
        delete rest.original; delete rest.noteOpen; delete rest.collapsed;
        return rest;
      }),
    };
    const result = await saveSession(clean);
    sessionStorage.setItem('coach.lastSave', JSON.stringify({
      synced: result.synced,
      connected: store.isConnected(),
      readyToIncrease: result.readyToIncrease,
      sessionId: result.session.id,
    }));
    releaseWakeLock();
    navigate('#/summary');
  }

  const saveBtn = h('button', { class: 'btn primary block big', onclick: save }, 'Save session');

  renderCards();

  mount(root,
    h('div', { class: 'topbar' },
      h('a', { class: 'back', href: '#/today', onclick: releaseWakeLock }, icon('back', 20), 'Today'),
      h('span', { class: 'small muted' }, formatDate(session.date)),
    ),
    h('h1', {}, session.dayName),
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Sets done' }, progressFill),
    cardsEl,
    h('button', { class: 'btn block', onclick: openAddExercise }, icon('plus', 18), 'Add exercise'),
    h('div', { class: 'dock' }, h('div', { class: 'dock-inner' }, saveBtn)),
  );
}
