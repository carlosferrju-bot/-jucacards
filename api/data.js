import { put, list } from '@vercel/blob';

const KEY = 'jucacards/data.json';

async function readStored() {
  const { blobs } = await list({ prefix: KEY, limit: 10 });
  const blob = blobs.find(b => b.pathname === KEY) || blobs[0];
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Blob read failed: ${res.status}`);
  return await res.json();
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = await readStored();
      if (data == null) return res.status(404).json({ ok: true, data: null });
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, error: 'Invalid data' });
      const blob = await put(KEY, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        cacheControlMaxAge: 0,
        allowOverwrite: true
      });
      return res.status(200).json({ ok: true, url: blob.url });
    }

    res.setHeader('Allow', 'GET,POST,PUT');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('JucaCards data API error:', err);
    return res.status(500).json({ ok: false, error: 'Persistent storage unavailable' });
  }
}
