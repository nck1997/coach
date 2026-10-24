// Built-in exercise library.
// Each entry: id (kebab-case of the name), name, equipment, region, and an
// optional rep range for exercises that don't use the 5 to 8 default.
// Used by the split builder, "+ Add exercise", and to resolve swap ids.

const E = (name, equipment, region, repMin = 5, repMax = 8) => ({
  id: toId(name),
  name,
  equipment, // machine | cable | dumbbell | barbell | bodyweight
  region,    // upper | lower | core
  repMin,
  repMax,
});

export function toId(name) {
  return String(name)
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const LIBRARY = [
  // Chest
  E('Flat Chest Press Machine', 'machine', 'upper'),
  E('Incline Chest Press Machine', 'machine', 'upper'),
  E('Pec Fly Machine', 'machine', 'upper'),
  E('Seated Low-to-High Cable Fly', 'cable', 'upper'),
  E('High-to-Low Cable Fly', 'cable', 'upper'),
  E('Flat Dumbbell Press', 'dumbbell', 'upper'),
  E('Incline Dumbbell Press', 'dumbbell', 'upper'),
  E('Barbell Bench Press', 'barbell', 'upper'),
  E('Smith Machine Incline Press', 'machine', 'upper'),
  E('Dip Machine', 'machine', 'upper'),

  // Back
  E('Wide Grip Lat Pull-Down', 'cable', 'upper'),
  E('Close Grip Lat Pull-Down', 'cable', 'upper'),
  E('Single Arm Lat Pull-Down (Machine)', 'machine', 'upper'),
  E('Chest Supported Machine Row (Neutral)', 'machine', 'upper'),
  E('Chest Supported Machine Row (Pronated)', 'machine', 'upper'),
  E('Seated Cable Row (Close Grip)', 'cable', 'upper'),
  E('Seated Cable Row (Wide Grip)', 'cable', 'upper'),
  E('Single Arm Dumbbell Row', 'dumbbell', 'upper'),
  E('T-Bar Row', 'machine', 'upper'),
  E('Assisted Pull-Up Machine', 'machine', 'upper'),
  E('Straight Arm Cable Pull-Down', 'cable', 'upper'),
  E('Barbell Row', 'barbell', 'upper'),

  // Shoulders
  E('Seated Machine Shoulder Press', 'machine', 'upper'),
  E('Seated Dumbbell Shoulder Press', 'dumbbell', 'upper'),
  E('Lateral Raise Machine', 'machine', 'upper', 12, 20),
  E('Cable Lateral Raise', 'cable', 'upper', 12, 20),
  E('Dumbbell Lateral Raise', 'dumbbell', 'upper', 12, 20),
  E('Rear Delt Fly Machine', 'machine', 'upper', 12, 20),
  E('Cable Rear Delt Fly', 'cable', 'upper', 12, 20),
  E('Face Pull', 'cable', 'upper', 12, 20),

  // Arms
  E('Seated Cable Tricep Push-Down', 'cable', 'upper'),
  E('Overhead Tricep Extension Machine', 'machine', 'upper'),
  E('Overhead Cable Tricep Extension', 'cable', 'upper'),
  E('Tricep Extension Machine', 'machine', 'upper'),
  E('Machine Preacher Curl (Single Arm)', 'machine', 'upper'),
  E('Machine Preacher Curl', 'machine', 'upper'),
  E('Seated SA DB Preacher Hammer Curl', 'dumbbell', 'upper'),
  E('Seated Dumbbell Curl', 'dumbbell', 'upper'),
  E('Seated Dumbbell Hammer Curl', 'dumbbell', 'upper'),
  E('Incline Dumbbell Curl', 'dumbbell', 'upper'),
  E('Cable Curl', 'cable', 'upper'),
  E('Bayesian Cable Curl', 'cable', 'upper'),

  // Legs
  E('Pendulum Squat', 'machine', 'lower'),
  E('Leg Press', 'machine', 'lower'),
  E('Hack Squat', 'machine', 'lower'),
  E('Smith Machine Squat', 'machine', 'lower'),
  E('Barbell Back Squat', 'barbell', 'lower'),
  E('Bulgarian Split Squat', 'dumbbell', 'lower'),
  E('Dumbbell Walking Lunge', 'dumbbell', 'lower'),
  E('Romanian Deadlift', 'barbell', 'lower'),
  E('Dumbbell Romanian Deadlift', 'dumbbell', 'lower'),
  E('45 Degree Back Extension', 'bodyweight', 'lower'),
  E('Hip Thrust Machine', 'machine', 'lower'),
  E('Seated Leg Curl', 'machine', 'lower'),
  E('Lying Leg Curl', 'machine', 'lower'),
  E('Leg Extension', 'machine', 'lower'),
  E('Adduction Machine', 'machine', 'lower', 8, 12),
  E('Abduction Machine', 'machine', 'lower', 8, 12),
  E('Calf Press on Leg Press', 'machine', 'lower', 8, 12),
  E('Standing Calf Raise Machine', 'machine', 'lower', 8, 12),
  E('Seated Calf Raise Machine', 'machine', 'lower', 8, 12),

  // Core
  E('Ab Crunch Machine', 'machine', 'core', 8, 12),
  E('Cable Crunch', 'cable', 'core', 8, 12),
  E('Hanging Knee Raise', 'bodyweight', 'core', 8, 12),
];

// Default increment, from the spec:
// upper body machines and cables 5 lb, lower body machines 10 lb, dumbbells 5 lb.
export function defaultIncrement(equipment, region, units = 'lb') {
  const lowerMachine = region === 'lower' && (equipment === 'machine' || equipment === 'barbell');
  if (units === 'kg') return lowerMachine ? 5 : 2.5;
  return lowerMachine ? 10 : 5;
}

export function findInLibrary(id) {
  return LIBRARY.find((e) => e.id === id) || null;
}

// Build a full split exercise from a library entry or a typed name.
export function makeExercise(nameOrEntry, units = 'lb', overrides = {}) {
  const entry = typeof nameOrEntry === 'string'
    ? findInLibrary(toId(nameOrEntry)) || { id: toId(nameOrEntry), name: nameOrEntry.trim(), equipment: 'machine', region: 'upper', repMin: 5, repMax: 8 }
    : nameOrEntry;
  return {
    id: entry.id,
    name: entry.name,
    sets: 2,
    repMin: entry.repMin,
    repMax: entry.repMax,
    increment: defaultIncrement(entry.equipment, entry.region, units),
    equipment: entry.equipment,
    caution: null,
    swap: null,
    ...overrides,
  };
}
