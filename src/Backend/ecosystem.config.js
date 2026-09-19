// PM2 process definition for the backend on the VPS.
//
// `npm start` (= `node index.js`) works fine standalone, but a named,
// version-controlled process definition is what makes `pm2 restart
// testexpress-backend` in deploy.sh reliable across reboots and across
// whoever is running the redeploy.
//
// First-time setup on the box:
//   cd src/Backend && pm2 start ecosystem.config.js && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "testexpress-backend",
      script: "index.js",
      cwd: __dirname,
      // .env is read by the app itself via dotenv (see index.js); PM2 does not
      // need to inject anything here as long as .env sits next to index.js.
      env: {
        NODE_ENV: "production",
      },
      // Playwright/WebdriverIO test runs can be memory-heavy; restart rather
      // than sit wedged if a run leaks past this instead of hanging forever.
      max_memory_restart: "1G",
    },
  ],
};
