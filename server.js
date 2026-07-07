require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');

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
    const aiServiceUrl = process.env.AI_SERVICE_URL || null;
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
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000/recognize';
    console.log(`AI service URL: ${aiServiceUrl}`);
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
