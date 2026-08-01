"use strict";

// App Store Connect API client — only the handful of calls TestFlight
// distribution needs.

const http = require('./http');
const release = require('./release');

const BASE = 'https://api.appstoreconnect.apple.com';

function privateKeyFromEnv() {
  if (!process.env.APP_STORE_CONNECT_PRIVATE_KEY) {
    throw new Error('APP_STORE_CONNECT_PRIVATE_KEY is not set');
  }
  return release.normalizeApiPrivateKey(process.env.APP_STORE_CONNECT_PRIVATE_KEY);
}

function token() {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
  if (!keyId) throw new Error('APP_STORE_CONNECT_KEY_ID is not set');
  if (!issuerId) throw new Error('APP_STORE_CONNECT_ISSUER_ID is not set');

  const now = Math.floor(Date.now() / 1000);
  return http.signJwtEs256(
    { alg: 'ES256', kid: keyId, typ: 'JWT' },
    { iss: issuerId, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' },
    privateKeyFromEnv()
  );
}

async function api(method, pathAndQuery, json) {
  return http.requestJson(BASE + pathAndQuery, {
    method,
    json,
    headers: { Authorization: 'Bearer ' + token() }
  });
}

async function appIdForBundleId(bundleId) {
  const res = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=2`);
  if (!res.data || res.data.length === 0) {
    throw new Error(`App Store Connect has no app with bundle id ${bundleId} (or the API key cannot see it)`);
  }
  return res.data[0].id;
}

async function findBuild(appId, version, buildNumber) {
  const query = [
    `filter[app]=${appId}`,
    `filter[preReleaseVersion.version]=${encodeURIComponent(version)}`,
    `filter[version]=${encodeURIComponent(String(buildNumber))}`,
    'limit=1'
  ].join('&');
  const res = await api('GET', `/v1/builds?${query}`);
  return res.data && res.data[0] ? res.data[0] : null;
}

async function waitForBuild(appId, version, buildNumber, opts) {
  const options = opts || {};
  const timeoutMs = (options.timeoutMinutes || 45) * 60 * 1000;
  const intervalMs = (options.intervalSeconds || 30) * 1000;
  const deadline = Date.now() + timeoutMs;
  let lastState = null;

  while (Date.now() < deadline) {
    const build = await findBuild(appId, version, buildNumber);
    const state = build ? build.attributes.processingState : 'not visible yet';

    if (state !== lastState) {
      console.log(`Build ${version} (${buildNumber}): ${state}`);
      lastState = state;
    }

    if (build) {
      if (state === 'VALID') return build;
      if (state === 'INVALID' || state === 'FAILED') {
        throw new Error(`App Store Connect rejected build ${version} (${buildNumber}): ${state}. Check the email/Activity tab for the reason.`);
      }
    }

    await http.sleep(intervalMs);
  }

  throw new Error(`Timed out after ${options.timeoutMinutes || 45} minutes waiting for build ${version} (${buildNumber}) to finish processing`);
}

async function setWhatsNew(buildId, text, locale) {
  const wanted = locale || 'en-US';
  const trimmed = text.slice(0, 4000);
  const existing = await api('GET', `/v1/builds/${buildId}/betaBuildLocalizations?limit=50`);
  const match = (existing.data || []).find(l => l.attributes.locale === wanted);

  if (match) {
    await api('PATCH', `/v1/betaBuildLocalizations/${match.id}`, {
      data: { type: 'betaBuildLocalizations', id: match.id, attributes: { whatsNew: trimmed } }
    });
  } else {
    await api('POST', '/v1/betaBuildLocalizations', {
      data: {
        type: 'betaBuildLocalizations',
        attributes: { locale: wanted, whatsNew: trimmed },
        relationships: { build: { data: { type: 'builds', id: buildId } } }
      }
    });
  }
  console.log(`Set "What to Test" (${wanted})`);
}


module.exports = {
  token,
  api,
  appIdForBundleId,
  findBuild,
  waitForBuild,
  setWhatsNew
};
