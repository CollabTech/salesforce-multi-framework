# SMF-4 AC1 — build and static checks before deployment

Commit `7d6b5ea` (+ evidence commit). Host: Linux cloud container, Node v22.22.0, npm 10.9.4. 2026-10-03T21:52:35Z.

```
$ npm ci
$ npm run lint

✖ 1 problem (0 errors, 1 warning)
  0 errors and 1 warning potentially fixable with the `--fix` option.

$ npx vitest run
 Test Files  1 passed (1)
      Tests  3 passed (3)
$ VITE_BUILD_COMMIT=7d6b5ea npm run build
✓ 578 modules transformed.
dist/index.html                   0.40 kB │ gzip:   0.27 kB
✓ built in 4.92s
$ node .agents/skills/experience-ui-bundle-frontend-generate/scripts/verify-rules.mjs src index.html
SUCCESS: No hard-rule violations found in: src index.html
$ PW_CHROMIUM_PATH=<preinstalled chromium> npx playwright test   # ENV-EMULATION-LOCALHOST
  3 passed (3.1s)
```

The single lint warning is in the template's `src/types/globals.d.ts` (unused eslint-disable directive). Template defects fixed here: vitest picked up the Playwright `e2e/` spec (scoped vitest to `src/`); the e2e static server lacked SPA fallback (`serve -s`). The bundle's 500 kB chunk warning comes from the template's dependencies.
