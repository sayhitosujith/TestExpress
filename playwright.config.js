// Runs the specs that scripts/review-tests.js generates from TestExpress
// recordings. A reviewer reads them on the pull request; this is what lets them
// also run one before saying it looks fine.
//
// @playwright/test is a root devDependency, pinned to the same 1.62.0 that
// src/Backend uses for the real-browser recording engine — one version means one
// driver and one browser download rather than two of each.
//
//   npm run tests:review -- <export.json>   generate specs into ./tests
//   npm run test:e2e                        run them, one worker per core
//
// Installs need `legacy-peer-deps`, which the committed .npmrc supplies — see the
// note in that file. Nothing to pass by hand, here or in CI.
//
// The projects below are the engines and devices the in-app runner offers, so
// "does this pass in Safari" and "does it pass on a phone" are both answerable
// here. They run concurrently with each other — a project is just more work in
// the same worker queue, so nothing extra is needed to fan out across all six.
//
//   npx playwright test --project=webkit
//   npx playwright test --grep @smoke      (tags are in each spec's title)

const { defineConfig, devices } = require('@playwright/test');

// Every generated spec reads BASE_URL itself, so this only has to agree with
// them — a spec is portable to staging with BASE_URL and nothing else.
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// Whether the app under test is this machine's, and therefore ours to start.
// An explicit BASE_URL means somebody is pointing the suite somewhere that is
// already running, so `webServer` below has to stay out of it.
const OWN_APP = !process.env.BASE_URL;

module.exports = defineConfig({
  testDir: './tests',
  // Recorded UI flows are order-dependent far more often than their authors
  // intend; a fully parallel first run mostly produces noise to triage.
  //
  // This is narrower than it looks. Spec *files* already run concurrently —
  // that is `workers`, not this — and one recording generates one file holding
  // one test, so the ordinary suite is fully parallel regardless. All this
  // governs is several tests inside one file, which here means exactly one
  // thing: a data-driven recording, whose rows run one after another.
  //
  // Opt a row table in per file rather than flipping this, so the cautious
  // default survives for everything that has not been checked:
  //
  //   test.describe.configure({ mode: 'parallel' });
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // A generated selector is the first thing to rot, and the trace is what
    // tells a reviewer whether the step or the app is at fault.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Starting the app is part of running the suite, so this does it rather than
  // leaving a second terminal as a prerequisite nothing enforces — the failure
  // when you forget is every spec timing out on a blank page, which reads as
  // the app being broken rather than absent.
  //
  // `npm run dev` and not `npm start`: the generated specs drive the real app,
  // and the app calls its own backend. A frontend started on its own serves
  // pages whose every request fails, which is a slower way to learn the same
  // thing.
  //
  // Undefined when BASE_URL names somewhere else — booting a local CRA in order
  // to test staging would cost two minutes and then test the wrong app.
  webServer: OWN_APP
    ? {
        command: 'npm run dev',
        url: BASE_URL,
        // A developer who already has `npm run dev` up is not someone to fight
        // with; CI has no such server and must always start its own.
        reuseExistingServer: !process.env.CI,
        // A cold CRA start on this tree is minutes rather than seconds, and the
        // default 60s expires while webpack is still bundling.
        timeout: 240_000,
      }
    : undefined,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Phone and tablet emulation — the same devices the in-app runner offers
    // (src/Backend/routes/testrunner.js), so a recording made against a Pixel
    // there is replayable here without editing the spec.
    //
    // These carry viewport, device pixel ratio, user agent and touch support,
    // which is the part a narrow desktop window cannot fake: a control that
    // handles click but not touch passes resized and fails here.
    //
    //   npx playwright test --project=mobile-chrome
    //
    // No Firefox counterpart deliberately: Playwright does not support mobile
    // emulation on Gecko, and a project that silently ran desktop-with-a-small-
    // window would make "passes on mobile Firefox" mean nothing.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] } },
  ],
});
