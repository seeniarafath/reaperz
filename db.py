#!/usr/bin/env python3
"""
====================================================================
  REAPERZ COMMUNITY - SQLITE DATABASE & AUTHENTICATION MANAGER
  Uses Python 3 standard library sqlite3 with parameterized queries.
  Implements PBKDF2-HMAC-SHA256 password hashing and salt verification.
====================================================================
"""

import hashlib
import json
import os
import secrets
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_FILE = DATA_DIR / "reaperz.db"
JSON_BACKUP_FILE = DATA_DIR / "db.json"
UPLOADS_DIR = BASE_DIR / "assets" / "images" / "uploads"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def get_db_connection():
    """Returns a SQLite connection with row factory enabled and foreign keys on."""
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# --- PASSWORD HASHING UTILITIES ---

def hash_password(password: str, salt: str = None) -> tuple:
    """
    Hashes a password with PBKDF2-HMAC-SHA256 and a random or provided salt.
    Returns (salt_hex, hash_hex).
    """
    if salt is None:
        salt = secrets.token_hex(16)
    salt_bytes = bytes.fromhex(salt)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_bytes,
        100000
    )
    return salt, key.hex()


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    """Verifies a password against a stored salt and hash using constant-time comparison."""
    try:
        salt_bytes = bytes.fromhex(salt)
        key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt_bytes,
            100000
        )
        return secrets.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False


# --- INITIAL DATABASE SCHEMA CREATION ---

def init_db():
    """Initializes all SQL database tables with parameterized schemas and default seeds."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Members Table
    cursor.execute("""
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
        )
    """)

    # Ensure department and details columns exist on members
    try:
        cursor.execute("PRAGMA table_info(members)")
        mem_cols = [c["name"] for c in cursor.fetchall()]
        if "department" not in mem_cols:
            cursor.execute("ALTER TABLE members ADD COLUMN department TEXT NOT NULL DEFAULT 'Community'")
        if "details" not in mem_cols:
            cursor.execute("ALTER TABLE members ADD COLUMN details TEXT DEFAULT ''")
    except Exception:
        pass

    # 2. Staff Table (Secure Authentication)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_login TEXT DEFAULT NULL
        )
    """)

    # 3. Applications Table
    cursor.execute("""
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
        )
    """)

    # 4. Messages Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 5. Ratings Table
    cursor.execute("""
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
        )
    """)

    # 6. Library Media Table
    cursor.execute("""
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
        )
    """)

    # 7. Community Highlights Table
    cursor.execute("""
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
        )
    """)

    # 8. Events Table
    cursor.execute("""
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
            discord_link TEXT DEFAULT '',
            is_published INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    event_cols = {column["name"] for column in cursor.execute("PRAGMA table_info(events)").fetchall()}
    for name, definition in (
        ("category", "TEXT DEFAULT 'Community Event'"),
        ("prize", "TEXT DEFAULT ''"),
        ("button_text", "TEXT DEFAULT ''"),
        ("display_order", "INTEGER DEFAULT 0"),
    ):
        if name not in event_cols:
            cursor.execute(f"ALTER TABLE events ADD COLUMN {name} {definition}")

    # 9. Gaming Platforms Table (GTA V Online Crew & FiveM Servers)
    cursor.execute("""
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
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_metadata (
            meta_key TEXT PRIMARY KEY,
            meta_value TEXT NOT NULL
        )
    """)

    # 10. Website Settings Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS website_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()

    # --- SEED DEFAULT STAFF ACCOUNTS IF NOT PRESENT ---
    cursor.execute("SELECT COUNT(*) as cnt FROM staff")
    founder_pass = os.environ.get("STAFF_FOUNDER_PASS")
    admin_pass = os.environ.get("STAFF_ADMIN_PASS")

    if cursor.fetchone()["cnt"] == 0:
        if not founder_pass or not admin_pass:
            conn.close()
            raise RuntimeError("Set STAFF_FOUNDER_PASS and STAFF_ADMIN_PASS before initializing an empty database.")
        salt_founder, hash_founder = hash_password(founder_pass)
        salt_admin, hash_admin = hash_password(admin_pass)

        cursor.execute("""
            INSERT INTO staff (username, name, role, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("dark", "Dark", "Founder", hash_founder, salt_founder, datetime.utcnow().isoformat() + "Z"))

        cursor.execute("""
            INSERT INTO staff (username, name, role, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("founder", "REAPER ARAFATH", "Founder", hash_founder, salt_founder, datetime.utcnow().isoformat() + "Z"))

        cursor.execute("""
            INSERT INTO staff (username, name, role, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("admin", "WOLF", "Admin", hash_admin, salt_admin, datetime.utcnow().isoformat() + "Z"))

        conn.commit()
        print("[DB] Default staff accounts initialized with salted password hashes.")
    else:
        cursor.execute("SELECT id FROM staff WHERE username = 'dark'")
        if not cursor.fetchone() and founder_pass:
            salt_founder, hash_founder = hash_password(founder_pass)
            cursor.execute("""
                INSERT INTO staff (username, name, role, password_hash, salt, created_at)
                VALUES ('dark', 'Dark', 'Founder', ?, ?, ?)
            """, (hash_founder, salt_founder, datetime.utcnow().isoformat() + "Z"))
            conn.commit()

    # --- SEED DEFAULT MEMBERS IF NOT PRESENT ---
    cursor.execute("SELECT COUNT(*) as cnt FROM members")
    founder_avatar = "https://cdn.discordapp.com/avatars/937289791429562398/9970cd81f120a25115493cc9ed04a777.png?size=4096&ignore=true"

    if cursor.fetchone()["cnt"] == 0:
        default_members = [
            ("Dark", "Founder", "GTA V / FiveM", "rpz_dark", "937289791429562398", "Online", founder_avatar, "Command", "Community Founder & Head of Operations", "2026-01-01T00:00:00Z"),
            ("Beast Boy", "Developer", "GTA V / FiveM", "beastboy", "912345678901234568", "Online", "", "Development", "Lead Website & Systems Developer", "2026-01-10T00:00:00Z"),
            ("REAPER ARAFATH", "Founder", "GTA V / FiveM", "arafath", "912345678901234560", "Online", "", "Command", "Co-Founder", "2026-01-01T00:00:00Z"),
            ("WOLF", "Admin", "FiveM", "wolf", "912345678901234561", "Online", "", "Operations", "Head Administrator", "2026-01-15T00:00:00Z"),
            ("SHADOW", "Moderator", "GTA V Online", "shadow", "912345678901234562", "Idle", "", "Roleplay", "RP Division Lead", "2026-02-01T00:00:00Z"),
            ("KING", "Moderator", "FiveM", "king", "912345678901234563", "Do Not Disturb", "", "Events", "Events Coordinator", "2026-02-10T00:00:00Z"),
            ("VIKRAM", "Member", "GTA V Online", "vikram", "912345678901234564", "Online", "", "Heists", "Tactical Heist Squad", "2026-03-01T00:00:00Z"),
            ("SURIYA", "Member", "FiveM", "suriya", "912345678901234565", "Online", "", "Roleplay", "Senior Roleplayer", "2026-03-05T00:00:00Z"),
            ("RAJ", "Member", "GTA V Online", "raj", "912345678901234566", "Offline", "", "Community", "Crew Member", "2026-03-12T00:00:00Z"),
            ("KARTHI", "Member", "FiveM", "karthi", "912345678901234567", "Online", "", "Community", "Crew Member", "2026-03-20T00:00:00Z")
        ]
        cursor.executemany("""
            INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, default_members)
        conn.commit()
        print("[DB] Default members roster seeded into SQL database.")
    else:
        # Ensure Dark and Beast Boy exist
        cursor.execute("SELECT id FROM members WHERE discord = 'rpz_dark' OR name = 'Dark'")
        dark_row = cursor.fetchone()
        if dark_row:
            cursor.execute("""
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
            """, (founder_avatar, dark_row["id"]))
        else:
            cursor.execute("""
                INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
                VALUES ('Dark', 'Founder', 'GTA V / FiveM', 'rpz_dark', '937289791429562398', 'Online', ?, 'Command', 'Community Founder & Head of Operations', '2026-01-01T00:00:00Z')
            """, (founder_avatar,))

        cursor.execute("SELECT id FROM members WHERE LOWER(name) = 'beast boy' OR discord = 'beastboy'")
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
                VALUES ('Beast Boy', 'Developer', 'GTA V / FiveM', 'beastboy', '912345678901234568', 'Online', '', 'Development', 'Lead Website & Systems Developer', '2026-01-10T00:00:00Z')
            """)
        conn.commit()

    # --- SEED DEFAULT HIGHLIGHTS IF EMPTY ---
    cursor.execute("SELECT COUNT(*) as cnt FROM community_highlights")
    if cursor.fetchone()["cnt"] == 0:
        default_highlights = [
            ("NURP Community Mega Roleplay", "REAPERZ Police & EMS division staging tactical patrol convoy across Sandy Shores.", "assets/images/gallery-1.jpg", "2026-10-01", 1, 1),
            ("Los Santos Midnight Squad Run", "High-speed night cruise and freeway formation through downtown Los Santos.", "assets/images/gallery-2.jpg", "2026-10-02", 2, 1),
            ("Tamil Car Enthusiasts Meetup", "Clean JDM tuners and widebody hypercars on display at Del Perro pier car show.", "assets/images/gallery-3.jpg", "2026-10-03", 3, 1),
            ("City Roleplay Action & Briefing", "Subway station operation and city roleplay patrol debriefing session.", "assets/images/gallery-4.jpg", "2026-10-04", 4, 1),
            ("Highway Convoy & Fleet Drive", "Blaine County highway formation convoy heading towards Mount Chiliad.", "assets/images/gallery-5.jpg", "2026-10-05", 5, 1),
            ("Squad Briefing & Heist Setup", "Pre-heist tactical briefing and weapons layout prior to Casino vault breach.", "assets/images/gallery-6.jpg", "2026-10-06", 6, 1)
        ]
        cursor.executemany("""
            INSERT INTO community_highlights (title, description, image_url, event_date, display_order, is_published)
            VALUES (?, ?, ?, ?, ?, ?)
        """, default_highlights)
        conn.commit()

    # --- SEED DEFAULT EVENTS IF EMPTY ---
    cursor.execute("SELECT COUNT(*) as cnt FROM events")
    if cursor.fetchone()["cnt"] == 0:
        default_events = [
            ("NURP Community Mega Roleplay Event", "Massive city-wide joint operation with police pursuits, gang territory showdowns, and emergency EMS responses on NURP RP server.", "assets/images/gallery-1.jpg", "2026-10-20", "8:00 PM IST", "NURP Roleplay Server", "Dark & REAPERZ Staff", "Upcoming", "https://discord.gg/reaperz-tamil", 1),
            ("Los Santos Midnight Tuner Grand Prix", "High-octane street racing tournament through the tunnels and highways of Los Santos. Cash prizes and custom Discord titles for winners!", "assets/images/gallery-3.jpg", "2026-10-25", "9:00 PM IST", "GTA V Online Private Lobby", "KING", "Upcoming", "https://discord.gg/reaperz-tamil", 1),
            ("Doomsday Heist Criminal Mastermind Run", "Elite crew operation completing all acts of the Doomsday Heist with zero deaths and elite challenge times.", "assets/images/gallery-6.jpg", "2026-10-05", "7:30 PM IST", "GTA V Online Facility", "VIKRAM & WOLF", "Past", "https://discord.gg/reaperz-tamil", 1),
            ("Sandy Shores Tactical Convoy", "Cross-county convoy and fleet parade featuring 25+ crew members cruising through Blaine County.", "assets/images/gallery-5.jpg", "2026-09-28", "8:00 PM IST", "FiveM Roleplay Server", "SHADOW", "Past", "https://discord.gg/reaperz-tamil", 1)
        ]
        cursor.executemany("""
            INSERT INTO events (title, description, image_url, event_date, event_time, location, organizer, status, discord_link, is_published)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, default_events)
        conn.commit()

    # Seed platform defaults once so deleting all managed records persists across restarts.
    cursor.execute("SELECT meta_value FROM app_metadata WHERE meta_key = ?", ("gaming_platforms_seeded",))
    if cursor.fetchone() is None:
        cursor.execute("SELECT COUNT(*) as cnt FROM gaming_platforms")
        if cursor.fetchone()["cnt"] == 0:
            default_platforms = [
                ("gta_online", "TN REAPERZ", "Official Rockstar Social Club Crew for GTA Online", "assets/images/gallery-2.jpg", "https://socialclub.rockstargames.com", "Active", 1, 1),
                ("fivem", "NURP RP", "Tamil Roleplay FiveM Server — Primary Server for REAPERZ", "assets/images/gallery-4.jpg", "fivem://connect/cfx.re/join/nurp", "Active", 1, 1)
            ]
            cursor.executemany("""
                INSERT INTO gaming_platforms (type, name, description, image_url, link, status, display_order, is_published)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, default_platforms)
        cursor.execute("INSERT INTO app_metadata (meta_key, meta_value) VALUES (?, ?)", ("gaming_platforms_seeded", "1"))
        conn.commit()

    # --- SEED DEFAULT SETTINGS IF EMPTY ---
    cursor.execute("SELECT COUNT(*) as cnt FROM website_settings")
    if cursor.fetchone()["cnt"] == 0:
        default_settings = [
            ("discord_invite", "https://discord.gg/reaperz-tamil")
        ]
        cursor.executemany("""
            INSERT INTO website_settings (setting_key, setting_value)
            VALUES (?, ?)
        """, default_settings)
        conn.commit()

    # --- SEED DEFAULT RATINGS IF NOT PRESENT ---
    cursor.execute("SELECT COUNT(*) as cnt FROM ratings")
    if cursor.fetchone()["cnt"] == 0:
        default_ratings = [
            ("Arun Kumar", "arun_chennai#1001", 5, "FiveM Roleplay", "6+ Months", "Top-tier FiveM Tamil Roleplay!", "Joined REAPERZ 4 months ago for FiveM police and EMS RP. The community is well-organized, friendly, and non-toxic. Voice calls in Tamil make gaming feel like family!", 1, 18, "2026-10-10T14:20:00Z"),
            ("Siva Nathan", "siva_kl#7723", 5, "GTA 5 Online", "3-6 Months", "Best Crew for Heists and Money Grinding", "Cayo Perico, Casino, and Doomsday heists with REAPER ARAFATH and the squad are super smooth. No griefers, pure coordination and maximum payouts.", 1, 14, "2026-10-11T09:15:00Z"),
            ("Vignesh V", "vicky_racer#4412", 5, "Car Meets & Racing", "1-3 Months", "Los Santos Tamil Car Meets are Pure Fire!", "The weekly car shows, mountain drift runs, and highway convoys are insanely fun. Great custom builds, respectful members, and high adrenaline.", 1, 11, "2026-10-11T18:40:00Z"),
            ("Mohamed Irfan", "irfan_reaper#3321", 5, "Community & Atmosphere", "6+ Months", "Zero Toxicity & True Tamil Brotherhood", "Whether you are a beginner or a veteran player, everyone treats you with respect. Staff members SHADOW and WOLF are always helpful on voice calls.", 1, 9, "2026-10-12T12:05:00Z"),
            ("Praveen Raj", "praveen_gta#5589", 4, "FiveM Roleplay", "New Recruit", "Solid Community with Active Leadership", "Very active Discord, clear community rules, and regular server events. The admins guided me through setting up FiveM mods quickly.", 1, 7, "2026-10-12T17:30:00Z")
        ]
        cursor.executemany("""
            INSERT INTO ratings (name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, default_ratings)
        conn.commit()
        print("[DB] Default player ratings seeded into SQL database.")

    # --- SEED DEFAULT LIBRARY MEDIA IF NOT PRESENT ---
    cursor.execute("SELECT COUNT(*) as cnt FROM library")
    if cursor.fetchone()["cnt"] == 0:
        default_media = [
            ("FiveM Patrol & Convoy Meet", "FiveM RP", "gallery-1.jpg", "assets/images/gallery-1.jpg", 283047, "image/jpeg", "REAPERZ Police & EMS division staging tactical patrol convoy across Sandy Shores.", "REAPER ARAFATH", "2026-10-01T12:00:00Z"),
            ("Los Santos Midnight Squad Run", "GTA 5 Online", "gallery-2.jpg", "assets/images/gallery-2.jpg", 284219, "image/jpeg", "High-speed night cruise and freeway formation through downtown Los Santos.", "WOLF", "2026-10-02T15:30:00Z"),
            ("Tamil Car Enthusiasts Meetup", "Car Meets", "gallery-3.jpg", "assets/images/gallery-3.jpg", 284872, "image/jpeg", "Clean JDM tuners and widebody hypercars on display at Del Perro pier car show.", "KING", "2026-10-03T18:00:00Z"),
            ("City Roleplay Action & Briefing", "FiveM RP", "gallery-4.jpg", "assets/images/gallery-4.jpg", 298721, "image/jpeg", "Subway station operation and city roleplay patrol debriefing session.", "SHADOW", "2026-10-04T20:15:00Z"),
            ("Highway Convoy & Fleet Drive", "Crew Convoys", "gallery-5.jpg", "assets/images/gallery-5.jpg", 316724, "image/jpeg", "Blaine County highway formation convoy heading towards Mount Chiliad.", "VIKRAM", "2026-10-05T14:40:00Z"),
            ("Squad Briefing & Heist Setup", "Heist Operations", "gallery-6.jpg", "assets/images/gallery-6.jpg", 348681, "image/jpeg", "Pre-heist tactical briefing and weapons layout prior to Casino vault breach.", "REAPER ARAFATH", "2026-10-06T19:00:00Z")
        ]
        cursor.executemany("""
            INSERT INTO library (title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, default_media)
        conn.commit()
        print("[DB] Default media library items seeded into SQL database.")

    # --- SEED DEFAULT APPLICATION IF EMPTY ---
    cursor.execute("SELECT COUNT(*) as cnt FROM applications")
    if cursor.fetchone()["cnt"] == 0:
        cursor.execute("""
            INSERT INTO applications (name, discord, age, game, role, timezone, about, status, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "Dinesh Kumar",
            "dinesh_gta#1234",
            21,
            "FiveM",
            "Police RP",
            "IST (Tamil Nadu)",
            "Experienced in FiveM Tamil servers for 2 years. Looking for a serious and fun roleplay community with REAPERZ.",
            "Pending",
            "2026-10-12T19:30:00Z"
        ))
        conn.commit()

    conn.close()
    sync_to_json()


def sync_to_json():
    """Exports SQLite database state to db.json for backup and offline fallback compatibility."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id, name, role, game, discord, discord_id, discord_status as status, avatar, department, details, joined_at FROM members ORDER BY id ASC")
        members = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT id, name, discord, age, game, role, timezone, about, status, submitted_at FROM applications ORDER BY id DESC")
        apps = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT id, name, email, subject, message, submitted_at FROM messages ORDER BY id DESC")
        msgs = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT id, name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at FROM ratings ORDER BY id DESC")
        ratings = [dict(row) for row in cursor.fetchall()]
        for r in ratings:
            r["recommended"] = bool(r["recommended"])

        cursor.execute("SELECT id, title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at FROM library ORDER BY id DESC")
        media = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT id, title, description, image_url, event_date, display_order, is_published, created_at FROM community_highlights ORDER BY display_order ASC, id DESC")
        highlights = [dict(row) for row in cursor.fetchall()]
        for h in highlights:
            h["is_published"] = bool(h["is_published"])

        cursor.execute("SELECT id, title, description, image_url, event_date, event_time, location, organizer, status, category, prize, button_text, display_order, discord_link, is_published, created_at FROM events ORDER BY display_order ASC, event_date ASC")
        events_list = [dict(row) for row in cursor.fetchall()]
        for e in events_list:
            e["is_published"] = bool(e["is_published"])

        cursor.execute("SELECT id, type, name, description, image_url, link, status, display_order, is_published, created_at FROM gaming_platforms ORDER BY display_order ASC, id ASC")
        platforms = [dict(row) for row in cursor.fetchall()]
        for p in platforms:
            p["is_published"] = bool(p["is_published"])

        cursor.execute("SELECT setting_key, setting_value FROM website_settings")
        settings = {r["setting_key"]: r["setting_value"] for r in cursor.fetchall()}

        conn.close()

        payload = {
            "members": members,
            "applications": apps,
            "messages": msgs,
            "ratings": ratings,
            "library": media,
            "community_highlights": highlights,
            "events": events_list,
            "gaming_platforms": platforms,
            "website_settings": settings
        }

        with open(JSON_BACKUP_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Warn] Failed to sync to db.json: {e}", file=sys.stderr)


# --- MEMBERS SQL API ---

def get_members(search: str = "", role: str = "", department: str = "", status: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT id, name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at FROM members WHERE 1=1"
    params = []

    if search:
        query += " AND (LOWER(name) LIKE ? OR LOWER(game) LIKE ? OR LOWER(discord) LIKE ? OR LOWER(discord_id) LIKE ? OR LOWER(role) LIKE ? OR LOWER(department) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term, term, term, term, term])

    if role and role.lower() != "all":
        query += " AND LOWER(role) = ?"
        params.append(role.lower())

    if department and department.lower() != "all":
        query += " AND LOWER(department) = ?"
        params.append(department.lower())

    if status and status.lower() != "all":
        query += " AND LOWER(discord_status) = ?"
        params.append(status.lower())

    query += " ORDER BY CASE role WHEN 'Founder' THEN 1 WHEN 'Admin' THEN 2 WHEN 'Moderator' THEN 3 WHEN 'Developer' THEN 4 ELSE 5 END, id ASC"

    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Requirement 8: Founder status always displays Online
    for r in rows:
        if r.get("role") == "Founder" or r.get("discord") == "rpz_dark" or r.get("name") == "Dark":
            r["discord_status"] = "Online"
        r["status"] = r["discord_status"]
    return rows


def get_member(member_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at FROM members WHERE id = ?", (member_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    if res.get("role") == "Founder" or res.get("discord") == "rpz_dark" or res.get("name") == "Dark":
        res["discord_status"] = "Online"
    res["status"] = res["discord_status"]
    return res


def add_member(name: str, role: str, game: str = "GTA V / FiveM", discord: str = "", discord_id: str = "", discord_status: str = "Online", avatar: str = "", department: str = "Community", details: str = "", joined_at: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()

    now = joined_at or (datetime.utcnow().isoformat() + "Z")
    cursor.execute("""
        INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, role, game, discord, discord_id, discord_status, avatar, department, details, now))

    member_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()

    return {
        "id": member_id,
        "name": name,
        "role": role,
        "game": game,
        "department": department,
        "details": details,
        "discord": discord,
        "discord_id": discord_id,
        "discord_status": discord_status,
        "status": discord_status,
        "avatar": avatar,
        "joined_at": now
    }


def update_member(member_id: int, **fields):
    conn = get_db_connection()
    cursor = conn.cursor()

    allowed = ["name", "role", "game", "discord", "discord_id", "discord_status", "avatar", "department", "details", "joined_at"]
    sets = []
    params = []
    for k, v in fields.items():
        if k in allowed and v is not None:
            sets.append(f"{k} = ?")
            params.append(v)

    if not sets:
        conn.close()
        return get_member(member_id)

    params.append(member_id)
    cursor.execute(f"UPDATE members SET {', '.join(sets)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    sync_to_json()
    return get_member(member_id)


def update_member_role(member_id: int, new_role: str):
    return bool(update_member(member_id, role=new_role))


def update_member_discord_status(member_id: int, status: str, avatar: str = None):
    kwargs = {"discord_status": status}
    if avatar:
        kwargs["avatar"] = avatar
    return bool(update_member(member_id, **kwargs))


def delete_member(member_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM members WHERE id = ?", (member_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    sync_to_json()
    return affected > 0


# --- COMMUNITY HIGHLIGHTS SQL API ---

def get_highlights(all_items: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT id, title, description, image_url, event_date, display_order, is_published, created_at, updated_at FROM community_highlights"
    if not all_items:
        query += " WHERE is_published = 1"
    query += " ORDER BY display_order ASC, id DESC"
    cursor.execute(query)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for r in rows:
        r["is_published"] = bool(r["is_published"])
    return rows


def add_highlight(title: str, description: str, image_url: str, event_date: str = "", display_order: int = 0, is_published: bool = True):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO community_highlights (title, description, image_url, event_date, display_order, is_published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, description, image_url, event_date, display_order, 1 if is_published else 0, now, now))
    h_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()
    return {
        "id": h_id,
        "title": title,
        "description": description,
        "image_url": image_url,
        "event_date": event_date,
        "display_order": display_order,
        "is_published": is_published,
        "created_at": now
    }


def update_highlight(highlight_id: int, **fields):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"

    allowed = ["title", "description", "image_url", "event_date", "display_order", "is_published"]
    sets = []
    params = []
    for k, v in fields.items():
        if k in allowed and v is not None:
            if k == "is_published":
                v = 1 if v else 0
            sets.append(f"{k} = ?")
            params.append(v)
    sets.append("updated_at = ?")
    params.append(now)
    params.append(highlight_id)

    cursor.execute(f"UPDATE community_highlights SET {', '.join(sets)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM community_highlights WHERE id = ?", (highlight_id,))
    row = cursor.fetchone()
    conn.close()
    sync_to_json()
    if row:
        res = dict(row)
        res["is_published"] = bool(res["is_published"])
        return res
    return None


def delete_highlight(highlight_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM community_highlights WHERE id = ?", (highlight_id,))
    aff = cursor.rowcount
    conn.commit()
    conn.close()
    sync_to_json()
    return aff > 0


# --- EVENTS SQL API ---

def get_events(event_type: str = None, all_items: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT id, title, description, image_url, event_date, event_time, location, organizer, status, category, prize, button_text, display_order, discord_link, is_published, created_at, updated_at FROM events WHERE 1=1"
    if not all_items:
        query += " AND is_published = 1"
    if event_type == "upcoming":
        query += " AND LOWER(status) NOT IN ('past', 'completed')"
    elif event_type == "past":
        query += " AND LOWER(status) IN ('past', 'completed')"

    query += " ORDER BY display_order ASC, event_date ASC, id ASC"
    cursor.execute(query)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for r in rows:
        r["is_published"] = bool(r["is_published"])
    return rows


def add_event(title: str, description: str, image_url: str, event_date: str, event_time: str, location: str = "FiveM Server / Los Santos", organizer: str = "REAPERZ Staff", status: str = "Upcoming", category: str = "Community Event", prize: str = "", button_text: str = "", display_order: int = 0, discord_link: str = "", is_published: bool = True):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO events (title, description, image_url, event_date, event_time, location, organizer, status, category, prize, button_text, display_order, discord_link, is_published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, description, image_url, event_date, event_time, location, organizer, status, category, prize, button_text, display_order, discord_link, 1 if is_published else 0, now, now))
    e_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()
    return {
        "id": e_id,
        "title": title,
        "description": description,
        "image_url": image_url,
        "event_date": event_date,
        "event_time": event_time,
        "location": location,
        "organizer": organizer,
        "status": status,
        "category": category,
        "prize": prize,
        "button_text": button_text,
        "display_order": display_order,
        "discord_link": discord_link,
        "is_published": is_published,
        "created_at": now
    }


def update_event(event_id: int, **fields):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"

    allowed = ["title", "description", "image_url", "event_date", "event_time", "location", "organizer", "status", "category", "prize", "button_text", "display_order", "discord_link", "is_published"]
    sets = []
    params = []
    for k, v in fields.items():
        if k in allowed and v is not None:
            if k == "is_published":
                v = 1 if v else 0
            sets.append(f"{k} = ?")
            params.append(v)
    sets.append("updated_at = ?")
    params.append(now)
    params.append(event_id)

    cursor.execute(f"UPDATE events SET {', '.join(sets)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = cursor.fetchone()
    conn.close()
    sync_to_json()
    if row:
        res = dict(row)
        res["is_published"] = bool(res["is_published"])
        return res
    return None


def delete_event(event_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
    aff = cursor.rowcount
    conn.commit()
    conn.close()
    sync_to_json()
    return aff > 0


# --- GAMING PLATFORMS SQL API ---

def get_gaming_platforms(all_items: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT id, type, name, description, image_url, link, status, display_order, is_published, created_at, updated_at FROM gaming_platforms"
    if not all_items:
        query += " WHERE is_published = 1"
    query += " ORDER BY display_order ASC, id ASC"
    cursor.execute(query)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for r in rows:
        r["is_published"] = bool(r["is_published"])
    return rows


def add_gaming_platform(platform_type: str, name: str, description: str = "", image_url: str = "", link: str = "", status: str = "Active", display_order: int = 0, is_published: bool = True):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO gaming_platforms (type, name, description, image_url, link, status, display_order, is_published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (platform_type.lower(), name, description, image_url, link, status, display_order, 1 if is_published else 0, now, now))
    p_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()
    return {
        "id": p_id,
        "type": platform_type,
        "name": name,
        "description": description,
        "image_url": image_url,
        "link": link,
        "status": status,
        "display_order": display_order,
        "is_published": is_published,
        "created_at": now
    }


def update_gaming_platform(platform_id: int, **fields):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"

    allowed = ["type", "name", "description", "image_url", "link", "status", "display_order", "is_published"]
    sets = []
    params = []
    for k, v in fields.items():
        if k in allowed and v is not None:
            if k == "is_published":
                v = 1 if v else 0
            sets.append(f"{k} = ?")
            params.append(v)
    sets.append("updated_at = ?")
    params.append(now)
    params.append(platform_id)

    cursor.execute(f"UPDATE gaming_platforms SET {', '.join(sets)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM gaming_platforms WHERE id = ?", (platform_id,))
    row = cursor.fetchone()
    conn.close()
    sync_to_json()
    if row:
        res = dict(row)
        res["is_published"] = bool(res["is_published"])
        return res
    return None


def delete_gaming_platform(platform_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM gaming_platforms WHERE id = ?", (platform_id,))
    aff = cursor.rowcount
    conn.commit()
    conn.close()
    sync_to_json()
    return aff > 0


# --- WEBSITE SETTINGS SQL API ---

def get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT setting_key, setting_value FROM website_settings")
    settings = {r["setting_key"]: r["setting_value"] for r in cursor.fetchall()}
    conn.close()
    return settings


def update_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO website_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET
            setting_value = excluded.setting_value,
            updated_at = excluded.updated_at
    """, (key, str(value), now))
    conn.commit()
    conn.close()
    sync_to_json()
    return True



# --- STAFF AUTHENTICATION SQL API ---

def authenticate_staff(identifier: str, password: str):
    """
    Checks staff credentials using parameterized queries and PBKDF2-HMAC-SHA256 verification.
    Identifier is a staff username.
    """
    if not identifier or not password:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, username, name, role, password_hash, salt
        FROM staff
        WHERE LOWER(username) = LOWER(?)
    """, (identifier.strip(),))

    user = cursor.fetchone()

    if not user:
        conn.close()
        return None

    is_valid = verify_password(password, user["salt"], user["password_hash"])

    if is_valid:
        now = datetime.utcnow().isoformat() + "Z"
        cursor.execute("UPDATE staff SET last_login = ? WHERE id = ?", (now, user["id"]))
        conn.commit()
        conn.close()
        return {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"]
        }

    conn.close()
    return None


def change_staff_password(username: str, new_password: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    salt, p_hash = hash_password(new_password)
    cursor.execute("""
        UPDATE staff SET password_hash = ?, salt = ? WHERE LOWER(username) = LOWER(?)
    """, (p_hash, salt, username.strip()))

    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


# --- RATINGS SQL API ---

def get_ratings(category: str = "", stars: int = None):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT id, name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at FROM ratings WHERE 1=1"
    params = []

    if category and category.lower() != "all":
        query += " AND LOWER(category) LIKE ?"
        params.append(f"%{category.lower()}%")

    if stars and stars > 0:
        query += " AND stars = ?"
        params.append(stars)

    query += " ORDER BY id DESC"

    cursor.execute(query, params)
    ratings = [dict(r) for r in cursor.fetchall()]
    for r in ratings:
        r["recommended"] = bool(r["recommended"])

    # Aggregate distribution counts across ALL ratings
    cursor.execute("SELECT stars, COUNT(*) as cnt FROM ratings GROUP BY stars")
    dist_rows = cursor.fetchall()
    distribution = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for row in dist_rows:
        distribution[row["stars"]] = row["cnt"]

    cursor.execute("SELECT COUNT(*) as total, AVG(stars) as avg_score FROM ratings")
    stat_row = cursor.fetchone()
    total_count = stat_row["total"] or 0
    avg_score = round(stat_row["avg_score"], 1) if stat_row["avg_score"] else 5.0

    conn.close()

    return {
        "ratings": ratings,
        "total": total_count,
        "average": avg_score,
        "distribution": distribution
    }


def add_rating(name: str, discord: str, stars: int, category: str, experience: str, title: str, comment: str, recommended: bool = True):
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO ratings (name, discord, stars, category, experience, title, comment, recommended, helpful, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    """, (name, discord, stars, category, experience, title, comment, 1 if recommended else 0, now))

    rating_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()

    return {
        "id": rating_id,
        "name": name,
        "discord": discord,
        "stars": stars,
        "category": category,
        "experience": experience,
        "title": title,
        "comment": comment,
        "recommended": recommended,
        "helpful": 0,
        "submitted_at": now
    }


def upvote_rating(rating_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE ratings SET helpful = helpful + 1 WHERE id = ?", (rating_id,))
    affected = cursor.rowcount
    cursor.execute("SELECT helpful FROM ratings WHERE id = ?", (rating_id,))
    row = cursor.fetchone()
    helpful = row["helpful"] if row else 0

    conn.commit()
    conn.close()
    sync_to_json()

    return helpful if affected > 0 else None


def delete_rating(rating_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ratings WHERE id = ?", (rating_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    sync_to_json()
    return affected > 0


# --- LIBRARY MEDIA SQL API ---

def get_library_media(category: str = "", search: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT id, title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at FROM library WHERE 1=1"
    params = []

    if category and category.lower() != "all":
        query += " AND LOWER(category) = ?"
        params.append(category.lower())

    if search:
        query += " AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term])

    query += " ORDER BY id DESC"

    cursor.execute(query, params)
    media = [dict(r) for r in cursor.fetchall()]

    # Fetch available categories and total counts
    cursor.execute("SELECT DISTINCT category FROM library ORDER BY category ASC")
    categories = [r["category"] for r in cursor.fetchall()]

    cursor.execute("SELECT COUNT(*) as total FROM library")
    total = cursor.fetchone()["total"]

    conn.close()

    return {
        "media": media,
        "total": total,
        "categories": categories
    }


def add_library_media(title: str, category: str, filename: str, file_path: str, file_size: int, mime_type: str, description: str = "", uploaded_by: str = "Staff"):
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO library (title, category, filename, file_path, file_size, mime_type, description, uploaded_by, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, category, filename, file_path, file_size, mime_type, description, uploaded_by, now))

    media_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()

    return {
        "id": media_id,
        "title": title,
        "category": category,
        "filename": filename,
        "file_path": file_path,
        "file_size": file_size,
        "mime_type": mime_type,
        "description": description,
        "uploaded_by": uploaded_by,
        "uploaded_at": now
    }


def delete_library_media(media_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT filename, file_path FROM library WHERE id = ?", (media_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return False

    cursor.execute("DELETE FROM library WHERE id = ?", (media_id,))
    conn.commit()
    conn.close()

    # Safely remove uploaded file from disk if located in uploads directory
    try:
        f_path = Path(BASE_DIR / row["file_path"]).resolve()
        if f_path.is_file() and str(f_path).startswith(str(UPLOADS_DIR)):
            f_path.unlink()
    except Exception as e:
        print(f"[Warn] Could not delete media file: {e}", file=sys.stderr)

    sync_to_json()
    return True


# --- APPLICATIONS & MESSAGES SQL API ---

def get_applications():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, discord, age, game, role, timezone, about, status, submitted_at FROM applications ORDER BY id DESC")
    apps = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return apps


def add_application(name: str, discord: str, age: int, game: str, role: str = "Member", timezone: str = "IST", about: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO applications (name, discord, age, game, role, timezone, about, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    """, (name, discord, age, game, role, timezone, about, now))

    app_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()

    return {"id": app_id, "name": name, "status": "Pending", "submitted_at": now}


def update_application_status(app_id: int, new_status: str, add_to_members: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM applications WHERE id = ?", (app_id,))
    app = cursor.fetchone()

    if not app:
        conn.close()
        return None

    cursor.execute("UPDATE applications SET status = ? WHERE id = ?", (new_status, app_id))

    if new_status == "Approved" and add_to_members:
        # Check if member already exists
        cursor.execute("SELECT id FROM members WHERE LOWER(discord) = LOWER(?)", (app["discord"],))
        existing = cursor.fetchone()
        if not existing:
            now = datetime.utcnow().isoformat() + "Z"
            cursor.execute("""
                INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, joined_at)
                VALUES (?, ?, ?, ?, ?, 'Online', '', ?)
            """, (app["name"], app["role"] or "Member", app["game"], app["discord"], "", now))

    conn.commit()
    cursor.execute("SELECT * FROM applications WHERE id = ?", (app_id,))
    updated_app = dict(cursor.fetchone())
    conn.close()
    sync_to_json()
    return updated_app


def get_messages():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, subject, message, submitted_at FROM messages ORDER BY id DESC")
    msgs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return msgs


def add_message(name: str, email: str, subject: str, message: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO messages (name, email, subject, message, submitted_at)
        VALUES (?, ?, ?, ?, ?)
    """, (name, email, subject, message, now))

    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    sync_to_json()
    return {"id": msg_id, "name": name, "submitted_at": now}


def get_community_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as total FROM members")
    total_members = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM members WHERE LOWER(discord_status) = 'online'")
    online_members = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM applications WHERE status = 'Pending'")
    pending_apps = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM applications")
    total_apps = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM messages")
    total_msgs = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total, AVG(stars) as avg_score FROM ratings")
    r_stat = cursor.fetchone()
    total_ratings = r_stat["total"]
    avg_rating = round(r_stat["avg_score"], 1) if r_stat["avg_score"] else 5.0

    cursor.execute("SELECT COUNT(*) as total FROM library")
    total_media = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM events")
    total_events = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM community_highlights")
    total_highlights = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM gaming_platforms")
    total_platforms = cursor.fetchone()["total"]

    conn.close()

    return {
        "totalMembers": total_members,
        "onlineMembers": online_members,
        "pendingApplications": pending_apps,
        "totalApplications": total_apps,
        "totalMessages": total_msgs,
        "totalRatings": total_ratings,
        "averageRating": avg_rating,
        "totalMedia": total_media,
        "totalEvents": total_events,
        "totalHighlights": total_highlights,
        "totalPlatforms": total_platforms
    }


# Auto-initialize database on module import
init_db()
