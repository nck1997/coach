# Coach

A personal workout logger built around one idea: progressive overload with a
5 to 8 rep ladder. Open it at the gym, pick today's workout, tap through your
sets, and save. Each session lands as a CSV in a private GitHub repo
(`coach-data`) where Claude can read it and update the program.

Live app: https://nck1997.github.io/coach/

## Install on iPhone

1. Open the live app in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open Coach from the home screen icon. It runs full screen and works offline.

## Connect GitHub (optional)

Without a token, everything stays on the phone and Settings can export all
logs as one CSV. To sync:

1. Create a fine-grained token at https://github.com/settings/personal-access-tokens/new
2. Repository access: **Only select repositories** → `coach-data`
3. Permissions: **Contents → Read and write**
4. In Coach → Settings, paste the token, enter your GitHub username as the
   owner, and tap **Test connection**.

## How progression works

Pick a weight you can do for about 5 reps. Stay there until every working set
hits 8. The next session prefills the weight plus the exercise's increment in
green, and you work back up from 5. The app never suggests going down.
"Hit 8 clean" marks a lift ready to go up by hand. Lateral and rear delt
raises use 12 to 20 with the same logic.

## Code map

No framework and no build step. Plain HTML, CSS and ES modules.

| File | What it does |
|---|---|
| `index.html` | App shell and tab bar |
| `css/app.css` | All styles. Color tokens are at the top. |
| `js/app.js` | Startup, routing, sync on open |
| `js/progression.js` | The 5 to 8 ladder rules (tested in `tests.html`) |
| `js/storage.js` | Everything saved on the phone |
| `js/github.js` | GitHub API calls |
| `js/sync.js` | Pull on open, push on save, the outbox |
| `js/csv.js` | Session CSV format |
| `js/library.js` | Built-in exercise library and default increments |
| `js/templates.js` | Split templates, including Coach Default |
| `js/session.js` | Builds a workout from the split and working weights |
| `js/ui/*.js` | One file per screen |
| `sw.js` | Offline cache. Bump `VERSION` after changing app files. |
| `tests.html` | Open in a browser to run the progression and CSV tests |

## Updating the app

After changing any file, bump `VERSION` in `sw.js` (for example `coach-v2`)
so phones pick up the new version. The phone loads the cached copy instantly
and fetches the update in the background, so changes show on the second open.
