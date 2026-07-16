require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');

const normalizeAiUrl = (url) => {
  if (!url) return null;
  const trimmed = url.replace(/\/+$|\s+$/g, '');
  return trimmed.endsWith('/recognize') ? trimmed : `${trimmed}/recognize`;
};

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'face-attendance-backend' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

const faceRoutes = require('./routes/face');
app.use('/api/face', faceRoutes);

const attendanceRoutes = require('./routes/attendance');
app.use('/api/attendance', attendanceRoutes);

const userRoutes = require('./routes/user');
app.use('/api/users', userRoutes);

app.get('/api/debug/admin', async (req, res) => {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const aiServiceUrl = normalizeAiUrl(process.env.AI_SERVICE_URL) || null;
    const user = await User.findOne({ email });
    return res.json({
      adminEmail: email,
      adminExists: !!user,
      role: user?.role || null,
      hasPassword: !!user?.password,
      aiServiceUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/ai', async (req, res) => {
  const aiServiceUrl = normalizeAiUrl(process.env.AI_SERVICE_URL);
  if (!aiServiceUrl) {
    return res.status(500).json({
      error: 'AI_SERVICE_URL is not configured. Set the env var to your deployed AI recognize endpoint.',
    });
  }

  try {
    const response = await axios.options(aiServiceUrl, { timeout: 5000 });
    return res.json({
      aiServiceUrl,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'AI service check failed',
      message: err.message,
      aiServiceUrl,
      response: err.response?.data || err.response?.statusText || null,
    });
  }
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

const connectDB = require('./config/db');
const seedAdmin = require('./config/seedAdmin');

connectDB()
  .then(async () => {
    await seedAdmin();
    const aiServiceUrl = normalizeAiUrl(process.env.AI_SERVICE_URL);
    if (!aiServiceUrl) {
      console.warn('WARNING: AI_SERVICE_URL is not configured. Face enroll/recognize routes will fail until this env var is set.');
    } else {
      console.log(`AI service URL: ${aiServiceUrl}`);
    }
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('DB connect error', err);
  });

// Basic socket logging
io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected', socket.id));
});
