FROM mcr.microsoft.com/playwright:v1.62.0-jammy

# The image's CA bundle is stale enough that Node reports a perfectly valid
# Neon certificate as self-signed (confirmed: the same cert verifies fine
# under strict TLS from outside this image). Refreshing it here fixes real
# TLS verification instead of papering over it with DATABASE_SSL_NO_VERIFY.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

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
