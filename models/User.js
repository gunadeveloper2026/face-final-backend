const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['employee','admin'], default: 'employee' },
  faceEmbedding: { type: Array },
  avatarUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
