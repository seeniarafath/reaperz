# 🔥 REAPERZ — Tamil GTA 5 Online & FiveM Community Portal

Welcome to the official **REAPERZ** Tamil gaming portal, founded by **Dark**. The project is powered by a zero-external-dependency backend supporting **Node.js 22+ / 24+** (with built-in `node:sqlite`) and **Python 3.11** with SQLite and PBKDF2 authentication!

---

## 🚀 How to Run the Website

### Option 1: One-Click Launcher (Recommended for Windows)
Simply double-click:
```
start-server.bat
```
It will automatically detect Node.js or Python, start the server on **`http://localhost:5000`**, and open your default web browser!

### Option 2: Command Line with Node.js
When initializing a new, empty database, set unique credentials for both staff accounts before starting the server. Existing staff accounts are not overwritten.
```powershell
$env:STAFF_FOUNDER_PASS = "choose-a-unique-founder-password"
$env:STAFF_ADMIN_PASS = "choose-a-unique-admin-password"
node server.js
```
Then visit:
* **Home Page**: [http://localhost:5000](http://localhost:5000)
* **About Us**: [http://localhost:5000/about.html](http://localhost:5000/about.html)
* **Media Library**: [http://localhost:5000/library.html](http://localhost:5000/library.html)
* **Members Roster**: [http://localhost:5000/members.html](http://localhost:5000/members.html)
* **Join Application**: [http://localhost:5000/join.html](http://localhost:5000/join.html)
* **Community Rules**: [http://localhost:5000/rules.html](http://localhost:5000/rules.html)
* **Rate Us / Reviews**: [http://localhost:5000/rate.html](http://localhost:5000/rate.html)
* **Contact Headquarters**: [http://localhost:5000/contact.html](http://localhost:5000/contact.html)
* **Staff Admin Portal**: [http://localhost:5000/admin.html](http://localhost:5000/admin.html)

### Option 3: Command Line with Python
Use the same `STAFF_FOUNDER_PASS` and `STAFF_ADMIN_PASS` environment variables when first initializing an empty database.
```powershell
$env:STAFF_FOUNDER_PASS = "choose-a-unique-founder-password"
$env:STAFF_ADMIN_PASS = "choose-a-unique-admin-password"
python app.py
```

### Option 4: VS Code Live Server
Right-click `index.html` and choose **"Open with Live Server"** for static preview only. Database-backed management and dynamic content require the Node.js or Python server; managed records are not stored in browser LocalStorage.

---

## 👑 Key Features & Fixes

* **Rate Us Page**:
  - Compact responsive feedback form with name, Discord username, star rating, and review validation.
  - Submissions are permanently stored in the SQL database (`ratings` table).
  - Inline confirmation displayed after a successful submission.
  - Real-time rating recalculation: overall community score, total review count, and 5-star distribution progress bars update dynamically without page reload.
  - Helpful upvote button with live increment.

* **Secure Password-Protected Staff Management Portal (`admin.html`)**:
  - Protected by PBKDF2-HMAC-SHA256 salted password hashing (zero plain-text passwords stored).
  - Passwords are strictly verified on the backend with constant-time comparison — no passwords exposed in frontend HTML or JavaScript files.
  - Username-based login uses an HttpOnly, SameSite session cookie; cookies are marked Secure when served over HTTPS.
  - Staff sessions expire and management APIs reject unauthenticated requests.
  - Staff capabilities:
    - **Members Management**: Add new members with Discord ID, Discord Status, Game, and Role. Promote/demote members with role dropdown (Founder, Admin, Moderator, Member). Remove members.
    - **Media Library & Uploads**: Upload new images with title, category, and description. View and delete uploaded captures with file unlinking from disk.
    - **Join Applications**: Review candidates and approve with 1-click automatic addition to the community roster.
    - **Review Moderation**: View all community reviews and delete spam/inappropriate entries.
    - **System Settings**: Securely change staff password after verifying the current password (8-character minimum).

* **Media Library Page (`library.html`)**:
  - Responsive card gallery with consistent image frames and a modal preview.
  - Displays uploaded captures dynamically from the SQLite database (`library` table).
  - Division filter pills: All Media, FiveM RP, GTA 5 Online, Car Meets, Heist Operations, Crew Convoys.
  - Real-time search by title, description, or division.
  - Uploaded content continues to load from the database and scales inside its card.

* **Discord Online Status & Avatars (`members.html`)**:
  - Displays all 4 Discord statuses: **Online 🟢, Idle 🟡, Do Not Disturb 🔴, and Offline ⚫**.
  - Live Discord presence integration via Lanyard API and Discord CDN avatars.
  - Fallback to Discord embed avatars and stylized initials.
  - Filter by Role and Discord Status directly in the toolbar.
  - Connected directly to SQLite SQL database (`members` table).

* **Gaming Platforms (`index.html` and `admin.html`)**:
  - The Home page displays the published GTA V Online crew and FiveM servers from the `gaming_platforms` database table.
  - Authorized staff can add, edit, hide/show, reorder, and delete entries in the Gaming Platforms tab.
  - Platform records are never managed through browser localStorage; a one-time database seed provides the default `TN REAPERZ` crew and `NURP RP` server.

* **Home Highlights and Events Management**:
  - Founder/Admin staff can create, edit, publish/hide, and delete database-backed highlights and events from the Staff Portal.
  - Event records include category, date/time, prize, action label, status, and display order; event images render as cropped 16:9 thumbnails with active/completed filters.
  - Image uploads are validated and saved on the server; Home and Events pages load published records from the API.
  - The Discord invite displayed on Home is loaded from the database and can be changed in Staff Portal settings.

* **Member Roster Management**:
  - Staff can search/filter the roster and edit member details, Discord information, department, status, and join date.

* **Security & Database Integrity**:
  - Prepared statements and parameterized queries for 100% of SQL operations (`?` placeholders).
  - Whitelisted file upload extensions (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`) with 10MB limit.
  - Secure random filenames to prevent path traversal.

---

## 📁 Project Structure

```
REAPERZ/
├── server.js              # Node.js HTTP & REST API server (SQLite & PBKDF2)
├── app.py                 # Python 3.11 HTTP and REST API server
├── db.py                  # Python SQLite database & authentication manager
├── start-server.bat       # Auto-detecting 1-click Windows server launcher
├── database.sql           # MySQL & SQLite schema definitions
├── data/
│   ├── reaperz.db         # SQLite database file
│   └── db.json            # JSON backup & fallback
├── assets/
│   └── images/            # FiveM and GTA 5 screenshots & hero assets
│       └── uploads/       # Uploaded library images (managed by staff)
├── css/
│   ├── style.css          # Core cyberpunk dark neon theme & Discord status styles
│   └── admin.css          # Staff dashboard, dropzone, and modal styles
├── js/
│   ├── store.js           # Client store with SQLite REST API & LocalStorage auto-detection
│   ├── main.js            # UI navigation and toast notifications
│   ├── members.js         # Dynamic member cards renderer with live Discord statuses
│   ├── forms.js           # Form handlers for applications and contact
│   ├── ratings.js         # Rate Us controller, star picker, validation & live feed
│   ├── library.js         # Media library controller, search & lightbox
│   └── admin.js           # Staff portal controller, upload dropzone & moderation
├── index.html             # Homepage
├── about.html             # About Us lore, divisions & leadership
├── library.html           # Media library vault
├── members.html           # Crew roster with Discord presence
├── join.html              # Join application form
├── contact.html           # Contact headquarters
├── rules.html             # Community rules
└── admin.html             # Staff Command Portal
```
