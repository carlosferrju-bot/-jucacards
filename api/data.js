const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const PATH = 'data/jucacards-data.json';
const BRANCH = 'main';

function configError() {
  return !OWNER || !REPO || !TOKEN;
}

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function url() {
  return `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${PATH}`;
}

function decodeContent(content) {
  return JSON.parse(Buffer.from(String(content).replace(/\n/g, ''), 'base64').toString('utf8'));
}

async function githubFile() {
  const response = await fetch(`${url()}?ref=${encodeURIComponent(BRANCH)}`, {
    method: 'GET',
    headers: headers(),
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub GET ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  return {
    sha: payload.sha,
    data: decodeContent(payload.content),
  };
}

function countData(data) {
  if (!data || typeof data !== 'object') return 0;
  return (Array.isArray(data.cards) ? data.cards.length : 0)
    + (Array.isArray(data.decks) ? data.decks.length : 0)
    + (Array.isArray(data.reviews) ? data.reviews.length : 0);
}

async function saveGithub(data) {
  const current = await githubFile();

  // Never replace an existing non-empty remote database with an empty payload.
  // This protects the user's cards during deployments, reloads and first-time sync.
  if (current && countData(current.data) > 0 && countData(data) === 0) {
    return { protected: true, sha: current.sha };
  }

  const body = {
    message: 'chore: persist JucaCards data',
    content: Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64'),
    branch: BRANCH,
  };

  if (current?.sha) body.sha = current.sha;

  const response = await fetch(url(), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub PUT ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  return { protected: false, sha: payload.content?.sha || null };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (configError()) {
      return res.status(500).json({
        ok: false,
        error: 'GitHub persistence is not configured',
      });
    }

    if (req.method === 'GET') {
      const file = await githubFile();
      if (!file) return res.status(404).json({ ok: true, data: null });
      return res.status(200).json({ ok: true, data: file.data });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ ok: false, error: 'Invalid data' });
      }

      const result = await saveGithub(data);
      if (result.protected) {
        const current = await githubFile();
        return res.status(409).json({
          ok: false,
          protected: true,
          error: 'Remote data was protected from an empty overwrite',
          data: current?.data || null,
        });
      }

      return res.status(200).json({ ok: true, sha: result.sha });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('JucaCards GitHub persistence error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Persistent storage unavailable',
    });
  }
};
