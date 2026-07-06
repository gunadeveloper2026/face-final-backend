const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/face-attendance', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Admin already exists:', email);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  const admin = await User.create({ name: 'Admin', email, password: hash, role: 'admin' });
  console.log('Seeded admin:', admin.email);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
