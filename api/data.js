const KEY = 'jucacards/data.json';

async function blobSdk() {
  return await import('@vercel/blob');
}

async function readStored() {
  const { list, get } = await blobSdk();
  const { blobs } = await list({ prefix: KEY, limit: 10, mode: 'expanded' });
  const blob = blobs.find((item) => item.pathname === KEY) || blobs[0];
  if (!blob) return null;

  const result = await get(blob.pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) throw new Error('Blob read failed');

  return await new Response(result.stream).json();
}

module.exports = async function handler(req, res) {
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

      const { put } = await blobSdk();
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
  } catch (error) {
    console.error('JucaCards data API error:', error);
    return res.status(500).json({ ok: false, error: 'Persistent storage unavailable' });
  }
};
