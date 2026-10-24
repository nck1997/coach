// Builds the in-progress session from the split and state.json.

import { suggest, prefillReps } from './progression.js';
import { findInLibrary, makeExercise } from './library.js';
import { localDate } from './ui/dom.js';

// Find an exercise definition by id: the split first, then the library.
export function findExerciseDef(id, split) {
  for (const d of split?.days || []) {
    const ex = d.exercises.find((e) => e.id === id);
    if (ex) return ex;
  }
  const lib = findInLibrary(id);
  return lib ? makeExercise(lib, split?.units || 'lb') : null;
}

export function sessionExercise(def, state, overrides = {}) {
  const sug = suggest(state[def.id], def);
  const setCount = overrides.sets ?? def.sets;
  const sets = Array.from({ length: setCount }, (_, i) => ({
    weight: sug.weight,
    reps: prefillReps(sug, def, i),
    done: false,
  }));
  return {
    id: def.id,
    name: def.name,
    repMin: def.repMin,
    repMax: def.repMax,
    increment: def.increment,
    caution: def.caution || null,
    swap: def.swap || null,
    sets,
    lastWeight: sug.baseWeight,
    lastReps: sug.lastReps,
    increased: sug.increased,
    status: sug.status,
    offPlan: false,
    swappedFrom: null,
    original: null,
    note: '',
    noteOpen: false,
    manualReady: false,
    collapsed: null, // null = collapse automatically when every set is done
    ...overrides,
    ...(overrides.sets != null ? { sets } : {}),
  };
}

export function newSession(day, split, state) {
  return {
    id: `s-${Date.now()}`,
    date: localDate(),
    dayId: day.id,
    dayName: day.name,
    startedAt: new Date().toISOString(),
    exercises: day.exercises.map((def) => sessionExercise(def, state)),
  };
}
