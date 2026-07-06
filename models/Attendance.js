const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present','absent','late'], default: 'present' },
  checkIn: { type: Date },
  checkOut: { type: Date }
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
