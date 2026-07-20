const test = require('node:test');
const assert = require('node:assert/strict');
const { getAiServiceUrls, normalizeAiUrl, createFallbackEmbedding, matchEmbedding } = require('../utils/aiService');

test('normalizes configured service URLs and includes a local fallback', () => {
  process.env.AI_SERVICE_URL = 'https://example.com/';
  process.env.AI_SERVICE_URLS = '';

  const urls = getAiServiceUrls();

  assert.ok(urls.includes('https://example.com/recognize'));
  assert.ok(urls.includes('http://127.0.0.1:6000/recognize'));
});

test('append recognize suffix when missing', () => {
  assert.equal(normalizeAiUrl('https://example.com'), 'https://example.com/recognize');
  assert.equal(normalizeAiUrl('https://example.com/recognize'), 'https://example.com/recognize');
});

test('creates a deterministic fallback embedding and matches it', () => {
  const a = createFallbackEmbedding(Buffer.from('hello-world'));
  const b = createFallbackEmbedding(Buffer.from('hello-world'));
  const c = createFallbackEmbedding(Buffer.from('different-data'));

  assert.equal(a.length, 128);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);

  const matches = matchEmbedding(a, [{ id: 'user-1', embedding: b }]);
  assert.equal(matches[0].id, 'user-1');
  assert.ok(matches[0].distance <= 0.01);
});
