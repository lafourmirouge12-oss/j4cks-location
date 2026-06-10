const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'j4cks-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true }
}));

// ═══ DB PERSISTANTE ═══
const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'db.json');
const CFG_PATH = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_DEFAULT = { vehicles: [], reservations: [], contracts: [], clients: [] };
const CFG_DEFAULT = {
  features: {
    clientAccounts: false,      // Comptes clients on/off
    vehicleGrades: false,       // Options de gamme on/off
    vehicleDeposit: false,      // Dépôt véhicule on/off
    onlinePayment: false,       // Paiement en ligne on/off
    reviews: false,             // Avis clients on/off
    newsletter: false,          // Newsletter on/off
    liveChat: false,            // Chat live on/off
    multiplePhotos: false,      // Photos multiples véhicule on/off
    insurance: true,            // Option assurance on/off
    chauffeur: false,           // Option chauffeur on/off
    delivery: true,             // Livraison véhicule on/off
    gps: true,                  // Option GPS on/off
  },
  agency: {
    name: "J4CK'S Location",
    phone: '',
    email: '',
    address: 'Mulhouse, France',
    instagram: '',
    whatsapp: '',
    minAge: 21,
    depositAmount: 800,
    minDays: 1,
    maxDays: 30,
  }
};

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) { fs.writeFileSync(DB_PATH, JSON.stringify(DB_DEFAULT, null, 2)); return { ...DB_DEFAULT }; }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) { console.error('DB read error:', e.message); return { ...DB_DEFAULT }; }
}
function saveDB(db) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
  catch (e) { console.error('DB write error:', e.message); }
}
function loadCfg() {
  try {
    if (!fs.existsSync(CFG_PATH)) { fs.writeFileSync(CFG_PATH, JSON.stringify(CFG_DEFAULT, null, 2)); return JSON.parse(JSON.stringify(CFG_DEFAULT)); }
    const saved = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
    // Merge avec les defaults pour les nouvelles clés
    return {
      features: { ...CFG_DEFAULT.features, ...saved.features },
      agency: { ...CFG_DEFAULT.agency, ...saved.agency }
    };
  } catch (e) { return JSON.parse(JSON.stringify(CFG_DEFAULT)); }
}
function saveCfg(cfg) {
  try { fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)); }
  catch (e) { console.error('Config write error:', e.message); }
}

// ═══ AUTH ═══
function requireAdmin(req, res, next) {
  if (req.session.role === 'admin' || req.session.role === 'superadmin') return next();
  res.status(401).json({ error: 'Non autorisé' });
}
function requireSuperAdmin(req, res, next) {
  if (req.session.role === 'superadmin') return next();
  res.status(401).json({ error: 'Super admin requis' });
}
function requireClient(req, res, next) {
  if (req.session.clientId || req.session.role === 'admin' || req.session.role === 'superadmin') return next();
  res.status(401).json({ error: 'Connexion client requise' });
}

// ═══ AUTH ROUTES ═══
app.post('/api/login', (req, res) => {
  const { password, role } = req.body;
  if (!password || !role) return res.status(400).json({ error: 'Données manquantes' });
  if (role === 'superadmin' && password === (process.env.SUPERADMIN_PASSWORD || 'super2024')) {
    req.session.role = 'superadmin'; return res.json({ ok: true, role: 'superadmin' });
  }
  if (role === 'admin' && password === (process.env.ADMIN_PASSWORD || 'admin2024')) {
    req.session.role = 'admin'; return res.json({ ok: true, role: 'admin' });
  }
  res.status(401).json({ error: 'Mot de passe incorrect' });
});
app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ role: req.session.role || null, clientId: req.session.clientId || null }));

// ═══ CONFIG / FEATURES ═══
app.get('/api/config', (req, res) => {
  const cfg = loadCfg();
  // Le public voit seulement les features et infos agence (pas les secrets)
  res.json({ features: cfg.features, agency: cfg.agency });
});
app.put('/api/config', requireAdmin, (req, res) => {
  const cfg = loadCfg();
  if (req.body.features) cfg.features = { ...cfg.features, ...req.body.features };
  if (req.body.agency) cfg.agency = { ...cfg.agency, ...req.body.agency };
  if (req.body.siteConfig) cfg.siteConfig = req.body.siteConfig;
  saveCfg(cfg);
  res.json({ ok: true, config: cfg });
});

// ═══ EMAIL (Resend) ═══
async function sendEmail(to, subject, html) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: 'J4CK\'S Location <onboarding@resend.dev>', to, subject, html })
    });
    const d = await r.json();
    if (!r.ok) console.error('Resend error:', d);
    return r.ok;
  } catch(e) { console.error('Email error:', e.message); return false; }
}

// ═══ CLIENT ACCOUNTS ═══
app.post('/api/client/register', async (req, res) => {
  const cfg = loadCfg();
  if (!cfg.features.clientAccounts) return res.status(403).json({ error: 'Comptes clients désactivés' });
  const { prenom, nom, email, tel, password } = req.body;
  if (!prenom || !nom || !email || !password) return res.status(400).json({ error: 'Champs requis manquants' });
  const db = loadDB();
  if (db.clients.find(c => c.email === email)) return res.status(409).json({ error: 'Email déjà utilisé' });
  const hash = crypto.createHash('sha256').update(password + 'j4cks-salt').digest('hex');
  const client = { id: Date.now().toString(), prenom, nom, email, tel: tel || '', passwordHash: hash, createdAt: new Date().toISOString() };
  db.clients.push(client);
  saveDB(db);
  req.session.clientId = client.id;
  req.session.clientEmail = client.email;

  // Mail de confirmation
  if (process.env.RESEND_API_KEY) {
    await sendEmail(email, '✅ Bienvenue chez J4CK\'S Location !', `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0d0d0d;color:#f0f0f0;padding:2rem;border-top:3px solid #e00020;">
        <div style="font-size:1.3rem;font-weight:900;letter-spacing:0.1em;margin-bottom:0.3rem;"><span style="color:#e00020;">J4</span>CK'S LOCATION</div>
        <div style="font-size:0.75rem;color:#777;letter-spacing:0.3em;margin-bottom:2rem;">// CONFIRMATION DE COMPTE</div>
        <p style="font-size:1rem;color:#ccc;">Bonjour <strong style="color:#fff;">${prenom}</strong>,</p>
        <p style="margin-top:1rem;color:#aaa;line-height:1.6;">Ton compte J4CK'S Location a bien été créé. Tu peux maintenant réserver nos véhicules directement depuis ton espace personnel.</p>
        <div style="margin:2rem 0;padding:1.2rem;background:#111;border-left:3px solid #e00020;">
          <div style="font-size:0.75rem;color:#777;letter-spacing:0.2em;margin-bottom:0.5rem;">TON COMPTE</div>
          <div style="color:#fff;">${prenom} ${nom}</div>
          <div style="color:#aaa;font-size:0.9rem;">${email}</div>
        </div>
        <a href="https://j4cks-location.onrender.com/client" style="display:inline-block;background:#e00020;color:#fff;text-decoration:none;padding:0.8rem 2rem;font-weight:700;letter-spacing:0.1em;font-size:0.85rem;">→ ACCÉDER À MON ESPACE</a>
        <p style="margin-top:2rem;font-size:0.75rem;color:#555;">J4CK'S Location · Mulhouse, France</p>
      </div>
    `);
  }

  res.json({ ok: true, client: { id: client.id, prenom, nom, email } });
});

app.post('/api/client/login', (req, res) => {
  const cfg = loadCfg();
  if (!cfg.features.clientAccounts) return res.status(403).json({ error: 'Comptes clients désactivés' });
  const { email, password } = req.body;
  const db = loadDB();
  const client = db.clients.find(c => c.email === email);
  if (!client) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const hash = crypto.createHash('sha256').update(password + 'j4cks-salt').digest('hex');
  if (client.passwordHash !== hash) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  req.session.clientId = client.id;
  req.session.clientEmail = client.email;
  res.json({ ok: true, client: { id: client.id, prenom: client.prenom, nom: client.nom, email: client.email } });
});

app.post('/api/client/logout', (req, res) => {
  req.session.clientId = null;
  req.session.clientEmail = null;
  res.json({ ok: true });
});

app.get('/api/client/me', (req, res) => {
  if (!req.session.clientId) return res.json({ client: null });
  const db = loadDB();
  const client = db.clients.find(c => c.id === req.session.clientId);
  if (!client) return res.json({ client: null });
  res.json({ client: { id: client.id, prenom: client.prenom, nom: client.nom, email: client.email, tel: client.tel } });
});

app.get('/api/client/reservations', requireClient, (req, res) => {
  const db = loadDB();
  const resas = db.reservations.filter(r => r.clientId === req.session.clientId);
  res.json(resas);
});

// ═══ VEHICLES ═══
app.get('/api/vehicles', (req, res) => res.json(loadDB().vehicles));
app.post('/api/vehicles', requireAdmin, (req, res) => {
  const db = loadDB();
  const v = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  db.vehicles.push(v); saveDB(db); res.json(v);
});
app.put('/api/vehicles/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.vehicles = db.vehicles.map(v => v.id === req.params.id ? { ...v, ...req.body } : v);
  saveDB(db); res.json({ ok: true });
});
app.delete('/api/vehicles/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.vehicles = db.vehicles.filter(v => v.id !== req.params.id);
  saveDB(db); res.json({ ok: true });
});

// ═══ RESERVATIONS ═══
app.get('/api/reservations', requireAdmin, (req, res) => {
  const db = loadDB();
  res.json([...db.reservations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
app.post('/api/reservations', (req, res) => {
  const { prenom, nom, tel } = req.body;
  if (!prenom || !nom || !tel) return res.status(400).json({ error: 'Champs requis manquants' });
  const db = loadDB();
  const r = {
    id: Date.now().toString(),
    ...req.body,
    clientId: req.session.clientId || null,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  db.reservations.push(r); saveDB(db); res.json(r);
});
app.put('/api/reservations/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.reservations = db.reservations.map(r => r.id === req.params.id ? { ...r, ...req.body } : r);
  saveDB(db); res.json({ ok: true });
});
app.delete('/api/reservations/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.reservations = db.reservations.filter(r => r.id !== req.params.id);
  saveDB(db); res.json({ ok: true });
});

// ═══ CONTRACTS ═══
app.get('/api/contracts', requireAdmin, (req, res) => {
  const db = loadDB();
  res.json([...db.contracts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
app.delete('/api/contracts/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.contracts = db.contracts.filter(c => c.id !== req.params.id);
  saveDB(db); res.json({ ok: true });
});

// ═══ CLIENTS (admin) ═══
app.get('/api/clients', requireAdmin, (req, res) => {
  const db = loadDB();
  res.json(db.clients.map(c => ({ id: c.id, prenom: c.prenom, nom: c.nom, email: c.email, tel: c.tel, createdAt: c.createdAt })));
});
app.delete('/api/clients/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.clients = db.clients.filter(c => c.id !== req.params.id);
  saveDB(db); res.json({ ok: true });
});

// ═══ STATS ═══
app.get('/api/stats', requireAdmin, (req, res) => {
  const db = loadDB();
  const confirmed = db.reservations.filter(r => r.status === 'confirmed');
  const revenue = confirmed.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  res.json({
    vehicles: db.vehicles.length,
    reservations: db.reservations.length,
    contracts: db.contracts.length,
    clients: (db.clients || []).length,
    revenue,
    pending: db.reservations.filter(r => r.status === 'pending').length,
    confirmed: confirmed.length
  });
});

// ═══ APPEL ANTHROPIC ═══
async function callAnthropic(body, timeoutMs = 35000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${r.status}`); }
    return await r.json();
  } catch (e) { clearTimeout(timer); throw e.name === 'AbortError' ? new Error('Timeout IA') : e; }
}

// ═══ IA ASSISTANT ═══
app.post('/api/ai', requireAdmin, async (req, res) => {
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: 'Message requis' });
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('REMPLACE')) {
    return res.status(500).json({ error: 'Clé API non configurée dans .env' });
  }
  try {
    const data = await callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Tu es l'IA de J4CK'S Location, agence de location premium à Mulhouse. Tu es direct, intelligent, tu vas droit au but. Tu t'adaptes au ton : si on te parle cash, tu réponds cash. Si c'est pro, tu restes pro. Jamais de blabla. Tu connais le business location de voitures, gestion client, contrats, marketing. Tu analyses les données et proposes des actions concrètes. Données agence : ${context || 'base vide'}`,
      messages: [{ role: 'user', content: message }]
    });
    res.json({ reply: data.content?.[0]?.text || 'Pas de réponse' });
  } catch (e) { res.status(500).json({ error: 'Erreur IA : ' + e.message }); }
});

// ═══ GÉNÉRATEUR CONTRATS ═══
app.post('/api/generate-contract', requireAdmin, async (req, res) => {
  const { type, data } = req.body;
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('REMPLACE')) {
    return res.status(500).json({ error: 'Clé API non configurée dans .env' });
  }
  const prompts = {
    location: `Génère un contrat de location de véhicule complet et professionnel en français pour J4CK'S Location (SAS, Mulhouse). Données: ${JSON.stringify(data)}. Inclus: identité des parties, description véhicule, dates, prix TTC, conditions, caution, signatures. Sections numérotées.`,
    caution: `Génère un document de caution/dépôt de garantie professionnel en français pour J4CK'S Location (SAS). Données: ${JSON.stringify(data)}. Format légal complet avec conditions de restitution.`,
    etatLieux: `Génère un formulaire d'état des lieux de véhicule détaillé en français pour J4CK'S Location. Données: ${JSON.stringify(data)}. Toutes les zones (carrosserie, intérieur, pneumatiques, vitres) avec cases à remplir.`,
    facture: `Génère une facture professionnelle conforme législation française pour J4CK'S Location (SAS, Mulhouse). Données: ${JSON.stringify(data)}. Inclus HT, TVA 20%, TTC, mentions légales obligatoires.`
  };
  try {
    const d = await callAnthropic({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompts[type] || prompts.location }] }, 45000);
    const text = d.content?.[0]?.text || '';
    const db = loadDB();
    const contract = { id: Date.now().toString(), type, data, content: text, createdAt: new Date().toISOString() };
    db.contracts.push(contract); saveDB(db);
    res.json({ content: text, id: contract.id });
  } catch (e) { res.status(500).json({ error: 'Erreur génération : ' + e.message }); }
});

// ═══ EXPORT DB ═══
app.get('/api/export', requireSuperAdmin, (req, res) => {
  const db = loadDB();
  const cfg = loadCfg();
  res.setHeader('Content-Disposition', `attachment; filename="j4cks-backup-${Date.now()}.json"`);
  res.json({ db, config: cfg, exportDate: new Date().toISOString() });
});

// ═══ GÉNÉRATION PDF ═══
app.post('/api/generate-pdf', requireAdmin, async (req, res) => {
  const { type, data } = req.body;
  const { spawn } = require('child_process');
  const scriptPath = path.join(__dirname, 'generate_pdf.py');
  const titles = { location:'Contrat-Location', caution:'Depot-Garantie', etatLieux:'Etat-des-Lieux', facture:'Facture' };
  const chunks = [];
  const py = spawn('python3', [scriptPath, type, JSON.stringify(data)]);
  py.stdout.on('data', chunk => chunks.push(chunk));
  py.stderr.on('data', err => console.error('PDF err:', err.toString()));
  py.on('close', code => {
    if (code !== 0) return res.status(500).json({ error: 'Erreur génération PDF' });
    const pdf = Buffer.concat(chunks);
    const filename = `J4CKS-${titles[type]||'Document'}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  });
});

// ═══ PAGES ═══
app.get('/editor*', (req, res) => {
  if (!req.session.role) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});
app.get('/client*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'client.html')));
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/superadmin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'superadmin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ J4CK'S Location → http://localhost:${PORT}`));
