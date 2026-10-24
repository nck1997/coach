// Progression logic: the 5 to 8 rep ladder.
//
// Pick a weight you can do for about repMin reps. Stay there until every
// working set hits repMax. Then add the exercise's increment and work back
// up from repMin. The app never suggests going down in weight.
//
// Everything here is a pure function so tests.html can check it.

// What to prefill for an exercise, given its state.json entry.
// Returns:
//   weight      number or null (null = first session, ask for a weight)
//   baseWeight  the weight before any increase (for the one-tap revert)
//   increased   true if the weight was bumped because the last session topped out
//   lastReps    reps from last session, by set (the numbers to beat)
//   status      'new' | 'increase' | 'in-range' | 'below'
export function suggest(stateEntry, exercise) {
  if (!stateEntry || stateEntry.weight == null) {
    return { weight: null, baseWeight: null, increased: false, lastReps: [], status: 'new' };
  }
  const lastReps = stateEntry.lastReps || [];
  if (stateEntry.readyToIncrease) {
    return {
      weight: round(stateEntry.weight + exercise.increment),
      baseWeight: stateEntry.weight,
      increased: true,
      lastReps,
      status: 'increase',
    };
  }
  const below = lastReps.some((r) => r < exercise.repMin);
  return {
    weight: stateEntry.weight,
    baseWeight: stateEntry.weight,
    increased: false,
    lastReps,
    status: below ? 'below' : 'in-range',
  };
}

// Reps to prefill for set i: last session's reps for that set (the number to
// beat), or repMin after a weight increase or on a first session.
export function prefillReps(suggestion, exercise, i) {
  if (suggestion.increased || suggestion.status === 'new') return exercise.repMin;
  const r = suggestion.lastReps[i] ?? suggestion.lastReps[suggestion.lastReps.length - 1];
  return r ?? exercise.repMin;
}

// Rule 1: topped out when every planned set was completed at repMax or more.
export function isToppedOut(sets, repMax) {
  return sets.length > 0 && sets.every((s) => s.done && s.reps >= repMax);
}

// New state.json entry after a session.
// sessionEx: { sets: [{ weight, reps, done }], repMax, manualReady }
// Returns the previous entry unchanged if no set was completed.
export function nextState(prev, sessionEx, date) {
  const done = sessionEx.sets.filter((s) => s.done && s.weight != null && s.weight !== '');
  if (done.length === 0) return prev || null;
  const weight = Math.max(...done.map((s) => Number(s.weight)));
  const ready = isToppedOut(sessionEx.sets, sessionEx.repMax) || !!sessionEx.manualReady;
  return {
    weight,
    lastReps: done.map((s) => s.reps),
    lastDate: date,
    readyToIncrease: ready,
  };
}

// How a checked set looks: 'below' (red edge), 'top' (green repMax chip), or 'ok'.
export function setMark(set, repMin, repMax) {
  if (!set.done) return null;
  if (set.reps < repMin) return 'below';
  if (set.reps >= repMax) return 'top';
  return 'ok';
}

// Step a weight by the increment, never below zero.
export function stepWeight(weight, increment, dir) {
  const w = Number(weight) || 0;
  return Math.max(0, round(w + dir * increment));
}

function round(n) {
  return Math.round(n * 100) / 100;
}
