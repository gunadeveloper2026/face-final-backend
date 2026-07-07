const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await User.findOne({ email });
  if (existing) {
    const isPasswordValid = existing.password ? await bcrypt.compare(password, existing.password) : false;
    const needsUpdate = existing.role !== 'admin' || !isPasswordValid;
    if (!needsUpdate) {
      console.log(`Admin user already exists and is up to date: ${email}`);
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    existing.password = hash;
    existing.role = 'admin';
    await existing.save();
    console.log(`Updated admin user credentials and role for: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await User.create({ name: 'Admin', email, password: hash, role: 'admin' });
  console.log(`Seeded admin user: ${email}`);
};

module.exports = seedAdmin;
