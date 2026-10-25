#!/usr/bin/env python3
"""
====================================================================
  REAPERZ - TAMIL GTA 5 ONLINE & FIVEM COMMUNITY WEB SERVER (PYTHON)
  Zero external dependencies. Powered by Python 3 standard library.
  Features SQLite SQL database, PBKDF2 staff auth, dynamic media library,
  reliable reviews system, and live Discord status integration.
====================================================================
"""

import base64
import http.server
import json
import mimetypes
import os
import re
import secrets
import sys
import time
from http.cookies import SimpleCookie
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

import db

PORT = int(os.environ.get("PORT", 5000))
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "assets" / "images" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory active staff sessions: { token: { "id": int, "username": str, "role": str, "name": str, "expires": float } }
ACTIVE_SESSIONS = {}

# In-memory Discord presence cache: { user_id: { "status": str, "avatar": str, "cached_at": float } }
DISCORD_PRESENCE_CACHE = {}
CACHE_TTL = 45.0  # seconds


def get_token_from_headers(headers):
    """Extracts session token from Authorization: Bearer <token> or X-Staff-Token."""
    cookies = SimpleCookie()
    try:
        cookies.load(headers.get("Cookie", ""))
    except Exception:
        return ""
    if "reaperz_staff_session" in cookies:
        return cookies["reaperz_staff_session"].value
    auth_header = headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return headers.get("X-Staff-Token", "").strip()


def verify_staff_session(headers):
    """Verifies that the request has a valid, unexpired staff session token."""
    token = get_token_from_headers(headers)
    if not token or token not in ACTIVE_SESSIONS:
        return None
    session = ACTIVE_SESSIONS[token]
    if time.time() > session["expires"]:
        del ACTIVE_SESSIONS[token]
        return None
    if session.get("role", "").lower() not in ("founder", "admin"):
        return None
    # Renew token expiry by 2 hours on activity
    session["expires"] = time.time() + 7200
    return session


class ReaperzHandler(http.server.BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Staff-Token")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data, extra_headers=None):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_cors_headers()
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(payload)

    def parse_body(self):
        """Safely parses JSON or URL-encoded request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            return {}

        raw = self.rfile.read(content_length).decode("utf-8", errors="replace")
        content_type = self.headers.get("Content-Type", "")

        if "application/json" in content_type:
            try:
                return json.loads(raw)
            except Exception:
                pass

        # Also support form-urlencoded
        try:
            parsed_qs = urllib.parse.parse_qs(raw)
            return {k: v[0] if len(v) == 1 else v for k, v in parsed_qs.items()}
        except Exception:
            return {}

    # =========================================================================
    # GET REQUEST HANDLERS
    # =========================================================================

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: Community Stats
        if path == "/api/stats":
            stats = db.get_community_stats()
            return self.send_json(200, {"success": True, "stats": stats})

        # 2. API: Members List (SQL Database)
        if path == "/api/members":
            search = query.get("search", [""])[0].strip()
            role = query.get("role", [""])[0].strip()
            department = query.get("department", [""])[0].strip()
            status = query.get("status", [""])[0].strip()
            members = db.get_members(search=search, role=role, department=department, status=status)
            return self.send_json(200, {"success": True, "count": len(members), "members": members})

        # Single Member by ID
        if path.startswith("/api/members/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                try:
                    member_id = int(parts[2])
                    member = db.get_member(member_id)
                    if not member:
                        return self.send_json(404, {"success": False, "message": "Member not found."})
                    return self.send_json(200, {"success": True, "member": member})
                except ValueError:
                    return self.send_json(400, {"success": False, "message": "Invalid member ID."})

        # Community Highlights API
        if path == "/api/highlights":
            all_items = query.get("all", ["0"])[0] == "1"
            if all_items and not verify_staff_session(self.headers):
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})
            highlights = db.get_highlights(all_items=all_items)
            return self.send_json(200, {"success": True, "count": len(highlights), "highlights": highlights})

        # Events API
        if path == "/api/events":
            all_items = query.get("all", ["0"])[0] == "1"
            if all_items and not verify_staff_session(self.headers):
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})
            event_type = query.get("type", [""])[0].strip().lower()
            events = db.get_events(all_items=all_items, event_type=event_type)
            return self.send_json(200, {"success": True, "count": len(events), "events": events})

        # Gaming Platforms API (GTA V Online Crew & FiveM Servers)
        if path == "/api/gaming-platforms":
            all_items = query.get("all", ["0"])[0] == "1"
            if all_items and not verify_staff_session(self.headers):
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})
            platforms = db.get_gaming_platforms(all_items=all_items)
            return self.send_json(200, {"success": True, "count": len(platforms), "platforms": platforms})

        # Website Settings API
        if path == "/api/settings":
            settings = db.get_settings()
            return self.send_json(200, {"success": True, "settings": settings})

        # 3. API: Ratings & Reviews
        if path == "/api/ratings":
            category = query.get("category", [""])[0].strip()
            stars_param = query.get("stars", [""])[0].strip()
            stars = int(stars_param) if stars_param.isdigit() else None
            data = db.get_ratings(category=category, stars=stars)
            return self.send_json(200, {
                "success": True,
                "total": data["total"],
                "average": data["average"],
                "distribution": data["distribution"],
                "ratings": data["ratings"]
            })

        # 4. API: Media Library
        if path == "/api/library":
            category = query.get("category", [""])[0].strip()
            search = query.get("search", [""])[0].strip()
            media_data = db.get_library_media(category=category, search=search)
            return self.send_json(200, {
                "success": True,
                "total": media_data["total"],
                "categories": media_data["categories"],
                "media": media_data["media"]
            })

        # 5. API: Discord Online Presence Integration
        if path == "/api/discord/presence":
            user_id = query.get("user_id", [""])[0].strip()
            member_id_param = query.get("member_id", [""])[0].strip()
            member_id = int(member_id_param) if member_id_param.isdigit() else None

            result = self.fetch_discord_presence(user_id, member_id)
            return self.send_json(200, result)

        # 6. API: Applications
        if path == "/api/applications":
            apps = db.get_applications()
            return self.send_json(200, {"success": True, "applications": apps})

        # 7. API: Messages
        if path == "/api/messages":
            msgs = db.get_messages()
            return self.send_json(200, {"success": True, "messages": msgs})

        # 8. API: Staff Session Verification
        if path == "/api/auth/verify":
            session = verify_staff_session(self.headers)
            if session:
                return self.send_json(200, {
                    "success": True,
                    "user": {
                        "username": session["username"],
                        "name": session["name"],
                        "role": session["role"]
                    }
                })
            return self.send_json(401, {"success": False, "message": "Session expired or invalid. Please login."})

        # Static file delivery
        self.serve_static(path)

    # =========================================================================
    # POST REQUEST HANDLERS
    # =========================================================================

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # 1. API: Staff Login (Secure Password Hashing)
        if path == "/api/auth/login":
            username = body.get("username", "")
            password = body.get("password", "")

            if not str(username).strip() or not password:
                return self.send_json(400, {"success": False, "message": "Username and password are required."})

            user = db.authenticate_staff(str(username).strip(), str(password))
            if not user:
                return self.send_json(401, {"success": False, "message": "Invalid staff credentials. Access denied."})

            token = secrets.token_hex(32)
            ACTIVE_SESSIONS[token] = {
                "id": user["id"],
                "username": user["username"],
                "role": user["role"],
                "name": user["name"],
                "expires": time.time() + 86400  # 24 hours
            }

            secure_cookie = "; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""
            return self.send_json(200, {
                "success": True,
                "user": user,
                "message": f"Welcome back, {user['name']}!"
            }, {
                "Set-Cookie": f"reaperz_staff_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400{secure_cookie}"
            })

        # 2. API: Staff Logout
        if path == "/api/auth/logout":
            token = get_token_from_headers(self.headers)
            if token in ACTIVE_SESSIONS:
                del ACTIVE_SESSIONS[token]
            secure_cookie = "; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""
            return self.send_json(200, {"success": True, "message": "Successfully logged out."}, {
                "Set-Cookie": f"reaperz_staff_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0{secure_cookie}"
            })

        # 3. API: Staff Change Password
        if path == "/api/auth/change-password":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})

            current_pass = body.get("current_password", "").strip()
            new_pass = body.get("new_password", "")

            if not current_pass or not new_pass:
                return self.send_json(400, {"success": False, "message": "Current and new passwords required."})

            if len(new_pass) < 8:
                return self.send_json(422, {"success": False, "message": "New password must be at least 8 characters."})

            # Verify current password first
            verify_user = db.authenticate_staff(session["username"], current_pass)
            if not verify_user:
                return self.send_json(403, {"success": False, "message": "Incorrect current password."})

            db.change_staff_password(session["username"], new_pass)
            return self.send_json(200, {"success": True, "message": "Password changed successfully."})

        # 4. API: Submit Rating / Review (Rate Us Page Fix)
        if path == "/api/ratings":
            name = (body.get("name") or "").strip()
            discord = (body.get("discord") or "").strip()
            comment = (body.get("comment") or "").strip()
            title = (body.get("title") or "Community Rating").strip()
            category = (body.get("category") or "FiveM Roleplay").strip()
            experience = (body.get("experience") or "Member").strip()
            rec_val = body.get("recommended")
            recommended = bool(rec_val is True or rec_val == "true" or rec_val == "on" or rec_val == 1)

            # Validation
            if not name:
                return self.send_json(422, {"success": False, "message": "Please enter your Name or Gamertag."})
            if not discord:
                return self.send_json(422, {"success": False, "message": "Please enter your Discord username."})
            if not comment:
                return self.send_json(422, {"success": False, "message": "Please write a review comment."})

            try:
                stars = int(body.get("stars", 5))
                if stars < 1 or stars > 5:
                    stars = 5
            except (ValueError, TypeError):
                stars = 5

            new_rating = db.add_rating(
                name=name,
                discord=discord,
                stars=stars,
                category=category,
                experience=experience,
                title=title,
                comment=comment,
                recommended=recommended
            )

            return self.send_json(201, {
                "success": True,
                "rating": new_rating,
                "message": "✓ Thank you! Your rating has been recorded successfully in the REAPERZ database."
            })

        # 5. API: Helpful Upvote on Rating
        if path.startswith("/api/ratings/") and path.endswith("/helpful"):
            try:
                parts = path.strip("/").split("/")
                rating_id = int(parts[2])
            except (IndexError, ValueError):
                return self.send_json(400, {"success": False, "message": "Invalid rating ID."})

            helpful = db.upvote_rating(rating_id)
            if helpful is None:
                return self.send_json(404, {"success": False, "message": "Rating not found."})
            return self.send_json(200, {"success": True, "helpful": helpful})

        # 6. API: Upload Image to Media Library (Staff Portal)
        if path == "/api/library/upload":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff authentication required to upload images."})

            title = (body.get("title") or "").strip()
            category = (body.get("category") or "General").strip()
            description = (body.get("description") or "").strip()
            file_data = body.get("file_data") or body.get("image_base64")
            filename = (body.get("filename") or "upload.jpg").strip()

            if not title:
                return self.send_json(422, {"success": False, "message": "Media title is required."})
            if not file_data:
                return self.send_json(422, {"success": False, "message": "No image data provided for upload."})

            # Validate extension
            ext = os.path.splitext(filename)[1].lower()
            ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
            if ext not in ALLOWED_EXTENSIONS:
                return self.send_json(422, {"success": False, "message": f"Unsupported file type '{ext}'. Allowed: JPG, PNG, WEBP, GIF."})

            # Decode Base64 data (support data URLs e.g. 'data:image/png;base64,...')
            if "," in file_data:
                file_data = file_data.split(",", 1)[1]

            try:
                image_bytes = base64.b64decode(file_data)
            except Exception as e:
                return self.send_json(400, {"success": False, "message": f"Corrupted Base64 image data: {e}"})

            # Check size limit (max 10MB)
            if len(image_bytes) > 10 * 1024 * 1024:
                return self.send_json(413, {"success": False, "message": "Image size exceeds 10MB limit."})

            # Save file to disk
            safe_filename = f"reaperz_{int(time.time())}_{secrets.token_hex(4)}{ext}"
            target_path = UPLOADS_DIR / safe_filename
            with open(target_path, "wb") as f:
                f.write(image_bytes)

            mime_type, _ = mimetypes.guess_type(str(target_path))
            if not mime_type:
                mime_type = "image/jpeg"

            rel_file_path = f"assets/images/uploads/{safe_filename}"
            new_media = db.add_library_media(
                title=title,
                category=category,
                filename=safe_filename,
                file_path=rel_file_path,
                file_size=len(image_bytes),
                mime_type=mime_type,
                description=description,
                uploaded_by=session["name"]
            )

            return self.send_json(201, {
                "success": True,
                "media": new_media,
                "message": "✓ Image uploaded successfully to the REAPERZ Library!"
            })

        # 7. API: Add Member (Staff Only)
        if path == "/api/members":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff authentication required."})

            name = (body.get("name") or "").strip()
            role = (body.get("role") or "Member").strip()
            if not name:
                return self.send_json(422, {"success": False, "message": "Member name is required."})
            if role == "Founder" and session["role"] != "Founder":
                return self.send_json(403, {"success": False, "message": "Only a Founder can add another Founder."})

            member = db.add_member(
                name=name,
                role=role,
                game=(body.get("game") or "GTA V / FiveM").strip(),
                discord=(body.get("discord") or "").strip(),
                discord_id=(body.get("discord_id") or "").strip(),
                discord_status=(body.get("status") or body.get("discord_status") or "Online").strip(),
                avatar=(body.get("avatar") or "").strip(),
                department=(body.get("department") or "Community").strip(),
                details=(body.get("details") or body.get("description") or "").strip(),
                joined_at=body.get("joined_at")
            )
            return self.send_json(201, {"success": True, "member": member, "message": "Member added successfully."})

        # Community Highlights POST (Staff Only)
        if path == "/api/highlights":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})

            title = (body.get("title") or "").strip()
            description = (body.get("description") or "").strip()
            image_url = (body.get("image_url") or body.get("image") or "").strip()
            event_date = (body.get("event_date") or body.get("date") or "").strip()
            display_order = int(body.get("display_order", 0)) if str(body.get("display_order", 0)).isdigit() else 0
            is_pub = body.get("is_published")
            is_published = False if (is_pub is False or is_pub == 0 or is_pub == "0") else True

            if not title:
                return self.send_json(422, {"success": False, "message": "Highlight title is required."})

            highlight = db.add_highlight(
                title=title,
                description=description,
                image_url=image_url,
                event_date=event_date,
                display_order=display_order,
                is_published=is_published
            )
            return self.send_json(201, {"success": True, "highlight": highlight, "message": "Highlight created successfully."})

        # Events POST (Staff Only)
        if path == "/api/events":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})

            title = (body.get("title") or "").strip()
            description = (body.get("description") or "").strip()
            image_url = (body.get("image_url") or body.get("image") or "assets/images/gallery-1.jpg").strip()
            event_date = (body.get("event_date") or body.get("date") or "").strip()
            event_time = (body.get("event_time") or body.get("time") or "").strip()
            location = (body.get("location") or "FiveM Server / Los Santos").strip()
            organizer = (body.get("organizer") or session["name"] or "REAPERZ Staff").strip()
            statuses = {"upcoming": "Upcoming", "active": "Active", "live": "Active", "completed": "Completed", "past": "Completed"}
            status = statuses.get(str(body.get("status") or "Upcoming").strip().lower())
            category = (body.get("category") or "Community Event").strip()
            prize = (body.get("prize") or "").strip()
            button_text = (body.get("button_text") or "").strip()
            order_value = body.get("display_order", 0)
            if isinstance(order_value, int) and not isinstance(order_value, bool):
                display_order = order_value
            elif isinstance(order_value, str) and order_value.isdigit():
                display_order = int(order_value)
            else:
                display_order = -1
            if display_order < 0:
                return self.send_json(422, {"success": False, "message": "Event order must be a non-negative whole number."})
            discord_link = (body.get("discord_link") or body.get("link") or "").strip()
            is_pub = body.get("is_published")
            is_published = False if (is_pub is False or is_pub == 0 or is_pub == "0") else True

            if not title or not event_date or not description:
                return self.send_json(422, {"success": False, "message": "Event title, date, and description are required."})
            if not status:
                return self.send_json(422, {"success": False, "message": "Event status must be Upcoming, Active, or Completed."})
            event_time = event_time or "TBA"

            ev = db.add_event(
                title=title,
                description=description,
                image_url=image_url,
                event_date=event_date,
                event_time=event_time,
                location=location,
                organizer=organizer,
                status=status,
                category=category,
                prize=prize,
                button_text=button_text,
                display_order=display_order,
                discord_link=discord_link,
                is_published=is_published
            )
            return self.send_json(201, {"success": True, "event": ev, "message": "Event created successfully."})

        # Event Image Upload POST (Staff Only)
        if path == "/api/events/upload":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff authentication required."})

            filename = (body.get("filename") or "event.jpg").strip()
            file_data = body.get("file_data") or body.get("image_base64") or ""

            if not file_data:
                return self.send_json(422, {"success": False, "message": "No image data provided for event image upload."})

            ext = os.path.splitext(filename)[1].lower()
            ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
            if ext not in ALLOWED_EXTENSIONS:
                return self.send_json(422, {"success": False, "message": f"Unsupported file type '{ext}'. Allowed: JPG, PNG, WEBP, GIF."})

            if "," in file_data:
                file_data = file_data.split(",", 1)[1]

            try:
                image_bytes = base64.b64decode(file_data)
            except Exception as e:
                return self.send_json(400, {"success": False, "message": f"Corrupted Base64 image data: {e}"})

            if len(image_bytes) > 10 * 1024 * 1024:
                return self.send_json(413, {"success": False, "message": "Image size exceeds 10MB limit."})

            safe_filename = f"reaperz_event_{int(time.time())}_{secrets.token_hex(4)}{ext}"
            target_path = UPLOADS_DIR / safe_filename
            with open(target_path, "wb") as f:
                f.write(image_bytes)

            rel_file_path = f"assets/images/uploads/{safe_filename}"
            return self.send_json(201, {
                "success": True,
                "file_path": rel_file_path,
                "filename": safe_filename,
                "message": "✓ Event image uploaded successfully!"
            })

        # Gaming Platforms POST (Staff Only)
        if path == "/api/gaming-platforms":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})

            type_val = body.get("type", "fivem")
            name = body.get("name", "")
            description = body.get("description", "")
            image_url = body.get("image_url", "")
            link = body.get("link", "")
            status = body.get("status", "Active")
            if not all(isinstance(value, str) for value in (type_val, name, description, image_url, link, status)):
                return self.send_json(422, {"success": False, "message": "Platform fields must be text."})
            type_val = type_val.strip().lower()
            name, description = name.strip(), description.strip()
            image_url, link, status = image_url.strip(), link.strip(), status.strip()
            if type_val not in {"gta_online", "fivem"}:
                return self.send_json(422, {"success": False, "message": "Platform type must be gta_online or fivem."})
            if len(name) > 150 or len(description) > 2000 or len(image_url) > 500 or len(link) > 500 or len(status) > 50:
                return self.send_json(422, {"success": False, "message": "One or more platform fields exceed the allowed length."})
            if not status:
                return self.send_json(422, {"success": False, "message": "Platform status is required."})
            try:
                display_order = int(body.get("display_order", 0))
            except (TypeError, ValueError):
                return self.send_json(422, {"success": False, "message": "Display order must be a non-negative whole number."})
            if display_order < 0:
                return self.send_json(422, {"success": False, "message": "Display order must be a non-negative whole number."})
            is_pub = body.get("is_published")
            is_published = False if (is_pub is False or is_pub == 0 or is_pub == "0") else True

            if not name:
                return self.send_json(422, {"success": False, "message": "Platform/Server name is required."})

            plat = db.add_gaming_platform(
                platform_type=type_val,
                name=name,
                description=description,
                image_url=image_url,
                link=link,
                status=status,
                display_order=display_order,
                is_published=is_published
            )
            return self.send_json(201, {"success": True, "platform": plat, "message": "Gaming platform added."})

        # Website Settings POST (Staff Only)
        if path == "/api/settings":
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff session required."})

            settings_to_update = {body["key"]: body["value"]} if "key" in body and "value" in body else body
            if "discord_invite" in settings_to_update:
                try:
                    invite = urllib.parse.urlsplit(str(settings_to_update["discord_invite"]))
                    hostname = invite.hostname
                except ValueError:
                    return self.send_json(422, {"success": False, "message": "A valid Discord invite URL is required."})
                valid_host = hostname == "discord.gg" or (
                    hostname == "discord.com" and invite.path.startswith("/invite/")
                )
                if invite.scheme != "https" or not valid_host:
                    return self.send_json(422, {"success": False, "message": "Use an HTTPS discord.gg or discord.com/invite URL."})
                settings_to_update["discord_invite"] = urllib.parse.urlunsplit(invite)
            for key, value in settings_to_update.items():
                db.update_setting(key, str(value))

            settings = db.get_settings()
            return self.send_json(200, {"success": True, "settings": settings, "message": "Settings updated."})

        # 8. API: Submit Application (Join Us Form)
        if path == "/api/applications":
            name = (body.get("name") or "").strip()
            discord = (body.get("discord") or "").strip()
            game = (body.get("game") or "").strip()
            if not name or not discord or not game:
                return self.send_json(422, {"success": False, "message": "Name, discord, and game are required."})

            try:
                age = int(body.get("age", 18))
            except ValueError:
                age = 18

            app_res = db.add_application(
                name=name,
                discord=discord,
                age=age,
                game=game,
                role=(body.get("role") or "Member").strip(),
                timezone=(body.get("timezone") or "IST").strip(),
                about=(body.get("about") or "").strip()
            )
            return self.send_json(201, {"success": True, "application_id": app_res["id"], "message": "Application submitted successfully."})

        # 9. API: Submit Message (Contact Form)
        if path == "/api/messages":
            name = (body.get("name") or "").strip()
            email = (body.get("email") or "").strip()
            message = (body.get("message") or "").strip()
            if not name or not email or not message:
                return self.send_json(422, {"success": False, "message": "Name, email, and message are required."})

            msg_res = db.add_message(
                name=name,
                email=email,
                subject=(body.get("subject") or "General Inquiry").strip(),
                message=message
            )
            return self.send_json(201, {"success": True, "message": "Message received by REAPERZ Staff HQ."})

        # 10. API: Reset Database (Founder Only)
        if path == "/api/reset":
            session = verify_staff_session(self.headers)
            if not session or session["role"] != "Founder":
                return self.send_json(403, {"success": False, "message": "Permission denied. Only Founder can reset database."})

            # Re-init db
            db.init_db()
            return self.send_json(200, {"success": True, "message": "Database reset to defaults."})

        return self.send_json(404, {"success": False, "message": "Endpoint not found."})

    # =========================================================================
    # PUT & PATCH REQUEST HANDLERS
    # =========================================================================

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        session = verify_staff_session(self.headers)
        if not session:
            return self.send_json(401, {"success": False, "message": "Unauthorized. Staff authentication required."})

        # Update member role: PUT /api/members/<id>/role
        if path.startswith("/api/members/") and path.endswith("/role"):
            parts = path.strip("/").split("/")
            try:
                member_id = int(parts[2])
            except (IndexError, ValueError):
                return self.send_json(400, {"success": False, "message": "Invalid member ID."})

            new_role = (body.get("role") or "").strip()
            VALID_ROLES = ["Founder", "Admin", "Moderator", "Developer", "Member"]
            if new_role not in VALID_ROLES:
                return self.send_json(422, {"success": False, "message": f"Invalid role. Permitted: {', '.join(VALID_ROLES)}"})

            existing_member = db.get_member(member_id)
            if not existing_member:
                return self.send_json(404, {"success": False, "message": "Member not found."})
            if session["role"] != "Founder" and existing_member["role"] == "Founder":
                return self.send_json(403, {"success": False, "message": "Only a Founder can change a Founder account."})
            if session["role"] != "Founder" and new_role == "Founder":
                return self.send_json(403, {"success": False, "message": "Only Founder can appoint another Founder."})

            db.update_member_role(member_id, new_role)
            return self.send_json(200, {"success": True, "message": f"Role updated to {new_role}"})

        # Full Member Update: PUT /api/members/<id>
        if path.startswith("/api/members/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                try:
                    member_id = int(parts[2])
                except ValueError:
                    return self.send_json(400, {"success": False, "message": "Invalid member ID."})

                existing_member = db.get_member(member_id)
                if not existing_member:
                    return self.send_json(404, {"success": False, "message": "Member not found."})
                if "role" in body and body["role"] not in ["Founder", "Admin", "Moderator", "Developer", "Member"]:
                    return self.send_json(422, {"success": False, "message": "Invalid member role."})
                if session["role"] != "Founder" and (
                    existing_member["role"] == "Founder" or body.get("role") == "Founder"
                ):
                    return self.send_json(403, {"success": False, "message": "Only a Founder can edit Founder accounts or assign the Founder role."})

                update_fields = {}
                for k in ["name", "role", "game", "discord", "discord_id", "avatar", "department"]:
                    if k in body:
                        update_fields[k] = body[k]
                if "status" in body:
                    update_fields["discord_status"] = body["status"]
                elif "discord_status" in body:
                    update_fields["discord_status"] = body["discord_status"]
                if "details" in body:
                    update_fields["details"] = body["details"]
                elif "description" in body:
                    update_fields["details"] = body["description"]
                if "joined_at" in body:
                    update_fields["joined_at"] = body["joined_at"]

                updated = db.update_member(member_id, **update_fields)
                if not updated:
                    return self.send_json(404, {"success": False, "message": "Member not found."})
                return self.send_json(200, {"success": True, "member": updated, "message": "Member updated successfully."})

        # Update Highlight: PUT /api/highlights/<id>
        if path.startswith("/api/highlights/"):
            try:
                h_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid highlight ID."})

            h_fields = {}
            if "title" in body: h_fields["title"] = body["title"]
            if "description" in body: h_fields["description"] = body["description"]
            if "image_url" in body: h_fields["image_url"] = body["image_url"]
            elif "image" in body: h_fields["image_url"] = body["image"]
            if "event_date" in body: h_fields["event_date"] = body["event_date"]
            elif "date" in body: h_fields["event_date"] = body["date"]
            if "display_order" in body:
                try: h_fields["display_order"] = int(body["display_order"])
                except Exception: pass
            if "is_published" in body:
                is_pub = body["is_published"]
                h_fields["is_published"] = False if (is_pub is False or is_pub == 0 or is_pub == "0") else True

            updated_h = db.update_highlight(h_id, **h_fields)
            if not updated_h:
                return self.send_json(404, {"success": False, "message": "Highlight not found."})
            return self.send_json(200, {"success": True, "highlight": updated_h, "message": "Highlight updated."})

        # Update Event: PUT /api/events/<id>
        if path.startswith("/api/events/"):
            try:
                ev_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid event ID."})

            ev_fields = {}
            if "title" in body: ev_fields["title"] = body["title"]
            if "description" in body: ev_fields["description"] = body["description"]
            if "image_url" in body: ev_fields["image_url"] = body["image_url"]
            elif "image" in body: ev_fields["image_url"] = body["image"]
            if "event_date" in body: ev_fields["event_date"] = body["event_date"]
            elif "date" in body: ev_fields["event_date"] = body["date"]
            if "event_time" in body: ev_fields["event_time"] = body["event_time"]
            elif "time" in body: ev_fields["event_time"] = body["time"]
            if "location" in body: ev_fields["location"] = body["location"]
            if "organizer" in body: ev_fields["organizer"] = body["organizer"]
            if "status" in body:
                statuses = {"upcoming": "Upcoming", "active": "Active", "live": "Active", "completed": "Completed", "past": "Completed"}
                status = statuses.get(str(body["status"]).strip().lower())
                if not status:
                    return self.send_json(422, {"success": False, "message": "Event status must be Upcoming, Active, or Completed."})
                ev_fields["status"] = status
            for field in ("category", "prize", "button_text"):
                if field in body:
                    ev_fields[field] = body[field]
            if "display_order" in body:
                order_value = body["display_order"]
                if isinstance(order_value, int) and not isinstance(order_value, bool):
                    display_order = order_value
                elif isinstance(order_value, str) and order_value.isdigit():
                    display_order = int(order_value)
                else:
                    display_order = -1
                if display_order < 0:
                    return self.send_json(422, {"success": False, "message": "Event order must be a non-negative whole number."})
                ev_fields["display_order"] = display_order
            if "discord_link" in body: ev_fields["discord_link"] = body["discord_link"]
            elif "link" in body: ev_fields["discord_link"] = body["link"]
            if "is_published" in body:
                is_pub = body["is_published"]
                ev_fields["is_published"] = False if (is_pub is False or is_pub == 0 or is_pub == "0") else True

            updated_ev = db.update_event(ev_id, **ev_fields)
            if not updated_ev:
                return self.send_json(404, {"success": False, "message": "Event not found."})
            return self.send_json(200, {"success": True, "event": updated_ev, "message": "Event updated successfully."})

        # Update Gaming Platform: PUT /api/gaming-platforms/<id>
        if path.startswith("/api/gaming-platforms/"):
            try:
                p_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid platform ID."})

            p_fields = {}
            if "type" in body:
                type_val = body["type"]
                if not isinstance(type_val, str) or type_val.strip().lower() not in {"gta_online", "fivem"}:
                    return self.send_json(422, {"success": False, "message": "Platform type must be gta_online or fivem."})
                p_fields["type"] = type_val.strip().lower()
            for field, limit in (("name", 150), ("description", 2000), ("image_url", 500), ("link", 500), ("status", 50)):
                if field in body:
                    value = body[field]
                    if not isinstance(value, str) or len(value.strip()) > limit:
                        return self.send_json(422, {"success": False, "message": f"Invalid {field} value or length."})
                    if field in {"name", "status"} and not value.strip():
                        return self.send_json(422, {"success": False, "message": f"{field.capitalize()} is required."})
                    p_fields[field] = value.strip()
            if "display_order" in body:
                try:
                    p_fields["display_order"] = int(body["display_order"])
                except (TypeError, ValueError):
                    return self.send_json(422, {"success": False, "message": "Display order must be a non-negative whole number."})
                if p_fields["display_order"] < 0:
                    return self.send_json(422, {"success": False, "message": "Display order must be a non-negative whole number."})
            if "is_published" in body:
                is_pub = body["is_published"]
                p_fields["is_published"] = False if (is_pub is False or is_pub == 0 or is_pub == "0") else True

            updated_p = db.update_gaming_platform(p_id, **p_fields)
            if not updated_p:
                return self.send_json(404, {"success": False, "message": "Gaming platform not found."})
            return self.send_json(200, {"success": True, "platform": updated_p, "message": "Gaming platform updated."})

        # Update Settings: PUT /api/settings
        if path == "/api/settings":
            if "key" in body and "value" in body:
                db.update_setting(body["key"], str(body["value"]))
            else:
                for k, v in body.items():
                    db.update_setting(k, str(v))
            settings = db.get_settings()
            return self.send_json(200, {"success": True, "settings": settings, "message": "Settings updated."})

        return self.send_json(404, {"success": False, "message": "Endpoint not found."})

    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # Update application status: PATCH /api/applications/<id>
        if path.startswith("/api/applications/"):
            session = verify_staff_session(self.headers)
            if not session:
                return self.send_json(401, {"success": False, "message": "Unauthorized. Staff authentication required."})

            try:
                app_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid application ID."})

            new_status = body.get("status")
            if not new_status:
                return self.send_json(400, {"success": False, "message": "Status required."})

            add_to_members = bool(body.get("addToMembers"))
            updated = db.update_application_status(app_id, new_status, add_to_members=add_to_members)
            if not updated:
                return self.send_json(404, {"success": False, "message": "Application not found."})

            return self.send_json(200, {"success": True, "application": updated})

        return self.send_json(404, {"success": False, "message": "Endpoint not found."})

    # =========================================================================
    # DELETE REQUEST HANDLERS
    # =========================================================================

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        session = verify_staff_session(self.headers)
        if not session:
            return self.send_json(401, {"success": False, "message": "Unauthorized. Staff authentication required."})

        # 1. DELETE /api/members/<id>
        if path.startswith("/api/members/"):
            try:
                member_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid member ID."})

            existing_member = db.get_member(member_id)
            if not existing_member:
                return self.send_json(404, {"success": False, "message": "Member not found."})
            if session["role"] != "Founder" and existing_member["role"] == "Founder":
                return self.send_json(403, {"success": False, "message": "Only a Founder can delete a Founder account."})
            success = db.delete_member(member_id)
            if not success:
                return self.send_json(404, {"success": False, "message": "Member not found."})
            return self.send_json(200, {"success": True, "message": "Member removed from roster."})

        # 2. DELETE /api/highlights/<id>
        if path.startswith("/api/highlights/"):
            try:
                h_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid highlight ID."})

            success = db.delete_highlight(h_id)
            if not success:
                return self.send_json(404, {"success": False, "message": "Highlight not found."})
            return self.send_json(200, {"success": True, "message": "Highlight deleted."})

        # 3. DELETE /api/events/<id>
        if path.startswith("/api/events/"):
            try:
                ev_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid event ID."})

            success = db.delete_event(ev_id)
            if not success:
                return self.send_json(404, {"success": False, "message": "Event not found."})
            return self.send_json(200, {"success": True, "message": "Event deleted."})

        # 4. DELETE /api/gaming-platforms/<id>
        if path.startswith("/api/gaming-platforms/"):
            try:
                p_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid platform ID."})

            success = db.delete_gaming_platform(p_id)
            if not success:
                return self.send_json(404, {"success": False, "message": "Gaming platform not found."})
            return self.send_json(200, {"success": True, "message": "Gaming platform deleted."})

        # 5. DELETE /api/library/<id>
        if path.startswith("/api/library/"):
            try:
                media_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid media ID."})

            success = db.delete_library_media(media_id)
            if not success:
                return self.send_json(404, {"success": False, "message": "Media item not found."})
            return self.send_json(200, {"success": True, "message": "Image deleted from library."})

        # 6. DELETE /api/ratings/<id>
        if path.startswith("/api/ratings/"):
            try:
                rating_id = int(path.split("/")[-1])
            except ValueError:
                return self.send_json(400, {"success": False, "message": "Invalid rating ID."})

            success = db.delete_rating(rating_id)
            if not success:
                return self.send_json(404, {"success": False, "message": "Rating not found."})
            return self.send_json(200, {"success": True, "message": "Review deleted."})

        return self.send_json(404, {"success": False, "message": "Endpoint not found."})

    # =========================================================================
    # DISCORD PRESENCE RESOLVER
    # =========================================================================

    def fetch_discord_presence(self, user_id: str, member_id: int = None):
        """
        Retrieves real-time Discord presence & avatar via Lanyard or Discord CDN.
        Maintains an in-memory cache to prevent hitting Discord rate limits.
        """
        now = time.time()

        # Requirement 8: Dark is the founder and must ALWAYS display as Online with the configured avatar
        if user_id == "937289791429562398":
            return {
                "success": True,
                "user_id": user_id,
                "status": "Online",
                "avatar": "https://cdn.discordapp.com/avatars/937289791429562398/9970cd81f120a25115493cc9ed04a777.png?size=4096&ignore=true",
                "source": "founder_override"
            }

        if user_id in DISCORD_PRESENCE_CACHE:
            cached = DISCORD_PRESENCE_CACHE[user_id]
            if now - cached["cached_at"] < CACHE_TTL:
                return {
                    "success": True,
                    "user_id": user_id,
                    "status": cached["status"],
                    "avatar": cached["avatar"],
                    "source": "cache"
                }

        status = "Offline"
        avatar = ""

        # 1. Attempt Lanyard Public Presence API (Zero token required)
        if user_id and user_id.isdigit() and len(user_id) >= 17:
            try:
                lanyard_url = f"https://api.lanyard.rest/v1/users/{user_id}"
                req = urllib.request.Request(lanyard_url, headers={"User-Agent": "REAPERZ-Portal/2.0"})
                with urllib.request.urlopen(req, timeout=1.8) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        if data.get("success") and "data" in data:
                            raw_status = data["data"].get("discord_status", "offline").lower()
                            STATUS_MAP = {
                                "online": "Online",
                                "idle": "Idle",
                                "dnd": "Do Not Disturb",
                                "offline": "Offline"
                            }
                            status = STATUS_MAP.get(raw_status, "Offline")
                            user_data = data["data"].get("discord_user", {})
                            avatar_hash = user_data.get("avatar")
                            if avatar_hash:
                                avatar = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png?size=128"
            except Exception:
                pass

        # 2. If Discord User ID exists but Lanyard is not linked, provide Discord CDN avatar format
        if not avatar and user_id and user_id.isdigit() and len(user_id) >= 17:
            # Deterministic default Discord avatar (0-5)
            discrim_idx = (int(user_id) >> 22) % 6
            avatar = f"https://cdn.discordapp.com/embed/avatars/{discrim_idx}.png"

        # Update cache
        if user_id:
            DISCORD_PRESENCE_CACHE[user_id] = {
                "status": status,
                "avatar": avatar,
                "cached_at": now
            }

        # If member_id provided and we resolved an active status, update SQL database
        if member_id and status != "Offline":
            db.update_member_discord_status(member_id, status, avatar if avatar else None)

        return {
            "success": True,
            "user_id": user_id,
            "status": status,
            "avatar": avatar,
            "source": "live"
        }

    # =========================================================================
    # STATIC FILE SERVER
    # =========================================================================

    def serve_static(self, req_path):
        clean = req_path.strip("/")
        ROUTE_ALIASES = {
            "": "index.html",
            "staff": "admin.html",
            "admin": "admin.html",
            "events": "events.html",
            "members": "members.html",
            "join": "join.html",
            "about": "about.html",
            "rules": "rules.html",
            "contact": "contact.html",
            "library": "library.html",
            "rate": "rate.html",
        }
        rel_path = ROUTE_ALIASES.get(clean, clean if clean else "index.html")
        file_path = (BASE_DIR / rel_path).resolve()

        if not file_path.suffix and (BASE_DIR / f"{rel_path}.html").is_file():
            file_path = (BASE_DIR / f"{rel_path}.html").resolve()

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
            self.send_header("Cache-Control", "no-cache, must-revalidate")
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
    print("=" * 65)
    print("  [+] REAPERZ COMMUNITY PYTHON SERVER ONLINE [+]")
    print(f"  Web Portal:   http://localhost:{PORT}")
    print(f"  Library:      http://localhost:{PORT}/library.html")
    print(f"  Rate Us:      http://localhost:{PORT}/rate.html")
    print(f"  Members:      http://localhost:{PORT}/members.html")
    print(f"  Staff Portal: http://localhost:{PORT}/admin.html")
    print(f"  SQL Database: data/reaperz.db (Active & Parameterized)")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server Stopped]")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
