require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');

const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const orderRoutes     = require('./routes/orders');
const categoryRoutes  = require('./routes/categories');
const uploadRoutes    = require('./routes/upload');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──
app.use('/api/auth',       authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload',    uploadRoutes);

// ── SPA fallback (toate rutele necunoscute → index.html) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n🌸 Accesorii Nuntă – Server pornit`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin.html\n`);
});
