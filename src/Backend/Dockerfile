FROM mcr.microsoft.com/playwright:v1.62.0-jammy

# Node bundles its own CA list at compile time and does not read the OS trust
# store on its own -- refreshing the OS certificates alone (a prior version of
# this file) changes nothing for Node. NODE_EXTRA_CA_CERTS is what actually
# makes Node trust the OS bundle too, which is what Neon's (perfectly valid --
# confirmed working under strict TLS from outside this image) certificate
# needs to verify here.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

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
