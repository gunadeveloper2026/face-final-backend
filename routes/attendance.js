const express = require('express');
const router = express.Router();
const {
  markAttendance,
  userHistory,
  adminRecords,
  adminReports,
  adminSummary,
  exportRecords
} = require('../controllers/attendanceController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

router.post('/mark', authMiddleware, markAttendance);
router.get('/history', authMiddleware, userHistory);
router.get('/summary', authMiddleware, adminSummary);
router.get('/admin/records', authMiddleware, adminOnly, adminRecords);
router.get('/admin/reports', authMiddleware, adminOnly, adminReports);
router.get('/admin/export', authMiddleware, adminOnly, exportRecords);

module.exports = router;
