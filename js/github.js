// GitHub REST API (Contents endpoints), called straight from the browser.
// Auth is a fine-grained personal access token scoped to the coach-data repo
// with Contents read and write. The token lives on this device only.

import { getSettings } from './storage.js';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function request(path, options = {}, settings = getSettings()) {
  if (!settings.token) throw new GitHubError('No GitHub token set', 0);
  let res;
  try {
    res = await fetch(API + path, {
      cache: 'no-store',
      ...options,
      headers: { ...headers(settings.token), ...(options.headers || {}) },
    });
  } catch {
    throw new GitHubError('Offline or GitHub unreachable', 0);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    let msg = `GitHub error ${res.status}`;
    try { msg = (await res.json()).message || msg; } catch {}
    throw new GitHubError(msg, res.status);
  }
  return res.status === 204 ? {} : res.json();
}

const contentsPath = (s, path) =>
  `/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${path
    .split('/').map(encodeURIComponent).join('/')}`;

// Base64 that handles any UTF-8 text (btoa alone breaks on non-Latin characters).
function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Returns { text, sha } or null if the file doesn't exist.
export async function getFile(path) {
  const s = getSettings();
  const data = await request(contentsPath(s, path), {}, s);
  if (!data) return null;
  return { text: decode(data.content || ''), sha: data.sha };
}

export async function getJSON(path) {
  const f = await getFile(path);
  return f ? { data: JSON.parse(f.text), sha: f.sha } : null;
}

// Create or update a file. Pass sha when updating.
export async function putFile(path, text, message, sha) {
  const s = getSettings();
  const body = { message, content: encode(text) };
  if (sha) body.sha = sha;
  return request(contentsPath(s, path), { method: 'PUT', body: JSON.stringify(body) }, s);
}

// Write a file whether or not it exists (fetches the current sha first).
export async function upsertFile(path, text, message) {
  const existing = await getFile(path);
  return putFile(path, text, message, existing?.sha);
}

// List a folder. Returns [] if it doesn't exist.
export async function listDir(path) {
  const s = getSettings();
  const data = await request(contentsPath(s, path), {}, s);
  return Array.isArray(data) ? data : [];
}

// Check that the token can read and write the repo.
export async function testConnection(settings) {
  const repo = await request(
    `/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`,
    {},
    settings,
  );
  if (!repo) {
    throw new GitHubError('Repo not found. Check the owner and repo name, and that the token can see this repo.', 404);
  }
  if (repo.permissions && !repo.permissions.push) {
    throw new GitHubError('The token can read this repo but not write to it. Give it Contents: Read and write.', 403);
  }
  return repo;
}
