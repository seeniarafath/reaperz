# 🔥 REAPERZ — Tamil GTA 5 Online & FiveM Community Portal (Python Edition)

Welcome to the official **REAPERZ** Tamil gaming portal, founded by **REAPER ARAFATH**. The project is now powered by **Python 3.11** with zero external dependencies!

---

## 🚀 How to Run with Python

### Option 1: One-Click Launcher (Recommended)
Simply double-click:
```
start-server.bat
```
It will automatically start the Python server on **`http://localhost:5000`** and open your browser!

### Option 2: Command Line (PowerShell / Command Prompt)
Open PowerShell or CMD in this directory and run:
```bash
python app.py
```
Then visit:
* **Home Page**: [http://localhost:5000](http://localhost:5000)
* **Members Roster**: [http://localhost:5000/members.html](http://localhost:5000/members.html)
* **Staff Admin Portal**: [http://localhost:5000/admin.html](http://localhost:5000/admin.html)
* **Join Application**: [http://localhost:5000/join.html](http://localhost:5000/join.html)

### Option 3: VS Code Live Server
Right-click `index.html` and choose **"Open with Live Server"**. The client data store (`js/store.js`) will seamlessly run in offline mode using your browser's LocalStorage.

---

## 👑 What's Included

* **Python Web & REST API Server (`app.py`)**:
  - Pure Python 3.11 standard library (`http.server`, `urllib.parse`, `json`).
  - No `pip install` required!
  - REST endpoints:
    - `GET /api/members` (with search and role filters)
    - `POST /api/members` (add member)
    - `DELETE /api/members/<id>` (remove member)
    - `GET /api/applications`
    - `POST /api/applications` (join submission)
    - `PATCH /api/applications/<id>` (approve/reject with 1-click auto-add to members roster)
    - `GET /api/messages`
    - `POST /api/messages`
    - `GET /api/stats`
    - `POST /api/reset`
* **Staff Control Center (`admin.html`)**:
  - Live statistics: Total Members, Online Gamers, Pending Applications, Messages.
  - Review candidate applications and approve them with one click.
  - Add, manage, and delete crew members.
* **Members Roster (`members.html`)**:
  - Live search and filter by role (Founder, Admin, Moderator, Member).
  - Online/Offline status indicators and initials avatar generator.
* **Join Us Application (`join.html`)**:
  - Complete form for FiveM / GTA 5 players to submit their gaming credentials and RP roles.
* **Community Highlights Gallery (`index.html`)**:
  - In-game GTA 5 & FiveM screenshots showcasing community convoys, car meets, and RP patrol sessions.
* **Community Rules (`rules.html`)**:
  - 6 core rules ensuring mutual respect and quality RP.
* **Contact Headquarters (`contact.html`)**:
  - Direct Discord and support channels.

---

## 📁 Project Structure

```
D:\Reaperz\REAPERZ_GTA5_FiveM_Tamil_Website\
├── app.py                 # Python 3.11 HTTP and REST API web server
├── start-server.bat       # Windows 1-click launcher
├── database.sql           # MySQL database schema (optional)
├── data\
│   └── db.json            # JSON database for members, applications, messages
├── assets\images\         # FiveM and GTA 5 gameplay screenshots
│   ├── hero-bg.jpg
│   └── gallery-1.jpg to gallery-6.jpg
├── css\
│   ├── style.css          # Cyberpunk/GTA dark neon theme
│   └── admin.css          # Staff dashboard styles
├── js\
│   ├── store.js           # Client store with Python API & LocalStorage auto-detection
│   ├── main.js            # UI navigation and toast notifications
│   ├── members.js         # Dynamic member cards renderer
│   ├── forms.js           # Form handlers for applications and contact
│   └── admin.js           # Admin controller
├── index.html             # Homepage & gallery
├── members.html           # Members directory
├── join.html              # Join application form
├── contact.html           # Contact headquarters
├── rules.html             # Community rules
└── admin.html             # Staff Command Portal
```
