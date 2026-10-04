// Cloudflare R2 storage via the S3-compatible API (AWS SigV4, region "auto",
// service "s3"). Activated when all four R2_* vars are present; the endpoint
// can be overridden with R2_ENDPOINT (local testing against a mock).
import crypto from 'node:crypto';

function conf() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secret || !bucket) return null;
  const base = (process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, '');
  return { accountId, accessKeyId, secret, bucket, base, publicBase: (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '') };
}

export function r2Configured() {
  return !!conf();
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function request(method, key, { body = null, contentType = null } = {}) {
  const c = conf();
  if (!c) throw new Error('R2 not configured');
  const host = new URL(c.base).host;
  const p = `/${c.bucket}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body || '');
  const headers = {
    'host': host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;
  const signedKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedKeys.map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const signedHeaders = signedKeys.join(';');
  const canonicalRequest = [method, p, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  let k = hmac('AWS4' + c.secret, dateStamp);
  k = hmac(k, 'auto');
  k = hmac(k, 's3');
  k = hmac(k, 'aws4_request');
  const signature = crypto.createHmac('sha256', k).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetch(c.base + p, {
    method,
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(contentType ? { 'content-type': contentType } : {}),
      'authorization': authorization,
    },
    body: body || undefined,
  });
}

export async function r2Head(key) {
  const res = await request('HEAD', key);
  return res.status === 200;
}

export async function r2Put(key, body, contentType) {
  const res = await request('PUT', key, { body, contentType: contentType || 'application/octet-stream' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`r2 put ${key}: ${res.status} ${detail.slice(0, 160)}`.trim());
  }
}

export async function r2Get(key) {
  const res = await request('GET', key);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`r2 get ${key}: ${res.status}`);
  return res.text();
}

export function r2PublicUrl(key) {
  const c = conf();
  if (!c.publicBase) throw new Error('R2_PUBLIC_BASE not set');
  return `${c.publicBase}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}
