const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');

exports.enroll = async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path), req.file.originalname);
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000/recognize';
    const aiRes = await axios.post(aiUrl, form, { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity });
    if (aiRes.data.error) return res.status(500).json({ error: aiRes.data.error });
    const embedding = aiRes.data.embedding;
    if (!embedding) return res.status(500).json({ error: 'No embedding returned from AI service' });
    // support passing email or name string instead of an ObjectId
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findByIdAndUpdate(userId, { faceEmbedding: embedding, avatarUrl: `/uploads/${req.file.filename}` }, { new: true });
    } else {
      // try email first
      user = await User.findOneAndUpdate({ email: userId }, { faceEmbedding: embedding, avatarUrl: `/uploads/${req.file.filename}` }, { new: true });
      // then try name (case-insensitive)
      if (!user) {
        const regex = new RegExp('^' + escapeRegex(userId) + '$', 'i');
        user = await User.findOneAndUpdate({ name: regex }, { faceEmbedding: embedding, avatarUrl: `/uploads/${req.file.filename}` }, { new: true });
      }
    }
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('Enroll error:', err);
    res.status(500).json({ error: err.message });
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

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000/recognize';
    const aiRes = await axios.post(aiUrl, form, { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity });
    if (aiRes.data.error) return res.status(500).json({ error: aiRes.data.error });

    const best = aiRes.data.best;
    let matchedUser = null;
    if (best && best.id && aiRes.data.matched) {
      matchedUser = await User.findById(best.id).select('-password');
    }
    res.json({ ai: aiRes.data, user: matchedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
