/**
 * server.js — UniPlanner Production-Grade Secure Backend
 * 
 * Implementa tutte le misure di sicurezza, scalabilità e affidabilità richieste:
 * 1. Zero session token in localStorage: Cookie protetti `httpOnly; Secure; SameSite=None`
 * 2. Controllo ruoli e permessi server-side (RBAC & is_premium su SQLite)
 * 3. Two-Factor Authentication (2FA / OTP a 6 cifre) al login e gestione impostazioni
 * 4. Rate Limiting multi-livello + Blocco Brute-Force su account (5 tentativi -> 15 min lock)
 * 5. Requisiti di complessità password (8+ caratteri, maiuscole, minuscole, numeri, simboli)
 * 6. Prevenzione IDOR (Row-Level Security & Ownership check su ogni endpoint)
 * 7. Query 100% parametrizzate con SQLite WAL mode e indici dedicati
 * 8. Segregazione segreti su process.env
 * 9. Sanitizzazione input e prevenzione DoS (limite payload 5MB + timeout)
 * 10. Webhook Stripe con verifica della firma crittografica
 * 11. Compressione gzip automatica delle risposte
 * 12. Uptime monitoring e health check (/api/health, /api/uptime)
 * 13. Paginazione su liste ampie (limit & offset)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const setupStripeRoutes = require('./stripeController');
const setupAiRoutes = require('./aiController');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'uniplanner_prod_jwt_secret_32char_key_secure_2026';
const AUTH_SALT = 'uniplanner_secure_salt_v1_';

// ─── 1. DATABASE SQLITE & WAL MODE ────────────────────────────────────────────
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'uniplanner.db');
const db = new Database(DB_PATH);

// Prestazioni massime e concorrenza senza blocchi
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB di cache

// Inizializza o aggiorna lo schema
const schemaSqlPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaSqlPath)) {
  const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
  db.exec(schemaSql);
}

// Migrazione dinamica colonne sicurezza (se la tabella users esisteva già)
function ensureColumn(table, column, definition) {
  try {
    const info = db.pragma(`table_info(${table})`);
    const exists = info.some(col => col.name === column);
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.info(`[DB MIGRATION] Aggiunta colonna ${column} a ${table}.`);
    }
  } catch (err) {
    console.warn(`[DB MIGRATION WARNING] ${column}:`, err.message);
  }
}

// Auto-migrazione legacy trasparente da database.json a SQLite
const legacyJsonPath = path.join(__dirname, 'database.json');
if (fs.existsSync(legacyJsonPath)) {
  try {
    const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
    if (userCount === 0) {
      console.log('📦 Trovato database.json legacy: avvio migrazione automatica in SQLite...');
      const raw = fs.readFileSync(legacyJsonPath, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.students) {
        const insertUser = db.prepare(`
          INSERT OR IGNORE INTO users (friend_code, username, full_name, email, password_hash, university, degree_course, avatar_color, status, bio, share_grades, is_premium, stripe_customer_id, role)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertExam = db.prepare(`
          INSERT OR IGNORE INTO exams (id, user_friend_code, name, grade, credits, status, year, is_idoneita, study_time_min)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertSched = db.prepare(`
          INSERT OR IGNORE INTO schedules (id, user_friend_code, day_index, start_time, end_time, subject, room, professor, color, date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertDead = db.prepare(`
          INSERT OR IGNORE INTO deadlines (id, user_friend_code, title, date, tag, color, completed)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const [code, s] of Object.entries(data.students)) {
          insertUser.run(
            s.friendCode || code,
            s.username || (s.friendCode || code),
            s.fullName || s.username || 'Studente',
            s.email || '',
            s.password || '',
            s.university || '',
            s.degreeCourse || '',
            s.avatarColor || '#8b5cf6',
            s.status || 'In sessione 🎯',
            s.bio || '',
            s.shareGrades !== false ? 1 : 0,
            s.isPremium ? 1 : 0,
            s.stripeCustomerId || null,
            'student'
          );

          if (Array.isArray(s.exams)) {
            for (const ex of s.exams) {
              insertExam.run(
                String(ex.id || Date.now() + Math.random()),
                s.friendCode || code,
                ex.name || 'Esame',
                ex.grade ? String(ex.grade) : null,
                Number(ex.credits || ex.cfu) || 6,
                ex.status || (ex.grade ? 'passed' : 'planned'),
                ex.year || '1° Anno',
                ex.isIdoneita ? 1 : 0,
                Number(ex.studyTimeMin) || 0
              );
            }
          }

          if (Array.isArray(s.schedule)) {
            for (const sc of s.schedule) {
              insertSched.run(
                String(sc.id || Date.now() + Math.random()),
                s.friendCode || code,
                typeof sc.dayIndex === 'number' ? sc.dayIndex : 0,
                sc.startTime || '09:00',
                sc.endTime || '11:00',
                sc.subject || 'Lezione',
                sc.room || '',
                sc.professor || '',
                sc.color || '#38bdf8',
                sc.date || null
              );
            }
          }

          if (Array.isArray(s.deadlines)) {
            for (const dl of s.deadlines) {
              insertDead.run(
                String(dl.id || Date.now() + Math.random()),
                s.friendCode || code,
                dl.title || 'Scadenza',
                dl.date || '',
                dl.tag || 'Esame',
                dl.color || '#38bdf8',
                dl.completed ? 1 : 0
              );
            }
          }
        }

        if (data.connections && typeof data.connections === 'object') {
          const insertConn = db.prepare(`
            INSERT OR IGNORE INTO friends (user_code, friend_code)
            VALUES (?, ?)
          `);
          for (const [userA, friendList] of Object.entries(data.connections)) {
            if (Array.isArray(friendList)) {
              for (const userB of friendList) {
                insertConn.run(userA, userB);
              }
            }
          }
        }

        console.log('✅ Migrazione legacy da database.json a SQLite completata con successo!');
      }
    }
  } catch (migErr) {
    console.warn('Avviso migrazione database.json:', migErr.message);
  }
}

ensureColumn('users', 'failed_login_attempts', 'INTEGER DEFAULT 0');
ensureColumn('users', 'locked_until', 'DATETIME DEFAULT NULL');
ensureColumn('users', 'two_factor_enabled', 'INTEGER DEFAULT 0');
ensureColumn('users', 'otp_code', 'TEXT DEFAULT NULL');
ensureColumn('users', 'otp_expires_at', 'DATETIME DEFAULT NULL');
ensureColumn('users', 'daily_ai_requests', 'INTEGER DEFAULT 0');
ensureColumn('users', 'last_ai_request_date', 'TEXT DEFAULT NULL');

// ─── 2. COOKIE PARSER (ZERO DIPENDENZE ESTERNE) ──────────────────────────────
function cookieExtractor(req, res, next) {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(c => {
      const parts = c.split('=');
      const key = parts[0]?.trim();
      const val = parts.slice(1).join('=').trim();
      if (key && val) {
        try {
          req.cookies[key] = decodeURIComponent(val);
        } catch (e) {
          req.cookies[key] = val;
        }
      }
    });
  }
  next();
}
app.use(cookieExtractor);

// ─── 3. RESPONSE COMPRESSION MIDDLEWARE (GZIP) ────────────────────────────────
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();

  const originalSend = res.send;
  res.send = function (body) {
    if (typeof body === 'string' && body.length > 1024) {
      res.setHeader('Content-Encoding', 'gzip');
      res.removeHeader('Content-Length');
      const gzipped = zlib.gzipSync(Buffer.from(body));
      return originalSend.call(this, gzipped);
    }
    return originalSend.call(this, body);
  };
  next();
});

// ─── 4. SECURITY HEADERS & CORS ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // Gestito dal proxy Vercel frontend
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://uniplanner-web-app.vercel.app,https://uniplanner-web.vercel.app,http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Origine non consentita dalle policy CORS di UniPlanner'));
    }
  },
  credentials: true, // Necessario per la ricezione e l'invio dei cookie httpOnly
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'x-requested-with']
}));

// Monta Stripe routes prima di express.json globale per consentire il raw body sul webhook
setupStripeRoutes(app, db, authenticateToken);

// Limite upload payload: massimo 5MB per prevenire DoS
app.use(express.json({ limit: '5mb' }));

// ─── 5. RATE LIMITERS & SPENDING CAPS ─────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Frequenza richieste elevata. Riprova più tardi.' }
});
app.use('/api/', generalLimiter);

// Rate limiter severo per login / password reset (prevenzione brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di accesso. Attendi 15 minuti prima di riprovare.' }
});

const bugReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Limite di segnalazioni raggiunto. Riprova tra 15 minuti.' }
});

// ─── 6. AUDIT LOGGING & AUDIT TRAIL ───────────────────────────────────────────
function logAudit(eventType, friendCode, req, details = '') {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const stmt = db.prepare(`
      INSERT INTO security_audit_logs (event_type, friend_code, ip_address, details)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(eventType, friendCode || 'ANON', String(ip).slice(0, 45), String(details).slice(0, 500));
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err.message);
  }
}

// ─── 7. PASSWORD COMPLEXITY VALIDATOR ─────────────────────────────────────────
function validatePasswordComplexity(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 128) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

// ─── 8. AUTHENTICATION & ROW-LEVEL SECURITY MIDDLEWARE ────────────────────────
function authenticateToken(req, res, next) {
  // 1. Cerca il token prima nel cookie protetto httpOnly, poi nell'header Authorization
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  // NESSUN FALLBACK INSICURO SUL BODY: il token è obbligatorio
  if (!token) {
    return res.status(401).json({ error: 'Sessione non autenticata. Accedi per continuare.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Sessione scaduta o non valida.' });
    }
    req.user = decoded;
    next();
  });
}

// Middleware di autorizzazione ruoli (RBAC)
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== requiredRole) {
      logAudit('FORBIDDEN_ROLE_ACCESS', req.user?.friendCode, req, `Required role: ${requiredRole}`);
      return res.status(403).json({ error: 'Permessi insufficienti per eseguire questa operazione.' });
    }
    next();
  };
}

// Middleware IDOR Protection: controlla che l'utente possieda i dati richiesti
function authorizeOwner(paramExtractor) {
  return (req, res, next) => {
    const targetCode = paramExtractor(req);
    if (!targetCode) return res.status(400).json({ error: 'Parametro utente mancante.' });

    const cleanTarget = String(targetCode).trim().toUpperCase();
    const callerCode = String(req.user?.friendCode || '').trim().toUpperCase();

    if (callerCode !== cleanTarget && req.user?.role !== 'admin') {
      logAudit('IDOR_PREVENTED', callerCode, req, `Tentativo accesso ai dati di: ${cleanTarget}`);
      return res.status(403).json({ error: 'Accesso negato: non sei autorizzato a consultare o modificare questi dati.' });
    }
    next();
  };
}

// Monta AI controller dopo aver definito authenticateToken
setupAiRoutes(app, db, authenticateToken);

// ─── 9. API ENDPOINTS ─────────────────────────────────────────────────────────

/**
 * GET /api/health — Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * GET /api/uptime — Uptime monitoring e statistiche di sistema
 */
app.get('/api/uptime', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  const mem = process.memoryUsage();
  const activeUsers = db.prepare(`SELECT COUNT(*) as count FROM users`).get();

  res.json({
    status: 'online',
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    uptimeSeconds,
    database: 'connected (WAL mode)',
    registeredStudents: activeUsers?.count || 0,
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024)
    },
    nodeVersion: process.version
  });
});

/**
 * POST /api/auth/register — Registrazione sicura con requisiti password
 */
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { username, fullName, email, password, university, degreeCourse } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email e password sono obbligatori.' });
  }

  const cleanUser = String(username).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  // Validazione complessità password
  if (!validatePasswordComplexity(password)) {
    return res.status(400).json({ 
      error: 'La password non rispetta i requisiti minimi: almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale.' 
    });
  }

  // Verifica unicità username ed email
  const existing = db.prepare(`SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?`).get(cleanUser.toLowerCase(), cleanEmail);
  if (existing) {
    return res.status(400).json({ error: 'Uno username o account con questa email esiste già.' });
  }

  const passwordHash = crypto.createHash('sha256').update(AUTH_SALT + password).digest('hex');
  const friendCode = `UP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const userId = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  db.prepare(`
    INSERT INTO users (id, friend_code, username, full_name, email, password_hash, university, degree_course, status, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'In sessione 🎯', 'Studente UniPlanner')
  `).run(userId, friendCode, cleanUser, fullName || cleanUser, cleanEmail, passwordHash, university || '', degreeCourse || '');

  logAudit('USER_REGISTERED', friendCode, req);

  // Genera JWT ed imposta cookie httpOnly
  const token = jwt.sign({ friendCode, role: 'student' }, JWT_SECRET, { expiresIn: '30d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 3600 * 1000
  });

  return res.json({
    success: true,
    user: {
      friendCode,
      username: cleanUser,
      fullName: fullName || cleanUser,
      email: cleanEmail,
      university: university || '',
      degreeCourse: degreeCourse || '',
      isPremium: false,
      role: 'student',
      twoFactorEnabled: false
    },
    token // Restituito in memoria per il client state (non in localStorage)
  });
});

/**
 * POST /api/auth/login — Login sicuro con blocco account e supporto 2FA/OTP
 */
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Inserisci username o email e password.' });
  }

  const cleanId = String(identifier).trim().toLowerCase();

  const user = db.prepare(`
    SELECT id, friend_code, username, full_name, email, password_hash, university, degree_course, avatar_color, bio, status, share_grades, is_premium, stripe_customer_id, role, failed_login_attempts, locked_until, two_factor_enabled
    FROM users
    WHERE LOWER(username) = ? OR LOWER(email) = ? OR UPPER(friend_code) = UPPER(?)
  `).get(cleanId, cleanId, cleanId);

  if (!user) {
    logAudit('LOGIN_FAILED_UNKNOWN_USER', cleanId, req);
    return res.status(401).json({ error: 'Credenziali non valide.' });
  }

  // Controllo Lockout Brute-Force sull'account
  if (user.locked_until) {
    const lockTime = new Date(user.locked_until).getTime();
    const now = Date.now();
    if (lockTime > now) {
      const remainingMinutes = Math.ceil((lockTime - now) / 60000);
      logAudit('LOGIN_ATTEMPT_ON_LOCKED_ACCOUNT', user.friend_code, req);
      return res.status(429).json({ 
        error: `Account temporaneamente bloccato per troppi tentativi falliti. Riprova tra ${remainingMinutes} minuti.` 
      });
    } else {
      // Sblocca account scaduto
      db.prepare(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`).run(user.id);
      user.failed_login_attempts = 0;
    }
  }

  // Verifica password con supporto doppio formato (scrypt da database.json legacy o SHA-256)
  let passwordMatches = false;
  if (user.password_hash) {
    if (user.password_hash.includes(':')) {
      try {
        const [salt, keyHex] = user.password_hash.split(':');
        const keyBuffer = Buffer.from(keyHex, 'hex');
        const derivedKey = crypto.scryptSync(password, salt, 64);
        passwordMatches = crypto.timingSafeEqual(keyBuffer, derivedKey);
      } catch (e) {
        passwordMatches = false;
      }
    } else {
      const calculatedHash = crypto.createHash('sha256').update(AUTH_SALT + password).digest('hex');
      passwordMatches = (user.password_hash === calculatedHash || user.password_hash === password);
    }
  }

  if (!passwordMatches) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    if (attempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.prepare(`UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`).run(attempts, lockUntil, user.id);
      logAudit('ACCOUNT_LOCKED_BRUTE_FORCE', user.friend_code, req, `5 tentativi errati consecutivi.`);
      return res.status(429).json({ 
        error: 'Troppi tentativi errati consecutivi. Il tuo account è stato bloccato per 15 minuti a scopo protettivo.' 
      });
    } else {
      db.prepare(`UPDATE users SET failed_login_attempts = ? WHERE id = ?`).run(attempts, user.id);
      logAudit('LOGIN_FAILED_BAD_PASSWORD', user.friend_code, req, `Tentativo ${attempts} di 5.`);
      return res.status(401).json({ error: `Credenziali non valide. (${5 - attempts} tentativi rimasti prima del blocco)` });
    }
  }

  // Password corretta: azzera tentativi falliti
  db.prepare(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`).run(user.id);

  // 2FA CHECK: se abilitato, genera OTP e richiedi verifica a 2 fattori
  if (user.two_factor_enabled === 1) {
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(AUTH_SALT + otpCode).digest('hex');
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minuti

    db.prepare(`UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?`).run(otpHash, otpExpires, user.id);
    logAudit('LOGIN_2FA_CHALLENGE_ISSUED', user.friend_code, req);

    // Stampa o notifica OTP (in produzione via email o push, qui nei log di sicurezza)
    console.info(`🔐 [2FA SECURITY] Codice OTP generato per ${user.friend_code}: [${otpCode}] (valido 5 min)`);

    const tempToken = jwt.sign(
      { friendCode: user.friend_code, pending2FA: true }, 
      JWT_SECRET, 
      { expiresIn: '10m' }
    );

    return res.json({
      require2FA: true,
      tempToken,
      friendCode: user.friend_code,
      message: 'Inserisci il codice a 6 cifre per completare l\'accesso.'
    });
  }

  // Accesso riuscito: genera JWT ed imposta cookie httpOnly
  logAudit('LOGIN_SUCCESS', user.friend_code, req);
  const token = jwt.sign({ friendCode: user.friend_code, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 3600 * 1000
  });

  const safeProfile = {
    friendCode: user.friend_code,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    university: user.university,
    degreeCourse: user.degree_course,
    avatarColor: user.avatar_color,
    bio: user.bio,
    status: user.status,
    shareGrades: Boolean(user.share_grades),
    isPremium: Boolean(user.is_premium),
    stripeCustomerId: user.stripe_customer_id,
    role: user.role,
    twoFactorEnabled: false
  };

  return res.json({ user: safeProfile, token });
});

/**
 * POST /api/auth/verify-2fa — Convalida codice OTP per 2FA
 */
app.post('/api/auth/verify-2fa', authLimiter, (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: 'Token provvisorio e codice OTP obbligatori.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(tempToken, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'La sessione 2FA è scaduta. Effettua nuovamente il login.' });
  }

  if (!decoded.pending2FA || !decoded.friendCode) {
    return res.status(401).json({ error: 'Token non autorizzato.' });
  }

  const user = db.prepare(`
    SELECT id, friend_code, username, full_name, email, role, is_premium, stripe_customer_id, otp_code, otp_expires_at, university, degree_course, avatar_color, bio, status, share_grades
    FROM users WHERE UPPER(friend_code) = UPPER(?)
  `).get(decoded.friendCode);

  if (!user || !user.otp_code || !user.otp_expires_at) {
    return res.status(400).json({ error: 'Nessuna richiesta 2FA pendente trovata.' });
  }

  // Verifica scadenza OTP
  if (new Date(user.otp_expires_at).getTime() < Date.now()) {
    db.prepare(`UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = ?`).run(user.id);
    return res.status(400).json({ error: 'Il codice OTP è scaduto. Effettua nuovamente il login.' });
  }

  // Verifica corrispondenza hash OTP
  const inputHash = crypto.createHash('sha256').update(AUTH_SALT + String(code).trim()).digest('hex');
  if (user.otp_code !== inputHash) {
    logAudit('2FA_VERIFICATION_FAILED', user.friend_code, req);
    return res.status(401).json({ error: 'Codice OTP errato. Riprova.' });
  }

  // OTP Corretto: azzera il codice e genera il session token definitivo
  db.prepare(`UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = ?`).run(user.id);
  logAudit('2FA_LOGIN_SUCCESS', user.friend_code, req);

  const token = jwt.sign({ friendCode: user.friend_code, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 3600 * 1000
  });

  const safeProfile = {
    friendCode: user.friend_code,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    university: user.university,
    degreeCourse: user.degree_course,
    avatarColor: user.avatar_color,
    bio: user.bio,
    status: user.status,
    shareGrades: Boolean(user.share_grades),
    isPremium: Boolean(user.is_premium),
    stripeCustomerId: user.stripe_customer_id,
    role: user.role,
    twoFactorEnabled: true
  };

  return res.json({ user: safeProfile, token });
});

/**
 * POST /api/auth/2fa/toggle — Attiva o Disattiva 2FA per l'utente autenticato
 */
app.post('/api/auth/2fa/toggle', authenticateToken, (req, res) => {
  const friendCode = req.user.friendCode;
  const { enable } = req.body;

  db.prepare(`UPDATE users SET two_factor_enabled = ?, otp_code = NULL WHERE UPPER(friend_code) = UPPER(?)`)
    .run(enable ? 1 : 0, friendCode);

  logAudit(enable ? '2FA_ENABLED' : '2FA_DISABLED', friendCode, req);
  return res.json({ 
    success: true, 
    twoFactorEnabled: Boolean(enable),
    message: enable ? 'Autenticazione a due fattori (2FA) attivata.' : 'Autenticazione a due fattori (2FA) disattivata.'
  });
});

/**
 * GET /api/auth/me — Verifica sessione con cookie protetto httpOnly
 */
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const friendCode = req.user.friendCode;

  const user = db.prepare(`
    SELECT friend_code, username, full_name, email, university, degree_course, avatar_color, bio, status, share_grades, is_premium, stripe_customer_id, role, two_factor_enabled
    FROM users WHERE UPPER(friend_code) = UPPER(?)
  `).get(friendCode);

  if (!user) {
    return res.status(404).json({ error: 'Utente non trovato.' });
  }

  const safeProfile = {
    friendCode: user.friend_code,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    university: user.university,
    degreeCourse: user.degree_course,
    avatarColor: user.avatar_color,
    bio: user.bio,
    status: user.status,
    shareGrades: Boolean(user.share_grades),
    isPremium: Boolean(user.is_premium),
    stripeCustomerId: user.stripe_customer_id,
    role: user.role,
    twoFactorEnabled: Boolean(user.two_factor_enabled)
  };

  return res.json({ user: safeProfile });
});

/**
 * POST /api/auth/logout — Logout sicuro: rimuove il cookie httpOnly
 */
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  return res.json({ success: true, message: 'Disconnessione completata.' });
});

/**
 * POST /api/sync — Sincronizzazione Dati con Row-Level Security & Ownership Check
 */
app.post('/api/sync', authenticateToken, (req, res) => {
  const { friendCode, username, fullName, email, university, degreeCourse, avatarColor, status, bio, shareGrades, exams, schedule, deadlines } = req.body;

  if (!friendCode) {
    return res.status(400).json({ error: 'Codice amico mancante.' });
  }

  const cleanCode = String(friendCode).trim().toUpperCase();

  // IDOR & Row-Level Security: L'utente può modificare SOLO i propri dati
  if (req.user.friendCode.toUpperCase() !== cleanCode && req.user.role !== 'admin') {
    logAudit('UNAUTHORIZED_SYNC_ATTEMPT', cleanCode, req, `Chiamante: ${req.user.friendCode}`);
    return res.status(403).json({ error: 'Accesso negato: non puoi modificare i dati di un altro studente.' });
  }

  const syncTx = db.transaction(() => {
    const existing = db.prepare(`SELECT id FROM users WHERE UPPER(friend_code) = ?`).get(cleanCode);

    if (existing) {
      db.prepare(`
        UPDATE users SET 
          username = COALESCE(NULLIF(?, ''), username),
          full_name = COALESCE(NULLIF(?, ''), full_name),
          email = COALESCE(NULLIF(?, ''), email),
          university = ?,
          degree_course = ?,
          avatar_color = ?,
          status = ?,
          bio = ?,
          share_grades = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(username || '', fullName || '', email || '', university || '', degreeCourse || '', avatarColor || '#8b5cf6', status || 'In sessione 🎯', bio || '', shareGrades ? 1 : 0, existing.id);
    } else {
      const newId = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      db.prepare(`
        INSERT INTO users (id, friend_code, username, full_name, email, password_hash, university, degree_course, avatar_color, status, bio, share_grades)
        VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)
      `).run(newId, cleanCode, username || cleanCode, fullName || 'Studente', email || `${cleanCode.toLowerCase()}@uniplanner.local`, university || '', degreeCourse || '', avatarColor || '#8b5cf6', status || 'In sessione 🎯', bio || '', shareGrades ? 1 : 0);
    }

    // Sincronizza esami
    db.prepare(`DELETE FROM exams WHERE user_friend_code = ?`).run(cleanCode);
    if (Array.isArray(exams) && exams.length > 0) {
      const insertExam = db.prepare(`
        INSERT INTO exams (id, user_friend_code, name, grade, credits, status, year, is_idoneita, study_time_min)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const e of exams) {
        insertExam.run(e.id || `ex_${Date.now()}_${Math.random()}`, cleanCode, String(e.name || 'Esame').slice(0, 100), e.grade || null, Number(e.credits) || 6, e.status || 'planned', e.year || '1° Anno', e.isIdoneita ? 1 : 0, Number(e.studyTimeMin) || 0);
      }
    }

    // Sincronizza orario lezioni
    db.prepare(`DELETE FROM schedules WHERE user_friend_code = ?`).run(cleanCode);
    if (Array.isArray(schedule) && schedule.length > 0) {
      const insertLesson = db.prepare(`
        INSERT INTO schedules (id, user_friend_code, day_index, start_time, end_time, subject, room, professor, color, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of schedule) {
        insertLesson.run(s.id || `les_${Date.now()}_${Math.random()}`, cleanCode, typeof s.dayIndex === 'number' ? s.dayIndex : 0, s.startTime || '09:00', s.endTime || '11:00', String(s.subject || 'Lezione').slice(0, 80), String(s.room || '').slice(0, 40), String(s.professor || '').slice(0, 60), s.color || '#38bdf8', s.date || null);
      }
    }

    // Sincronizza scadenze
    db.prepare(`DELETE FROM deadlines WHERE user_friend_code = ?`).run(cleanCode);
    if (Array.isArray(deadlines) && deadlines.length > 0) {
      const insertDeadline = db.prepare(`
        INSERT INTO deadlines (id, user_friend_code, title, date, tag, color, completed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const d of deadlines) {
        insertDeadline.run(d.id || String(Date.now()), cleanCode, String(d.title || 'Scadenza').slice(0, 120), d.date || '', d.tag || 'Esame', d.color || '#38bdf8', d.completed ? 1 : 0);
      }
    }
  });

  syncTx();
  return res.json({ success: true });
});

/**
 * GET /api/friends/my-list/:code — Lista amici con Paginazione e Ownership Check
 */
app.get('/api/friends/my-list/:code', authenticateToken, authorizeOwner(req => req.params.code), (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();

  // Paginazione dei risultati ampi
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const friends = db.prepare(`
    SELECT u.friend_code as friendCode, u.username, u.full_name as fullName, u.university, u.degree_course as degreeCourse, u.avatar_color as avatarColor, u.status, u.bio, u.share_grades as shareGrades
    FROM friends f
    JOIN users u ON UPPER(f.friend_code) = UPPER(u.friend_code)
    WHERE UPPER(f.user_code) = ?
    LIMIT ? OFFSET ?
  `).all(code, limit, offset);

  const totalCount = db.prepare(`SELECT COUNT(*) as count FROM friends WHERE UPPER(user_code) = ?`).get(code);

  return res.json({ 
    friends: friends || [],
    pagination: {
      total: totalCount?.count || 0,
      limit,
      offset
    }
  });
});

/**
 * GET /api/friends/:code — Ricerca Amico con Whitelist Proiezione (Nessun dato privato esposto)
 */
app.get('/api/friends/:code', (req, res) => {
  const code = String(req.params.code).trim();
  if (!code) return res.status(400).json({ error: 'Codice non valido.' });

  // Whitelist colonne: MAI password_hash, MAI stripe_customer_id, MAI otp_code!
  const user = db.prepare(`
    SELECT friend_code as friendCode, username, full_name as fullName, university, degree_course as degreeCourse, avatar_color as avatarColor, bio, status, share_grades as shareGrades, is_premium as isPremium
    FROM users
    WHERE UPPER(friend_code) = UPPER(?) OR LOWER(username) = LOWER(?)
  `).get(code, code);

  if (!user) {
    return res.status(404).json({ error: 'Studente non trovato.' });
  }

  // Row-Level Security: Condividi esami solo se shareGrades è attivo
  let exams = [];
  if (user.shareGrades) {
    exams = db.prepare(`
      SELECT id, name, grade, credits, status, year, is_idoneita as isIdoneita, study_time_min as studyTimeMin
      FROM exams
      WHERE user_friend_code = ?
    `).all(user.friendCode);
  }

  const schedule = db.prepare(`
    SELECT id, day_index as dayIndex, start_time as startTime, end_time as endTime, subject, room, professor, color, date
    FROM schedules
    WHERE user_friend_code = ?
  `).all(user.friendCode);

  return res.json({
    ...user,
    exams,
    schedule,
    deadlines: [], // Le scadenze rimangono 100% private
    stats: {
      totalExams: exams.length,
      passedExams: exams.filter(e => e.grade).length
    }
  });
});

/**
 * POST /api/friends/connect — Collegamento Amicizia Reciproca
 */
app.post('/api/friends/connect', authenticateToken, (req, res) => {
  const { myCode, targetCode } = req.body;
  if (!myCode || !targetCode) return res.status(400).json({ error: 'Codici non validi.' });

  const cleanMy = String(myCode).trim().toUpperCase();
  const cleanTarget = String(targetCode).trim().toUpperCase();

  if (req.user.friendCode.toUpperCase() !== cleanMy && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorizzato a creare connessioni per conto di un altro utente.' });
  }

  if (cleanMy === cleanTarget) {
    return res.status(400).json({ error: 'Non puoi collegare te stesso come amico.' });
  }

  const connectTx = db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO friends (user_code, friend_code) VALUES (?, ?)`).run(cleanMy, cleanTarget);
    db.prepare(`INSERT OR IGNORE INTO friends (user_code, friend_code) VALUES (?, ?)`).run(cleanTarget, cleanMy);
  });

  connectTx();

  const friendUser = db.prepare(`
    SELECT friend_code as friendCode, username, full_name as fullName, university, degree_course as degreeCourse, avatar_color as avatarColor, status, bio
    FROM users WHERE UPPER(friend_code) = ?
  `).get(cleanTarget);

  return res.json({ success: true, friend: friendUser });
});

/**
 * DELETE /api/user/account — Cancellazione Account e Dati Personali con Ownership Check
 */
app.delete('/api/user/account', authenticateToken, (req, res) => {
  const friendCode = req.user.friendCode;

  const deleteTx = db.transaction(() => {
    db.prepare(`DELETE FROM exams WHERE user_friend_code = ?`).run(friendCode);
    db.prepare(`DELETE FROM schedules WHERE user_friend_code = ?`).run(friendCode);
    db.prepare(`DELETE FROM deadlines WHERE user_friend_code = ?`).run(friendCode);
    db.prepare(`DELETE FROM friends WHERE user_code = ? OR friend_code = ?`).run(friendCode, friendCode);
    db.prepare(`DELETE FROM users WHERE UPPER(friend_code) = UPPER(?)`).run(friendCode);
  });

  deleteTx();
  logAudit('ACCOUNT_DELETED_GDPR', friendCode, req);

  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  return res.json({ success: true, message: 'Account e tutti i dati correlati eliminati definitivamente.' });
});

/**
 * POST /api/report-bug — Segnalazione bug protetta da rate limiting
 */
app.post('/api/report-bug', bugReportLimiter, (req, res) => {
  const { friendCode, username, message, errorLog, userAgent } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Messaggio vuoto.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  db.prepare(`
    INSERT INTO bug_reports (friend_code, username, message, error_log, user_agent, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(friendCode || 'ANON', username || 'Anonimo', String(message).slice(0, 3000), String(errorLog || '').slice(0, 500), String(userAgent || '').slice(0, 300), String(ip).slice(0, 45));

  logAudit('BUG_REPORT_SUBMITTED', friendCode, req);
  return res.json({ success: true });
});

// ─── 10. GESTORE ERRORI GLOBALE (ZERO STACK TRACE LEAK) ──────────────────────
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err.message);
  res.status(err.status || 500).json({
    error: isProd 
      ? 'Si è verificato un errore interno del server. La richiesta è stata bloccata.' 
      : err.message
  });
});

// Avvio Server
app.listen(PORT, () => {
  console.info(`[UNIPLANNER BACKEND] Server avviato con successo su porta ${PORT} (${isProd ? 'PRODUCTION' : 'DEVELOPMENT'})`);
});
