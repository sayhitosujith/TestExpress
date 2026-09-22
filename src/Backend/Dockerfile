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

# The performance-testing engine (testrunner/jmeter.js) shells out to a real
# `jmeter`, the same way Playwright above needs real browser binaries — a JRE
# and an unpacked JMeter distribution. JMETER_HOME is set below to the fixed
# path it is unpacked to; the JRE is left to testrunner/jmeter.js's own
# discovery (it already searches /usr/lib/jvm), since apt installs it under a
# directory named after the machine's architecture, not a fixed path this file
# could name in advance.
ARG JMETER_VERSION=5.6.3
RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless wget \
  && wget -q "https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz" -O /tmp/jmeter.tgz \
  && tar -xzf /tmp/jmeter.tgz -C /opt \
  && mv "/opt/apache-jmeter-${JMETER_VERSION}" /opt/jmeter \
  && rm /tmp/jmeter.tgz \
  && apt-get purge -y wget \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*
ENV JMETER_HOME=/opt/jmeter
ENV PATH="${JMETER_HOME}/bin:${PATH}"

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
