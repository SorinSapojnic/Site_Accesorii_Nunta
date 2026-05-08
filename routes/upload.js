const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const requireAuth = require('../middleware/auth');

const router      = express.Router();
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

// Creează directorul uploads dacă nu există
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sunt acceptate doar fișiere imagine!'));
  },
});

// POST /api/upload — încarcă o imagine, returnează URL-ul relativ
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Niciun fișier primit' });
  const url = '/uploads/' + req.file.filename;
  res.json({ ok: true, url });
});

module.exports = router;
