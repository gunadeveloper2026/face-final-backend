const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const faceController = require('../controllers/faceController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const upload = multer({ storage });

router.post('/enroll', authMiddleware, adminOnly, upload.single('image'), faceController.enroll);
router.post('/recognize', authMiddleware, upload.single('image'), faceController.recognize);

module.exports = router;
