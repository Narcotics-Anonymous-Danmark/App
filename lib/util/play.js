"use strict";

// Google Play Developer API v3 client — service-account auth, bundle upload,
// track assignment, commit. Dependency-free on purpose: this replaces what
// fastlane's supply would do, in ~100 lines we can read.

const fs = require('fs');
const http = require('./http');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_BASE = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

function serviceAccount() {
  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('PLAY_SERVICE_ACCOUNT_JSON is not set');
  let json;
  try {
    json = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch (_) {
    throw new Error('PLAY_SERVICE_ACCOUNT_JSON is neither JSON nor base64-encoded JSON');
  }
  if (!json.client_email || !json.private_key) {
    throw new Error('PLAY_SERVICE_ACCOUNT_JSON has no client_email/private_key — is it a service account key?');
  }
  return json;
}

async function accessToken() {
  const account = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = http.signJwtRs256(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600
    },
    account.private_key.replace(/\\n/g, '\n')
  );

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  }).toString();

  const res = await http.requestJson(TOKEN_URL, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  });

  return res.access_token;
}

function client(token, packageName) {
  const auth = { Authorization: 'Bearer ' + token };
  const app = `${BASE}/applications/${encodeURIComponent(packageName)}`;

  return {
    async insertEdit() {
      const res = await http.requestJson(`${app}/edits`, { method: 'POST', headers: auth, json: {} });
      return res.id;
    },

    async uploadBundle(editId, aabPath) {
      const size = fs.statSync(aabPath).size;
      const url = `${UPLOAD_BASE}/applications/${encodeURIComponent(packageName)}/edits/${editId}/bundles?uploadType=media`;
      const res = await http.request(url, {
        method: 'POST',
        headers: Object.assign({}, auth, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': size
        }),
        bodyFile: aabPath
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Bundle upload failed (${res.status}): ${res.body.slice(0, 600)}`);
      }
      return JSON.parse(res.body);
    },

    async updateTrack(editId, track, release) {
      return http.requestJson(`${app}/edits/${editId}/tracks/${encodeURIComponent(track)}`, {
        method: 'PUT',
        headers: auth,
        json: { track, releases: [release] }
      });
    },

    async commit(editId) {
      return http.requestJson(`${app}/edits/${editId}:commit`, { method: 'POST', headers: auth, json: {} });
    },

    async deleteEdit(editId) {
      return http.requestJson(`${app}/edits/${editId}`, { method: 'DELETE', headers: auth });
    }
  };
}

module.exports = { accessToken, client, serviceAccount };
