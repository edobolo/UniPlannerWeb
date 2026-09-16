-- =====================================================================
-- UniPlanner SQLite Database Schema — Production Grade & Secure
-- Dotato di vincoli di integrità relazionale, indici e Row-Level Security
-- =====================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;

-- 1. Tabella Utenti (Nessuna tabella pubblicata direttamente; colonne sensibili isolate)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    friend_code TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'student' CHECK(role IN ('student', 'admin')),
    university TEXT DEFAULT '',
    degree_course TEXT DEFAULT '',
    avatar_color TEXT DEFAULT '#8b5cf6',
    bio TEXT DEFAULT '',
    status TEXT DEFAULT 'In sessione 🎯',
    share_grades INTEGER DEFAULT 1 CHECK(share_grades IN (0, 1)),
    is_premium INTEGER DEFAULT 0 CHECK(is_premium IN (0, 1)),
    stripe_customer_id TEXT DEFAULT NULL,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME DEFAULT NULL,
    two_factor_enabled INTEGER DEFAULT 0 CHECK(two_factor_enabled IN (0, 1)),
    otp_code TEXT DEFAULT NULL,
    otp_expires_at DATETIME DEFAULT NULL,
    reset_code_hash TEXT DEFAULT NULL,
    reset_code_expires DATETIME DEFAULT NULL,
    reset_attempts INTEGER DEFAULT 0,
    daily_ai_requests INTEGER DEFAULT 0,
    last_ai_request_date TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indici per lookup istantanei O(log n)
CREATE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked_until);

-- 2. Tabella Esami (Ownership isolata: ogni riga appartiene a un friend_code)
CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    user_friend_code TEXT NOT NULL,
    name TEXT NOT NULL,
    grade TEXT,
    credits INTEGER DEFAULT 6,
    status TEXT DEFAULT 'planned',
    year TEXT DEFAULT '1° Anno',
    is_idoneita INTEGER DEFAULT 0 CHECK(is_idoneita IN (0, 1)),
    study_time_min INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_friend_code) REFERENCES users(friend_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exams_user ON exams(user_friend_code);
CREATE INDEX IF NOT EXISTS idx_exams_user_status ON exams(user_friend_code, status);

-- 3. Tabella Lezioni Orario (Ownership isolata)
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    user_friend_code TEXT NOT NULL,
    day_index INTEGER NOT NULL CHECK(day_index BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    subject TEXT NOT NULL,
    room TEXT DEFAULT '',
    professor TEXT DEFAULT '',
    color TEXT DEFAULT '#38bdf8',
    date TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_friend_code) REFERENCES users(friend_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_friend_code);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(user_friend_code, day_index);

-- 4. Tabella Scadenze & Consegne (Ownership isolata)
CREATE TABLE IF NOT EXISTS deadlines (
    id TEXT PRIMARY KEY,
    user_friend_code TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    tag TEXT DEFAULT 'Esame',
    color TEXT DEFAULT '#38bdf8',
    completed INTEGER DEFAULT 0 CHECK(completed IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_friend_code) REFERENCES users(friend_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deadlines_user ON deadlines(user_friend_code);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(user_friend_code, date, completed);

-- 5. Tabella Amicizie Reciproche (Collegamento bilaterale verificato)
CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_code TEXT NOT NULL,
    friend_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_code, friend_code),
    FOREIGN KEY (user_code) REFERENCES users(friend_code) ON DELETE CASCADE,
    FOREIGN KEY (friend_code) REFERENCES users(friend_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_code);
CREATE INDEX IF NOT EXISTS idx_friends_target ON friends(friend_code);

-- 6. Tabella Segnalazioni Bug & Feedback
CREATE TABLE IF NOT EXISTS bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    friend_code TEXT DEFAULT 'ANON',
    username TEXT DEFAULT 'Anonimo',
    message TEXT NOT NULL,
    error_log TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Log di Sicurezza (Tracciamento accessi ed eventi sensibili)
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    friend_code TEXT,
    ip_address TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_event ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_time ON security_audit_logs(created_at);
