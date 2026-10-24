# Coach app repo

Public repo for the Coach workout app, served by GitHub Pages from `main`.
The user's program and logs live in the private `coach-data` repo, not here.

- Plain HTML, CSS and ES modules. No framework, no build step, no npm
  dependencies. Keep the code readable: the owner makes small edits by hand.
- Keep the feature set small. Out of scope: food, body weight, accounts,
  social, cardio, in-app AI, streaks or badges, analytics. Put ideas in IDEAS.md.
- Colors come from the tokens at the top of `css/app.css`. Red and green
  only mean bad and good. Purple is the brand.
- Copy is plain and quiet: no exclamation points, no hype.
- Tap targets are at least 48px; check every screen at 375px wide.
- After changing app files, bump `VERSION` in `sw.js` and add any new file
  to its `SHELL` list.
- Run the tests by serving the folder (`npx http-server .`) and opening
  `/tests.html`. Progression rules live in `js/progression.js`.
