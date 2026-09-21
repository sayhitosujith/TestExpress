FROM mcr.microsoft.com/playwright:v1.62.0-jammy

WORKDIR /app

COPY src/Backend/package*.json ./src/Backend/
RUN cd src/Backend && npm install --omit=dev

# The backend reaches outside its own folder for code and data the frontend
# also uses — paymentOptions.json (plansDb.js's fallback seed) and the shared
# testrunner modules (testrunner/replay.js) — so both come along at the same
# relative depth `require('../paymentOptions.json')` and
# `require('../../testrunner/selfHeal')` expect.
COPY src/Backend ./src/Backend
COPY src/paymentOptions.json ./src/paymentOptions.json
COPY src/testrunner ./src/testrunner

WORKDIR /app/src/Backend

ENV NODE_ENV=production

CMD ["npm", "start"]
