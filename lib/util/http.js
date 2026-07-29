"use strict";

// Minimal HTTPS + JWT helpers. Deliberately dependency-free: the publish step
// runs on a fresh runner and the App Store Connect / Google Play APIs are
// plain REST, so pulling in an SDK (or fastlane) would only add moving parts.

const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { URL } = require('url');

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Node 16 bundles OpenSSL 1.1.1, which chokes the first time it parses the
// OpenSSL 3 style /etc/ssl/openssl.cnf that Ubuntu 22.04 ships (it tries to
// dlopen the `providers` section and throws
// ERR_OSSL_DSO_COULD_NOT_LOAD_THE_SHARED_LIBRARY). The failure is one-shot —
// the next call in the same process works — so every signature gets one retry.
function signWithRetry(sign) {
  try {
    return sign();
  } catch (err) {
    if (err && err.code === 'ERR_OSSL_DSO_COULD_NOT_LOAD_THE_SHARED_LIBRARY') {
      return sign();
    }
    throw err;
  }
}

// ES256 (App Store Connect). `ieee-p1363` is the raw r||s encoding JWT wants —
// Node's default DER encoding is rejected by Apple.
function signJwtEs256(header, payload, privateKey) {
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = signWithRetry(() => crypto.createSign('SHA256').update(signingInput).sign({
    key: privateKey,
    dsaEncoding: 'ieee-p1363'
  }));
  return `${signingInput}.${base64url(signature)}`;
}

// RS256 (Google service accounts).
function signJwtRs256(header, payload, privateKey) {
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = signWithRetry(() => crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey));
  return `${signingInput}.${base64url(signature)}`;
}

function request(url, opts) {
  const options = opts || {};
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', reject);

    if (options.bodyFile) {
      const stream = fs.createReadStream(options.bodyFile);
      stream.on('error', reject);
      stream.pipe(req);
    } else {
      if (options.body) req.write(options.body);
      req.end();
    }
  });
}

// Wraps request() with JSON encode/decode and turns any non-2xx into an error
// that actually says what the API complained about.
async function requestJson(url, opts) {
  const options = Object.assign({}, opts);
  const headers = Object.assign({ Accept: 'application/json' }, options.headers);
  let body;

  if (options.json !== undefined) {
    body = JSON.stringify(options.json);
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  } else if (options.body) {
    body = options.body;
  }

  const res = await request(url, Object.assign({}, options, { headers, body }));
  let parsed = null;
  if (res.body) {
    try {
      parsed = JSON.parse(res.body);
    } catch (_) {
      parsed = null;
    }
  }

  if (res.status < 200 || res.status >= 300) {
    const detail = parsed
      ? (parsed.errors ? parsed.errors.map(e => `${e.title || ''}: ${e.detail || ''}`).join('; ')
        : (parsed.error && (parsed.error.message || parsed.error.error_description)) || JSON.stringify(parsed).slice(0, 600))
      : res.body.slice(0, 600);
    const err = new Error(`${options.method || 'GET'} ${url} -> ${res.status}\n  ${detail}`);
    err.status = res.status;
    err.payload = parsed;
    throw err;
  }

  return parsed;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { base64url, signJwtEs256, signJwtRs256, request, requestJson, sleep };
