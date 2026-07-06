const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');
const User = require('../models/User');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

const findUserByIdentifier = async (userId) => {
  if (mongoose.Types.ObjectId.isValid(userId)) {
    return User.findById(userId).select('-password');
  }

  let user = await User.findOne({ email: userId }).select('-password');
  if (!user) {
    const regex = new RegExp('^' + escapeRegex(userId) + '$', 'i');
    user = await User.findOne({ name: regex }).select('-password');
  }
  return user;
};

exports.markAttendance = async (req, res) => {
  try {
    const { userId, type } = req.body; // type: checkIn/checkOut
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const user = await findUserByIdentifier(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    let status = 'present';
    if (type === 'checkIn') {
      const lateLimit = new Date(now);
      lateLimit.setHours(9, 0, 0, 0);
      if (now > lateLimit) status = 'late';
    }

    const record = await Attendance.create({
      user: user._id,
      date: now,
      status,
      checkIn: type === 'checkIn' ? now : undefined,
      checkOut: type === 'checkOut' ? now : undefined
    });
    const populated = await record.populate('user', 'name email avatarUrl');

    const io = req.app.get('io');
    if (io) io.emit('attendance:marked', { attendance: populated });

    res.json({ attendance: populated });
  } catch (err) {
    console.error('Attendance mark error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.userHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const filter = { user: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lte = new Date(req.query.to);
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .sort('-date')
        .skip((page - 1) * limit)
        .limit(limit),
      Attendance.countDocuments(filter)
    ]);

    res.json({ records, page, limit, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.user = req.query.userId;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lte = new Date(req.query.to);
    }

    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), 'i');
      const matchedUsers = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id');
      filter.user = { $in: matchedUsers.map((u) => u._id) };
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate('user', 'name email role')
        .sort('-date')
        .skip((page - 1) * limit)
        .limit(limit),
      Attendance.countDocuments(filter)
    ]);

    res.json({ records, page, limit, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminReports = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const results = await Attendance.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.day': 1 } }
    ]);

    const daily = {};
    let lateCount = 0;
    let totalCount = 0;
    results.forEach((row) => {
      const day = row._id.day;
      if (!daily[day]) daily[day] = { present: 0, late: 0, absent: 0 };
      daily[day][row._id.status] = row.count;
      totalCount += row.count;
      if (row._id.status === 'late') lateCount += row.count;
    });

    const monthly = await Attendance.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    res.json({ daily, monthly, lateCount, totalCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminSummary = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    const [totalEmployees, todayCount, lateCount, statusResults, dailyTrendResults] = await Promise.all([
      User.countDocuments(),
      Attendance.countDocuments({ date: { $gte: todayStart, $lt: tomorrowStart } }),
      Attendance.countDocuments({ date: { $gte: todayStart, $lt: tomorrowStart }, status: 'late' }),
      Attendance.aggregate([
        { $match: { date: { $gte: weekStart, $lt: tomorrowStart } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Attendance.aggregate([
        { $match: { date: { $gte: weekStart, $lt: tomorrowStart } } },
        { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }, count: { $sum: 1 } } },
        { $sort: { '_id.day': 1 } }
      ])
    ]);

    const statusCounts = { present: 0, late: 0, absent: 0 };
    statusResults.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    const dailyTrend = [];
    const dayMap = new Map();
    dailyTrendResults.forEach((item) => {
      dayMap.set(item._id.day, item.count);
    });

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const label = date.toISOString().slice(0, 10);
      dailyTrend.push({ day: label, count: dayMap.get(label) || 0 });
    }

    res.json({ totalEmployees, todayCount, lateCount, statusCounts, dailyTrend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportRecords = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.user = req.query.userId;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lte = new Date(req.query.to);
    }

    const records = await Attendance.find(filter).populate('user', 'name email role').sort('-date');
    const rows = ['Name,Email,Role,Status,Check-in,Check-out,Date'];
    records.forEach((rec) => {
      rows.push([
        rec.user.name,
        rec.user.email,
        rec.user.role,
        rec.status,
        rec.checkIn ? rec.checkIn.toISOString() : '',
        rec.checkOut ? rec.checkOut.toISOString() : '',
        rec.date.toISOString()
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    res.send(rows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
