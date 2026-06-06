const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'j4cks-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// DB simple JSON
const DB_PATH = './data/db.json';
if (!fs.existsSync('./data')) fs.mkdirSync('./data');
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const init = { vehicles: [], reservations: [], contracts: [], users: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

// AUTH MIDDLEWARE
function requireAdmin(req, res, next) {
  if (req.session.role === 'admin' || req.session.role === 'superadmin') return next();
  res.status(401).json({ error: 'Non autorisé' });
}
function requireSuperAdmin(req, res, next) {
  if (req.session.role === 'superadmin') return next();
  res.status(401).json({ error: 'Super admin requis' });
}

// ─── AUTH ROUTES ───
app.post('/api/login', (req, res) => {
  const { password, role } = req.body;
  if (role === 'superadmin' && password === (process.env.SUPERADMIN_PASSWORD || 'super2024')) {
    req.session.role = 'superadmin';
    return res.json({ ok: true, role: 'superadmin' });
  }
  if (role === 'admin' && password === (process.env.ADMIN_PASSWORD || 'admin2024')) {
    req.session.role = 'admin';
    return res.json({ ok: true, role: 'admin' });
  }
  res.status(401).json({ error: 'Mot de passe incorrect' });
});
app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ role: req.session.role || null }));

// ─── VEHICLES ───
app.get('/api/vehicles', (req, res) => res.json(loadDB().vehicles));
app.post('/api/vehicles', requireAdmin, (req, res) => {
  const db = loadDB();
  const v = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  db.vehicles.push(v);
  saveDB(db);
  res.json(v);
});
app.put('/api/vehicles/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.vehicles = db.vehicles.map(v => v.id === req.params.id ? { ...v, ...req.body } : v);
  saveDB(db);
  res.json({ ok: true });
});
app.delete('/api/vehicles/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.vehicles = db.vehicles.filter(v => v.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ─── RESERVATIONS ───
app.get('/api/reservations', requireAdmin, (req, res) => res.json(loadDB().reservations));
app.post('/api/reservations', (req, res) => {
  const db = loadDB();
  const r = { id: Date.now().toString(), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
  db.reservations.push(r);
  saveDB(db);
  res.json(r);
});
app.put('/api/reservations/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.reservations = db.reservations.map(r => r.id === req.params.id ? { ...r, ...req.body } : r);
  saveDB(db);
  res.json({ ok: true });
});

// ─── CONTRACTS ───
app.get('/api/contracts', requireAdmin, (req, res) => res.json(loadDB().contracts));
app.post('/api/contracts', requireAdmin, (req, res) => {
  const db = loadDB();
  const c = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  db.contracts.push(c);
  saveDB(db);
  res.json(c);
});
app.delete('/api/contracts/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.contracts = db.contracts.filter(c => c.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ─── STATS ───
app.get('/api/stats', requireAdmin, (req, res) => {
  const db = loadDB();
  const confirmed = db.reservations.filter(r => r.status === 'confirmed');
  const revenue = confirmed.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  res.json({
    vehicles: db.vehicles.length,
    reservations: db.reservations.length,
    contracts: db.contracts.length,
    revenue,
    pending: db.reservations.filter(r => r.status === 'pending').length,
    confirmed: confirmed.length
  });
});

// ─── IA ASSISTANT ───
app.post('/api/ai', requireAdmin, async (req, res) => {
  const { message, context } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `Tu es l'assistant IA de J4CK'S Location, une agence de location de voitures premium basée à Mulhouse. Tu aides l'équipe admin à gérer l'agence : réservations, contrats, véhicules, clients. Réponds toujours en français, de façon concise et professionnelle. Contexte actuel de la base de données : ${context || 'Non fourni'}`,
        messages: [{ role: 'user', content: message }]
      })
    });
    const data = await response.json();
    res.json({ reply: data.content?.[0]?.text || 'Erreur IA' });
  } catch (e) {
    res.status(500).json({ error: 'Erreur IA: ' + e.message });
  }
});

// ─── CONTRACT GENERATOR ───
app.post('/api/generate-contract', requireAdmin, async (req, res) => {
  const { type, data } = req.body;
  const prompts = {
    location: `Génère un contrat de location de véhicule complet et professionnel en français pour J4CK'S Location (SAS). Données: ${JSON.stringify(data)}. Inclus: identité des parties, description véhicule, dates, prix, conditions, caution, état des lieux, signatures. Format propre avec sections numérotées.`,
    caution: `Génère un document de caution/dépôt de garantie professionnel en français pour J4CK'S Location. Données: ${JSON.stringify(data)}. Format légal complet.`,
    etatLieux: `Génère un formulaire d'état des lieux de véhicule détaillé en français pour J4CK'S Location. Véhicule: ${JSON.stringify(data)}. Inclus toutes les zones du véhicule avec cases à cocher/remplir.`,
    facture: `Génère une facture professionnelle complète en français pour J4CK'S Location (SAS). Données: ${JSON.stringify(data)}. Format standard français avec TVA.`
  };
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompts[type] || prompts.location }]
      })
    });
    const d = await response.json();
    const text = d.content?.[0]?.text || '';
    // Sauvegarde
    const db = loadDB();
    const contract = { id: Date.now().toString(), type, data, content: text, createdAt: new Date().toISOString() };
    db.contracts.push(contract);
    saveDB(db);
    res.json({ content: text, id: contract.id });
  } catch (e) {
    res.status(500).json({ error: 'Erreur génération: ' + e.message });
  }
});

// ─── SUPERADMIN: reset password ───
app.post('/api/superadmin/config', requireSuperAdmin, (req, res) => {
  // En prod: écrire dans .env via fs
  res.json({ ok: true, message: 'Config mise à jour (redémarrage requis en prod)' });
});

// ─── PAGES ───
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/superadmin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'superadmin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`J4CK'S Location démarré sur http://localhost:${PORT}`));
