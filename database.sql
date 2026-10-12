-- =====================================================================
-- REAPERZ TAMIL GTA 5 ONLINE & FIVEM COMMUNITY - DATABASE SCHEMA
-- =====================================================================

CREATE DATABASE IF NOT EXISTS reaperz 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE reaperz;

-- 1. MEMBERS TABLE
CREATE TABLE IF NOT EXISTS members (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Member',
    game VARCHAR(100) NOT NULL DEFAULT 'GTA V / FiveM',
    discord VARCHAR(100) DEFAULT NULL,
    status ENUM('Online', 'Offline') NOT NULL DEFAULT 'Online',
    avatar VARCHAR(255) DEFAULT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. APPLICATIONS TABLE
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

-- 3. CONTACT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SEED MEMBERS
INSERT INTO members (name, role, game, discord, status) VALUES
('REAPER ARAFATH', 'Founder', 'GTA V / FiveM', 'arafath', 'Online'),
('WOLF', 'Admin', 'FiveM', 'wolf', 'Online'),
('SHADOW', 'Moderator', 'GTA V Online', 'shadow', 'Offline'),
('KING', 'Moderator', 'FiveM', 'king', 'Online'),
('VIKRAM', 'Member', 'GTA V Online', 'vikram', 'Online'),
('SURIYA', 'Member', 'FiveM', 'suriya', 'Online'),
('RAJ', 'Member', 'GTA V Online', 'raj', 'Online'),
('KARTHI', 'Member', 'FiveM', 'karthi', 'Online');
