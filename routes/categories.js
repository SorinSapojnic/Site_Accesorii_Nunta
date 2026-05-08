const express = require('express');
const fs      = require('fs');
const path    = require('path');
const requireAuth = require('../middleware/auth');

const router   = express.Router();
const CATS_FILE = path.join(__dirname, '../data/categories.json');

function readCats() {
  try { return JSON.parse(fs.readFileSync(CATS_FILE, 'utf8')); }
  catch { return { categories: [] }; }
}
function saveCats(data) {
  fs.writeFileSync(CATS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /api/categories — public
router.get('/', (req, res) => {
  res.json(readCats());
});

// POST /api/categories — adaugă categorie nouă
router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Numele categoriei este obligatoriu' });
  const data = readCats();
  if (data.categories.find(c => c.name === name.trim()))
    return res.status(409).json({ error: 'Categoria există deja' });
  data.categories.push({ name: name.trim(), subcategories: [] });
  saveCats(data);
  res.json({ ok: true, categories: data.categories });
});

// PUT /api/categories/:name — redenumește categoria
router.put('/:name', requireAuth, (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { name: newName } = req.body;
  if (!newName?.trim()) return res.status(400).json({ error: 'Nume invalid' });
  const data = readCats();
  const cat = data.categories.find(c => c.name === oldName);
  if (!cat) return res.status(404).json({ error: 'Categoria nu există' });
  cat.name = newName.trim();
  saveCats(data);
  res.json({ ok: true, categories: data.categories });
});

// DELETE /api/categories/:name — șterge categoria
router.delete('/:name', requireAuth, (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const data = readCats();
  const idx  = data.categories.findIndex(c => c.name === name);
  if (idx === -1) return res.status(404).json({ error: 'Categoria nu există' });
  data.categories.splice(idx, 1);
  saveCats(data);
  res.json({ ok: true, categories: data.categories });
});

// POST /api/categories/:name/subcategories — adaugă subcategorie
router.post('/:name/subcategories', requireAuth, (req, res) => {
  const catName = decodeURIComponent(req.params.name);
  const { name: subName } = req.body;
  if (!subName?.trim()) return res.status(400).json({ error: 'Numele subcategoriei este obligatoriu' });
  const data = readCats();
  const cat  = data.categories.find(c => c.name === catName);
  if (!cat) return res.status(404).json({ error: 'Categoria nu există' });
  if (cat.subcategories.includes(subName.trim()))
    return res.status(409).json({ error: 'Subcategoria există deja' });
  cat.subcategories.push(subName.trim());
  cat.subcategories.sort();
  saveCats(data);
  res.json({ ok: true, categories: data.categories });
});

// DELETE /api/categories/:name/subcategories/:sub — șterge subcategorie
router.delete('/:name/subcategories/:sub', requireAuth, (req, res) => {
  const catName = decodeURIComponent(req.params.name);
  const subName = decodeURIComponent(req.params.sub);
  const data = readCats();
  const cat  = data.categories.find(c => c.name === catName);
  if (!cat) return res.status(404).json({ error: 'Categoria nu există' });
  cat.subcategories = cat.subcategories.filter(s => s !== subName);
  saveCats(data);
  res.json({ ok: true, categories: data.categories });
});

module.exports = router;
