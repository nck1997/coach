// Split templates. Coach Default loads automatically on first open.
// Every template uses the 5 to 8 default, 2 to 3 working sets, and
// machine-friendly exercises. All of them are editable after loading.

import { makeExercise } from './library.js';

const ex = (name, sets, overrides = {}) => makeExercise(name, 'lb', { sets, ...overrides });

const day = (id, name, weekday, exercises) => ({ id, name, weekday, exercises });

function split(name, days) {
  return { version: 1, name, units: 'lb', days };
}

export function coachDefault() {
  return split('Coach Default', [
    day('upper', 'Upper', 'mon', [
      ex('Flat Chest Press Machine', 2),
      ex('Wide Grip Lat Pull-Down', 2),
      ex('Chest Supported Machine Row (Neutral)', 2),
      ex('Seated Low-to-High Cable Fly', 2),
      ex('Lateral Raise Machine', 3),
      ex('Seated Cable Tricep Push-Down', 3),
      ex('Machine Preacher Curl (Single Arm)', 2),
      ex('Seated SA DB Preacher Hammer Curl', 1),
    ]),
    day('lower', 'Lower', 'tue', [
      ex('Pendulum Squat', 2, { increment: 10, swap: 'leg-press' }),
      ex('Bulgarian Split Squat', 2),
      ex('45 Degree Back Extension', 2),
      ex('Seated Leg Curl', 3),
      ex('Leg Extension', 3),
      ex('Adduction Machine', 3),
      ex('Calf Press on Leg Press', 3),
      ex('Ab Crunch Machine', 3),
    ]),
    day('pull', 'Pull', 'thu', [
      ex('Chest Supported Machine Row (Pronated)', 2),
      ex('Wide Grip Lat Pull-Down', 2),
      ex('Single Arm Lat Pull-Down (Machine)', 2),
      ex('Seated Cable Row (Close Grip)', 2),
      ex('Rear Delt Fly Machine', 3),
      ex('Seated Dumbbell Curl', 3),
      ex('Seated Dumbbell Hammer Curl', 2),
    ]),
    day('push', 'Push', 'fri', [
      ex('Incline Chest Press Machine', 2),
      ex('Pec Fly Machine', 3),
      ex('Seated Machine Shoulder Press', 2, {
        caution: 'Right shoulder: stop at any front-of-shoulder pinch.',
        swap: 'lateral-raise-machine',
      }),
      ex('Lateral Raise Machine', 3),
      ex('Dip Machine', 2, {
        caution: 'Pain-free range only. Elbows tucked.',
        swap: 'seated-cable-tricep-push-down',
      }),
      ex('Overhead Tricep Extension Machine', 3),
    ]),
  ]);
}

function upperLowerPull() {
  // Runs on a rotation (no fixed weekdays): Upper, Lower, Pull, rest, repeat.
  return split('3-Day Upper / Lower / Pull', [
    day('upper', 'Upper', null, [
      ex('Flat Chest Press Machine', 2),
      ex('Wide Grip Lat Pull-Down', 2),
      ex('Seated Machine Shoulder Press', 2),
      ex('Chest Supported Machine Row (Neutral)', 2),
      ex('Lateral Raise Machine', 3),
      ex('Seated Cable Tricep Push-Down', 2),
    ]),
    day('lower', 'Lower', null, [
      ex('Pendulum Squat', 2, { swap: 'leg-press' }),
      ex('Romanian Deadlift', 2),
      ex('Seated Leg Curl', 3),
      ex('Leg Extension', 3),
      ex('Standing Calf Raise Machine', 3),
      ex('Ab Crunch Machine', 3),
    ]),
    day('pull', 'Pull', null, [
      ex('Chest Supported Machine Row (Pronated)', 2),
      ex('Close Grip Lat Pull-Down', 2),
      ex('Seated Cable Row (Close Grip)', 2),
      ex('Rear Delt Fly Machine', 3),
      ex('Seated Dumbbell Curl', 3),
      ex('Seated Dumbbell Hammer Curl', 2),
    ]),
  ]);
}

function upperLower4() {
  return split('Upper / Lower (4 days)', [
    day('upper-a', 'Upper A', 'mon', [
      ex('Flat Chest Press Machine', 3),
      ex('Wide Grip Lat Pull-Down', 3),
      ex('Seated Machine Shoulder Press', 2),
      ex('Chest Supported Machine Row (Neutral)', 2),
      ex('Seated Cable Tricep Push-Down', 2),
      ex('Seated Dumbbell Curl', 2),
    ]),
    day('lower-a', 'Lower A', 'tue', [
      ex('Pendulum Squat', 3, { swap: 'leg-press' }),
      ex('Seated Leg Curl', 3),
      ex('Leg Extension', 2),
      ex('Standing Calf Raise Machine', 3),
      ex('Ab Crunch Machine', 3),
    ]),
    day('upper-b', 'Upper B', 'thu', [
      ex('Incline Chest Press Machine', 3),
      ex('Chest Supported Machine Row (Pronated)', 3),
      ex('Single Arm Lat Pull-Down (Machine)', 2),
      ex('Lateral Raise Machine', 3),
      ex('Overhead Tricep Extension Machine', 2),
      ex('Machine Preacher Curl', 2),
    ]),
    day('lower-b', 'Lower B', 'fri', [
      ex('Leg Press', 3),
      ex('Romanian Deadlift', 3),
      ex('Lying Leg Curl', 2),
      ex('Hip Thrust Machine', 2),
      ex('Seated Calf Raise Machine', 3),
    ]),
  ]);
}

function pushPullLegs() {
  return split('Push / Pull / Legs (6 days)', [
    day('push-a', 'Push A', 'mon', [
      ex('Flat Chest Press Machine', 3),
      ex('Seated Machine Shoulder Press', 2),
      ex('Pec Fly Machine', 2),
      ex('Lateral Raise Machine', 3),
      ex('Seated Cable Tricep Push-Down', 3),
    ]),
    day('pull-a', 'Pull A', 'tue', [
      ex('Wide Grip Lat Pull-Down', 3),
      ex('Chest Supported Machine Row (Neutral)', 3),
      ex('Rear Delt Fly Machine', 3),
      ex('Seated Dumbbell Curl', 3),
    ]),
    day('legs-a', 'Legs A', 'wed', [
      ex('Pendulum Squat', 3, { swap: 'leg-press' }),
      ex('Seated Leg Curl', 3),
      ex('Leg Extension', 2),
      ex('Standing Calf Raise Machine', 3),
    ]),
    day('push-b', 'Push B', 'thu', [
      ex('Incline Chest Press Machine', 3),
      ex('Seated Dumbbell Shoulder Press', 2),
      ex('Seated Low-to-High Cable Fly', 2),
      ex('Cable Lateral Raise', 3),
      ex('Overhead Tricep Extension Machine', 3),
    ]),
    day('pull-b', 'Pull B', 'fri', [
      ex('Chest Supported Machine Row (Pronated)', 3),
      ex('Single Arm Lat Pull-Down (Machine)', 2),
      ex('Seated Cable Row (Close Grip)', 2),
      ex('Face Pull', 3),
      ex('Seated Dumbbell Hammer Curl', 3),
    ]),
    day('legs-b', 'Legs B', 'sat', [
      ex('Leg Press', 3),
      ex('Romanian Deadlift', 3),
      ex('Lying Leg Curl', 2),
      ex('Adduction Machine', 2),
      ex('Seated Calf Raise Machine', 3),
    ]),
  ]);
}

function fullBody3() {
  return split('Full Body (3 days)', [
    day('full-a', 'Full Body A', 'mon', [
      ex('Pendulum Squat', 2, { swap: 'leg-press' }),
      ex('Flat Chest Press Machine', 2),
      ex('Wide Grip Lat Pull-Down', 2),
      ex('Seated Leg Curl', 2),
      ex('Lateral Raise Machine', 2),
      ex('Seated Cable Tricep Push-Down', 2),
    ]),
    day('full-b', 'Full Body B', 'wed', [
      ex('Leg Press', 2),
      ex('Seated Machine Shoulder Press', 2),
      ex('Chest Supported Machine Row (Neutral)', 2),
      ex('Romanian Deadlift', 2),
      ex('Rear Delt Fly Machine', 2),
      ex('Seated Dumbbell Curl', 2),
    ]),
    day('full-c', 'Full Body C', 'fri', [
      ex('Hack Squat', 2),
      ex('Incline Chest Press Machine', 2),
      ex('Seated Cable Row (Close Grip)', 2),
      ex('Leg Extension', 2),
      ex('Pec Fly Machine', 2),
      ex('Overhead Tricep Extension Machine', 2),
    ]),
  ]);
}

export const TEMPLATES = [
  { id: 'coach-default', name: 'Coach Default', detail: '4 days · Upper, Lower, Pull, Push', build: coachDefault },
  { id: 'ulp-3', name: '3-Day Upper / Lower / Pull', detail: 'Rotation · Upper, Lower, Pull, rest', build: upperLowerPull },
  { id: 'ul-4', name: 'Upper / Lower', detail: '4 days · Upper A, Lower A, Upper B, Lower B', build: upperLower4 },
  { id: 'ppl-6', name: 'Push / Pull / Legs', detail: '6 days', build: pushPullLegs },
  { id: 'fb-3', name: 'Full Body', detail: '3 days · A, B, C', build: fullBody3 },
];
