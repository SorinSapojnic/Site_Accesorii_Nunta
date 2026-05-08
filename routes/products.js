const express     = require('express');
const fs          = require('fs');
const path        = require('path');
const requireAuth = require('../middleware/auth');

const router       = express.Router();
const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');

// ── Citește produsele din fișier ──
function readProducts() {
  const raw  = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
  const data = JSON.parse(raw);
  // Suportă ambele formate: { products: [...] } sau [...]
  return Array.isArray(data) ? data : (data.products || []);
}

// ── Salvează produsele în fișier ──
function writeProducts(products) {
  // Păstrăm meta dacă există
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
  } catch {}
  const out = Array.isArray(existing)
    ? products
    : { ...existing, products, meta: { ...existing.meta, updatedAt: new Date().toISOString(), totalProducts: products.length } };
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(out, null, 2), 'utf-8');
}

// ── GET /api/products ── (public)
router.get('/', (req, res) => {
  try {
    const products = readProducts();
    res.json({ products, total: products.length });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la citirea produselor' });
  }
});

// ── POST /api/products ── (admin)
router.post('/', requireAuth, (req, res) => {
  try {
    const products = readProducts();
    const p = req.body;
    if (!p.title || !p.priceNumeric || !p.category || !p.imgUrl)
      return res.status(400).json({ error: 'Câmpuri obligatorii lipsă' });

    p.id = 'prod_custom_' + Date.now();
    p.price    = p.priceNumeric + 'MDL';
    p.currency = 'MDL';
    products.unshift(p);
    writeProducts(products);
    res.status(201).json({ ok: true, product: p });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la adăugarea produsului' });
  }
});

// ── PUT /api/products/:id ── (admin)
router.put('/:id', requireAuth, (req, res) => {
  try {
    const products = readProducts();
    const idx = products.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Produs negăsit' });

    const updated = { ...products[idx], ...req.body };
    updated.price    = updated.priceNumeric + 'MDL';
    updated.currency = 'MDL';
    products[idx] = updated;
    writeProducts(products);
    res.json({ ok: true, product: updated });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la actualizarea produsului' });
  }
});

// ── DELETE /api/products/:id ── (admin)
router.delete('/:id', requireAuth, (req, res) => {
  try {
    let products = readProducts();
    const before = products.length;
    products = products.filter(x => x.id !== req.params.id);
    if (products.length === before) return res.status(404).json({ error: 'Produs negăsit' });
    writeProducts(products);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la ștergerea produsului' });
  }
});

// ── POST /api/products/import ── (admin – bulk import)
router.post('/import', requireAuth, (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || !products.length)
      return res.status(400).json({ error: 'Format invalid' });
    writeProducts(products);
    res.json({ ok: true, total: products.length });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la import' });
  }
});

module.exports = router;
