#!/usr/bin/env python3
"""
====================================================================
  REAPERZ - TAMIL GTA 5 ONLINE & FIVEM COMMUNITY WEB SERVER (PYTHON)
  Zero external dependencies. Runs on pure Python 3.11 standard library.
====================================================================
"""

import http.server
import json
import mimetypes
import os
import sys
import urllib.parse
from datetime import datetime
from pathlib import Path

PORT = int(os.environ.get("PORT", 5000))
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_FILE = DATA_DIR / "db.json"

DEFAULT_SEED = {
    "members": [
        {"id": 1, "name": "REAPER ARAFATH", "role": "Founder", "game": "GTA V / FiveM", "discord": "arafath", "status": "Online", "avatar": "", "joined_at": "2026-01-01T00:00:00Z"},
        {"id": 2, "name": "WOLF", "role": "Admin", "game": "FiveM", "discord": "wolf", "status": "Online", "avatar": "", "joined_at": "2026-01-15T00:00:00Z"},
        {"id": 3, "name": "SHADOW", "role": "Moderator", "game": "GTA V Online", "discord": "shadow", "status": "Offline", "avatar": "", "joined_at": "2026-02-01T00:00:00Z"},
        {"id": 4, "name": "KING", "role": "Moderator", "game": "FiveM", "discord": "king", "status": "Online", "avatar": "", "joined_at": "2026-02-10T00:00:00Z"},
        {"id": 5, "name": "VIKRAM", "role": "Member", "game": "GTA V Online", "discord": "vikram", "status": "Online", "avatar": "", "joined_at": "2026-03-01T00:00:00Z"},
        {"id": 6, "name": "SURIYA", "role": "Member", "game": "FiveM", "discord": "suriya", "status": "Online", "avatar": "", "joined_at": "2026-03-05T00:00:00Z"},
        {"id": 7, "name": "RAJ", "role": "Member", "game": "GTA V Online", "discord": "raj", "status": "Online", "avatar": "", "joined_at": "2026-03-12T00:00:00Z"},
        {"id": 8, "name": "KARTHI", "role": "Member", "game": "FiveM", "discord": "karthi", "status": "Online", "avatar": "", "joined_at": "2026-03-20T00:00:00Z"}
    ],
    "applications": [
        {
            "id": 1,
            "name": "Dinesh Kumar",
            "discord": "dinesh_gta#1234",
            "age": 21,
            "game": "FiveM",
            "role": "Police RP",
            "timezone": "IST (Tamil Nadu)",
            "about": "Experienced in FiveM Tamil servers for 2 years. Looking for a serious and fun roleplay community with REAPERZ.",
            "status": "Pending",
            "submitted_at": "2026-10-12T19:30:00Z"
        }
    ],
    "messages": [
        {
            "id": 1,
            "name": "Pradeep",
            "email": "pradeep@example.com",
            "subject": "FiveM Server Partnership",
            "message": "Vanakkam brother! Love the community vibe. We would love to collaborate for an upcoming Tamil GTA tournament.",
            "submitted_at": "2026-10-12T20:15:00Z"
        }
    ]
}


def load_db():
    if not DB_FILE.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        save_db(DEFAULT_SEED)
        return DEFAULT_SEED.copy()
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[Error] Failed to read db.json: {e}", file=sys.stderr)
        return DEFAULT_SEED.copy()


def save_db(data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[Error] Failed to write db.json: {e}", file=sys.stderr)
        return False


class ReaperzHandler(http.server.BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def parse_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(body)
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API: Stats
        if path == "/api/stats":
            db = load_db()
            members = db.get("members", [])
            apps = db.get("applications", [])
            msgs = db.get("messages", [])
            online = sum(1 for m in members if m.get("status", "").lower() == "online")
            pending = sum(1 for a in apps if a.get("status", "").lower() == "pending")

            return self.send_json(200, {
                "success": True,
                "stats": {
                    "totalMembers": len(members),
                    "onlineMembers": online,
                    "pendingApplications": pending,
                    "totalApplications": len(apps),
                    "totalMessages": len(msgs)
                }
            })

        # API: Members
        if path == "/api/members":
            db = load_db()
            members = db.get("members", [])
            search = query.get("search", [""])[0].lower().strip()
            role = query.get("role", [""])[0].lower().strip()

            if search:
                members = [m for m in members if search in m.get("name", "").lower() or search in m.get("game", "").lower() or search in m.get("discord", "").lower()]
            if role and role != "all":
                members = [m for m in members if role == m.get("role", "").lower()]

            return self.send_json(200, {"success": True, "count": len(members), "members": members})

        # API: Applications
        if path == "/api/applications":
            db = load_db()
            return self.send_json(200, {"success": True, "applications": db.get("applications", [])})

        # API: Messages
        if path == "/api/messages":
            db = load_db()
            return self.send_json(200, {"success": True, "messages": db.get("messages", [])})

        # Static file delivery
        self.serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()
        db = load_db()

        # API: Add member
        if path == "/api/members":
            name = body.get("name", "").strip()
            role = body.get("role", "").strip()
            if not name or not role:
                return self.send_json(400, {"success": False, "message": "Name and role are required."})

            new_member = {
                "id": int(datetime.now().timestamp() * 1000),
                "name": name,
                "role": role,
                "game": body.get("game", "GTA V / FiveM").strip(),
                "discord": body.get("discord", "").strip(),
                "status": "Offline" if body.get("status") == "Offline" else "Online",
                "avatar": body.get("avatar", "").strip(),
                "joined_at": datetime.utcnow().isoformat() + "Z"
            }
            db.setdefault("members", []).insert(0, new_member)
            save_db(db)
            return self.send_json(201, {"success": True, "member": new_member})

        # API: Submit Application
        if path == "/api/applications":
            name = body.get("name", "").strip()
            discord = body.get("discord", "").strip()
            game = body.get("game", "").strip()
            if not name or not discord or not game:
                return self.send_json(422, {"success": False, "message": "Required fields missing."})

            new_app = {
                "id": int(datetime.now().timestamp() * 1000),
                "name": name,
                "discord": discord,
                "age": int(body.get("age", 18)),
                "game": game,
                "role": body.get("role", "Member").strip(),
                "timezone": body.get("timezone", "IST").strip(),
                "about": body.get("about", "").strip(),
                "status": "Pending",
                "submitted_at": datetime.utcnow().isoformat() + "Z"
            }
            db.setdefault("applications", []).insert(0, new_app)
            save_db(db)
            return self.send_json(201, {"success": True, "application_id": new_app["id"], "message": "Application submitted."})

        # API: Submit Message
        if path == "/api/messages":
            name = body.get("name", "").strip()
            email = body.get("email", "").strip()
            message = body.get("message", "").strip()
            if not name or not email or not message:
                return self.send_json(422, {"success": False, "message": "Required fields missing."})

            new_msg = {
                "id": int(datetime.now().timestamp() * 1000),
                "name": name,
                "email": email,
                "subject": body.get("subject", "General Inquiry").strip(),
                "message": message,
                "submitted_at": datetime.utcnow().isoformat() + "Z"
            }
            db.setdefault("messages", []).insert(0, new_msg)
            save_db(db)
            return self.send_json(201, {"success": True, "message": "Message received."})

        # API: Reset Database
        if path == "/api/reset":
            save_db(DEFAULT_SEED)
            return self.send_json(200, {"success": True, "message": "Database reset to default seed."})

        return self.send_json(404, {"success": False, "message": "Endpoint not found."})

    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()
        db = load_db()

        if path.startswith("/api/applications/"):
            try:
                app_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid ID."})

            apps = db.get("applications", [])
            target = next((a for a in apps if a.get("id") == app_id), None)
            if not target:
                return self.send_json(404, {"success": False, "message": "Application not found."})

            status = body.get("status")
            if status:
                target["status"] = status
                if status == "Approved" and body.get("addToMembers"):
                    # Check if already added
                    members = db.setdefault("members", [])
                    if not any(m.get("discord", "").lower() == target.get("discord", "").lower() for m in members):
                        members.append({
                            "id": int(datetime.now().timestamp() * 1000),
                            "name": target.get("name"),
                            "role": target.get("role", "Member"),
                            "game": target.get("game", "GTA V / FiveM"),
                            "discord": target.get("discord", ""),
                            "status": "Online",
                            "avatar": "",
                            "joined_at": datetime.utcnow().isoformat() + "Z"
                        })
                save_db(db)
                return self.send_json(200, {"success": True, "application": target})

        return self.send_json(404, {"success": False, "message": "Endpoint not found."})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        db = load_db()

        if path.startswith("/api/members/"):
            try:
                member_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid member ID."})

            members = db.get("members", [])
            initial_len = len(members)
            db["members"] = [m for m in members if m.get("id") != member_id]
            if len(db["members"]) < initial_len:
                save_db(db)
                return self.send_json(200, {"success": True, "message": "Member removed."})
            return self.send_json(404, {"success": False, "message": "Member not found."})

        return self.send_json(404, {"success": False, "message": "Endpoint not found."})

    def serve_static(self, req_path):
        rel_path = "index.html" if req_path in ["", "/"] else req_path.lstrip("/")
        file_path = (BASE_DIR / rel_path).resolve()

        # Prevent directory traversal
        if not str(file_path).startswith(str(BASE_DIR)):
            self.send_error(403, "Access Forbidden")
            return

        if not file_path.is_file():
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"""
                <!DOCTYPE html><html><body style="background:#05070c;color:#fff;font-family:sans-serif;padding:60px;text-align:center;">
                <h2>404 | File Not Found</h2><p>The requested file does not exist.</p><a href="/" style="color:#00b7ff;">Back to Home</a>
                </body></html>
            """)
            return

        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"
        if mime_type.startswith("text/") or mime_type in ["application/javascript", "application/json"]:
            mime_type += "; charset=utf-8"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} - {args[1]}\n")
        sys.stdout.flush()


def run_server():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    server_address = ("", PORT)
    httpd = http.server.HTTPServer(server_address, ReaperzHandler)
    print("=" * 60)
    print("  [+] REAPERZ COMMUNITY PYTHON SERVER STARTED [+]")
    print(f"  Web Portal:  http://localhost:{PORT}")
    print(f"  Members:     http://localhost:{PORT}/members.html")
    print(f"  Staff Admin: http://localhost:{PORT}/admin.html")
    print(f"  REST API:    http://localhost:{PORT}/api/members")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server Stopped]")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
