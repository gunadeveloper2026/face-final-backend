const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

router.get('/', authMiddleware, adminOnly, async (req, res) => {
  const users = await User.find().select('-password');
  res.json({ users });
});

router.patch('/:id/role', authMiddleware, adminOnly, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
});

module.exports = router;
