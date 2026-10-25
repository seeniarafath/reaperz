/**
 * ====================================================================
 *   REAPERZ COMMUNITY - NODE.JS SERVER (PORT 5000)
 *   Tamil GTA 5 Online & FiveM Community Web Server
 *   Powered by Node.js built-ins: http, fs, path, crypto, node:sqlite
 *   Zero external npm dependencies.
 *   Features SQLite SQL database, PBKDF2 staff auth, dynamic media library,
 *   reliable reviews system, and live Discord status integration.
 * ====================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'reaperz.db');
const JSON_BACKUP_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(BASE_DIR, 'assets', 'images', 'uploads');

// Ensure essential directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Initialize SQLite Database Connection
let db;
try {
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('[DB] Connected to SQLite database:', DB_FILE);
} catch (err) {
  console.error('[DB Error] Failed to open SQLite database:', err);
  process.exit(1);
}

// In-memory active staff sessions: token -> { id, username, name, role, expires }
const ACTIVE_SESSIONS = new Map();

// In-memory Discord presence cache: userId -> { status, avatar, cached_at }
const DISCORD_PRESENCE_CACHE = new Map();
const DISCORD_CACHE_TTL_MS = 45 * 1000;

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// ============================================================================
// PASSWORD HASHING UTILITIES (PBKDF2-HMAC-SHA256, 100,000 ITERATIONS)
// ============================================================================

function hashPassword(password, saltHex = null) {
  if (!saltHex) {
    saltHex = crypto.randomBytes(16).toString('hex');
  }
  const saltBuf = Buffer.from(saltHex, 'hex');
  const key = crypto.pbkdf2Sync(password, saltBuf, 100000, 32, 'sha256');
  return { salt: saltHex, hash: key.toString('hex') };
}

function verifyPassword(password, saltHex, storedHashHex) {
  try {
    const saltBuf = Buffer.from(saltHex, 'hex');
    const computedKey = crypto.pbkdf2Sync(password, saltBuf, 100000, 32, 'sha256');
    const storedBuf = Buffer.from(storedHashHex, 'hex');
    if (computedKey.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(computedKey, storedBuf);
  } catch (err) {
    return false;
  }
}

// ============================================================================
// DATABASE INITIALIZATION & SCHEMA CREATION
// ============================================================================

function initDatabase() {
  // 1. Members Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Member',
      game TEXT NOT NULL DEFAULT 'GTA V / FiveM',
      discord TEXT DEFAULT NULL,
      discord_id TEXT DEFAULT NULL,
      discord_status TEXT NOT NULL DEFAULT 'Offline',
      avatar TEXT DEFAULT NULL,
      department TEXT NOT NULL DEFAULT 'Community',
      details TEXT DEFAULT '',
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure department and details columns exist on members
  try {
    const memCols = db.prepare('PRAGMA table_info(members)').all().map(c => c.name);
    if (!memCols.includes('department')) {
      db.exec("ALTER TABLE members ADD COLUMN department TEXT NOT NULL DEFAULT 'Community';");
    }
    if (!memCols.includes('details')) {
      db.exec("ALTER TABLE members ADD COLUMN details TEXT DEFAULT '';");
    }
  } catch (e) {}

  // 2. Staff Table (Secure PBKDF2 Authentication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT DEFAULT NULL
    );
  `);

  // 3. Applications Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      discord TEXT NOT NULL,
      age INTEGER NOT NULL,
      game TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Member',
      timezone TEXT DEFAULT 'IST',
      about TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Messages Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Ratings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      discord TEXT NOT NULL,
      stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
      category TEXT NOT NULL DEFAULT 'FiveM Roleplay',
      experience TEXT DEFAULT 'Member',
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      recommended INTEGER NOT NULL DEFAULT 1,
      helpful INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Library Media Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT 'image/jpeg',
      description TEXT DEFAULT NULL,
      uploaded_by TEXT DEFAULT 'Staff',
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Community Highlights Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      event_date TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. Events Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      location TEXT DEFAULT 'FiveM Server / Los Santos',
      organizer TEXT DEFAULT 'REAPERZ Staff',
      status TEXT DEFAULT 'Upcoming',
      category TEXT DEFAULT 'Community Event',
      prize TEXT DEFAULT '',
      button_text TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      discord_link TEXT DEFAULT '',
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const eventCols = db.prepare('PRAGMA table_info(events)').all().map(column => column.name);
  for (const [name, definition] of [
    ['category', "TEXT DEFAULT 'Community Event'"],
    ['prize', "TEXT DEFAULT ''"],
    ['button_text', "TEXT DEFAULT ''"],
    ['display_order', 'INTEGER DEFAULT 0']
  ]) {
    if (!eventCols.includes(name)) db.exec(`ALTER TABLE events ADD COLUMN ${name} ${definition};`);
  }

  // 9. Gaming Platforms Table (GTA V Online Crew & FiveM Servers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS gaming_platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      link TEXT DEFAULT '',
      status TEXT DEFAULT 'Active',
      display_order INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      meta_key TEXT PRIMARY KEY,
      meta_value TEXT NOT NULL
    );
  `);

  // 10. Website Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS website_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default staff accounts
  const staffCount = db.prepare('SELECT COUNT(*) as cnt FROM staff').get().cnt;
  const founderPass = process.env.STAFF_FOUNDER_PASS;
  const adminPass = process.env.STAFF_ADMIN_PASS;

  if (staffCount === 0) {
    if (!founderPass || !adminPass) {
      throw new Error('Set STAFF_FOUNDER_PASS and STAFF_ADMIN_PASS before initializing an empty database.');
    }
    const founder = hashPassword(founderPass);
    const admin = hashPassword(adminPass);

    const insertStaff = db.prepare(`
      INSERT INTO staff (username, name, role, password_hash, salt, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStaff.run('dark', 'Dark', 'Founder', founder.hash, founder.salt, new Date().toISOString());
    insertStaff.run('founder', 'REAPER ARAFATH', 'Founder', founder.hash, founder.salt, new Date().toISOString());
    insertStaff.run('admin', 'WOLF', 'Admin', admin.hash, admin.salt, new Date().toISOString());
    console.log('[DB] Initialized default staff accounts with salted password hashes.');
  } else {
    // Ensure 'dark' staff exists
    const darkStaff = db.prepare("SELECT id FROM staff WHERE username = 'dark'").get();
    if (!darkStaff && founderPass) {
      const founder = hashPassword(founderPass);
      db.prepare(`
        INSERT INTO staff (username, name, role, password_hash, salt, created_at)
        VALUES ('dark', 'Dark', 'Founder', ?, ?, ?)
      `).run(founder.hash, founder.salt, new Date().toISOString());
    } else if (!darkStaff) {
      console.warn('[DB] STAFF_FOUNDER_PASS is not set; skipped creating the additional Dark account.');
    }
  }

  // Seed default members if not present
  const membersCount = db.prepare('SELECT COUNT(*) as cnt FROM members').get().cnt;
  const founderAvatar = 'https://cdn.discordapp.com/avatars/937289791429562398/9970cd81f120a25115493cc9ed04a777.png?size=4096&ignore=true';

  if (membersCount === 0) {
    const defaultMembers = [
      ['Dark', 'Founder', 'GTA V / FiveM', 'rpz_dark', '937289791429562398', 'Online', founderAvatar, 'Command', 'Community Founder & Head of Operations', '2026-01-01T00:00:00Z'],
      ['Beast Boy', 'Developer', 'GTA V / FiveM', 'beastboy', '912345678901234568', 'Online', '', 'Development', 'Lead Website & Systems Developer', '2026-01-10T00:00:00Z'],
      ['REAPER ARAFATH', 'Founder', 'GTA V / FiveM', 'arafath', '912345678901234560', 'Online', '', 'Command', 'Co-Founder', '2026-01-01T00:00:00Z'],
      ['WOLF', 'Admin', 'FiveM', 'wolf', '912345678901234561', 'Online', '', 'Operations', 'Head Administrator', '2026-01-15T00:00:00Z'],
      ['SHADOW', 'Moderator', 'GTA V Online', 'shadow', '912345678901234562', 'Idle', '', 'Roleplay', 'RP Division Lead', '2026-02-01T00:00:00Z'],
      ['KING', 'Moderator', 'FiveM', 'king', '912345678901234563', 'Do Not Disturb', '', 'Events', 'Events Coordinator', '2026-02-10T00:00:00Z'],
      ['VIKRAM', 'Member', 'GTA V Online', 'vikram', '912345678901234564', 'Online', '', 'Heists', 'Tactical Heist Squad', '2026-03-01T00:00:00Z'],
      ['SURIYA', 'Member', 'FiveM', 'suriya', '912345678901234565', 'Online', '', 'Roleplay', 'Senior Roleplayer', '2026-03-05T00:00:00Z'],
      ['RAJ', 'Member', 'GTA V Online', 'raj', '912345678901234566', 'Offline', '', 'Community', 'Crew Member', '2026-03-12T00:00:00Z'],
      ['KARTHI', 'Member', 'FiveM', 'karthi', '912345678901234567', 'Online', '', 'Community', 'Crew Member', '2026-03-20T00:00:00Z']
    ];

    const insertMember = db.prepare(`
      INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of defaultMembers) {
      insertMember.run(...m);
    }
    console.log('[DB] Seeded default members roster.');
  } else {
    // Ensure Founder Dark and Developer Beast Boy are present and correct
    const darkMem = db.prepare("SELECT id FROM members WHERE discord = 'rpz_dark' OR name = 'Dark'").get();
    if (darkMem) {
      db.prepare(`
        UPDATE members SET
          name = 'Dark',
          role = 'Founder',
          discord = 'rpz_dark',
          discord_id = '937289791429562398',
          discord_status = 'Online',
          avatar = ?,
          department = 'Command',
          details = 'Community Founder & Head of Operations'
        WHERE id = ?
      `).run(founderAvatar, darkMem.id);
    } else {
      db.prepare(`
        INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
        VALUES ('Dark', 'Founder', 'GTA V / FiveM', 'rpz_dark', '937289791429562398', 'Online', ?, 'Command', 'Community Founder & Head of Operations', '2026-01-01T00:00:00Z')
      `).run(founderAvatar);
    }

    const beastMem = db.prepare("SELECT id FROM members WHERE LOWER(name) = 'beast boy' OR discord = 'beastboy'").get();
    if (!beastMem) {
      db.prepare(`
        INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
        VALUES ('Beast Boy', 'Developer', 'GTA V / FiveM', 'beastboy', '912345678901234568', 'Online', '', 'Development', 'Lead Website & Systems Developer', '2026-01-10T00:00:00Z')
      `).run();
    }
  }

  // Seed default community highlights if empty
  const highlightsCount = db.prepare('SELECT COUNT(*) as cnt FROM community_highlights').get().cnt;
  if (highlightsCount === 0) {
    const defaultHighlights = [
      ['NURP Community Mega Roleplay', 'REAPERZ Police & EMS division staging tactical patrol convoy across Sandy Shores.', 'assets/images/gallery-1.jpg', '2026-10-01', 1, 1],
      ['Los Santos Midnight Squad Run', 'High-speed night cruise and freeway formation through downtown Los Santos.', 'assets/images/gallery-2.jpg', '2026-10-02', 2, 1],
      ['Tamil Car Enthusiasts Meetup', 'Clean JDM tuners and widebody hypercars on display at Del Perro pier car show.', 'assets/images/gallery-3.jpg', '2026-10-03', 3, 1],
      ['City Roleplay Action & Briefing', 'Subway station operation and city roleplay patrol debriefing session.', 'assets/images/gallery-4.jpg', '2026-10-04', 4, 1],
      ['Highway Convoy & Fleet Drive', 'Blaine County highway formation convoy heading towards Mount Chiliad.', 'assets/images/gallery-5.jpg', '2026-10-05', 5, 1],
      ['Squad Briefing & Heist Setup', 'Pre-heist tactical briefing and weapons layout prior to Casino vault breach.', 'assets/images/gallery-6.jpg', '2026-10-06', 6, 1]
    ];
    const insH = db.prepare('INSERT INTO community_highlights (title, description, image_url, event_date, display_order, is_published) VALUES (?, ?, ?, ?, ?, ?)');
    for (const h of defaultHighlights) insH.run(...h);
    console.log('[DB] Seeded community highlights.');
  }

  // Seed default events if empty
  const eventsCount = db.prepare('SELECT COUNT(*) as cnt FROM events').get().cnt;
  if (eventsCount === 0) {
    const defaultEvents = [
      ['NURP Community Mega Roleplay Event', 'Massive city-wide joint operation with police pursuits, gang territory showdowns, and emergency EMS responses on NURP RP server.', 'assets/images/gallery-1.jpg', '2026-10-20', '8:00 PM IST', 'NURP Roleplay Server', 'Dark & REAPERZ Staff', 'Upcoming', 'https://discord.gg/reaperz-tamil', 1],
      ['Los Santos Midnight Tuner Grand Prix', 'High-octane street racing tournament through the tunnels and highways of Los Santos. Cash prizes and custom Discord titles for winners!', 'assets/images/gallery-3.jpg', '2026-10-25', '9:00 PM IST', 'GTA V Online Private Lobby', 'KING', 'Upcoming', 'https://discord.gg/reaperz-tamil', 1],
      ['Doomsday Heist Criminal Mastermind Run', 'Elite crew operation completing all acts of the Doomsday Heist with zero deaths and elite challenge times.', 'assets/images/gallery-6.jpg', '2026-10-05', '7:30 PM IST', 'GTA V Online Facility', 'VIKRAM & WOLF', 'Past', 'https://discord.gg/reaperz-tamil', 1],
      ['Sandy Shores Tactical Convoy', 'Cross-county convoy and fleet parade featuring 25+ crew members cruising through Blaine County.', 'assets/images/gallery-5.jpg', '2026-09-28', '8:00 PM IST', 'FiveM Roleplay Server', 'SHADOW', 'Past', 'https://discord.gg/reaperz-tamil', 1]
    ];
    const insE = db.prepare('INSERT INTO events (title, description, image_url, event_date, event_time, location, organizer, status, discord_link, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const e of defaultEvents) insE.run(...e);
    console.log('[DB] Seeded events.');
  }

  // Seed platform defaults once so deleting all managed records persists across restarts.
  const platformSeed = db.prepare("SELECT meta_value FROM app_metadata WHERE meta_key = 'gaming_platforms_seeded'").get();
  if (!platformSeed) {
    const platformsCount = db.prepare('SELECT COUNT(*) as cnt FROM gaming_platforms').get().cnt;
    if (platformsCount === 0) {
      const defaultPlatforms = [
        ['gta_online', 'TN REAPERZ', 'Official Rockstar Social Club Crew for GTA Online', 'assets/images/gallery-2.jpg', 'https://socialclub.rockstargames.com', 'Active', 1, 1],
        ['fivem', 'NURP RP', 'Tamil Roleplay FiveM Server — Primary Server for REAPERZ', 'assets/images/gallery-4.jpg', 'fivem://connect/cfx.re/join/nurp', 'Active', 1, 1]
      ];
      const insP = db.prepare('INSERT INTO gaming_platforms (type, name, description, image_url, link, status, display_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const p of defaultPlatforms) insP.run(...p);
      console.log('[DB] Seeded gaming platforms.');
    }
    db.prepare('INSERT INTO app_metadata (meta_key, meta_value) VALUES (?, ?)').run('gaming_platforms_seeded', '1');
  }

  // Seed default website settings
  const settingsRows = db.prepare('SELECT COUNT(*) as cnt FROM website_settings').get().cnt;
  if (settingsRows === 0) {
    const defaultSettings = [
      ['discord_invite', 'https://discord.gg/reaperz-tamil']
    ];
    const insS = db.prepare('INSERT INTO website_settings (setting_key, setting_value) VALUES (?, ?)');
    for (const s of defaultSettings) insS.run(...s);
    console.log('[DB] Seeded website settings.');
  }

  // Seed default ratings if not present
  const ratingsCount = db.prepare('SELECT COUNT(*) as cnt FROM ratings').get().cnt;
  if (ratingsCount === 0) {
    const defaultRatings = [
      ['Arun Kumar', 'arun_chennai#1001', 5, 'FiveM Roleplay', '6+ Months', 'Top-tier FiveM Tamil Roleplay!', 'Joined REAPERZ 4 months ago for FiveM police and EMS RP. The community is well-organized, friendly, and non-toxic. Voice calls in Tamil make gaming feel like family!', 1, 18, '2026-10-10T14:20:00Z'],
      ['Siva Nathan', 'siva_kl#7723', 5, 'GTA 5 Online', '3-6 Months', 'Best Crew for Heists and Money Grinding', 'Cayo Perico, Casino, and Doomsday heists with REAPER ARAFATH and the squad are super smooth. No griefers, pure coordination and maximum payouts.', 1, 14, '2026-10-11T09:15:00Z'],
      ['Vignesh V', 'vicky_racer#4412', 5, 'Car Meets & Racing', '1-3 Months', 'Los Santos Tamil Car Meets are Pure Fire!', 'The weekly car shows, mountain drift runs, and highway convoys are insanely fun. Great custom builds, respectful members, and high adrenaline.', 1, 11, '2026-10-11T18:40:00Z'],
      ['Mohamed Irfan', 'irfan_reaper#3321', 5, 'Community & Atmosphere', '6+ Months', 'Zero Toxicity & True Tamil Brotherhood', 'Whether you are a beginner or a veteran player, everyone treats you with respect. Staff members SHADOW and WOLF are always helpful on voice calls.', 1, 9, '2026-10-12T12:05:00Z'],
      ['Praveen Raj', 'praveen_gta#5589', 4, 'FiveM Roleplay', 'New Recruit', 'Solid Community with Active Leadership', 'Very active Discord, clear community rules, and regular server events. The admins guided me through setting up FiveM mods quickly.', 1, 7, '2026-10-12T17:30:00Z']
    ];

    const insertRating = db.prepare(`
      INSERT INTO ratings (name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of defaultRatings) {
      insertRating.run(...r);
    }
    console.log('[DB] Seeded default player ratings.');
  }

  // Seed default library media if not present
  const libraryCount = db.prepare('SELECT COUNT(*) as cnt FROM library').get().cnt;
  if (libraryCount === 0) {
    const defaultMedia = [
      ['FiveM Patrol & Convoy Meet', 'FiveM RP', 'gallery-1.jpg', 'assets/images/gallery-1.jpg', 283047, 'image/jpeg', 'REAPERZ Police & EMS division staging tactical patrol convoy across Sandy Shores.', 'REAPER ARAFATH', '2026-10-01T12:00:00Z'],
      ['Los Santos Midnight Squad Run', 'GTA 5 Online', 'gallery-2.jpg', 'assets/images/gallery-2.jpg', 284219, 'image/jpeg', 'High-speed night cruise and freeway formation through downtown Los Santos.', 'WOLF', '2026-10-02T15:30:00Z'],
      ['Tamil Car Enthusiasts Meetup', 'Car Meets', 'gallery-3.jpg', 'assets/images/gallery-3.jpg', 284872, 'image/jpeg', 'Clean JDM tuners and widebody hypercars on display at Del Perro pier car show.', 'KING', '2026-10-03T18:00:00Z'],
      ['City Roleplay Action & Briefing', 'FiveM RP', 'gallery-4.jpg', 'assets/images/gallery-4.jpg', 298721, 'image/jpeg', 'Subway station operation and city roleplay patrol debriefing session.', 'SHADOW', '2026-10-04T20:15:00Z'],
      ['Highway Convoy & Fleet Drive', 'Crew Convoys', 'gallery-5.jpg', 'assets/images/gallery-5.jpg', 316724, 'image/jpeg', 'Blaine County highway formation convoy heading towards Mount Chiliad.', 'VIKRAM', '2026-10-05T14:40:00Z'],
      ['Squad Briefing & Heist Setup', 'Heist Operations', 'gallery-6.jpg', 'assets/images/gallery-6.jpg', 348681, 'image/jpeg', 'Pre-heist tactical briefing and weapons layout prior to Casino vault breach.', 'REAPER ARAFATH', '2026-10-06T19:00:00Z']
    ];

    const insertMedia = db.prepare(`
      INSERT INTO library (title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of defaultMedia) {
      insertMedia.run(...m);
    }
    console.log('[DB] Seeded default media library items.');
  }

  // Seed default application if empty
  const appsCount = db.prepare('SELECT COUNT(*) as cnt FROM applications').get().cnt;
  if (appsCount === 0) {
    db.prepare(`
      INSERT INTO applications (name, discord, age, game, role, timezone, about, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `).run(
      'Dinesh Kumar',
      'dinesh_gta#1234',
      21,
      'FiveM',
      'Police RP',
      'IST (Tamil Nadu)',
      'Experienced in FiveM Tamil servers for 2 years. Looking for a serious and fun roleplay community with REAPERZ.',
      '2026-10-12T19:30:00Z'
    );
  }

  syncToJson();
}

function syncToJson() {
  try {
    const members = db.prepare('SELECT id, name, role, game, discord, discord_id, discord_status as status, avatar, department, details, joined_at FROM members ORDER BY id ASC').all();
    const apps = db.prepare('SELECT id, name, discord, age, game, role, timezone, about, status, submitted_at FROM applications ORDER BY id DESC').all();
    const msgs = db.prepare('SELECT id, name, email, subject, message, submitted_at FROM messages ORDER BY id DESC').all();
    const ratings = db.prepare('SELECT id, name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at FROM ratings ORDER BY id DESC').all().map(r => ({
      ...r,
      recommended: Boolean(r.recommended)
    }));
    const library = db.prepare('SELECT id, title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at FROM library ORDER BY id DESC').all();
    const highlights = db.prepare('SELECT id, title, description, image_url, event_date, display_order, is_published, created_at FROM community_highlights ORDER BY display_order ASC, id DESC').all();
    const eventsList = db.prepare('SELECT id, title, description, image_url, event_date, event_time, location, organizer, status, category, prize, button_text, display_order, discord_link, is_published, created_at FROM events ORDER BY display_order ASC, event_date ASC').all();
    const platforms = db.prepare('SELECT id, type, name, description, image_url, link, status, display_order, is_published, created_at FROM gaming_platforms ORDER BY display_order ASC, id ASC').all();
    const settingsRows = db.prepare('SELECT setting_key, setting_value FROM website_settings').all();
    const settings = {};
    for (const s of settingsRows) settings[s.setting_key] = s.setting_value;

    const payload = {
      members,
      applications: apps,
      messages: msgs,
      ratings,
      library,
      community_highlights: highlights,
      events: eventsList,
      gaming_platforms: platforms,
      website_settings: settings
    };

    fs.writeFileSync(JSON_BACKUP_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DB Warn] Could not sync to db.json:', err.message);
  }
}

// Run DB Initialization
initDatabase();

// ============================================================================
// SESSION & AUTHENTICATION HELPERS
// ============================================================================

function extractToken(req) {
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith('reaperz_staff_session='));
  if (cookie) return cookie.slice('reaperz_staff_session='.length);
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }
  const headerToken = (req.headers['x-staff-token'] || '').trim();
  if (headerToken) return headerToken;
  return '';
}

function verifyStaffSession(req) {
  const token = extractToken(req);
  if (!token || !ACTIVE_SESSIONS.has(token)) return null;

  const session = ACTIVE_SESSIONS.get(token);
  if (Date.now() > session.expires) {
    ACTIVE_SESSIONS.delete(token);
    return null;
  }
  if (!['founder', 'admin'].includes(String(session.role || '').toLowerCase())) return null;
  // Extend session by 2 hours on activity
  session.expires = Date.now() + 2 * 60 * 60 * 1000;
  return session;
}

// ============================================================================
// DISCORD PRESENCE INTEGRATION (LANYARD & CDN FALLBACK)
// ============================================================================

async function fetchDiscordPresence(userId, memberId = null) {
  // Requirement 8: Founder Dark (Discord ID: 937289791429562398) always displays Online
  if (userId === '937289791429562398') {
    return {
      success: true,
      user_id: userId,
      status: 'Online',
      avatar: 'https://cdn.discordapp.com/avatars/937289791429562398/9970cd81f120a25115493cc9ed04a777.png?size=4096&ignore=true',
      source: 'live'
    };
  }

  const now = Date.now();

  if (DISCORD_PRESENCE_CACHE.has(userId)) {
    const cached = DISCORD_PRESENCE_CACHE.get(userId);
    if (now - cached.cached_at < DISCORD_CACHE_TTL_MS) {
      return {
        success: true,
        user_id: userId,
        status: cached.status,
        avatar: cached.avatar,
        source: 'cache'
      };
    }
  }

  let status = 'Offline';
  let avatar = '';

  // 1. Check Lanyard API if valid Snowflake ID (17-20 digits)
  if (userId && /^\d{17,20}$/.test(userId)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2200);

      const res = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, {
        headers: { 'User-Agent': 'REAPERZ-Community-Portal/2.0' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const rawStatus = (json.data.discord_status || 'offline').toLowerCase();
          const STATUS_MAP = {
            'online': 'Online',
            'idle': 'Idle',
            'dnd': 'Do Not Disturb',
            'offline': 'Offline'
          };
          status = STATUS_MAP[rawStatus] || 'Offline';

          const userObj = json.data.discord_user || {};
          if (userObj.avatar) {
            avatar = `https://cdn.discordapp.com/avatars/${userId}/${userObj.avatar}.png?size=128`;
          }
        }
      }
    } catch (e) {
      // Network error or timeout, proceed to fallback
    }
  }

  // 2. Fallback Discord embed avatar if Snowflake exists
  if (!avatar && userId && /^\d{17,20}$/.test(userId)) {
    try {
      const idx = Number((BigInt(userId) >> 22n) % 6n);
      avatar = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
    } catch (e) {
      avatar = '';
    }
  }

  // Update in-memory cache
  if (userId) {
    DISCORD_PRESENCE_CACHE.set(userId, { status, avatar, cached_at: now });
  }

  // Update SQL database if active status detected for member
  if (memberId && status !== 'Offline') {
    try {
      if (avatar) {
        db.prepare('UPDATE members SET discord_status = ?, avatar = ? WHERE id = ?').run(status, avatar, memberId);
      } else {
        db.prepare('UPDATE members SET discord_status = ? WHERE id = ?').run(status, memberId);
      }
      syncToJson();
    } catch (e) {}
  }

  return {
    success: true,
    user_id: userId,
    status,
    avatar,
    source: 'live'
  };
}

// ============================================================================
// HTTP REQUEST HELPERS
// ============================================================================

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Staff-Token',
    ...extraHeaders
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) { // 25MB safety limit
        req.destroy();
        reject(new Error('Payload exceeds maximum allowed limit.'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        // Fallback urlencoded parser
        try {
          const params = new URLSearchParams(body);
          const obj = {};
          for (const [k, v] of params.entries()) obj[k] = v;
          resolve(obj);
        } catch (e) {
          resolve({});
        }
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(req, res, reqPath) {
  let cleanPath = reqPath === '/' || reqPath === '' ? 'index.html' : reqPath.replace(/^\/+/, '');

  // Clean route aliases (e.g. /staff, /events, /members)
  if (cleanPath === 'staff' || cleanPath === 'staff/') cleanPath = 'admin.html';
  else if (cleanPath === 'events' || cleanPath === 'events/') cleanPath = 'events.html';
  else if (cleanPath === 'members' || cleanPath === 'members/') cleanPath = 'members.html';
  else if (cleanPath === 'about' || cleanPath === 'about/') cleanPath = 'about.html';
  else if (cleanPath === 'join' || cleanPath === 'join/') cleanPath = 'join.html';
  else if (cleanPath === 'rules' || cleanPath === 'rules/') cleanPath = 'rules.html';
  else if (cleanPath === 'rate' || cleanPath === 'rate/') cleanPath = 'rate.html';
  else if (cleanPath === 'library' || cleanPath === 'library/') cleanPath = 'library.html';
  else if (cleanPath === 'contact' || cleanPath === 'contact/') cleanPath = 'contact.html';

  let resolvedPath = path.resolve(BASE_DIR, cleanPath);
  if (!path.extname(resolvedPath) && fs.existsSync(resolvedPath + '.html')) {
    resolvedPath += '.html';
  }

  // Prevent directory traversal
  if (!resolvedPath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Forbidden');
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html><html><body style="background:#05070c;color:#fff;font-family:sans-serif;padding:60px;text-align:center;">
        <h2>404 | File Not Found</h2><p>The requested file does not exist.</p><a href="/" style="color:#00b7ff;">Back to Home</a>
        </body></html>
      `);
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  });
}

// ============================================================================
// MAIN HTTP SERVER & REST ROUTER
// ============================================================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Staff-Token'
    });
    return res.end();
  }

  // --- 1. COMMUNITY STATS API ---
  if (pathname === '/api/stats' && method === 'GET') {
    try {
      const totalMembers = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
      const onlineMembers = db.prepare("SELECT COUNT(*) as count FROM members WHERE LOWER(discord_status) = 'online'").get().count;
      const pendingApps = db.prepare("SELECT COUNT(*) as count FROM applications WHERE status = 'Pending'").get().count;
      const totalApps = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
      const totalMsgs = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
      const rStat = db.prepare('SELECT COUNT(*) as count, AVG(stars) as avg_score FROM ratings').get();
      const totalMedia = db.prepare('SELECT COUNT(*) as count FROM library').get().count;
      const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
      const totalHighlights = db.prepare('SELECT COUNT(*) as count FROM community_highlights').get().count;
      const totalPlatforms = db.prepare('SELECT COUNT(*) as count FROM gaming_platforms').get().count;

      return sendJson(res, 200, {
        success: true,
        stats: {
          totalMembers,
          onlineMembers,
          pendingApplications: pendingApps,
          totalApplications: totalApps,
          totalMessages: totalMsgs,
          totalRatings: rStat.count || 0,
          averageRating: rStat.avg_score ? Math.round(rStat.avg_score * 10) / 10 : 5.0,
          totalMedia,
          totalEvents,
          totalHighlights,
          totalPlatforms
        }
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: 'Database error fetching stats.' });
    }
  }

  // --- 2. MEMBERS API (SQL CONNECTED) ---
  if (pathname === '/api/members') {
    if (method === 'GET') {
      try {
        const search = (parsedUrl.searchParams.get('search') || '').trim();
        const role = (parsedUrl.searchParams.get('role') || '').trim();
        const department = (parsedUrl.searchParams.get('department') || '').trim();
        const status = (parsedUrl.searchParams.get('status') || '').trim();

        let query = 'SELECT id, name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at FROM members WHERE 1=1';
        const params = [];

        if (search) {
          query += ' AND (LOWER(name) LIKE ? OR LOWER(game) LIKE ? OR LOWER(discord) LIKE ? OR LOWER(discord_id) LIKE ? OR LOWER(role) LIKE ? OR LOWER(department) LIKE ?)';
          const term = `%${search.toLowerCase()}%`;
          params.push(term, term, term, term, term, term);
        }

        if (role && role.toLowerCase() !== 'all') {
          query += ' AND LOWER(role) = ?';
          params.push(role.toLowerCase());
        }

        if (department && department.toLowerCase() !== 'all') {
          query += ' AND LOWER(department) = ?';
          params.push(department.toLowerCase());
        }

        if (status && status.toLowerCase() !== 'all') {
          query += ' AND LOWER(discord_status) = ?';
          params.push(status.toLowerCase());
        }

        query += " ORDER BY CASE role WHEN 'Founder' THEN 1 WHEN 'Admin' THEN 2 WHEN 'Moderator' THEN 3 WHEN 'Developer' THEN 4 ELSE 5 END, id ASC";

        const rows = db.prepare(query).all(...params);
        for (const r of rows) {
          // Requirement 8: Founder status always displays Online
          if (r.role === 'Founder' || r.discord === 'rpz_dark' || r.name === 'Dark') {
            r.discord_status = 'Online';
          }
          r.status = r.discord_status;
        }

        return sendJson(res, 200, { success: true, count: rows.length, members: rows });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: 'Database error retrieving members.' });
      }
    }

    if (method === 'POST') {
      const session = verifyStaffSession(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
      }

      const body = await parseBody(req);
      const name = (body.name || '').trim();
      const role = (body.role || 'Member').trim();
      const game = (body.game || 'GTA V / FiveM').trim();
      const department = (body.department || 'Community').trim();
      const discord = (body.discord || '').trim();
      const discord_id = (body.discord_id || '').trim();
      const discord_status = (body.status || body.discord_status || 'Online').trim();
      const avatar = (body.avatar || '').trim();
      const details = (body.details || body.description || '').trim();
      const joined_at = (body.joined_at || new Date().toISOString()).trim();

      if (!name) {
        return sendJson(res, 422, { success: false, message: 'Member name is required.' });
      }
      if (role === 'Founder' && session.role !== 'Founder') {
        return sendJson(res, 403, { success: false, message: 'Only a Founder can add another Founder.' });
      }

      const insert = db.prepare(`
        INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insert.run(name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at);
      syncToJson();

      const newMember = {
        id: Number(result.lastInsertRowid),
        name,
        role,
        game,
        department,
        details,
        discord,
        discord_id,
        discord_status,
        status: discord_status,
        avatar,
        joined_at
      };

      return sendJson(res, 201, { success: true, member: newMember, message: 'Member added successfully.' });
    }
  }

  // --- 3. SINGLE MEMBER API (GET, PUT, DELETE) ---
  if (pathname.startsWith('/api/members/')) {
    const parts = pathname.split('/');
    const memberId = parseInt(parts[3], 10);

    // GET /api/members/:id
    if (method === 'GET' && !parts[4]) {
      if (isNaN(memberId)) return sendJson(res, 400, { success: false, message: 'Invalid member ID.' });
      const member = db.prepare('SELECT id, name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at FROM members WHERE id = ?').get(memberId);
      if (!member) return sendJson(res, 404, { success: false, message: 'Member not found.' });
      if (member.role === 'Founder' || member.discord === 'rpz_dark' || member.name === 'Dark') {
        member.discord_status = 'Online';
      }
      member.status = member.discord_status;
      return sendJson(res, 200, { success: true, member });
    }

    // PUT /api/members/:id/role
    if (parts[4] === 'role' && method === 'PUT') {
      const session = verifyStaffSession(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
      }

      if (isNaN(memberId)) {
        return sendJson(res, 400, { success: false, message: 'Invalid member ID.' });
      }

      const body = await parseBody(req);
      const newRole = (body.role || '').trim();
      const VALID_ROLES = ['Founder', 'Admin', 'Moderator', 'Developer', 'Member'];

      if (!VALID_ROLES.includes(newRole)) {
        return sendJson(res, 422, { success: false, message: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` });
      }

      const existingMember = db.prepare('SELECT role FROM members WHERE id = ?').get(memberId);
      if (!existingMember) return sendJson(res, 404, { success: false, message: 'Member not found.' });
      if (session.role !== 'Founder' && existingMember.role === 'Founder') {
        return sendJson(res, 403, { success: false, message: 'Only a Founder can change a Founder account.' });
      }
      if (session.role !== 'Founder' && newRole === 'Founder') {
        return sendJson(res, 403, { success: false, message: 'Only Founder can appoint another Founder.' });
      }

      db.prepare('UPDATE members SET role = ? WHERE id = ?').run(newRole, memberId);
      syncToJson();
      return sendJson(res, 200, { success: true, message: `Role updated to ${newRole}` });
    }

    // PUT /api/members/:id
    if (method === 'PUT' && !parts[4]) {
      const session = verifyStaffSession(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
      }

      const body = await parseBody(req);
      const existingMember = db.prepare('SELECT role FROM members WHERE id = ?').get(memberId);
      if (!existingMember) return sendJson(res, 404, { success: false, message: 'Member not found.' });
      const validRoles = ['Founder', 'Admin', 'Moderator', 'Developer', 'Member'];
      if (body.role !== undefined && !validRoles.includes(body.role)) {
        return sendJson(res, 422, { success: false, message: 'Invalid member role.' });
      }
      if (session.role !== 'Founder' && (existingMember.role === 'Founder' || body.role === 'Founder')) {
        return sendJson(res, 403, { success: false, message: 'Only a Founder can edit Founder accounts or assign the Founder role.' });
      }
      db.prepare(`
        UPDATE members SET
          name = COALESCE(?, name),
          role = COALESCE(?, role),
          game = COALESCE(?, game),
          discord = COALESCE(?, discord),
          discord_id = COALESCE(?, discord_id),
          discord_status = COALESCE(?, discord_status),
          avatar = COALESCE(?, avatar),
          department = COALESCE(?, department),
          details = COALESCE(?, details),
          joined_at = COALESCE(?, joined_at)
        WHERE id = ?
      `).run(
        body.name !== undefined ? body.name : null,
        body.role !== undefined ? body.role : null,
        body.game !== undefined ? body.game : null,
        body.discord !== undefined ? body.discord : null,
        body.discord_id !== undefined ? body.discord_id : null,
        (body.discord_status || body.status) !== undefined ? (body.discord_status || body.status) : null,
        body.avatar !== undefined ? body.avatar : null,
        body.department !== undefined ? body.department : null,
        (body.details || body.description) !== undefined ? (body.details || body.description) : null,
        body.joined_at !== undefined ? body.joined_at : null,
        memberId
      );
      syncToJson();
      const updated = db.prepare('SELECT id, name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at FROM members WHERE id = ?').get(memberId);
      if (updated) {
        if (updated.role === 'Founder' || updated.discord === 'rpz_dark' || updated.name === 'Dark') {
          updated.discord_status = 'Online';
        }
        updated.status = updated.discord_status;
      }
      return sendJson(res, 200, { success: true, message: 'Member details updated.', member: updated });
    }

    // DELETE /api/members/:id
    if (method === 'DELETE' && !parts[4]) {
      const session = verifyStaffSession(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
      }

      if (isNaN(memberId)) {
        return sendJson(res, 400, { success: false, message: 'Invalid member ID.' });
      }

      const existingMember = db.prepare('SELECT role FROM members WHERE id = ?').get(memberId);
      if (!existingMember) return sendJson(res, 404, { success: false, message: 'Member not found.' });
      if (session.role !== 'Founder' && existingMember.role === 'Founder') {
        return sendJson(res, 403, { success: false, message: 'Only a Founder can delete a Founder account.' });
      }
      const resDelete = db.prepare('DELETE FROM members WHERE id = ?').run(memberId);
      if (resDelete.changes === 0) {
        return sendJson(res, 404, { success: false, message: 'Member not found.' });
      }

      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Member removed from roster.' });
    }
  }

  // --- COMMUNITY HIGHLIGHTS API ---
  if (pathname === '/api/highlights') {
    if (method === 'GET') {
      try {
        const all = parsedUrl.searchParams.get('all') === '1';
        if (all && !verifyStaffSession(req)) {
          return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
        }
        let query = 'SELECT id, title, description, image_url, event_date, display_order, is_published, created_at, updated_at FROM community_highlights';
        if (!all) query += ' WHERE is_published = 1';
        query += ' ORDER BY display_order ASC, id DESC';

        const rows = db.prepare(query).all().map(r => ({ ...r, is_published: Boolean(r.is_published) }));
        return sendJson(res, 200, { success: true, count: rows.length, highlights: rows });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: 'Database error retrieving highlights.' });
      }
    }

    if (method === 'POST') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const body = await parseBody(req);
      const title = (body.title || '').trim();
      const description = (body.description || '').trim();
      const image_url = (body.image_url || body.image || '').trim();
      const event_date = (body.event_date || body.date || '').trim();
      const display_order = parseInt(body.display_order, 10) || 0;
      const is_published = body.is_published === false || body.is_published === 0 || body.is_published === '0' ? 0 : 1;

      if (!title) return sendJson(res, 422, { success: false, message: 'Highlight title is required.' });

      const insert = db.prepare(`
        INSERT INTO community_highlights (title, description, image_url, event_date, display_order, is_published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      const result = insert.run(title, description, image_url, event_date, display_order, is_published, now, now);
      syncToJson();

      const newH = {
        id: Number(result.lastInsertRowid),
        title,
        description,
        image_url,
        event_date,
        display_order,
        is_published: Boolean(is_published),
        created_at: now
      };
      return sendJson(res, 201, { success: true, highlight: newH, message: 'Highlight created successfully.' });
    }
  }

  if (pathname.startsWith('/api/highlights/')) {
    const highlightId = parseInt(pathname.split('/')[3], 10);
    if (isNaN(highlightId)) return sendJson(res, 400, { success: false, message: 'Invalid highlight ID.' });

    if (method === 'PUT') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const body = await parseBody(req);
      const now = new Date().toISOString();
      const isPublishedVal = body.is_published !== undefined ? (body.is_published ? 1 : 0) : null;

      db.prepare(`
        UPDATE community_highlights SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url),
          event_date = COALESCE(?, event_date),
          display_order = COALESCE(?, display_order),
          is_published = COALESCE(?, is_published),
          updated_at = ?
        WHERE id = ?
      `).run(
        body.title || null,
        body.description || null,
        body.image_url || body.image || null,
        body.event_date || body.date || null,
        body.display_order !== undefined ? parseInt(body.display_order, 10) : null,
        isPublishedVal,
        now,
        highlightId
      );
      syncToJson();
      const updated = db.prepare('SELECT id, title, description, image_url, event_date, display_order, is_published FROM community_highlights WHERE id = ?').get(highlightId);
      if (updated) updated.is_published = Boolean(updated.is_published);
      return sendJson(res, 200, { success: true, message: 'Highlight updated.', highlight: updated });
    }

    if (method === 'DELETE') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const resDel = db.prepare('DELETE FROM community_highlights WHERE id = ?').run(highlightId);
      if (resDel.changes === 0) return sendJson(res, 404, { success: false, message: 'Highlight not found.' });
      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Highlight deleted.' });
    }
  }

  // --- EVENTS API ---
  if (pathname === '/api/events') {
    if (method === 'GET') {
      try {
        const all = parsedUrl.searchParams.get('all') === '1';
        if (all && !verifyStaffSession(req)) {
          return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
        }
        const type = (parsedUrl.searchParams.get('type') || '').toLowerCase();

        let query = 'SELECT id, title, description, image_url, event_date, event_time, location, organizer, status, category, prize, button_text, display_order, discord_link, is_published, created_at, updated_at FROM events WHERE 1=1';
        if (!all) query += ' AND is_published = 1';

        if (type === 'upcoming') {
          query += " AND LOWER(status) NOT IN ('past', 'completed')";
        } else if (type === 'past') {
          query += " AND LOWER(status) IN ('past', 'completed')";
        }

        query += ' ORDER BY display_order ASC, event_date ASC, id ASC';

        const rows = db.prepare(query).all().map(r => ({ ...r, is_published: Boolean(r.is_published) }));
        return sendJson(res, 200, { success: true, count: rows.length, events: rows });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: 'Database error retrieving events.' });
      }
    }

    if (method === 'POST') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const body = await parseBody(req);
      const title = (body.title || '').trim();
      const description = (body.description || '').trim();
      const image_url = (body.image_url || body.image || 'assets/images/gallery-1.jpg').trim();
      const event_date = (body.event_date || body.date || '').trim();
      const event_time = (body.event_time || body.time || '').trim();
      const location = (body.location || 'FiveM Server / Los Santos').trim();
      const organizer = (body.organizer || session.name || 'REAPERZ Staff').trim();
      const statusValue = (body.status || 'Upcoming').trim().toLowerCase();
      const statuses = { upcoming: 'Upcoming', active: 'Active', live: 'Active', completed: 'Completed', past: 'Completed' };
      const status = statuses[statusValue];
      const category = (body.category || 'Community Event').trim();
      const prize = (body.prize || '').trim();
      const button_text = (body.button_text || '').trim();
      const display_order = Number(body.display_order || 0);
      const discord_link = (body.discord_link || body.link || '').trim();
      const is_published = body.is_published === false || body.is_published === 0 || body.is_published === '0' ? 0 : 1;

      if (!title || !event_date || !description) {
        return sendJson(res, 422, { success: false, message: 'Event title, date, and description are required.' });
      }
      if (!status) return sendJson(res, 422, { success: false, message: 'Event status must be Upcoming, Active, or Completed.' });
      if (!Number.isInteger(display_order) || display_order < 0) {
        return sendJson(res, 422, { success: false, message: 'Event order must be a non-negative whole number.' });
      }
      const eventTime = event_time || 'TBA';

      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO events (title, description, image_url, event_date, event_time, location, organizer, status, category, prize, button_text, display_order, discord_link, is_published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insert.run(title, description, image_url, event_date, eventTime, location, organizer, status, category, prize, button_text, display_order, discord_link, is_published, now, now);
      syncToJson();

      const newEvent = {
        id: Number(result.lastInsertRowid),
        title,
        description,
        image_url,
        event_date,
        event_time: eventTime,
        location,
        organizer,
        status,
        category,
        prize,
        button_text,
        display_order,
        discord_link,
        is_published: Boolean(is_published),
        created_at: now
      };
      return sendJson(res, 201, { success: true, event: newEvent, message: 'Event created successfully.' });
    }
  }

  // --- EVENT IMAGE UPLOAD API ---
  if (pathname === '/api/events/upload' && method === 'POST') {
    const session = verifyStaffSession(req);
    if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff authentication required.' });

    const body = await parseBody(req);
    const filename = (body.filename || 'event.jpg').trim();
    let fileData = body.file_data || body.image_base64 || '';

    if (!fileData) {
      return sendJson(res, 422, { success: false, message: 'No image data provided for event image upload.' });
    }

    const ext = path.extname(filename).toLowerCase();
    const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!ALLOWED_EXTS.includes(ext)) {
      return sendJson(res, 422, { success: false, message: `Unsupported file type '${ext}'. Allowed: JPG, PNG, WEBP, GIF.` });
    }

    if (fileData.includes(',')) {
      fileData = fileData.split(',')[1];
    }

    let imageBuffer;
    try {
      imageBuffer = Buffer.from(fileData, 'base64');
    } catch (e) {
      return sendJson(res, 400, { success: false, message: 'Corrupted Base64 image data.' });
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      return sendJson(res, 413, { success: false, message: 'Image size exceeds 10MB limit.' });
    }

    const safeFilename = `reaperz_event_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, safeFilename);

    try {
      fs.writeFileSync(targetPath, imageBuffer);
    } catch (err) {
      return sendJson(res, 500, { success: false, message: 'Server failed to save event image to disk.' });
    }

    const relFilePath = `assets/images/uploads/${safeFilename}`;
    return sendJson(res, 201, {
      success: true,
      file_path: relFilePath,
      filename: safeFilename,
      message: '✓ Event image uploaded successfully!'
    });
  }

  if (pathname.startsWith('/api/events/')) {
    const eventId = parseInt(pathname.split('/')[3], 10);
    if (isNaN(eventId)) return sendJson(res, 400, { success: false, message: 'Invalid event ID.' });

    if (method === 'PUT') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const body = await parseBody(req);
      const now = new Date().toISOString();
      const isPublishedVal = body.is_published !== undefined ? (body.is_published ? 1 : 0) : null;
      const statuses = { upcoming: 'Upcoming', active: 'Active', live: 'Active', completed: 'Completed', past: 'Completed' };
      const normalizedStatus = body.status === undefined ? null : statuses[String(body.status).trim().toLowerCase()];
      if (body.status !== undefined && !normalizedStatus) {
        return sendJson(res, 422, { success: false, message: 'Event status must be Upcoming, Active, or Completed.' });
      }
      const displayOrder = body.display_order === undefined ? null : Number(body.display_order);
      if (displayOrder !== null && (!Number.isInteger(displayOrder) || displayOrder < 0)) {
        return sendJson(res, 422, { success: false, message: 'Event order must be a non-negative whole number.' });
      }

      db.prepare(`
        UPDATE events SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url),
          event_date = COALESCE(?, event_date),
          event_time = COALESCE(?, event_time),
          location = COALESCE(?, location),
          organizer = COALESCE(?, organizer),
          status = COALESCE(?, status),
          category = COALESCE(?, category),
          prize = COALESCE(?, prize),
          button_text = COALESCE(?, button_text),
          display_order = COALESCE(?, display_order),
          discord_link = COALESCE(?, discord_link),
          is_published = COALESCE(?, is_published),
          updated_at = ?
        WHERE id = ?
      `).run(
        body.title !== undefined ? String(body.title).trim() : null,
        body.description !== undefined ? String(body.description).trim() : null,
        body.image_url !== undefined ? String(body.image_url).trim() : body.image !== undefined ? String(body.image).trim() : null,
        body.event_date !== undefined ? String(body.event_date).trim() : body.date !== undefined ? String(body.date).trim() : null,
        body.event_time !== undefined ? String(body.event_time).trim() : body.time !== undefined ? String(body.time).trim() : null,
        body.location !== undefined ? String(body.location).trim() : null,
        body.organizer !== undefined ? String(body.organizer).trim() : null,
        normalizedStatus,
        body.category !== undefined ? String(body.category).trim() : null,
        body.prize !== undefined ? String(body.prize).trim() : null,
        body.button_text !== undefined ? String(body.button_text).trim() : null,
        displayOrder,
        body.discord_link !== undefined ? String(body.discord_link).trim() : body.link !== undefined ? String(body.link).trim() : null,
        isPublishedVal,
        now,
        eventId
      );
      syncToJson();
      const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
      if (updated) updated.is_published = Boolean(updated.is_published);
      return sendJson(res, 200, { success: true, message: 'Event updated successfully.', event: updated });
    }

    if (method === 'DELETE') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const resDel = db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
      if (resDel.changes === 0) return sendJson(res, 404, { success: false, message: 'Event not found.' });
      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Event deleted successfully.' });
    }
  }

  // --- GAMING PLATFORMS API (GTA V ONLINE CREW & FIVEM SERVERS) ---
  if (pathname === '/api/gaming-platforms') {
    if (method === 'GET') {
      try {
        const all = parsedUrl.searchParams.get('all') === '1';
        if (all && !verifyStaffSession(req)) {
          return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
        }
        let query = 'SELECT id, type, name, description, image_url, link, status, display_order, is_published, created_at, updated_at FROM gaming_platforms';
        if (!all) query += ' WHERE is_published = 1';
        query += ' ORDER BY display_order ASC, id ASC';

        const rows = db.prepare(query).all().map(r => ({ ...r, is_published: Boolean(r.is_published) }));
        return sendJson(res, 200, { success: true, count: rows.length, platforms: rows });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: 'Database error retrieving gaming platforms.' });
      }
    }

    if (method === 'POST') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const body = await parseBody(req);
      const rawFields = [
        body.type === undefined ? 'fivem' : body.type,
        body.name || '',
        body.description || '',
        body.image_url || '',
        body.link || '',
        body.status || 'Active'
      ];
      if (!rawFields.every(value => typeof value === 'string')) {
        return sendJson(res, 422, { success: false, message: 'Platform fields must be text.' });
      }
      const [rawType, rawName, rawDescription, rawImageUrl, rawLink, rawStatus] = rawFields;
      const type = rawType.trim().toLowerCase();
      const name = rawName.trim();
      const description = rawDescription.trim();
      const image_url = rawImageUrl.trim();
      const link = rawLink.trim();
      const status = rawStatus.trim();
      const display_order = body.display_order === undefined ? 0 : Number(body.display_order);
      const is_published = body.is_published === false || body.is_published === 0 || body.is_published === '0' ? 0 : 1;

      if (!['gta_online', 'fivem'].includes(type)) {
        return sendJson(res, 422, { success: false, message: 'Platform type must be gta_online or fivem.' });
      }
      if (!name) return sendJson(res, 422, { success: false, message: 'Platform/Server name is required.' });
      if (!status || name.length > 150 || description.length > 2000 || image_url.length > 500 || link.length > 500 || status.length > 50) {
        return sendJson(res, 422, { success: false, message: 'Platform fields are required and must be within the allowed lengths.' });
      }
      if (!Number.isInteger(display_order) || display_order < 0) {
        return sendJson(res, 422, { success: false, message: 'Display order must be a non-negative whole number.' });
      }

      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO gaming_platforms (type, name, description, image_url, link, status, display_order, is_published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insert.run(type, name, description, image_url, link, status, display_order, is_published, now, now);
      syncToJson();

      const newPlatform = {
        id: Number(result.lastInsertRowid),
        type,
        name,
        description,
        image_url,
        link,
        status,
        display_order,
        is_published: Boolean(is_published),
        created_at: now
      };
      return sendJson(res, 201, { success: true, platform: newPlatform, message: 'Gaming platform added.' });
    }
  }

  if (pathname.startsWith('/api/gaming-platforms/')) {
    const platformId = parseInt(pathname.split('/')[3], 10);
    if (isNaN(platformId)) return sendJson(res, 400, { success: false, message: 'Invalid platform ID.' });

    if (method === 'PUT') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const body = await parseBody(req);
      const now = new Date().toISOString();
      if (body.type !== undefined && !['gta_online', 'fivem'].includes(String(body.type).trim().toLowerCase())) {
        return sendJson(res, 422, { success: false, message: 'Platform type must be gta_online or fivem.' });
      }
      const textLimits = { name: 150, description: 2000, image_url: 500, link: 500, status: 50 };
      for (const [field, limit] of Object.entries(textLimits)) {
        if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].trim().length > limit)) {
          return sendJson(res, 422, { success: false, message: `Invalid ${field} value or length.` });
        }
        if (['name', 'status'].includes(field) && body[field] !== undefined && !body[field].trim()) {
          return sendJson(res, 422, { success: false, message: `${field} is required.` });
        }
      }
      if (body.display_order !== undefined && (!Number.isInteger(Number(body.display_order)) || Number(body.display_order) < 0)) {
        return sendJson(res, 422, { success: false, message: 'Display order must be a non-negative whole number.' });
      }
      const isPublishedVal = body.is_published !== undefined ? (body.is_published ? 1 : 0) : null;

      db.prepare(`
        UPDATE gaming_platforms SET
          type = COALESCE(?, type),
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url),
          link = COALESCE(?, link),
          status = COALESCE(?, status),
          display_order = COALESCE(?, display_order),
          is_published = COALESCE(?, is_published),
          updated_at = ?
        WHERE id = ?
      `).run(
        body.type !== undefined ? String(body.type).trim().toLowerCase() : null,
        body.name !== undefined ? body.name.trim() : null,
        body.description !== undefined ? body.description : null,
        body.image_url !== undefined ? body.image_url : null,
        body.link !== undefined ? body.link : null,
        body.status !== undefined ? body.status.trim() : null,
        body.display_order !== undefined ? Number(body.display_order) : null,
        isPublishedVal,
        now,
        platformId
      );
      syncToJson();
      const updated = db.prepare('SELECT * FROM gaming_platforms WHERE id = ?').get(platformId);
      if (!updated) return sendJson(res, 404, { success: false, message: 'Platform not found.' });
      if (updated) updated.is_published = Boolean(updated.is_published);
      return sendJson(res, 200, { success: true, message: 'Platform updated.', platform: updated });
    }

    if (method === 'DELETE') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const resDel = db.prepare('DELETE FROM gaming_platforms WHERE id = ?').run(platformId);
      if (resDel.changes === 0) return sendJson(res, 404, { success: false, message: 'Platform not found.' });
      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Platform deleted.' });
    }
  }

  // --- WEBSITE SETTINGS API ---
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      try {
        const rows = db.prepare('SELECT setting_key, setting_value FROM website_settings').all();
        const settings = {};
        for (const r of rows) settings[r.setting_key] = r.setting_value;
        return sendJson(res, 200, { success: true, settings });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: 'Database error retrieving settings.' });
      }
    }

    if (method === 'POST' || method === 'PUT') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });

      const body = await parseBody(req);
      const settingsToUpdate = body.key && body.value !== undefined
        ? { [body.key]: body.value }
        : body;
      if (Object.prototype.hasOwnProperty.call(settingsToUpdate, 'discord_invite')) {
        let invite;
        try {
          invite = new URL(String(settingsToUpdate.discord_invite));
        } catch {
          return sendJson(res, 422, { success: false, message: 'A valid Discord invite URL is required.' });
        }
        const validDiscordInvite = invite.protocol === 'https:' &&
          (invite.hostname === 'discord.gg' ||
            (invite.hostname === 'discord.com' && invite.pathname.startsWith('/invite/')));
        if (!validDiscordInvite) {
          return sendJson(res, 422, { success: false, message: 'Use an HTTPS discord.gg or discord.com/invite URL.' });
        }
        settingsToUpdate.discord_invite = invite.href;
      }
      const upsert = db.prepare(`
        INSERT INTO website_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = excluded.updated_at
      `);

      const now = new Date().toISOString();
      for (const [k, v] of Object.entries(settingsToUpdate)) {
        upsert.run(k, String(v), now);
      }
      syncToJson();

      const rows = db.prepare('SELECT setting_key, setting_value FROM website_settings').all();
      const settings = {};
      for (const r of rows) settings[r.setting_key] = r.setting_value;
      return sendJson(res, 200, { success: true, message: 'Settings saved successfully.', settings });
    }
  }

  // --- 4. DISCORD PRESENCE INTEGRATION API ---
  if (pathname === '/api/discord/presence' && method === 'GET') {
    const userId = (parsedUrl.searchParams.get('user_id') || '').trim();
    const memberIdParam = parsedUrl.searchParams.get('member_id');
    const memberId = memberIdParam && !isNaN(parseInt(memberIdParam, 10)) ? parseInt(memberIdParam, 10) : null;

    const presence = await fetchDiscordPresence(userId, memberId);
    return sendJson(res, 200, presence);
  }

  // --- 5. RATINGS & REVIEWS API ---
  if (pathname === '/api/ratings') {
    if (method === 'GET') {
      try {
        const category = (parsedUrl.searchParams.get('category') || '').trim();
        const starsParam = parsedUrl.searchParams.get('stars');
        const stars = starsParam && !isNaN(parseInt(starsParam, 10)) ? parseInt(starsParam, 10) : null;

        let query = 'SELECT id, name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at FROM ratings WHERE 1=1';
        const params = [];

        if (category && category.toLowerCase() !== 'all') {
          query += ' AND LOWER(category) LIKE ?';
          params.push(`%${category.toLowerCase()}%`);
        }

        if (stars && stars >= 1 && stars <= 5) {
          query += ' AND stars = ?';
          params.push(stars);
        }

        query += ' ORDER BY id DESC';

        const rows = db.prepare(query).all(...params).map(r => ({
          ...r,
          recommended: Boolean(r.recommended)
        }));

        // Distribution counts across all ratings
        const distRows = db.prepare('SELECT stars, COUNT(*) as cnt FROM ratings GROUP BY stars').all();
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        for (const row of distRows) {
          distribution[row.stars] = row.cnt;
        }

        const statRow = db.prepare('SELECT COUNT(*) as total, AVG(stars) as avg_score FROM ratings').get();
        const total = statRow.total || 0;
        const average = statRow.avg_score ? Math.round(statRow.avg_score * 10) / 10 : 5.0;

        return sendJson(res, 200, {
          success: true,
          total,
          average,
          distribution,
          ratings: rows
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: 'Database error retrieving ratings.' });
      }
    }

    if (method === 'POST') {
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      const discord = (body.discord || '').trim();
      const comment = (body.comment || '').trim();
      const title = (body.title || 'Community Rating').trim();
      const category = (body.category || 'FiveM Roleplay').trim();
      const experience = (body.experience || 'Member').trim();
      const recommended = body.recommended === true || body.recommended === 'true' || body.recommended === 1 || body.recommended === 'on';

      // Validation
      if (!name) {
        return sendJson(res, 422, { success: false, message: 'Please enter your Name or Gamertag.' });
      }
      if (!discord) {
        return sendJson(res, 422, { success: false, message: 'Please enter your Discord username.' });
      }
      if (!comment) {
        return sendJson(res, 422, { success: false, message: 'Please write a review comment.' });
      }

      let stars = parseInt(body.stars, 10);
      if (isNaN(stars) || stars < 1 || stars > 5) stars = 5;

      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO ratings (name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      const result = insert.run(name, discord, stars, category, experience, title, comment, recommended ? 1 : 0, now);
      syncToJson();

      const newRating = {
        id: Number(result.lastInsertRowid),
        name,
        discord,
        stars,
        category,
        experience,
        title,
        comment,
        recommended,
        helpful: 0,
        submitted_at: now
      };

      return sendJson(res, 201, {
        success: true,
        rating: newRating,
        message: '✓ Thank you! Your rating has been recorded successfully in the REAPERZ database.'
      });
    }
  }

  // --- 6. RATING UPVOTES & DELETE ---
  if (pathname.startsWith('/api/ratings/')) {
    const parts = pathname.split('/');
    const ratingId = parseInt(parts[3], 10);

    if (parts[4] === 'helpful' && method === 'POST') {
      if (isNaN(ratingId)) return sendJson(res, 400, { success: false, message: 'Invalid rating ID.' });

      const resUpvote = db.prepare('UPDATE ratings SET helpful = helpful + 1 WHERE id = ?').run(ratingId);
      if (resUpvote.changes === 0) {
        return sendJson(res, 404, { success: false, message: 'Rating not found.' });
      }

      const updated = db.prepare('SELECT helpful FROM ratings WHERE id = ?').get(ratingId);
      syncToJson();
      return sendJson(res, 200, { success: true, helpful: updated.helpful });
    }

    if (method === 'DELETE' && !parts[4]) {
      const session = verifyStaffSession(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
      }

      if (isNaN(ratingId)) return sendJson(res, 400, { success: false, message: 'Invalid rating ID.' });

      const resDel = db.prepare('DELETE FROM ratings WHERE id = ?').run(ratingId);
      if (resDel.changes === 0) {
        return sendJson(res, 404, { success: false, message: 'Rating not found.' });
      }

      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Review deleted successfully.' });
    }
  }

  // --- 7. MEDIA LIBRARY API ---
  if (pathname === '/api/library') {
    if (method === 'GET') {
      try {
        const category = (parsedUrl.searchParams.get('category') || '').trim();
        const search = (parsedUrl.searchParams.get('search') || '').trim();

        let query = 'SELECT id, title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at FROM library WHERE 1=1';
        const params = [];

        if (category && category.toLowerCase() !== 'all') {
          query += ' AND LOWER(category) = ?';
          params.push(category.toLowerCase());
        }

        if (search) {
          query += ' AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)';
          const term = `%${search.toLowerCase()}%`;
          params.push(term, term);
        }

        query += ' ORDER BY id DESC';

        const rows = db.prepare(query).all(...params);
        const categories = db.prepare('SELECT DISTINCT category FROM library ORDER BY category ASC').all().map(c => c.category);
        const total = db.prepare('SELECT COUNT(*) as cnt FROM library').get().cnt;

        return sendJson(res, 200, {
          success: true,
          total,
          categories,
          media: rows
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: 'Database error retrieving media library.' });
      }
    }
  }

  // --- 8. MEDIA UPLOAD API (STAFF PORTAL) ---
  if (pathname === '/api/library/upload' && method === 'POST') {
    const session = verifyStaffSession(req);
    if (!session) {
      return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff authentication required to upload images.' });
    }

    const body = await parseBody(req);
    const title = (body.title || '').trim();
    const category = (body.category || 'General').trim();
    const description = (body.description || '').trim();
    const filename = (body.filename || 'upload.jpg').trim();
    let fileData = body.file_data || body.image_base64 || '';

    if (!title) {
      return sendJson(res, 422, { success: false, message: 'Media title is required.' });
    }
    if (!fileData) {
      return sendJson(res, 422, { success: false, message: 'No image data provided for upload.' });
    }

    // Security: Validate file extension
    const ext = path.extname(filename).toLowerCase();
    const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!ALLOWED_EXTS.includes(ext)) {
      return sendJson(res, 422, { success: false, message: `Unsupported file type '${ext}'. Allowed: JPG, PNG, WEBP, GIF.` });
    }

    // Remove Base64 prefix (e.g. data:image/jpeg;base64,...)
    if (fileData.includes(',')) {
      fileData = fileData.split(',')[1];
    }

    let imageBuffer;
    try {
      imageBuffer = Buffer.from(fileData, 'base64');
    } catch (e) {
      return sendJson(res, 400, { success: false, message: 'Corrupted Base64 image data.' });
    }

    // Check size limit: 10MB
    if (imageBuffer.length > 10 * 1024 * 1024) {
      return sendJson(res, 413, { success: false, message: 'Image size exceeds 10MB limit.' });
    }

    // Save image to assets/images/uploads/
    const safeFilename = `reaperz_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, safeFilename);

    try {
      fs.writeFileSync(targetPath, imageBuffer);
    } catch (err) {
      return sendJson(res, 500, { success: false, message: 'Server failed to write image to disk.' });
    }

    const mimeType = MIME_TYPES[ext] || 'image/jpeg';
    const relFilePath = `assets/images/uploads/${safeFilename}`;
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO library (title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(title, category, safeFilename, relFilePath, imageBuffer.length, mimeType, description, session.name, now);
    syncToJson();

    const newMedia = {
      id: Number(result.lastInsertRowid),
      title,
      category,
      filename: safeFilename,
      file_path: relFilePath,
      file_size: imageBuffer.length,
      mime_type: mimeType,
      description,
      uploaded_by: session.name,
      uploaded_at: now
    };

    return sendJson(res, 201, {
      success: true,
      media: newMedia,
      message: '✓ Image uploaded successfully to the REAPERZ Library!'
    });
  }

  // --- 9. DELETE LIBRARY MEDIA API ---
  if (pathname.startsWith('/api/library/') && method === 'DELETE') {
    const session = verifyStaffSession(req);
    if (!session) {
      return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff authentication required.' });
    }

    const mediaId = parseInt(pathname.split('/')[3], 10);
    if (isNaN(mediaId)) return sendJson(res, 400, { success: false, message: 'Invalid media ID.' });

    const row = db.prepare('SELECT filename, file_path FROM library WHERE id = ?').get(mediaId);
    if (!row) {
      return sendJson(res, 404, { success: false, message: 'Media item not found.' });
    }

    db.prepare('DELETE FROM library WHERE id = ?').run(mediaId);

    // Safely remove file from uploads folder
    try {
      const fullPath = path.resolve(BASE_DIR, row.file_path);
      if (fullPath.startsWith(UPLOADS_DIR) && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn('[Upload Warn] Could not delete file:', err.message);
    }

    syncToJson();
    return sendJson(res, 200, { success: true, message: 'Image deleted from library.' });
  }

  // --- 10. APPLICATIONS API ---
  if (pathname === '/api/applications') {
    if (method === 'GET') {
      const apps = db.prepare('SELECT id, name, discord, age, game, role, timezone, about, status, submitted_at FROM applications ORDER BY id DESC').all();
      return sendJson(res, 200, { success: true, applications: apps });
    }

    if (method === 'POST') {
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      const discord = (body.discord || '').trim();
      const game = (body.game || '').trim();
      const age = parseInt(body.age, 10) || 18;
      const role = (body.role || 'Member').trim();
      const timezone = (body.timezone || 'IST').trim();
      const about = (body.about || '').trim();

      if (!name || !discord || !game) {
        return sendJson(res, 422, { success: false, message: 'Name, discord, and game are required.' });
      }

      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO applications (name, discord, age, game, role, timezone, about, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
      `);
      const result = insert.run(name, discord, age, game, role, timezone, about, now);
      syncToJson();

      return sendJson(res, 201, {
        success: true,
        application_id: Number(result.lastInsertRowid),
        message: 'Application submitted successfully.'
      });
    }
  }

  // --- 11. SINGLE APPLICATION (PATCH STATUS, DELETE) ---
  if (pathname.startsWith('/api/applications/')) {
    const parts = pathname.split('/');
    const appId = parseInt(parts[3], 10);

    if (method === 'PATCH') {
      const session = verifyStaffSession(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
      }

      if (isNaN(appId)) return sendJson(res, 400, { success: false, message: 'Invalid application ID.' });

      const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
      if (!app) return sendJson(res, 404, { success: false, message: 'Application not found.' });

      const body = await parseBody(req);
      const newStatus = body.status || 'Pending';
      const addToMembers = Boolean(body.addToMembers);

      db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(newStatus, appId);

      // Auto-add approved applicant to members roster
      if (newStatus === 'Approved' && addToMembers) {
        const existing = db.prepare('SELECT id FROM members WHERE LOWER(discord) = LOWER(?)').get(app.discord);
        if (!existing) {
          const now = new Date().toISOString();
          db.prepare(`
            INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, joined_at)
            VALUES (?, ?, ?, ?, '', 'Online', '', ?)
          `).run(app.name, app.role || 'Member', app.game, app.discord, now);
        }
      }

      syncToJson();
      const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
      return sendJson(res, 200, { success: true, application: updated });
    }

    if (method === 'DELETE') {
      const session = verifyStaffSession(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
      }

      if (isNaN(appId)) return sendJson(res, 400, { success: false, message: 'Invalid application ID.' });

      db.prepare('DELETE FROM applications WHERE id = ?').run(appId);
      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Application deleted.' });
    }
  }

  // --- 12. MESSAGES API ---
  if (pathname === '/api/messages') {
    if (method === 'GET') {
      const msgs = db.prepare('SELECT id, name, email, subject, message, submitted_at FROM messages ORDER BY id DESC').all();
      return sendJson(res, 200, { success: true, messages: msgs });
    }

    if (method === 'POST') {
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      const email = (body.email || '').trim();
      const subject = (body.subject || 'General Inquiry').trim();
      const message = (body.message || '').trim();

      if (!name || !email || !message) {
        return sendJson(res, 422, { success: false, message: 'Name, email, and message are required.' });
      }

      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO messages (name, email, subject, message, submitted_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = insert.run(name, email, subject, message, now);
      syncToJson();

      return sendJson(res, 201, {
        success: true,
        message: 'Message received by REAPERZ Staff HQ.'
      });
    }
  }

  // --- 13. STAFF AUTHENTICATION (SECURE PBKDF2) ---
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const identifier = (body.username || '').trim();
    const password = body.password || '';

    if (!identifier || !password) {
      return sendJson(res, 400, { success: false, message: 'Username/Position and password are required.' });
    }

    const staffUser = db.prepare(`
      SELECT id, username, name, role, password_hash, salt
      FROM staff
      WHERE LOWER(username) = LOWER(?)
    `).get(identifier);

    if (!staffUser) {
      return sendJson(res, 401, { success: false, message: 'Invalid staff credentials. Access denied.' });
    }

    const isValid = verifyPassword(password, staffUser.salt, staffUser.password_hash);
    if (!isValid) {
      return sendJson(res, 401, { success: false, message: 'Invalid staff credentials. Access denied.' });
    }

    // Generate secure session token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    ACTIVE_SESSIONS.set(token, {
      id: staffUser.id,
      username: staffUser.username,
      role: staffUser.role,
      name: staffUser.name,
      expires
    });

    db.prepare('UPDATE staff SET last_login = ? WHERE id = ?').run(new Date().toISOString(), staffUser.id);
    syncToJson();

    const secureCookie = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return sendJson(res, 200, {
      success: true,
      user: {
        id: staffUser.id,
        username: staffUser.username,
        name: staffUser.name,
        role: staffUser.role
      },
      message: `Welcome back, ${staffUser.name}!`
    }, { 'Set-Cookie': `reaperz_staff_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secureCookie}` });
  }

  if (pathname === '/api/auth/verify' && method === 'GET') {
    const session = verifyStaffSession(req);
    if (session) {
      return sendJson(res, 200, {
        success: true,
        user: {
          username: session.username,
          name: session.name,
          role: session.role
        }
      });
    }
    return sendJson(res, 401, { success: false, message: 'Session expired or invalid.' });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = extractToken(req);
    if (token) ACTIVE_SESSIONS.delete(token);
    const secureCookie = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return sendJson(res, 200, { success: true, message: 'Logged out successfully.' }, {
      'Set-Cookie': `reaperz_staff_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`
    });
  }

  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const session = verifyStaffSession(req);
    if (!session) {
      return sendJson(res, 401, { success: false, message: 'Unauthorized. Staff session required.' });
    }

    const body = await parseBody(req);
    const currentPass = (body.current_password || '').trim();
    const newPass = (body.new_password || '').trim();

    if (!currentPass || !newPass) {
      return sendJson(res, 400, { success: false, message: 'Current and new passwords required.' });
    }

    if (newPass.length < 8) {
      return sendJson(res, 422, { success: false, message: 'New password must be at least 8 characters.' });
    }

    const staffUser = db.prepare('SELECT password_hash, salt FROM staff WHERE id = ?').get(session.id);
    if (!verifyPassword(currentPass, staffUser.salt, staffUser.password_hash)) {
      return sendJson(res, 403, { success: false, message: 'Incorrect current password.' });
    }

    const newHashed = hashPassword(newPass);
    db.prepare('UPDATE staff SET password_hash = ?, salt = ? WHERE id = ?').run(newHashed.hash, newHashed.salt, session.id);
    syncToJson();

    return sendJson(res, 200, { success: true, message: 'Password changed successfully.' });
  }

  // --- 14. RESET DATABASE API (FOUNDER ONLY) ---
  if (pathname === '/api/reset' && method === 'POST') {
    const session = verifyStaffSession(req);
    if (!session || session.role !== 'Founder') {
      return sendJson(res, 403, { success: false, message: 'Permission denied. Only Founder can reset database.' });
    }

    initDatabase();
    return sendJson(res, 200, { success: true, message: 'Database reset to default seed.' });
  }

  // --- BUSINESS SYSTEM APIS ---
  if (await handleBusinessesApi(req, res, pathname, method)) return;
  if (await handleVehiclesApi(req, res, pathname, method, parsedUrl)) return;
  if (await handleVehicleBookingsApi(req, res, pathname, method, parsedUrl)) return;
  if (await handleServicesApi(req, res, pathname, method, parsedUrl)) return;
  if (await handleCustomizationRequestsApi(req, res, pathname, method, parsedUrl)) return;
  if (await handleBusinessStatsApi(req, res, pathname, method)) return;

  // New page route aliases
  if (method === 'GET') {
    if (pathname === '/businesses' || pathname === '/businesses/') return serveStaticFile(req, res, 'businesses.html');
    if (pathname === '/apex-motors' || pathname === '/apex-motors/') return serveStaticFile(req, res, 'apex-motors.html');
    if (pathname === '/hoonigan' || pathname === '/hoonigan/') return serveStaticFile(req, res, 'hoonigan.html');
    if (pathname === '/apex-book' || pathname === '/apex-book/') return serveStaticFile(req, res, 'apex-book.html');
  }

  // --- 15. STATIC FILE SERVER ---
  if (method === 'GET') {
    return serveStaticFile(req, res, pathname);
  }

  return sendJson(res, 404, { success: false, message: 'Endpoint not found.' });
});

// ============================================================================
// BUSINESS SYSTEM — NEW TABLES INITIALIZATION
// ============================================================================

function initBusinessTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      business_type TEXT NOT NULL,
      description TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      status TEXT DEFAULT 'Active',
      display_order INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Sports',
      price INTEGER NOT NULL DEFAULT 0,
      image_url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      specs TEXT DEFAULT '{}',
      availability TEXT NOT NULL DEFAULT 'Available',
      display_order INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      vehicle_id INTEGER,
      vehicle_name TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      vehicle_price INTEGER DEFAULT 0,
      customer_name TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      discord_id TEXT DEFAULT '',
      contact_number TEXT NOT NULL,
      preferred_date TEXT DEFAULT '',
      preferred_time TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      notes TEXT DEFAULT '',
      dealership TEXT DEFAULT 'Apex Motors',
      server_name TEXT DEFAULT 'Eclipse',
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS customization_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER DEFAULT 2,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Performance',
      description TEXT DEFAULT '',
      price_from INTEGER DEFAULT 0,
      price_to INTEGER DEFAULT 0,
      duration TEXT DEFAULT 'TBA',
      image_url TEXT DEFAULT '',
      is_available INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS customization_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      vehicle_name TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      services TEXT DEFAULT '[]',
      additional_requirements TEXT DEFAULT '',
      preferred_date TEXT DEFAULT '',
      preferred_time TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      notes TEXT DEFAULT '',
      shop_name TEXT DEFAULT 'Hoonigan Customs',
      server_name TEXT DEFAULT 'Thalai Nagaram',
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_type TEXT NOT NULL,
      action TEXT NOT NULL,
      reference TEXT DEFAULT '',
      details TEXT DEFAULT '{}',
      performed_by TEXT DEFAULT 'System',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const bizCount = db.prepare('SELECT COUNT(*) as cnt FROM businesses').get().cnt;
  if (bizCount === 0) {
    db.prepare('INSERT INTO businesses (server_name, business_name, business_type, description, status, display_order) VALUES (?, ?, ?, ?, ?, ?)').run('Eclipse', 'Apex Motors', 'Vehicle Dealership', 'The premier FiveM vehicle dealership on Eclipse server. Browse our exclusive fleet of high-performance cars, SUVs, and hypercars. Pre-book your dream vehicle today.', 'Active', 1);
    db.prepare('INSERT INTO businesses (server_name, business_name, business_type, description, status, display_order) VALUES (?, ?, ?, ?, ?, ?)').run('Thalai Nagaram', 'Hoonigan Customs', 'Vehicle Customization', 'The ultimate vehicle customization shop on Thalai Nagaram. Performance upgrades, body kits, paint jobs, and full interior reworks done by expert mechanics.', 'Active', 2);
    console.log('[DB] Seeded default businesses.');
  }

  const vehCount = db.prepare('SELECT COUNT(*) as cnt FROM vehicles').get().cnt;
  if (vehCount === 0) {
    const vehicles = [
      [1,'Striker','Striker','Sports',850000,'','High-performance sports car with aggressive styling and track-tuned suspension.',JSON.stringify({top_speed:'220 mph',acceleration:'0-60 in 3.2s',drive:'RWD',seats:2}),'Available',1],
      [1,'Hellfire GT','Hellfire','Supercar',1200000,'','Limited-edition supercar with twin-turbo V12 and carbon fiber body.',JSON.stringify({top_speed:'250 mph',acceleration:'0-60 in 2.8s',drive:'AWD',seats:2}),'Available',2],
      [1,'Venom X SUV','VenomX','SUV',650000,'','Premium armored SUV combining luxury comfort with off-road capability.',JSON.stringify({top_speed:'180 mph',acceleration:'0-60 in 4.5s',drive:'AWD',seats:5}),'Available',3],
      [1,'Phantom Coupe','Phantom','Luxury',980000,'','Ultra-luxury grand tourer with handcrafted interior and smooth V8 power.',JSON.stringify({top_speed:'200 mph',acceleration:'0-60 in 3.8s',drive:'RWD',seats:4}),'Available',4],
      [1,'Turbo Banshee','Banshee900R','Muscle',750000,'','Classic American muscle reborn with forced induction and modern electronics.',JSON.stringify({top_speed:'215 mph',acceleration:'0-60 in 3.5s',drive:'RWD',seats:2}),'Reserved',5],
      [1,'Circuit Racer','Circuit','Race',550000,'','Purpose-built racing machine stripped for maximum speed on the track.',JSON.stringify({top_speed:'230 mph',acceleration:'0-60 in 2.5s',drive:'RWD',seats:1}),'Available',6]
    ];
    const ins = db.prepare('INSERT INTO vehicles (business_id,name,model,category,price,image_url,description,specs,availability,display_order) VALUES (?,?,?,?,?,?,?,?,?,?)');
    for (const v of vehicles) ins.run(...v);
    console.log('[DB] Seeded default Apex Motors vehicles.');
  }

  const svcCount = db.prepare('SELECT COUNT(*) as cnt FROM customization_services').get().cnt;
  if (svcCount === 0) {
    const services = [
      [2,'Engine Swap & Tuning','Performance','Full engine replacement with custom ECU tuning for maximum power output.',150000,500000,'2-4 hours','',1,1],
      [2,'Turbo Kit Installation','Performance','Single or twin-turbo kit with intercooler, blow-off valve, and boost controller.',80000,250000,'1-3 hours','',1,2],
      [2,'Brake Upgrade Package','Performance','High-performance brake pads, rotors, and stainless steel brake lines.',30000,80000,'1 hour','',1,3],
      [2,'Suspension Overhaul','Performance','Coilover suspension with custom spring rates and damper tuning.',60000,200000,'2-3 hours','',1,4],
      [2,'Full Body Kit','Exterior','Wide-body aero kit with front splitter, side skirts, rear diffuser, and spoiler.',100000,400000,'3-5 hours','',1,5],
      [2,'Custom Paint Job','Exterior','Premium custom paint with base coat, color coat, and clear coat finish.',50000,300000,'2-4 hours','',1,6],
      [2,'Wheels & Tyres','Exterior','Custom alloy wheels with performance tyres in your chosen spec.',40000,150000,'1-2 hours','',1,7],
      [2,'Interior Rework','Interior','Full custom interior with racing seats, roll cage, and digital dashboard.',80000,350000,'3-6 hours','',1,8],
      [2,'Exhaust System','Performance','Cat-back exhaust with custom headers for maximum flow and signature sound.',35000,120000,'1-2 hours','',1,9],
      [2,'Window Tint & Wrapping','Exterior','Professional vinyl wrap and window tinting in any finish.',20000,100000,'2-3 hours','',1,10]
    ];
    const insSvc = db.prepare('INSERT INTO customization_services (business_id,name,category,description,price_from,price_to,duration,image_url,is_available,display_order) VALUES (?,?,?,?,?,?,?,?,?,?)');
    for (const s of services) insSvc.run(...s);
    console.log('[DB] Seeded default Hoonigan services.');
  }
}

try { initBusinessTables(); } catch (e) { console.error('[DB Business Init Error]', e.message); }

// ============================================================================
// DISCORD WEBHOOK HELPER (SERVER-SIDE ONLY)
// ============================================================================

async function sendDiscordWebhook(payload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) { console.log('[Discord] DISCORD_WEBHOOK_URL not set — skipping.'); return false; }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'REAPERZ-Business-Portal/1.0' }, body: JSON.stringify(payload), signal: controller.signal });
    clearTimeout(timeout);
    return r.ok;
  } catch (e) { console.warn('[Discord] Webhook failed:', e.message); return false; }
}

function buildApexBookingEmbed(booking, isUpdate, updatedBy, oldStatus) {
  const statusColors = { Approved: 0x29e07f, Rejected: 0xff1744, Completed: 0xffb703, Cancelled: 0x8e9fb5, Pending: 0x00b7ff, Reserved: 0xff9800 };
  return {
    username: 'APEX MOTORS',
    embeds: [{
      title: isUpdate ? `🔄 BOOKING UPDATE — ${booking.reference}` : '🚗 NEW VEHICLE PRE-BOOKING',
      color: statusColors[booking.status] || 0xff1744,
      fields: [
        { name: '📋 Status', value: `**${booking.status}**${oldStatus ? ` (was: ${oldStatus})` : ''}`, inline: true },
        { name: '📍 Dealership', value: booking.dealership || 'Apex Motors', inline: true },
        { name: '🌐 Server', value: booking.server_name || 'Eclipse', inline: true },
        { name: '👤 Customer', value: `• **Name:** ${booking.customer_name}\n• **Contact:** ${booking.contact_number}\n• **Discord:** @${booking.discord_username}${booking.discord_id ? ` (${booking.discord_id})` : ''}`, inline: false },
        { name: '🚘 Vehicle', value: `• **Vehicle:** ${booking.vehicle_name}\n• **Model:** ${booking.vehicle_model}\n• **Price:** $${Number(booking.vehicle_price||0).toLocaleString()}`, inline: false },
        { name: '📅 Booking', value: `• **Reference:** \`${booking.reference}\`\n• **Date:** ${booking.preferred_date||'TBA'}${booking.preferred_time?' at '+booking.preferred_time:''}\n${booking.message?'• **Message:** '+booking.message:''}`, inline: false },
        ...(updatedBy ? [{ name: '👮 Updated By', value: `**${updatedBy}**`, inline: true }] : [])
      ],
      footer: { text: 'APEX MOTORS • Booking System • Eclipse' },
      timestamp: new Date().toISOString()
    }]
  };
}

function buildHooniganEmbed(request, isUpdate, updatedBy, oldStatus) {
  const statusColors = { Approved: 0x29e07f, Rejected: 0xff1744, Completed: 0xffb703, Cancelled: 0x8e9fb5, Pending: 0xff9800, Reserved: 0x00b7ff };
  let servicesText = 'Not specified';
  try { const a = typeof request.services === 'string' ? JSON.parse(request.services) : (Array.isArray(request.services) ? request.services : []); if (a.length) servicesText = a.join(', '); } catch (e) {}
  return {
    username: 'HOONIGAN CUSTOMS',
    embeds: [{
      title: isUpdate ? `🔄 REQUEST UPDATE — ${request.reference}` : '🔧 NEW CUSTOMIZATION REQUEST',
      color: statusColors[request.status] || 0xff9800,
      fields: [
        { name: '📋 Status', value: `**${request.status}**${oldStatus ? ` (was: ${oldStatus})` : ''}`, inline: true },
        { name: '🏪 Shop', value: request.shop_name || 'Hoonigan Customs', inline: true },
        { name: '🌐 Server', value: request.server_name || 'Thalai Nagaram', inline: true },
        { name: '👤 Customer', value: `• **Name:** ${request.customer_name}\n• **Contact:** ${request.contact_number}\n• **Discord:** @${request.discord_username}`, inline: false },
        { name: '🚗 Vehicle', value: `• **Name:** ${request.vehicle_name}\n• **Model:** ${request.vehicle_model}`, inline: false },
        { name: '🔧 Services', value: servicesText, inline: false },
        { name: '📅 Details', value: `• **Reference:** \`${request.reference}\`\n• **Date:** ${request.preferred_date||'TBA'}\n${request.message?'• **Message:** '+request.message:''}`, inline: false },
        ...(updatedBy ? [{ name: '👮 Updated By', value: `**${updatedBy}**`, inline: true }] : [])
      ],
      footer: { text: 'HOONIGAN CUSTOMS • Request System • Thalai Nagaram' },
      timestamp: new Date().toISOString()
    }]
  };
}

function buildVehicleActionEmbed(action, vehicle, staffName) {
  const colors = { added: 0x29e07f, updated: 0x00b7ff, deleted: 0xff1744, sold: 0xffb703, reserved: 0xff9800 };
  return {
    username: 'APEX MOTORS',
    embeds: [{
      title: `🚗 VEHICLE ${action.toUpperCase()} — APEX MOTORS`,
      color: colors[action.toLowerCase()] || 0x00b7ff,
      fields: [
        { name: 'Vehicle', value: `${vehicle.name} (${vehicle.model})`, inline: true },
        { name: 'Category', value: vehicle.category || 'N/A', inline: true },
        { name: 'Price', value: `$${Number(vehicle.price||0).toLocaleString()}`, inline: true },
        { name: 'Status', value: vehicle.availability || 'N/A', inline: true },
        { name: 'Action By', value: staffName || 'Staff', inline: true }
      ],
      footer: { text: 'APEX MOTORS • Vehicle Management' },
      timestamp: new Date().toISOString()
    }]
  };
}

function generateReference(prefix) {
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  const suffix = crypto.randomBytes(1).toString('hex').toUpperCase();
  return `#${prefix}-${num}-${suffix}`;
}

// ============================================================================
// BUSINESS API ROUTE HANDLERS
// ============================================================================

async function handleBusinessesApi(req, res, pathname, method) {
  if (pathname !== '/api/businesses') return null;
  if (method === 'GET') {
    try {
      const rows = db.prepare('SELECT * FROM businesses WHERE is_published = 1 ORDER BY display_order ASC, id ASC').all();
      return sendJson(res, 200, { success: true, businesses: rows }), true;
    } catch (e) { return sendJson(res, 500, { success: false, message: 'DB error.' }), true; }
  }
  return null;
}

async function handleVehiclesApi(req, res, pathname, method, parsedUrl) {
  if (pathname === '/api/vehicles') {
    if (method === 'GET') {
      try {
        const category = (parsedUrl.searchParams.get('category') || '').trim();
        const availability = (parsedUrl.searchParams.get('availability') || '').trim();
        const all = parsedUrl.searchParams.get('all') === '1';
        if (all && !verifyStaffSession(req)) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
        let q = 'SELECT * FROM vehicles WHERE 1=1';
        const p = [];
        if (!all) q += ' AND is_published = 1';
        if (category && category.toLowerCase() !== 'all') { q += ' AND LOWER(category) = ?'; p.push(category.toLowerCase()); }
        if (availability && availability.toLowerCase() !== 'all') { q += ' AND LOWER(availability) = ?'; p.push(availability.toLowerCase()); }
        q += ' ORDER BY display_order ASC, id ASC';
        const rows = db.prepare(q).all(...p);
        for (const r of rows) { try { r.specs = typeof r.specs === 'string' ? JSON.parse(r.specs) : (r.specs || {}); } catch (e) { r.specs = {}; } }
        return sendJson(res, 200, { success: true, count: rows.length, vehicles: rows }), true;
      } catch (e) { return sendJson(res, 500, { success: false, message: 'DB error.' }), true; }
    }
    if (method === 'POST') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      const model = (body.model || '').trim();
      if (!name || !model) return sendJson(res, 422, { success: false, message: 'Vehicle name and model are required.' }), true;
      const category = (body.category || 'Sports').trim();
      const price = parseInt(body.price, 10) || 0;
      const image_url = (body.image_url || '').trim();
      const description = (body.description || '').trim();
      const specs = body.specs ? (typeof body.specs === 'object' ? JSON.stringify(body.specs) : String(body.specs)) : '{}';
      const availability = (body.availability || 'Available').trim();
      const VALID_AVAIL = ['Available', 'Reserved', 'Sold'];
      if (!VALID_AVAIL.includes(availability)) return sendJson(res, 422, { success: false, message: 'Availability must be Available, Reserved, or Sold.' }), true;
      const display_order = parseInt(body.display_order, 10) || 0;
      const business_id = parseInt(body.business_id, 10) || 1;
      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO vehicles (business_id,name,model,category,price,image_url,description,specs,availability,display_order,is_published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)').run(business_id, name, model, category, price, image_url, description, specs, availability, display_order, now, now);
      syncToJson();
      const newVeh = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(result.lastInsertRowid));
      sendDiscordWebhook(buildVehicleActionEmbed('added', newVeh || { name, model, category, price, availability }, session.name)).catch(() => {});
      return sendJson(res, 201, { success: true, vehicle: { id: Number(result.lastInsertRowid), name, model, category, price, image_url, description, availability }, message: 'Vehicle added successfully.' }), true;
    }
    return null;
  }

  if (pathname === '/api/vehicles/upload' && method === 'POST') {
    const session = verifyStaffSession(req);
    if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
    const body = await parseBody(req);
    const filename = (body.filename || 'vehicle.jpg').trim();
    let fileData = body.file_data || body.image_base64 || '';
    if (!fileData) return sendJson(res, 422, { success: false, message: 'No image data.' }), true;
    const ext = path.extname(filename).toLowerCase();
    if (!['.jpg','.jpeg','.png','.webp','.gif'].includes(ext)) return sendJson(res, 422, { success: false, message: 'Unsupported file type.' }), true;
    if (fileData.includes(',')) fileData = fileData.split(',')[1];
    let imgBuf;
    try { imgBuf = Buffer.from(fileData, 'base64'); } catch (e) { return sendJson(res, 400, { success: false, message: 'Corrupted image.' }), true; }
    if (imgBuf.length > 10 * 1024 * 1024) return sendJson(res, 413, { success: false, message: 'Image exceeds 10MB.' }), true;
    const safeFilename = `apex_vehicle_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, safeFilename), imgBuf);
    return sendJson(res, 201, { success: true, file_path: `assets/images/uploads/${safeFilename}`, filename: safeFilename, message: 'Vehicle image uploaded.' }), true;
  }

  if (pathname.startsWith('/api/vehicles/')) {
    const parts = pathname.split('/');
    const vehicleId = parseInt(parts[3], 10);
    if (isNaN(vehicleId)) return sendJson(res, 400, { success: false, message: 'Invalid vehicle ID.' }), true;
    if (method === 'GET') {
      const veh = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
      if (!veh) return sendJson(res, 404, { success: false, message: 'Vehicle not found.' }), true;
      try { veh.specs = typeof veh.specs === 'string' ? JSON.parse(veh.specs) : (veh.specs || {}); } catch (e) { veh.specs = {}; }
      return sendJson(res, 200, { success: true, vehicle: veh }), true;
    }
    if (method === 'PUT') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const body = await parseBody(req);
      const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
      if (!existing) return sendJson(res, 404, { success: false, message: 'Vehicle not found.' }), true;
      if (body.availability !== undefined && !['Available','Reserved','Sold'].includes(body.availability)) return sendJson(res, 422, { success: false, message: 'Invalid availability.' }), true;
      const specsVal = body.specs ? (typeof body.specs === 'object' ? JSON.stringify(body.specs) : String(body.specs)) : null;
      const now = new Date().toISOString();
      db.prepare('UPDATE vehicles SET name=COALESCE(?,name),model=COALESCE(?,model),category=COALESCE(?,category),price=COALESCE(?,price),image_url=COALESCE(?,image_url),description=COALESCE(?,description),specs=COALESCE(?,specs),availability=COALESCE(?,availability),display_order=COALESCE(?,display_order),is_published=COALESCE(?,is_published),updated_at=? WHERE id=?').run(
        body.name!==undefined?String(body.name).trim():null,
        body.model!==undefined?String(body.model).trim():null,
        body.category!==undefined?String(body.category).trim():null,
        body.price!==undefined?parseInt(body.price,10):null,
        body.image_url!==undefined?String(body.image_url).trim():null,
        body.description!==undefined?String(body.description).trim():null,
        specsVal,
        body.availability!==undefined?String(body.availability).trim():null,
        body.display_order!==undefined?parseInt(body.display_order,10):null,
        body.is_published!==undefined?(body.is_published?1:0):null,
        now, vehicleId
      );
      syncToJson();
      const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
      sendDiscordWebhook(buildVehicleActionEmbed('updated', updated||{name:'?',model:'?',category:'?',price:0,availability:'?'}, session.name)).catch(()=>{});
      return sendJson(res, 200, { success: true, message: 'Vehicle updated.', vehicle: updated }), true;
    }
    if (method === 'DELETE') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
      if (!existing) return sendJson(res, 404, { success: false, message: 'Vehicle not found.' }), true;
      db.prepare('DELETE FROM vehicles WHERE id = ?').run(vehicleId);
      syncToJson();
      sendDiscordWebhook(buildVehicleActionEmbed('deleted', existing, session.name)).catch(()=>{});
      return sendJson(res, 200, { success: true, message: 'Vehicle deleted.' }), true;
    }
  }
  return null;
}

async function handleVehicleBookingsApi(req, res, pathname, method, parsedUrl) {
  if (pathname === '/api/vehicle-bookings') {
    if (method === 'GET') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      try {
        const status = (parsedUrl.searchParams.get('status') || '').trim();
        const search = (parsedUrl.searchParams.get('search') || '').trim();
        let q = 'SELECT * FROM vehicle_bookings WHERE 1=1';
        const p = [];
        if (status && status.toLowerCase() !== 'all') { q += ' AND LOWER(status) = ?'; p.push(status.toLowerCase()); }
        if (search) { q += ' AND (LOWER(customer_name) LIKE ? OR LOWER(reference) LIKE ? OR LOWER(discord_username) LIKE ? OR LOWER(vehicle_name) LIKE ?)'; const t=`%${search.toLowerCase()}%`; p.push(t,t,t,t); }
        q += ' ORDER BY id DESC';
        const rows = db.prepare(q).all(...p);
        return sendJson(res, 200, { success: true, count: rows.length, bookings: rows }), true;
      } catch (e) { return sendJson(res, 500, { success: false, message: 'DB error.' }), true; }
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const customer_name = (body.customer_name || body.name || '').trim();
      const discord_username = (body.discord_username || body.discord || '').trim();
      const discord_id = (body.discord_id || '').trim();
      const contact_number = (body.contact_number || body.contact || '').trim();
      const vehicle_id = parseInt(body.vehicle_id, 10) || null;
      const preferred_date = (body.preferred_date || '').trim();
      const preferred_time = (body.preferred_time || '').trim();
      const message = (body.message || '').trim().slice(0, 1000);
      if (!customer_name) return sendJson(res, 422, { success: false, message: 'Customer name is required.' }), true;
      if (!discord_username) return sendJson(res, 422, { success: false, message: 'Discord username is required.' }), true;
      if (!contact_number) return sendJson(res, 422, { success: false, message: 'Contact number is required.' }), true;
      let vname = (body.vehicle_name || '').trim();
      let vmodel = (body.vehicle_model || '').trim();
      let vprice = parseInt(body.vehicle_price || body.price, 10) || 0;
      if (!vname) return sendJson(res, 422, { success: false, message: 'Vehicle name is required.' }), true;
      if (vehicle_id) {
        const veh = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle_id);
        if (veh) { vname = veh.name; vmodel = veh.model; vprice = veh.price; }
      }
      const reference = generateReference('APX');
      const now = new Date().toISOString();
      db.prepare('INSERT INTO vehicle_bookings (reference,vehicle_id,vehicle_name,vehicle_model,vehicle_price,customer_name,discord_username,discord_id,contact_number,preferred_date,preferred_time,message,status,dealership,server_name,submitted_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(reference,vehicle_id,vname,vmodel,vprice,customer_name,discord_username,discord_id,contact_number,preferred_date,preferred_time,message,'Pending','Apex Motors','Eclipse',now,now);
      syncToJson();
      const newBooking = db.prepare('SELECT * FROM vehicle_bookings WHERE reference = ?').get(reference);
      sendDiscordWebhook(buildApexBookingEmbed(newBooking, false, null, null)).catch(()=>{});
      return sendJson(res, 201, { success: true, booking: newBooking, reference, message: '✓ Pre-booking submitted successfully!' }), true;
    }
    return null;
  }
  if (pathname.startsWith('/api/vehicle-bookings/')) {
    const parts = pathname.split('/');
    const bookingId = parseInt(parts[3], 10);
    if (isNaN(bookingId)) return sendJson(res, 400, { success: false, message: 'Invalid booking ID.' }), true;
    if (method === 'GET') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const booking = db.prepare('SELECT * FROM vehicle_bookings WHERE id = ?').get(bookingId);
      if (!booking) return sendJson(res, 404, { success: false, message: 'Booking not found.' }), true;
      return sendJson(res, 200, { success: true, booking }), true;
    }
    if (method === 'PATCH') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const body = await parseBody(req);
      const VALID = ['Pending','Approved','Reserved','Completed','Cancelled','Rejected'];
      const newStatus = body.status ? String(body.status).trim() : null;
      if (!newStatus || !VALID.includes(newStatus)) return sendJson(res, 422, { success: false, message: `Status must be one of: ${VALID.join(', ')}` }), true;
      const existing = db.prepare('SELECT * FROM vehicle_bookings WHERE id = ?').get(bookingId);
      if (!existing) return sendJson(res, 404, { success: false, message: 'Booking not found.' }), true;
      const oldStatus = existing.status;
      const notes = body.notes !== undefined ? String(body.notes).trim() : null;
      const now = new Date().toISOString();
      db.prepare('UPDATE vehicle_bookings SET status=?,notes=COALESCE(?,notes),updated_at=? WHERE id=?').run(newStatus, notes, now, bookingId);
      if (newStatus === 'Completed' && existing.vehicle_id) db.prepare("UPDATE vehicles SET availability='Sold',updated_at=? WHERE id=?").run(now, existing.vehicle_id);
      syncToJson();
      const updated = db.prepare('SELECT * FROM vehicle_bookings WHERE id = ?').get(bookingId);
      sendDiscordWebhook(buildApexBookingEmbed(updated, true, session.name, oldStatus)).catch(()=>{});
      return sendJson(res, 200, { success: true, message: `Booking updated to ${newStatus}.`, booking: updated }), true;
    }
  }
  return null;
}

async function handleServicesApi(req, res, pathname, method, parsedUrl) {
  if (pathname === '/api/customization-services') {
    if (method === 'GET') {
      try {
        const all = parsedUrl.searchParams.get('all') === '1';
        if (all && !verifyStaffSession(req)) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
        let q = 'SELECT * FROM customization_services WHERE 1=1';
        if (!all) q += ' AND is_available = 1';
        q += ' ORDER BY display_order ASC, id ASC';
        return sendJson(res, 200, { success: true, services: db.prepare(q).all() }), true;
      } catch (e) { return sendJson(res, 500, { success: false, message: 'DB error.' }), true; }
    }
    if (method === 'POST') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      if (!name) return sendJson(res, 422, { success: false, message: 'Service name is required.' }), true;
      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO customization_services (business_id,name,category,description,price_from,price_to,duration,image_url,is_available,display_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
        parseInt(body.business_id,10)||2, name, (body.category||'Performance').trim(), (body.description||'').trim(),
        parseInt(body.price_from,10)||0, parseInt(body.price_to,10)||0, (body.duration||'TBA').trim(),
        (body.image_url||'').trim(), body.is_available===false?0:1, parseInt(body.display_order,10)||0, now, now
      );
      syncToJson();
      return sendJson(res, 201, { success: true, message: 'Service added.', id: Number(result.lastInsertRowid) }), true;
    }
    return null;
  }
  if (pathname.startsWith('/api/customization-services/')) {
    const svcId = parseInt(pathname.split('/')[3], 10);
    if (isNaN(svcId)) return sendJson(res, 400, { success: false, message: 'Invalid ID.' }), true;
    if (method === 'PUT') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const body = await parseBody(req);
      const now = new Date().toISOString();
      db.prepare('UPDATE customization_services SET name=COALESCE(?,name),category=COALESCE(?,category),description=COALESCE(?,description),price_from=COALESCE(?,price_from),price_to=COALESCE(?,price_to),duration=COALESCE(?,duration),is_available=COALESCE(?,is_available),display_order=COALESCE(?,display_order),updated_at=? WHERE id=?').run(
        body.name!==undefined?String(body.name).trim():null,
        body.category!==undefined?String(body.category).trim():null,
        body.description!==undefined?String(body.description).trim():null,
        body.price_from!==undefined?parseInt(body.price_from,10):null,
        body.price_to!==undefined?parseInt(body.price_to,10):null,
        body.duration!==undefined?String(body.duration).trim():null,
        body.is_available!==undefined?(body.is_available?1:0):null,
        body.display_order!==undefined?parseInt(body.display_order,10):null,
        now, svcId
      );
      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Service updated.' }), true;
    }
    if (method === 'DELETE') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      db.prepare('DELETE FROM customization_services WHERE id = ?').run(svcId);
      syncToJson();
      return sendJson(res, 200, { success: true, message: 'Service deleted.' }), true;
    }
  }
  return null;
}

async function handleCustomizationRequestsApi(req, res, pathname, method, parsedUrl) {
  if (pathname === '/api/customization-requests') {
    if (method === 'GET') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      try {
        const status = (parsedUrl.searchParams.get('status') || '').trim();
        const search = (parsedUrl.searchParams.get('search') || '').trim();
        let q = 'SELECT * FROM customization_requests WHERE 1=1';
        const p = [];
        if (status && status.toLowerCase() !== 'all') { q += ' AND LOWER(status) = ?'; p.push(status.toLowerCase()); }
        if (search) { q += ' AND (LOWER(customer_name) LIKE ? OR LOWER(reference) LIKE ? OR LOWER(vehicle_name) LIKE ?)'; const t=`%${search.toLowerCase()}%`; p.push(t,t,t); }
        q += ' ORDER BY id DESC';
        const rows = db.prepare(q).all(...p);
        return sendJson(res, 200, { success: true, count: rows.length, requests: rows }), true;
      } catch (e) { return sendJson(res, 500, { success: false, message: 'DB error.' }), true; }
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const customer_name = (body.customer_name || body.name || '').trim();
      const discord_username = (body.discord_username || body.discord || '').trim();
      const contact_number = (body.contact_number || body.contact || '').trim();
      const vehicle_name = (body.vehicle_name || '').trim();
      const vehicle_model = (body.vehicle_model || '').trim();
      const services = Array.isArray(body.services) ? JSON.stringify(body.services) : (body.services || '[]');
      const additional_requirements = (body.additional_requirements || '').trim().slice(0, 1000);
      const preferred_date = (body.preferred_date || '').trim();
      const preferred_time = (body.preferred_time || '').trim();
      const message = (body.message || '').trim().slice(0, 1000);
      if (!customer_name) return sendJson(res, 422, { success: false, message: 'Customer name is required.' }), true;
      if (!discord_username) return sendJson(res, 422, { success: false, message: 'Discord username is required.' }), true;
      if (!contact_number) return sendJson(res, 422, { success: false, message: 'Contact number is required.' }), true;
      if (!vehicle_name) return sendJson(res, 422, { success: false, message: 'Vehicle name is required.' }), true;
      const reference = generateReference('HGN');
      const now = new Date().toISOString();
      db.prepare('INSERT INTO customization_requests (reference,customer_name,discord_username,contact_number,vehicle_name,vehicle_model,services,additional_requirements,preferred_date,preferred_time,message,status,shop_name,server_name,submitted_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(reference,customer_name,discord_username,contact_number,vehicle_name,vehicle_model,services,additional_requirements,preferred_date,preferred_time,message,'Pending','Hoonigan Customs','Thalai Nagaram',now,now);
      syncToJson();
      const newReq = db.prepare('SELECT * FROM customization_requests WHERE reference = ?').get(reference);
      sendDiscordWebhook(buildHooniganEmbed(newReq, false, null, null)).catch(()=>{});
      return sendJson(res, 201, { success: true, request: newReq, reference, message: '✓ Customization request submitted!' }), true;
    }
    return null;
  }
  if (pathname.startsWith('/api/customization-requests/')) {
    const parts = pathname.split('/');
    const reqId = parseInt(parts[3], 10);
    if (isNaN(reqId)) return sendJson(res, 400, { success: false, message: 'Invalid ID.' }), true;
    if (method === 'GET') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const record = db.prepare('SELECT * FROM customization_requests WHERE id = ?').get(reqId);
      if (!record) return sendJson(res, 404, { success: false, message: 'Request not found.' }), true;
      return sendJson(res, 200, { success: true, request: record }), true;
    }
    if (method === 'PATCH') {
      const session = verifyStaffSession(req);
      if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
      const body = await parseBody(req);
      const VALID = ['Pending','Approved','Reserved','Completed','Cancelled','Rejected'];
      const newStatus = body.status ? String(body.status).trim() : null;
      if (!newStatus || !VALID.includes(newStatus)) return sendJson(res, 422, { success: false, message: `Status must be one of: ${VALID.join(', ')}` }), true;
      const existing = db.prepare('SELECT * FROM customization_requests WHERE id = ?').get(reqId);
      if (!existing) return sendJson(res, 404, { success: false, message: 'Request not found.' }), true;
      const oldStatus = existing.status;
      const notes = body.notes !== undefined ? String(body.notes).trim() : null;
      const now = new Date().toISOString();
      db.prepare('UPDATE customization_requests SET status=?,notes=COALESCE(?,notes),updated_at=? WHERE id=?').run(newStatus, notes, now, reqId);
      syncToJson();
      const updated = db.prepare('SELECT * FROM customization_requests WHERE id = ?').get(reqId);
      sendDiscordWebhook(buildHooniganEmbed(updated, true, session.name, oldStatus)).catch(()=>{});
      return sendJson(res, 200, { success: true, message: `Request updated to ${newStatus}.`, request: updated }), true;
    }
  }
  return null;
}

async function handleBusinessStatsApi(req, res, pathname, method) {
  if (pathname !== '/api/business-stats' || method !== 'GET') return null;
  const session = verifyStaffSession(req);
  if (!session) return sendJson(res, 401, { success: false, message: 'Unauthorized.' }), true;
  try {
    return sendJson(res, 200, { success: true, stats: {
      totalVehicles: db.prepare('SELECT COUNT(*) as c FROM vehicles').get().c,
      availableVehicles: db.prepare("SELECT COUNT(*) as c FROM vehicles WHERE availability='Available'").get().c,
      totalBookings: db.prepare('SELECT COUNT(*) as c FROM vehicle_bookings').get().c,
      pendingBookings: db.prepare("SELECT COUNT(*) as c FROM vehicle_bookings WHERE status='Pending'").get().c,
      totalRequests: db.prepare('SELECT COUNT(*) as c FROM customization_requests').get().c,
      pendingRequests: db.prepare("SELECT COUNT(*) as c FROM customization_requests WHERE status='Pending'").get().c,
      totalServices: db.prepare('SELECT COUNT(*) as c FROM customization_services').get().c
    } }), true;
  } catch (e) { return sendJson(res, 500, { success: false, message: 'DB error.' }), true; }
}

// Start Server Listener
server.listen(PORT, () => {
  console.log('='.repeat(65));
  console.log('  [+] REAPERZ COMMUNITY SERVER ONLINE (NODE.JS) [+]');
  console.log(`  Web Portal:   http://localhost:${PORT}`);
  console.log(`  Library:      http://localhost:${PORT}/library.html`);
  console.log(`  Rate Us:      http://localhost:${PORT}/rate.html`);
  console.log(`  Members:      http://localhost:${PORT}/members.html`);
  console.log(`  Staff Portal: http://localhost:${PORT}/admin.html`);
  console.log(`  SQL Database: data/reaperz.db (node:sqlite active)`);
  console.log('='.repeat(65));
});
