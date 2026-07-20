const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getAiServiceUrls, createFallbackEmbedding, matchEmbedding } = require('../utils/aiService');
const { findUserByIdentifier } = require('../utils/userLookup');

const sendAiRequest = async (form, { timeout = 15000 } = {}) => {
  const aiUrls = getAiServiceUrls();
  if (!aiUrls.length) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  let lastError = null;
  for (const aiUrl of aiUrls) {
    try {
      const response = await axios.post(aiUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout,
        validateStatus: () => true,
      });

      if (response.status >= 200 && response.status < 500) {
        return { aiUrl, response };
      }

      lastError = new Error(`AI service returned ${response.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('AI service request failed');
};

exports.enroll = async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path), req.file.originalname);
    let embedding = null;
    try {
      const aiReply = await sendAiRequest(form);
      if (aiReply.response?.data?.error) {
        throw new Error(aiReply.response.data.error);
      }
      embedding = aiReply.response?.data?.embedding;
    } catch (err) {
      console.warn('AI enroll request failed, using fallback embedding', { message: err.message });
      embedding = createFallbackEmbedding(req.file?.buffer || Buffer.from(req.file?.path || 'fallback'));
    }
    if (!embedding) return res.status(500).json({ error: 'No embedding returned from AI service' });
    const user = await findUserByIdentifier(User, userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const updatedUser = await User.findByIdAndUpdate(user._id, { faceEmbedding: embedding, avatarUrl: `/uploads/${req.file.filename}` }, { new: true });
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ user: updatedUser });
  } catch (err) {
    console.error('Enroll error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
};

exports.recognize = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path), req.file.originalname);

    // build gallery from users with embeddings
    const users = await User.find({ faceEmbedding: { $exists: true, $ne: [] } }).select('_id faceEmbedding name email');
    const gallery = users.map(u => ({ id: u._id.toString(), embedding: u.faceEmbedding }));
    form.append('gallery', JSON.stringify(gallery));

    let aiData = null;
    try {
      const aiReply = await sendAiRequest(form);
      if (aiReply.response?.data?.error) {
        throw new Error(aiReply.response.data.error);
      }
      aiData = aiReply.response?.data;
    } catch (err) {
      console.warn('AI recognize request failed, using fallback matching', { message: err.message });
      const embedding = createFallbackEmbedding(req.file?.buffer || Buffer.from(req.file?.path || 'fallback'));
      const users = await User.find({ faceEmbedding: { $exists: true, $ne: [] } }).select('_id faceEmbedding name email');
      const gallery = users.map((u) => ({ id: u._id.toString(), embedding: u.faceEmbedding }));
      const fallbackMatches = matchEmbedding(embedding, gallery);
      const best = fallbackMatches[0] || null;
      const matched = Boolean(best && best.distance <= 0.35);
      aiData = { embedding, matches: fallbackMatches, best, matched };
    }

    const best = aiData.best;
    let matchedUser = null;
    if (best && best.id && aiData.matched) {
      matchedUser = await User.findById(best.id).select('-password');
    }
    res.json({ ai: aiData, user: matchedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
};
