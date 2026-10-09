// Cloudflare R2 storage via the S3-compatible API (AWS SigV4, region "auto",
// service "s3"). Activated when R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY and R2_BUCKET are all set. R2_PUBLIC_URL (the bucket's
// public r2.dev URL or custom domain) is needed for uploaded images/videos.
// R2_ENDPOINT overrides the API endpoint (EU-jurisdiction buckets use
// https://<account>.eu.r2.cloudflarestorage.com; also used for local tests).
import crypto from 'node:crypto';

// Values pasted into the Vercel dashboard often carry quotes, spaces or a
// trailing newline; any of those breaks the signature or the bucket name.
function env(name) {
  let s = String(process.env[name] == null ? '' : process.env[name]).trim();
  if (s.length > 1 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) s = s.slice(1, -1).trim();
  return s;
}

const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];

function conf() {
  const accountId = env('R2_ACCOUNT_ID');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secret = env('R2_SECRET_ACCESS_KEY');
  // Accept "my-bucket" as well as a pasted "s3://my-bucket" or "my-bucket/".
  const bucket = env('R2_BUCKET').replace(/^s3:\/\//, '').replace(/\/+$/, '');
  if (!accountId || !accessKeyId || !secret || !bucket) return null;
  const base = (env('R2_ENDPOINT') || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, '');
  return { accountId, accessKeyId, secret, bucket, base, publicBase: (env('R2_PUBLIC_URL') || env('R2_PUBLIC_BASE')).replace(/\/+$/, '') };
}

export function r2Configured() {
  return !!conf();
}

// What is set and what is missing, for the admin status line. Never returns
// a secret value.
export function r2Settings() {
  const missing = REQUIRED.filter((k) => !env(k));
  const c = conf();
  return {
    anySet: missing.length < REQUIRED.length,
    missing,
    publicUrlSet: !!(c && c.publicBase),
    bucket: c ? c.bucket : env('R2_BUCKET') || null,
    endpoint: c ? new URL(c.base).host : null,
  };
}

// An S3/R2 error with a plain-language explanation for the admin.
export class R2Error extends Error {
  constructor(op, key, status, code, message) {
    super(explain(status, code) + ` (R2 ${op} ${key}: ${status}${code ? ' ' + code : ''}${message ? ' - ' + message : ''})`);
    this.status = status;
    this.code = code;
  }
}
function explain(status, code) {
  switch (code) {
    case 'NoSuchBucket': return 'The R2 bucket named in R2_BUCKET does not exist for this account (check the name, or set R2_ENDPOINT for an EU-jurisdiction bucket).';
    case 'InvalidAccessKeyId': return 'R2 does not recognise R2_ACCESS_KEY_ID. Create an R2 API token and copy its Access Key ID.';
    case 'SignatureDoesNotMatch': return 'R2 rejected the signature: R2_SECRET_ACCESS_KEY is wrong (or has extra characters).';
    case 'AccessDenied': return 'The R2 API token is not allowed to do this. Give it "Object Read & Write" on this bucket.';
    case 'Unauthorized': return 'R2 rejected the credentials. Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.';
    default:
      if (status === 401 || status === 403) return 'R2 refused access. Check the API token\'s keys and that it has "Object Read & Write" on this bucket.';
      if (status === 0) return 'Could not reach R2. Check R2_ACCOUNT_ID (and R2_ENDPOINT if set).';
      return 'R2 returned an error.';
  }
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
// SigV4 URI encoding: encodeURIComponent plus the characters it leaves alone.
function enc(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
}

// Exported for tests: builds the signed request without sending it.
export function signRequest(method, key, { body = null, contentType = null, query = {}, now = new Date() } = {}) {
  const c = conf();
  if (!c) throw new Error('R2 not configured');
  const host = new URL(c.base).host;
  const p = `/${c.bucket}${key == null ? '' : '/' + String(key).split('/').map(enc).join('/')}`;
  const qs = Object.keys(query).sort().map((k) => enc(k) + '=' + enc(String(query[k]))).join('&');
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body || '');
  const headers = { 'host': host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['content-type'] = contentType;
  const signedKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedKeys.map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const signedHeaders = signedKeys.join(';');
  const canonicalRequest = [method, p, qs, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  let k = hmac('AWS4' + c.secret, dateStamp);
  k = hmac(k, 'auto');
  k = hmac(k, 's3');
  k = hmac(k, 'aws4_request');
  const signature = crypto.createHmac('sha256', k).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    url: c.base + p + (qs ? '?' + qs : ''),
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(contentType ? { 'content-type': contentType } : {}),
      'authorization': authorization,
    },
  };
}

async function request(method, key, opts = {}) {
  const { url, headers } = signRequest(method, key, opts);
  try {
    return await fetch(url, { method, headers, body: opts.body || undefined, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    throw new R2Error(method, key, 0, '', String(e?.cause?.code || e?.message || e));
  }
}

async function fail(op, key, res) {
  const text = await res.text().catch(() => '');
  const code = (/<Code>([^<]+)<\/Code>/.exec(text) || [])[1] || '';
  const msg = (/<Message>([^<]+)<\/Message>/.exec(text) || [])[1] || '';
  return new R2Error(op, key, res.status, code, msg);
}

export async function r2Head(key) {
  const res = await request('HEAD', key);
  if (res.status === 200) return true;
  if (res.status === 404) return false; // HEAD has no body: a missing bucket shows up on put/get
  throw new R2Error('HEAD', key, res.status, '', '');
}

export async function r2Put(key, body, contentType) {
  const res = await request('PUT', key, { body, contentType: contentType || 'application/octet-stream' });
  if (!res.ok) throw await fail('PUT', key, res);
}

// The object's text, or null only when the object does not exist. Every
// other failure (wrong keys, missing bucket, no permission) THROWS: reading
// it as "empty" would let the next save overwrite everything stored.
export async function r2Get(key) {
  const res = await request('GET', key);
  if (res.ok) return res.text();
  const err = await fail('GET', key, res);
  if (res.status === 404 && err.code !== 'NoSuchBucket') return null;
  throw err;
}

export function r2PublicUrl(key) {
  const c = conf();
  if (!c || !c.publicBase) {
    throw new Error('R2_PUBLIC_URL is not set, so uploaded files would have no public address. In Cloudflare, open the bucket → Settings → Public access, enable the r2.dev URL (or add a custom domain), and set R2_PUBLIC_URL to it.');
  }
  return `${c.publicBase}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}
