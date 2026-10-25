-- =====================================================================
-- REAPERZ TAMIL GTA 5 ONLINE & FIVEM COMMUNITY - DATABASE SCHEMA (SQL)
-- Compatible with MySQL 8+, MariaDB, and SQLite
-- =====================================================================

CREATE DATABASE IF NOT EXISTS reaperz 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE reaperz;

-- 1. MEMBERS TABLE (With Discord Presence & Statuses)
CREATE TABLE IF NOT EXISTS members (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Member',
    game VARCHAR(100) NOT NULL DEFAULT 'GTA V / FiveM',
    discord VARCHAR(100) DEFAULT NULL,
    discord_id VARCHAR(32) DEFAULT NULL,
    discord_status ENUM('Online', 'Idle', 'Do Not Disturb', 'Offline') NOT NULL DEFAULT 'Offline',
    avatar VARCHAR(255) DEFAULT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Community',
    details TEXT DEFAULT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. STAFF TABLE (Password Hashing with Salt)
CREATE TABLE IF NOT EXISTS staff (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    role ENUM('Founder', 'Admin') NOT NULL DEFAULT 'Admin',
    password_hash VARCHAR(128) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. APPLICATIONS TABLE (Join Us Submissions)
CREATE TABLE IF NOT EXISTS applications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    discord VARCHAR(100) NOT NULL,
    age TINYINT UNSIGNED NOT NULL,
    game VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Member',
    timezone VARCHAR(100) DEFAULT 'IST',
    about TEXT DEFAULT NULL,
    status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CONTACT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. RATINGS & REVIEWS TABLE
CREATE TABLE IF NOT EXISTS ratings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    discord VARCHAR(100) NOT NULL,
    stars TINYINT UNSIGNED NOT NULL CHECK (stars >= 1 AND stars <= 5),
    category VARCHAR(100) NOT NULL DEFAULT 'FiveM Roleplay',
    experience VARCHAR(50) DEFAULT 'Member',
    title VARCHAR(200) NOT NULL,
    comment TEXT NOT NULL,
    recommended BOOLEAN NOT NULL DEFAULT 1,
    helpful INT UNSIGNED NOT NULL DEFAULT 0,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. MEDIA LIBRARY TABLE (Dynamic Uploads)
CREATE TABLE IF NOT EXISTS library (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size INT UNSIGNED DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'image/jpeg',
    description TEXT DEFAULT NULL,
    uploaded_by VARCHAR(100) DEFAULT 'Staff',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. COMMUNITY HIGHLIGHTS TABLE
CREATE TABLE IF NOT EXISTS community_highlights (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    event_date VARCHAR(50) DEFAULT '',
    display_order INT DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    event_date VARCHAR(50) NOT NULL,
    event_time VARCHAR(50) NOT NULL,
    location VARCHAR(150) DEFAULT 'FiveM Server / Los Santos',
    organizer VARCHAR(100) DEFAULT 'REAPERZ Staff',
    status VARCHAR(50) DEFAULT 'Upcoming',
    category VARCHAR(100) DEFAULT 'Community Event',
    prize VARCHAR(150) DEFAULT '',
    button_text VARCHAR(40) DEFAULT '',
    display_order INT DEFAULT 0,
    discord_link VARCHAR(255) DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. GAMING PLATFORMS TABLE (GTA V Online Crew & FiveM Servers)
CREATE TABLE IF NOT EXISTS gaming_platforms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'gta_online', 'fivem'
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    image_url VARCHAR(255) DEFAULT NULL,
    link VARCHAR(255) DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    display_order INT DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_metadata (
    meta_key VARCHAR(100) PRIMARY KEY,
    meta_value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. WEBSITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS website_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SEED MEMBERS (With Realistic Discord IDs and Statuses)
INSERT INTO members (name, role, game, discord, discord_id, discord_status, avatar, department, details) VALUES
('Dark', 'Founder', 'GTA V / FiveM', 'rpz_dark', '937289791429562398', 'Online', 'https://cdn.discordapp.com/avatars/937289791429562398/9970cd81f120a25115493cc9ed04a777.png?size=4096&ignore=true', 'Command', 'Community Founder & Head of Operations'),
('Beast Boy', 'Developer', 'GTA V / FiveM', 'beastboy', '912345678901234568', 'Online', '', 'Development', 'Lead Website & Systems Developer'),
('REAPER ARAFATH', 'Founder', 'GTA V / FiveM', 'arafath', '912345678901234560', 'Online', '', 'Command', 'Co-Founder'),
('WOLF', 'Admin', 'FiveM', 'wolf', '912345678901234561', 'Online', '', 'Operations', 'Head Administrator'),
('SHADOW', 'Moderator', 'GTA V Online', 'shadow', '912345678901234562', 'Idle', '', 'Roleplay', 'RP Division Lead'),
('KING', 'Moderator', 'FiveM', 'king', '912345678901234563', 'Do Not Disturb', '', 'Events', 'Events Coordinator'),
('VIKRAM', 'Member', 'GTA V Online', 'vikram', '912345678901234564', 'Online', '', 'Heists', 'Tactical Heist Squad'),
('SURIYA', 'Member', 'FiveM', 'suriya', '912345678901234565', 'Online', '', 'Roleplay', 'Senior Roleplayer'),
('RAJ', 'Member', 'GTA V Online', 'raj', '912345678901234566', 'Offline', '', 'Community', 'Crew Member'),
('KARTHI', 'Member', 'FiveM', 'karthi', '912345678901234567', 'Online', '', 'Community', 'Crew Member');

-- SEED COMMUNITY HIGHLIGHTS
INSERT INTO community_highlights (title, description, image_url, event_date, display_order, is_published) VALUES
('NURP Community Mega Roleplay', 'REAPERZ Police & EMS division staging tactical patrol convoy across Sandy Shores.', 'assets/images/gallery-1.jpg', '2026-10-01', 1, 1),
('Los Santos Midnight Squad Run', 'High-speed night cruise and freeway formation through downtown Los Santos.', 'assets/images/gallery-2.jpg', '2026-10-02', 2, 1),
('Tamil Car Enthusiasts Meetup', 'Clean JDM tuners and widebody hypercars on display at Del Perro pier car show.', 'assets/images/gallery-3.jpg', '2026-10-03', 3, 1),
('City Roleplay Action & Briefing', 'Subway station operation and city roleplay patrol debriefing session.', 'assets/images/gallery-4.jpg', '2026-10-04', 4, 1),
('Highway Convoy & Fleet Drive', 'Blaine County highway formation convoy heading towards Mount Chiliad.', 'assets/images/gallery-5.jpg', '2026-10-05', 5, 1),
('Squad Briefing & Heist Setup', 'Pre-heist tactical briefing and weapons layout prior to Casino vault breach.', 'assets/images/gallery-6.jpg', '2026-10-06', 6, 1);

-- SEED EVENTS
INSERT INTO events (title, description, image_url, event_date, event_time, location, organizer, status, discord_link, is_published) VALUES
('NURP Community Mega Roleplay Event', 'Massive city-wide joint operation with police pursuits, gang territory showdowns, and emergency EMS responses on NURP RP server.', 'assets/images/gallery-1.jpg', '2026-10-20', '8:00 PM IST', 'NURP Roleplay Server', 'Dark & REAPERZ Staff', 'Upcoming', 'https://discord.gg/reaperz-tamil', 1),
('Los Santos Midnight Tuner Grand Prix', 'High-octane street racing tournament through the tunnels and highways of Los Santos. Cash prizes and custom Discord titles for winners!', 'assets/images/gallery-3.jpg', '2026-10-25', '9:00 PM IST', 'GTA V Online Private Lobby', 'KING', 'Upcoming', 'https://discord.gg/reaperz-tamil', 1),
('Doomsday Heist Criminal Mastermind Run', 'Elite crew operation completing all acts of the Doomsday Heist with zero deaths and elite challenge times.', 'assets/images/gallery-6.jpg', '2026-10-05', '7:30 PM IST', 'GTA V Online Facility', 'VIKRAM & WOLF', 'Past', 'https://discord.gg/reaperz-tamil', 1),
('Sandy Shores Tactical Convoy', 'Cross-county convoy and fleet parade featuring 25+ crew members cruising through Blaine County.', 'assets/images/gallery-5.jpg', '2026-09-28', '8:00 PM IST', 'FiveM Roleplay Server', 'SHADOW', 'Past', 'https://discord.gg/reaperz-tamil', 1);

-- SEED GAMING PLATFORMS
INSERT INTO gaming_platforms (type, name, description, image_url, link, status, display_order, is_published) VALUES
('gta_online', 'TN REAPERZ', 'Official Rockstar Social Club Crew for GTA Online', 'assets/images/gallery-2.jpg', 'https://socialclub.rockstargames.com', 'Active', 1, 1),
('fivem', 'NURP RP', 'Tamil Roleplay FiveM Server — Primary Server for REAPERZ', 'assets/images/gallery-4.jpg', 'fivem://connect/cfx.re/join/nurp', 'Active', 1, 1);

INSERT INTO app_metadata (meta_key, meta_value) VALUES
('gaming_platforms_seeded', '1');

-- SEED WEBSITE SETTINGS
INSERT INTO website_settings (setting_key, setting_value) VALUES
('discord_invite', 'https://discord.gg/reaperz-tamil');

-- SEED RATINGS
INSERT INTO ratings (name, discord, stars, category, experience, title, comment, recommended, helpful) VALUES
('Arun Kumar', 'arun_chennai#1001', 5, 'FiveM Roleplay', '6+ Months', 'Top-tier FiveM Tamil Roleplay!', 'Joined REAPERZ 4 months ago for FiveM police and EMS RP. The community is well-organized, friendly, and non-toxic. Voice calls in Tamil make gaming feel like family!', 1, 18),
('Siva Nathan', 'siva_kl#7723', 5, 'GTA 5 Online', '3-6 Months', 'Best Crew for Heists and Money Grinding', 'Cayo Perico, Casino, and Doomsday heists with REAPER ARAFATH and the squad are super smooth. No griefers, pure coordination and maximum payouts.', 1, 14),
('Vignesh V', 'vicky_racer#4412', 5, 'Car Meets & Racing', '1-3 Months', 'Los Santos Tamil Car Meets are Pure Fire!', 'The weekly car shows, mountain drift runs, and highway convoys are insanely fun. Great custom builds, respectful members, and high adrenaline.', 1, 11),
('Mohamed Irfan', 'irfan_reaper#3321', 5, 'Community & Atmosphere', '6+ Months', 'Zero Toxicity & True Tamil Brotherhood', 'Whether you are a beginner or a veteran player, everyone treats you with respect. Staff members SHADOW and WOLF are always helpful on voice calls.', 1, 9),
('Praveen Raj', 'praveen_gta#5589', 4, 'FiveM Roleplay', 'New Recruit', 'Solid Community with Active Leadership', 'Very active Discord, clear community rules, and regular server events. The admins guided me through setting up FiveM mods quickly.', 1, 7);

-- SEED LIBRARY MEDIA
INSERT INTO library (title, category, filename, file_path, file_size, mime_type, description, uploaded_by) VALUES
('FiveM Patrol & Convoy Meet', 'FiveM RP', 'gallery-1.jpg', 'assets/images/gallery-1.jpg', 283047, 'image/jpeg', 'REAPERZ Police & EMS division staging tactical patrol convoy across Sandy Shores.', 'REAPER ARAFATH'),
('Los Santos Midnight Squad Run', 'GTA 5 Online', 'gallery-2.jpg', 'assets/images/gallery-2.jpg', 284219, 'image/jpeg', 'High-speed night cruise and freeway formation through downtown Los Santos.', 'WOLF'),
('Tamil Car Enthusiasts Meetup', 'Car Meets', 'gallery-3.jpg', 'assets/images/gallery-3.jpg', 284872, 'image/jpeg', 'Clean JDM tuners and widebody hypercars on display at Del Perro pier car show.', 'KING'),
('City Roleplay Action & Briefing', 'FiveM RP', 'gallery-4.jpg', 'assets/images/gallery-4.jpg', 298721, 'image/jpeg', 'Subway station operation and city roleplay patrol debriefing session.', 'SHADOW'),
('Highway Convoy & Fleet Drive', 'Crew Convoys', 'gallery-5.jpg', 'assets/images/gallery-5.jpg', 316724, 'image/jpeg', 'Blaine County highway formation convoy heading towards Mount Chiliad.', 'VIKRAM'),
('Squad Briefing & Heist Setup', 'Heist Operations', 'gallery-6.jpg', 'assets/images/gallery-6.jpg', 348681, 'image/jpeg', 'Pre-heist tactical briefing and weapons layout prior to Casino vault breach.', 'REAPER ARAFATH');
