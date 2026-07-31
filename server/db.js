'use strict';
/**
 * SQLite veri katmani. Tum sorgular hazir ifade (prepared statement) ile
 * calisir — kullanici girdisi hicbir zaman SQL metnine yapistirilmaz.
 */
const fs = require('node:fs');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');   // okuma ve yazma birbirini kilitlemesin
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  cover        TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  views        INTEGER NOT NULL DEFAULT 0,
  published_at INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_status_date ON posts (status, published_at DESC);

CREATE TABLE IF NOT EXISTS users (
  username   TEXT PRIMARY KEY,
  pass_hash  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,          -- cerezdeki jetonun SHA-256 ozeti
  username   TEXT NOT NULL,
  csrf       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip         TEXT,
  ua         TEXT
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);

-- Editordeki otomatik kayit. Anahtar: yazi id'si ya da yeni yazi icin 'new'.
CREATE TABLE IF NOT EXISTS autosave (
  key     TEXT PRIMARY KEY,
  title   TEXT NOT NULL DEFAULT '',
  body    TEXT NOT NULL DEFAULT '',
  cover   TEXT NOT NULL DEFAULT '',
  savedatms INTEGER NOT NULL
);

-- Basarisiz giris denemeleri: hem kilitleme hem de fail2ban icin kayit.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip      TEXT NOT NULL,
  at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts (ip, at);

-- Okunma sayaci: ayni ziyaretci ayni yaziyi gun icinde bir kez sayilir.
CREATE TABLE IF NOT EXISTS post_views (
  post_id TEXT NOT NULL,
  viewer  TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (post_id, viewer)
);
CREATE INDEX IF NOT EXISTS post_views_at ON post_views (at);
`);

/* ── yazilar ─────────────────────────────────────────────────────────────── */

const q = {
  allPosts: db.prepare('SELECT * FROM posts ORDER BY updated_at DESC'),
  published: db.prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC"),
  bySlug: db.prepare("SELECT * FROM posts WHERE slug = ?"),
  publishedBySlug: db.prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published'"),
  byId: db.prepare('SELECT * FROM posts WHERE id = ?'),
  slugTaken: db.prepare('SELECT 1 FROM posts WHERE slug = ? AND id <> ?'),
  insert: db.prepare(`INSERT INTO posts (id, slug, title, body, cover, status, views, published_at, updated_at)
                      VALUES (@id, @slug, @title, @body, @cover, @status, @views, @published_at, @updated_at)`),
  update: db.prepare(`UPDATE posts SET slug=@slug, title=@title, body=@body, cover=@cover,
                      status=@status, published_at=@published_at, updated_at=@updated_at WHERE id=@id`),
  remove: db.prepare('DELETE FROM posts WHERE id = ?'),
  bumpView: db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?'),
  stats: db.prepare(`SELECT
      COALESCE(SUM(views), 0)                                     AS views,
      COALESCE(SUM(status = 'published'), 0)                      AS published,
      COALESCE(SUM(status = 'draft'), 0)                          AS drafts
    FROM posts`),
  usedCovers: db.prepare("SELECT cover FROM posts WHERE cover LIKE '/uploads/%'"),
  bodies: db.prepare('SELECT body FROM posts'),
};

const posts = {
  all: () => q.allPosts.all(),
  published: () => q.published.all(),
  bySlug: (slug) => q.bySlug.get(slug),
  publishedBySlug: (slug) => q.publishedBySlug.get(slug),
  byId: (id) => q.byId.get(id),
  slugTaken: (slug, exceptId = '') => !!q.slugTaken.get(slug, exceptId),
  insert: (row) => q.insert.run(row),
  update: (row) => q.update.run(row),
  remove: (id) => q.remove.run(id),
  stats: () => q.stats.get(),
  usedImagePaths() {
    const used = new Set();
    for (const r of q.usedCovers.all()) used.add(r.cover);
    const re = /\/uploads\/[A-Za-z0-9._-]+/g;
    for (const r of q.bodies.all()) {
      let m;
      while ((m = re.exec(r.body))) used.add(m[0]);
    }
    return used;
  },
};

/* ── okunma sayaci ───────────────────────────────────────────────────────── */

const qViewSeen = db.prepare('SELECT 1 FROM post_views WHERE post_id = ? AND viewer = ?');
const qViewMark = db.prepare('INSERT OR IGNORE INTO post_views (post_id, viewer, at) VALUES (?, ?, ?)');
const qViewPrune = db.prepare('DELETE FROM post_views WHERE at < ?');

const views = {
  /** Bugun bu ziyaretci bu yaziyi ilk kez aciyorsa sayaci bir artirir. */
  bump(postId, viewer) {
    if (qViewSeen.get(postId, viewer)) return;
    const t = Date.now();
    qViewMark.run(postId, viewer, t);
    q.bumpView.run(postId);
  },
  prune: () => qViewPrune.run(Date.now() - 3 * 86400e3),
};

/* ── kullanicilar ────────────────────────────────────────────────────────── */

const qUserGet = db.prepare('SELECT * FROM users WHERE username = ?');
const qUserUpsert = db.prepare(`INSERT INTO users (username, pass_hash, created_at, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(username) DO UPDATE SET pass_hash = excluded.pass_hash, updated_at = excluded.updated_at`);
const qUserCount = db.prepare('SELECT COUNT(*) AS n FROM users');

const users = {
  get: (username) => qUserGet.get(username),
  upsert: (username, passHash) => qUserUpsert.run(username, passHash, Date.now(), Date.now()),
  count: () => qUserCount.get().n,
};

/* ── oturumlar ───────────────────────────────────────────────────────────── */

const qSessGet = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?');
const qSessNew = db.prepare(`INSERT INTO sessions (id, username, csrf, created_at, expires_at, ip, ua)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`);
const qSessDel = db.prepare('DELETE FROM sessions WHERE id = ?');
const qSessDelUser = db.prepare('DELETE FROM sessions WHERE username = ?');
const qSessTouch = db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?');
const qSessPrune = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

const sessions = {
  get: (id) => qSessGet.get(id, Date.now()),
  create: (id, username, csrf, expiresAt, ip, ua) => qSessNew.run(id, username, csrf, Date.now(), expiresAt, ip, ua),
  destroy: (id) => qSessDel.run(id),
  destroyAllFor: (username) => qSessDelUser.run(username),
  touch: (id, expiresAt) => qSessTouch.run(expiresAt, id),
  prune: () => qSessPrune.run(Date.now()),
};

/* ── giris denemeleri ────────────────────────────────────────────────────── */

const qAttAdd = db.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)');
const qAttCount = db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?');
const qAttClear = db.prepare('DELETE FROM login_attempts WHERE ip = ?');
const qAttPrune = db.prepare('DELETE FROM login_attempts WHERE at < ?');

const attempts = {
  add: (ip) => qAttAdd.run(ip, Date.now()),
  recent: (ip, sinceMs) => qAttCount.get(ip, Date.now() - sinceMs).n,
  clear: (ip) => qAttClear.run(ip),
  prune: () => qAttPrune.run(Date.now() - 86400e3),
};

/* ── otomatik kayit ──────────────────────────────────────────────────────── */

const qAutoGet = db.prepare('SELECT * FROM autosave WHERE key = ?');
const qAutoAll = db.prepare('SELECT * FROM autosave');
const qAutoPut = db.prepare(`INSERT INTO autosave (key, title, body, cover, savedatms) VALUES (@key, @title, @body, @cover, @at)
  ON CONFLICT(key) DO UPDATE SET title=excluded.title, body=excluded.body, cover=excluded.cover, savedatms=excluded.savedatms`);
const qAutoDel = db.prepare('DELETE FROM autosave WHERE key = ?');

const autosave = {
  get: (key) => qAutoGet.get(key),
  all: () => qAutoAll.all(),
  put: (key, title, body, cover) => qAutoPut.run({ key, title, body, cover, at: Date.now() }),
  clear: (key) => qAutoDel.run(key),
};

/* ── bakim ───────────────────────────────────────────────────────────────── */

function housekeeping() {
  sessions.prune();
  attempts.prune();
  views.prune();
}

function backup(toFile) {
  return db.backup(toFile);
}

function close() {
  try { db.close(); } catch { /* zaten kapali */ }
}

module.exports = { db, posts, users, sessions, attempts, autosave, views, housekeeping, backup, close };
