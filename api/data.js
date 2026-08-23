import { put, list, get } from '@vercel/blob';

const KEY = 'jucacards/data.json';

async function readStored() {
  const { blobs } = await list({ prefix: KEY, limit: 10, mode: 'expanded' });
  const blob = blobs.find((b) => b.pathname === KEY) || blobs[0];
  if (!blob) return null;

  const result = await get(blob.pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) throw new Error('Blob read failed');

  const response = new Response(result.stream);
  return await response.json();
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
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ ok: false, error: 'Invalid data' });
      }

      const blob = await put(KEY, JSON.stringify(data), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: true,
      });

      return res.status(200).json({ ok: true, pathname: blob.pathname });
    }

    res.setHeader('Allow', 'GET,POST,PUT');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('JucaCards data API error:', err);
    return res.status(500).json({ ok: false, error: 'Persistent storage unavailable' });
  }
}
