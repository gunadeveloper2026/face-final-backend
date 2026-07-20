const crypto = require('crypto');

const normalizeAiUrl = (url) => {
  if (!url) return null;
  const trimmed = String(url).trim().replace(/\/+$/g, '');
  return trimmed.endsWith('/recognize') ? trimmed : `${trimmed}/recognize`;
};

const getAiServiceUrls = () => {
  const configured = [process.env.AI_SERVICE_URL, process.env.AI_SERVICE_URLS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(',').map((item) => item.trim()).filter(Boolean));

  const unique = [];
  const seen = new Set();

  const addUrl = (url) => {
    const normalized = normalizeAiUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    unique.push(normalized);
  };

  configured.forEach(addUrl);

  const localCandidates = [
    'http://127.0.0.1:6000/recognize',
    'http://localhost:6000/recognize',
    'http://127.0.0.1:5000/recognize',
    'http://localhost:5000/recognize',
  ];

  localCandidates.forEach(addUrl);

  return unique;
};

const createFallbackEmbedding = (buffer) => {
  const hash = crypto.createHash('sha256').update(buffer).digest();
  const values = [];
  for (let i = 0; i < 128; i += 1) {
    const byte = hash[i % hash.length];
    values.push(((byte / 255) * 2 - 1).toFixed(6));
  }
  return values.map(Number);
};

const matchEmbedding = (embedding, gallery, threshold = 0.35) => {
  const results = gallery.map((entry) => {
    const vec = entry.embedding || entry.vector || [];
    if (!Array.isArray(vec) || !vec.length) {
      return { id: entry.id || entry.userId || entry.user, distance: Infinity };
    }
    const distance = vec.reduce((sum, value, index) => {
      const diff = (value || 0) - (embedding[index] || 0);
      return sum + diff * diff;
    }, 0);
    return { id: entry.id || entry.userId || entry.user, distance: Math.sqrt(distance) };
  });

  results.sort((a, b) => a.distance - b.distance);
  return results;
};

module.exports = {
  normalizeAiUrl,
  getAiServiceUrls,
  createFallbackEmbedding,
  matchEmbedding,
};
