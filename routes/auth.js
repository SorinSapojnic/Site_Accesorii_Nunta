const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const fs      = require('fs');
const path    = require('path');

const router    = express.Router();
const PASS_FILE = path.join(__dirname, '../data/admin_pass.json');
const SECRET    = () => process.env.JWT_SECRET || 'secret';

// Citește hash-ul parolei (sau generează din .env dacă nu există)
function getPassHash() {
  if (fs.existsSync(PASS_FILE)) {
    return JSON.parse(fs.readFileSync(PASS_FILE, 'utf-8')).hash;
  }
  // Prima rulare: hash din .env sau default
  const plain = process.env.ADMIN_PASSWORD || 'Nunta2024';
  const hash  = bcrypt.hashSync(plain, 10);
  fs.writeFileSync(PASS_FILE, JSON.stringify({ hash }), 'utf-8');
  return hash;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Parola lipsă' });

  const hash  = getPassHash();
  const valid = bcrypt.compareSync(password, hash);
  if (!valid) return res.status(401).json({ error: 'Parolă incorectă' });

  const token = jwt.sign({ role: 'admin' }, SECRET(), { expiresIn: '12h' });
  res.json({ token });
});

// POST /api/auth/change-password
const requireAuth = require('../middleware/auth');
router.post('/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Parola prea scurtă (minim 6 caractere)' });

  const hash = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(PASS_FILE, JSON.stringify({ hash }), 'utf-8');
  res.json({ ok: true });
});

module.exports = router;
