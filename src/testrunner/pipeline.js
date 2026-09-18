// CI pipeline generation for the specs TestExpress emits.
//
// The recorder produces page objects and specs; scripts/review-tests.js files
// them under tests/. What neither does is make them run on their own, and a
// recorded suite that only ever runs when somebody remembers to run it stops
// being a regression suite within about a fortnight. This module emits the
// pipeline that runs them on push, so a recording made this afternoon is
// guarding the branch tomorrow morning.
//
// One module rather than four templates buried in the modal, for the same
// reason ./spec.js is not in TestRunner.jsx: the provider list is going to grow,
// and a YAML heredoc inside a React component is a YAML heredoc nobody can test
// from Node.
//
// Deliberately CommonJS and free of any React or DOM reference, like its
// neighbours — and under the same no-object-spread rule, which is why
// Object.assign appears below in place of `{ ...x }`.

const { envName } = require('./spec');
const { varsOf } = require('./testdata');

// The engines a generated spec can be run under, matching the projects in
// playwright.config.js. Named here rather than imported because that file is a
// runtime config for Playwright and requiring it would drag @playwright/test
// into the browser bundle.
const BROWSERS = [
  { id: 'chromium', label: 'Chromium' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'webkit', label: 'WebKit' },
  { id: 'mobile-chrome', label: 'Pixel 7' },
  { id: 'mobile-safari', label: 'iPhone 14' },
  { id: 'tablet', label: 'iPad' },
];

const TRIGGERS = [
  { id: 'push', label: 'On push', hint: 'Every push to the default branch' },
  { id: 'pr', label: 'On pull request', hint: 'Before a merge, which is where a regression is cheapest to fix' },
  { id: 'nightly', label: 'Nightly', hint: '02:00 UTC — for suites too slow to sit in front of a merge' },
];

const PROVIDERS = [
  { id: 'github', label: 'GitHub Actions', file: '.github/workflows/testexpress.yml', lang: 'yaml' },
  { id: 'gitlab', label: 'GitLab CI', file: '.gitlab-ci.yml', lang: 'yaml' },
  { id: 'azure', label: 'Azure Pipelines', file: 'azure-pipelines.yml', lang: 'yaml' },
  { id: 'jenkins', label: 'Jenkins', file: 'Jenkinsfile', lang: 'groovy' },
];

// Pinned rather than floating. A container image or an action resolved at "v1"
// changes underneath a suite that has not been touched, and a pipeline that
// broke overnight without a commit is the least debuggable failure there is.
//
// The tag must match the @playwright/test in package.json, not merely be recent.
// The image ships browser binaries built for its own version, and `npm ci`
// inside it then installs whatever the manifest says: mismatch them and every
// job dies on "Executable doesn't exist at .../chromium-XXXX", which reads as a
// broken image rather than a version disagreement. GitLab and Jenkins run in
// this container, so they are the two that pay for it. Move this and the
// devDependency together.
const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.62.0-noble';

// Matches the root package.json's `engines.node`. It has to: `npm ci` is the
// first thing every generated pipeline runs, and installing a Node the project
// declares it does not support makes the run's opening line a warning about
// itself — or an outright failure the day anyone sets engine-strict.
//
// Kept as a literal rather than read from package.json, because this module is
// loaded both by the browser bundle and by scripts/review-tests.js from Node,
// and importing the manifest to learn one string would put the whole thing in
// the bundle. Move the two together.
const NODE_VERSION = '22';

/**
 * The environment variables a generated spec reads for its secrets.
 *
 * Derived from the data set rather than guessed, so the pipeline declares
 * exactly the secrets these tests actually need. A secret is never written into
 * a spec file — see dataBlock in ./spec — so without these the suite runs with
 * empty passwords and fails on the login step, which looks like a broken app.
 */
function secretEnv(set) {
  return varsOf(set)
    .filter((v) => v && v.secret && v.key)
    .map((v) => envName(v.key));
}

const listOf = (values) => `[${values.join(', ')}]`;

/**
 * A string as a YAML double-quoted scalar.
 *
 * JSON.stringify, because YAML's double-quoted style takes JSON's escapes — so
 * this is exact rather than approximately right.
 *
 * Every value that reaches the templates from a text box goes through this. The
 * branch name is typed by hand, and unquoted it broke the file in three
 * different ways: a `#` started a YAML comment and truncated the sequence, a
 * newline ended it, and a comma turned `[a,b]` into two branches — which is the
 * dangerous one, because it produces a perfectly valid pipeline that watches
 * something nobody asked for.
 */
const yamlStr = (v) => JSON.stringify(String(v == null ? '' : v));

// The grep argument, when the suite is filtered to a tag. Kept as one helper
// because all four providers need the identical string and a tag spelled with
// the "@" in one of them and without it in another silently matches nothing.
//
// Folded to the characters a tag can actually contain (see normTag in ./spec)
// rather than trusted: this lands inside a shell command in every provider, and
// in a single-quoted Groovy string in the Jenkins one, where a stray quote would
// end the string early.
const grepArg = (tag) => {
  const clean = String(tag == null ? '' : tag)
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._-]/g, '');
  return clean ? ` --grep @${clean}` : '';
};

// The worker argument, for the same reason grepArg is one helper: all four
// providers run the identical command and it must not drift between them.
//
// Written out in both directions rather than omitted for the parallel case.
// Playwright's own default is half the runner's cores, so leaving the flag off
// would make Sequential the only setting that changed anything and Parallel a
// label over whatever the runner happened to do — and on a 2-core hosted runner
// that default is one worker, which is the setting the user did not pick.
//
// A percentage rather than a count because the runner's size is not knowable
// from here: a 2-core hosted runner and a 16-core self-hosted one both mean
// "all of them" by Parallel, and a hardcoded 4 would over-subscribe the first
// and waste most of the second.
//
// Note this is the same flag `npm run test:e2e` uses locally, deliberately — a
// suite that passes on your machine and fails in CI should not have the worker
// count as one of the differences to rule out.
const workersArg = (parallel) => (parallel ? ' --workers=100%' : ' --workers=1');

// ---- GitHub Actions -------------------------------------------------------

function github(opts) {
  const browsers = opts.browsers;
  const secrets = opts.secrets;
  const on =
    opts.trigger === 'nightly'
      ? `on:\n  schedule:\n    - cron: '0 2 * * *'\n  workflow_dispatch:\n`
      : opts.trigger === 'pr'
        ? `on:\n  pull_request:\n  workflow_dispatch:\n`
        : `on:\n  push:\n    branches: [${yamlStr(opts.branch)}]\n  workflow_dispatch:\n`;

  // workflow_dispatch on every variant on purpose: the first thing anyone wants
  // after committing a pipeline is to run it once without inventing a commit.
  const env = [`          BASE_URL: \${{ vars.BASE_URL }}`]
    .concat(secrets.map((name) => `          ${name}: \${{ secrets.${name} }}`))
    .join('\n');

  return `# Runs the tests TestExpress generated from your recordings.
#
# Set BASE_URL as a repository *variable* (Settings -> Secrets and variables ->
# Actions -> Variables) to point the suite at a deployed environment.${
    secrets.length
      ? `\n# Add ${secrets.length === 1 ? 'this secret' : 'these secrets'} on the same page, under Secrets:\n${secrets.map((s) => `#   ${s}`).join('\n')}`
      : ''
  }
name: TestExpress

${on}
# Two runs of the same suite must not fight over the same records in a shared
# environment, so a second push waits for the first rather than doubling up.
concurrency:
  group: testexpress-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      # One engine failing must not cancel the others — "passes in Chromium,
      # fails in WebKit" is the finding, and fail-fast hides it.
      fail-fast: false
      matrix:
        project: ${listOf(browsers)}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '${NODE_VERSION}'
          cache: npm

      - run: npm ci

      # --with-deps because the runner is a bare container: the browser binary
      # alone will not start without the system libraries it links against.
      - run: npx playwright install --with-deps \${{ matrix.project }}

      - run: npx playwright test --project=\${{ matrix.project }}${grepArg(opts.tag)}${workersArg(opts.parallel)}
        env:
${env}

      # if: always() — the report is worth most precisely when the step above
      # failed, and the default would skip this on exactly that run.
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-\${{ matrix.project }}
          path: playwright-report/
          retention-days: 14
`;
}

// ---- GitLab CI ------------------------------------------------------------

function gitlab(opts) {
  const rules =
    opts.trigger === 'nightly'
      ? `  rules:\n    - if: $CI_PIPELINE_SOURCE == "schedule"\n    - if: $CI_PIPELINE_SOURCE == "web"\n`
      : opts.trigger === 'pr'
        ? `  rules:\n    - if: $CI_PIPELINE_SOURCE == "merge_request_event"\n`
        // The whole expression is quoted, not just the branch inside it.
        // Quoting only the branch leaves the value a YAML *plain* scalar, and a
        // branch containing ": " then ends the scalar early and breaks the file
        // — the one case that survived quoting the branch alone.
        : `  rules:\n    - if: ${yamlStr(`$CI_COMMIT_BRANCH == "${opts.branch}"`)}\n`;

  const env = opts.secrets.length
    ? `# Add ${opts.secrets.length === 1 ? 'this variable' : 'these variables'} under Settings -> CI/CD -> Variables, masked:\n${opts.secrets.map((s) => `#   ${s}`).join('\n')}\n`
    : '';

  return `# Runs the tests TestExpress generated from your recordings.
#
# Set BASE_URL under Settings -> CI/CD -> Variables to point at a deployed
# environment.
${env}${opts.trigger === 'nightly' ? '# Add the schedule itself under CI/CD -> Schedules; this file only says\n# which pipeline a schedule should run.\n' : ''}
stages:
  - e2e

e2e:
  stage: e2e
  # The official image ships the browsers and their system libraries, so there
  # is no install step to go stale against the pinned Playwright version.
  image: ${PLAYWRIGHT_IMAGE}
  timeout: 30 minutes
  parallel:
    matrix:
      - PROJECT: ${listOf(opts.browsers)}
${rules}  script:
    - npm ci
    - npx playwright test --project=$PROJECT${grepArg(opts.tag)}${workersArg(opts.parallel)}
  artifacts:
    # on_failure would be wrong: a flaky pass is worth a trace too, and the
    # trace is deleted with the runner the moment the job ends.
    when: always
    expire_in: 14 days
    paths:
      - playwright-report/
    reports:
      junit: results.xml
`;
}

// ---- Azure Pipelines ------------------------------------------------------

function azure(opts) {
  const trigger =
    opts.trigger === 'nightly'
      ? `trigger: none\npr: none\nschedules:\n  - cron: '0 2 * * *'\n    displayName: Nightly\n    branches:\n      include: [${yamlStr(opts.branch)}]\n    always: true\n`
      : opts.trigger === 'pr'
        ? `trigger: none\npr:\n  branches:\n    include: [${yamlStr(opts.branch)}]\n`
        : `trigger:\n  branches:\n    include: [${yamlStr(opts.branch)}]\npr: none\n`;

  // `env` is a sibling of `script` inside the same list item, so it sits at the
  // item's own indent — four spaces, not the eight a nested mapping would take.
  // Indented deeper it is not a step property at all, and Azure rejects the file
  // before running anything.
  const env = opts.secrets.length
    ? `\n    env:\n${opts.secrets.map((s) => `      ${s}: $(${s})`).join('\n')}`
    : '';

  return `# Runs the tests TestExpress generated from your recordings.
#
# BASE_URL is read from a variable group or a pipeline variable.${
    opts.secrets.length
      ? `\n# Add ${opts.secrets.length === 1 ? 'this secret variable' : 'these secret variables'} to the pipeline, marked secret:\n${opts.secrets.map((s) => `#   ${s}`).join('\n')}`
      : ''
  }
${trigger}
pool:
  vmImage: ubuntu-latest

strategy:
  matrix:
${opts.browsers.map((b) => `    ${b.replace(/-/g, '_')}:\n      project: ${b}`).join('\n')}

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '${NODE_VERSION}'
    displayName: Node ${NODE_VERSION}

  - script: npm ci
    displayName: Install

  - script: npx playwright install --with-deps $(project)
    displayName: Browsers

  - script: npx playwright test --project=$(project)${grepArg(opts.tag)}${workersArg(opts.parallel)}
    displayName: Test $(project)${env}

  # condition: always() — the report matters most on the run that failed.
  - task: PublishPipelineArtifact@1
    condition: always()
    inputs:
      targetPath: playwright-report
      artifact: playwright-report-$(project)
`;
}

// ---- Jenkins --------------------------------------------------------------

function jenkins(opts) {
  const triggers =
    opts.trigger === 'nightly'
      ? `  triggers { cron('0 2 * * *') }\n`
      : opts.trigger === 'pr'
        ? `  // Driven by the Multibranch job's PR discovery rather than a trigger here.\n`
        : `  triggers { pollSCM('H/5 * * * *') }\n`;

  const creds = opts.secrets.length
    ? `\n    // Each of these is a Jenkins credential of kind "Secret text".\n${opts.secrets
        .map((s) => `    ${s} = credentials('${s.toLowerCase().replace(/_/g, '-')}')`)
        .join('\n')}`
    : '';

  return `// Runs the tests TestExpress generated from your recordings.
//
// The agent is the official Playwright image, so the browsers and the system
// libraries they need are already present and pinned with it.
pipeline {
  agent {
    docker {
      image '${PLAYWRIGHT_IMAGE}'
      // Jenkins runs the container as its own uid; without a writable HOME the
      // npm cache has nowhere to go and the install fails on a permission error.
      args '-u root:root'
    }
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

${triggers}
  environment {
    BASE_URL = "\${env.BASE_URL ?: 'http://localhost:3000'}"${creds}
  }

  stages {
    stage('Install') {
      steps { sh 'npm ci' }
    }
${opts.browsers
  .map(
    (b) => `    stage('Test — ${b}') {
      steps { sh 'npx playwright test --project=${b}${grepArg(opts.tag)}${workersArg(opts.parallel)}' }
    }`,
  )
  .join('\n')}
  }

  post {
    // always, not failure: a trace from a run that passed flakily is the one
    // that explains the next failure.
    always {
      archiveArtifacts artifacts: 'playwright-report/**', allowEmptyArchive: true
    }
  }
}
`;
}

const EMIT = { github, gitlab, azure, jenkins };

/**
 * The pipeline file for one provider.
 *
 * @param {string} providerId one of PROVIDERS
 * @param {object} opts `{ browsers, trigger, tag, branch, set, parallel }` —
 *   `set` is the test data set the suite runs against, read only for which of
 *   its values are secret and therefore have to arrive from the CI secret
 *   store; `parallel` is whether the job uses every core or one worker.
 * @returns {{file: string, lang: string, source: string}}
 */
function toPipeline(providerId, opts) {
  const provider = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];
  const settings = {
    // Never an empty matrix: a pipeline that runs no engine is a green tick
    // that tested nothing, which is worse than no pipeline at all.
    browsers: opts && opts.browsers && opts.browsers.length ? opts.browsers : ['chromium'],
    trigger: (opts && opts.trigger) || 'push',
    tag: (opts && opts.tag) || '',
    branch: (opts && opts.branch) || 'main',
    secrets: secretEnv(opts && opts.set),
    // Defaulted on, matching the local `npm run test:e2e` script: a caller that
    // says nothing gets the faster of the two, and the slow one is a choice
    // somebody made rather than one they inherited.
    parallel: !opts || opts.parallel !== false,
  };
  return {
    file: provider.file,
    lang: provider.lang,
    source: EMIT[provider.id](settings),
  };
}

module.exports = { BROWSERS, PROVIDERS, TRIGGERS, secretEnv, toPipeline };
