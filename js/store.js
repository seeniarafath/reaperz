/**
 * ====================================================================
 *   REAPERZ COMMUNITY - UNIFIED DATA STORE
 *   Supports SQLite Backend (Node.js/Python on Port 5000) & LocalStorage Dual-Mode
 *   Handles Members, Media Library, Ratings, Discord Presence, Applications,
 *   and Secure PBKDF2 Staff Authentication without exposing credentials.
 * ====================================================================
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    MEMBERS: 'reaperz_members',
    APPLICATIONS: 'reaperz_applications',
    MESSAGES: 'reaperz_messages',
    RATINGS: 'reaperz_ratings',
    LIBRARY: 'reaperz_library',
    HIGHLIGHTS: 'reaperz_highlights',
    EVENTS: 'reaperz_events',
    SETTINGS: 'reaperz_settings',
    STAFF_TOKEN: 'reaperz_staff_token',
    STAFF_USER: 'reaperz_staff_user'
  };

  const DEFAULT_RATINGS = [
    {
      id: 1,
      name: "Arun Kumar",
      discord: "arun_chennai#1001",
      stars: 5,
      category: "FiveM Roleplay",
      experience: "6+ Months",
      title: "Top-tier FiveM Tamil Roleplay!",
      comment: "Joined REAPERZ 4 months ago for FiveM police and EMS RP. The community is well-organized, friendly, and non-toxic. Voice calls in Tamil make gaming feel like family!",
      recommended: true,
      helpful: 18,
      submitted_at: "2026-10-10T14:20:00Z"
    },
    {
      id: 2,
      name: "Siva Nathan",
      discord: "siva_kl#7723",
      stars: 5,
      category: "GTA 5 Online",
      experience: "3-6 Months",
      title: "Best Crew for Heists and Money Grinding",
      comment: "Cayo Perico, Casino, and Doomsday heists with REAPER ARAFATH and the squad are super smooth. No griefers, pure coordination and maximum payouts.",
      recommended: true,
      helpful: 14,
      submitted_at: "2026-10-11T09:15:00Z"
    },
    {
      id: 3,
      name: "Vignesh V",
      discord: "vicky_racer#4412",
      stars: 5,
      category: "Car Meets & Racing",
      experience: "1-3 Months",
      title: "Los Santos Tamil Car Meets are Pure Fire!",
      comment: "The weekly car shows, mountain drift runs, and highway convoys are insanely fun. Great custom builds, respectful members, and high adrenaline.",
      recommended: true,
      helpful: 11,
      submitted_at: "2026-10-11T18:40:00Z"
    },
    {
      id: 4,
      name: "Mohamed Irfan",
      discord: "irfan_reaper#3321",
      stars: 5,
      category: "Community & Atmosphere",
      experience: "6+ Months",
      title: "Zero Toxicity & True Tamil Brotherhood",
      comment: "Whether you are a beginner or a veteran player, everyone treats you with respect. Staff members SHADOW and WOLF are always helpful on voice calls.",
      recommended: true,
      helpful: 9,
      submitted_at: "2026-10-12T12:05:00Z"
    },
    {
      id: 5,
      name: "Praveen Raj",
      discord: "praveen_gta#5589",
      stars: 4,
      category: "FiveM Roleplay",
      experience: "New Recruit",
      title: "Solid Community with Active Leadership",
      comment: "Very active Discord, clear community rules, and regular server events. The admins guided me through setting up FiveM mods quickly.",
      recommended: true,
      helpful: 7,
      submitted_at: "2026-10-12T17:30:00Z"
    }
  ];

  const DEFAULT_MEMBERS = [
    {
      id: 11,
      name: "Dark",
      role: "Founder",
      game: "GTA V / FiveM",
      discord: "rpz_dark",
      discord_id: "937289791429562398",
      discord_status: "Online",
      status: "Online",
      avatar: "https://cdn.discordapp.com/avatars/937289791429562398/9970cd81f120a25115493cc9ed04a777.png?size=4096&ignore=true",
      department: "Leadership",
      details: "Founder & Community Leader of REAPERZ Tamil Gaming Community.",
      joined_at: "2026-01-01T00:00:00Z"
    },
    {
      id: 12,
      name: "Beast Boy",
      role: "Developer",
      game: "GTA V / FiveM",
      discord: "beastboy",
      discord_id: "912345678901234599",
      discord_status: "Online",
      status: "Online",
      avatar: "",
      department: "Development",
      details: "Official REAPERZ Website Developer & Systems Engineer.",
      joined_at: "2026-02-01T00:00:00Z"
    },
    { id: 1, name: "REAPER ARAFATH", role: "Admin", game: "GTA V / FiveM", discord: "arafath", discord_id: "912345678901234560", discord_status: "Online", status: "Online", avatar: "", department: "Administration", details: "Head Admin & Heist Master", joined_at: "2026-01-10T00:00:00Z" },
    { id: 2, name: "WOLF", role: "Admin", game: "FiveM", discord: "wolf", discord_id: "912345678901234561", discord_status: "Online", status: "Online", avatar: "", department: "FiveM RP", details: "FiveM Server Admin & Chief of Police", joined_at: "2026-01-15T00:00:00Z" },
    { id: 3, name: "SHADOW", role: "Moderator", game: "GTA V Online", discord: "shadow", discord_id: "912345678901234562", discord_status: "Idle", status: "Idle", avatar: "", department: "Moderation", details: "Community Moderator & Events Host", joined_at: "2026-02-10T00:00:00Z" },
    { id: 4, name: "KING", role: "Moderator", game: "FiveM", discord: "king", discord_id: "912345678901234563", discord_status: "Do Not Disturb", status: "Do Not Disturb", avatar: "", department: "FiveM RP", details: "FiveM EMS Director & Server Mod", joined_at: "2026-02-15T00:00:00Z" },
    { id: 5, name: "VIKRAM", role: "Member", game: "GTA V Online", discord: "vikram", discord_id: "912345678901234564", discord_status: "Online", status: "Online", avatar: "", department: "GTA Online", details: "Senior Crew Member & Convoy Driver", joined_at: "2026-03-01T00:00:00Z" },
    { id: 6, name: "SURIYA", role: "Member", game: "FiveM", discord: "suriya", discord_id: "912345678901234565", discord_status: "Online", status: "Online", avatar: "", department: "FiveM RP", details: "Tamil Roleplay Member", joined_at: "2026-03-05T00:00:00Z" },
    { id: 7, name: "RAJ", role: "Member", game: "GTA V Online", discord: "raj", discord_id: "912345678901234566", discord_status: "Offline", status: "Offline", avatar: "", department: "GTA Online", details: "Heist Specialist", joined_at: "2026-03-10T00:00:00Z" },
    { id: 8, name: "KARTHI", role: "Member", game: "FiveM", discord: "karthi", discord_id: "912345678901234567", discord_status: "Online", status: "Online", avatar: "", department: "FiveM RP", details: "Mechanic & Drift Specialist", joined_at: "2026-03-15T00:00:00Z" }
  ];

  const DEFAULT_HIGHLIGHTS = [
    { id: 1, title: "NURP Community Mega Event", description: "All-out Tamil RP police pursuit, gang territory war, and citywide EMS operation across Los Santos.", image_url: "assets/images/gallery-1.jpg", event_date: "14 Oct 2026", display_order: 1, is_published: true },
    { id: 2, title: "Los Santos Midnight Car Meet & Drift Run", description: "Over 40 custom JDM and hypercars cruised from Del Perro pier up to Mount Vinewood.", image_url: "assets/images/gallery-3.jpg", event_date: "08 Oct 2026", display_order: 2, is_published: true },
    { id: 3, title: "Cayo Perico Elite Heist Challenge", description: "REAPERZ tactical strike team completed back-to-back stealth vault runs with max secondary loot.", image_url: "assets/images/gallery-6.jpg", event_date: "02 Oct 2026", display_order: 3, is_published: true },
    { id: 4, title: "Blaine County Interstate Convoy", description: "50+ crew vehicles lined up along Senora Freeway under heavy police escort and aerial support.", image_url: "assets/images/gallery-5.jpg", event_date: "25 Sep 2026", display_order: 4, is_published: true },
    { id: 5, title: "Subway Station Roleplay Operation", description: "Intense tactical roleplay scenario between emergency response teams and undercover operatives.", image_url: "assets/images/gallery-4.jpg", event_date: "18 Sep 2026", display_order: 5, is_published: true },
    { id: 6, title: "Midnight Squad Freeway Formation", description: "Coordinated night flight and armored convoy through Downtown Los Santos skyscrapers.", image_url: "assets/images/gallery-2.jpg", event_date: "10 Sep 2026", display_order: 6, is_published: true }
  ];

  const DEFAULT_EVENTS = [
    {
      id: 1,
      title: "REAPERZ Grand Tamil Community Heist Night",
      description: "Coordinated Cayo Perico & Casino Heist night with multiple fireteams. Tamil voice coordination in Discord.",
      image_url: "assets/images/gallery-6.jpg",
      event_date: "2026-10-24",
      event_time: "8:00 PM IST",
      location: "GTA V Online Crew Session",
      organizer: "Dark & Beast Boy",
      status: "Upcoming",
      discord_link: "https://discord.gg/reaperz-tamil",
      is_published: true
    },
    {
      id: 2,
      title: "NURP Roleplay Mega Police Pursuit & Convoy",
      description: "Massive citywide FiveM roleplay event featuring high-speed pursuits, road blocks, and live dispatch.",
      image_url: "assets/images/gallery-1.jpg",
      event_date: "2026-10-28",
      event_time: "9:00 PM IST",
      location: "FiveM Roleplay Server",
      organizer: "WOLF & SHADOW",
      status: "Upcoming",
      discord_link: "https://discord.gg/reaperz-tamil",
      is_published: true
    },
    {
      id: 3,
      title: "Los Santos JDM & Supercar Tamil Showcase",
      description: "Annual car show, clean stance contest, mountain hillclimb drift runs, and prize distributions.",
      image_url: "assets/images/gallery-3.jpg",
      event_date: "2026-10-31",
      event_time: "7:30 PM IST",
      location: "Los Santos Car Meet / Del Perro",
      organizer: "KING & VIKRAM",
      status: "Upcoming",
      discord_link: "https://discord.gg/reaperz-tamil",
      is_published: true
    },
    {
      id: 4,
      title: "FiveM Sandy Shores Tactical Survival Patrol",
      description: "Off-road convoy and tactical briefing across Blaine County with over 35 active community members.",
      image_url: "assets/images/gallery-5.jpg",
      event_date: "2026-10-05",
      event_time: "8:30 PM IST",
      location: "NURP FiveM Server",
      organizer: "REAPERZ Staff HQ",
      status: "Past",
      discord_link: "https://discord.gg/reaperz-tamil",
      is_published: true
    }
  ];

  const DEFAULT_SETTINGS = {
    discord_invite: "https://discord.gg/reaperz-tamil"
  };

  const DEFAULT_PLATFORMS = [
    { id: 1, type: 'fivem', name: 'NURP FiveM Roleplay', description: 'Tamil FiveM Roleplay server. Police, EMS, Mechanics, Gangs & more.', image_url: 'assets/images/gallery-1.jpg', connect_link: 'fivem://connect/nurp.fivem.com', discord_link: 'https://discord.gg/reaperz-tamil', is_active: true },
    { id: 2, type: 'gta', name: 'GTA 5 Online Crew', description: 'Official REAPERZ Tamil GTA Online crew. Heists, car meets, races.', image_url: 'assets/images/gallery-2.jpg', connect_link: 'https://socialclub.rockstargames.com/crew/reaperz_tamil', discord_link: 'https://discord.gg/reaperz-tamil', is_active: true }
  ];

  const DEFAULT_LIBRARY = [
    { id: 1, title: "FiveM Patrol & Convoy Meet", category: "FiveM RP", filename: "gallery-1.jpg", file_path: "assets/images/gallery-1.jpg", uploaded_by: "REAPER ARAFATH", uploaded_at: "2026-10-01T12:00:00Z" },
    { id: 2, title: "Los Santos Midnight Squad Run", category: "GTA 5 Online", filename: "gallery-2.jpg", file_path: "assets/images/gallery-2.jpg", uploaded_by: "WOLF", uploaded_at: "2026-10-02T15:30:00Z" },
    { id: 3, title: "Tamil Car Enthusiasts Meetup", category: "Car Meets", filename: "gallery-3.jpg", file_path: "assets/images/gallery-3.jpg", uploaded_by: "KING", uploaded_at: "2026-10-03T18:00:00Z" },
    { id: 4, title: "City Roleplay Action & Briefing", category: "FiveM RP", filename: "gallery-4.jpg", file_path: "assets/images/gallery-4.jpg", uploaded_by: "SHADOW", uploaded_at: "2026-10-04T20:15:00Z" },
    { id: 5, title: "Highway Convoy & Fleet Drive", category: "Crew Convoys", filename: "gallery-5.jpg", file_path: "assets/images/gallery-5.jpg", uploaded_by: "VIKRAM", uploaded_at: "2026-10-05T14:40:00Z" },
    { id: 6, title: "Squad Briefing & Heist Setup", category: "Heist Operations", filename: "gallery-6.jpg", file_path: "assets/images/gallery-6.jpg", uploaded_by: "REAPER ARAFATH", uploaded_at: "2026-10-06T19:00:00Z" }
  ];

  class Store {
    constructor() {
      if (window.location.protocol.startsWith('http')) {
        this.apiBase = window.location.origin;
      } else {
        this.apiBase = 'http://localhost:5000';
      }
      this.isApiOnline = null;
      this.initLocalStorage();
    }

    initLocalStorage() {
      if (!localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) {
        localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify([
          {
            id: 1,
            name: "Dinesh Kumar",
            discord: "dinesh_gta#1234",
            age: 21,
            game: "FiveM",
            role: "Police RP",
            timezone: "IST (Tamil Nadu)",
            about: "Experienced in FiveM Tamil servers for 2 years. Looking for a serious and fun roleplay community with REAPERZ.",
            status: "Pending",
            submitted_at: new Date().toISOString()
          }
        ]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
      }
    }

    async checkApi() {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 1800);
        const res = await fetch(`${this.apiBase}/api/stats`, { signal: ctrl.signal });
        clearTimeout(timeout);
        this.isApiOnline = res.ok;
      } catch (e) {
        this.isApiOnline = false;
      }
      return this.isApiOnline;
    }

    // =========================================================================
    // STAFF AUTHENTICATION (NO PASSWORDS EXPOSED IN CLIENT FILES)
    // =========================================================================

    getStaffToken() {
      // Existing API guards use this value; authentication itself is the HttpOnly cookie.
      return this.getStaffSession() ? 'cookie-session' : '';
    }

    getStaffSession() {
      try {
        const user = sessionStorage.getItem(STORAGE_KEYS.STAFF_USER);
        if (user) {
          return JSON.parse(user);
        }
      } catch (e) {}
      return null;
    }

    setStaffSession(user) {
      sessionStorage.removeItem(STORAGE_KEYS.STAFF_TOKEN);
      sessionStorage.setItem(STORAGE_KEYS.STAFF_USER, JSON.stringify(user));
    }

    clearStaffSession() {
      sessionStorage.removeItem(STORAGE_KEYS.STAFF_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.STAFF_USER);
    }

    async loginStaff(username, password) {
      try {
        const res = await fetch(`${this.apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const json = await res.json();
        if (res.ok && json.success && json.user) {
          this.isApiOnline = true;
          this.setStaffSession(json.user);
          return { success: true, user: json.user, name: json.user.name, message: json.message };
        }
        return { success: false, message: json.message || "Invalid credentials." };
      } catch (err) {
        return { success: false, message: "Could not connect to authentication server. Please ensure the server is running on port 5000." };
      }
    }

    // Alias for loginStaff to ensure complete backwards compatibility
    async verifyStaff(roleOrUsername, password) {
      return await this.loginStaff(roleOrUsername, password);
    }

    async verifyStaffSession() {
      try {
        const res = await fetch(`${this.apiBase}/api/auth/verify`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.user) {
            this.setStaffSession(json.user);
            return true;
          }
        }
      } catch (e) {}

      this.clearStaffSession();
      return false;
    }

    async logoutStaff() {
      const token = this.getStaffToken();
      if (token) {
        try {
          await fetch(`${this.apiBase}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
      }
      this.clearStaffSession();
    }

    async changeStaffPassword(currentPassword, newPassword) {
      const token = this.getStaffToken();
      const res = await fetch(`${this.apiBase}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Could not change password.");
      return json;
    }

    // =========================================================================
    // MEMBERS API (SQL CONNECTED)
    // =========================================================================

    async getMembers(search = '', role = '', department = '', status = '') {
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (role && role !== 'All') params.set('role', role);
        if (department && department !== 'All') params.set('department', department);
        if (status && status !== 'All') params.set('status', status);
        const res = await fetch(`${this.apiBase}/api/members?${params.toString()}`);
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.members)) throw new Error('Bad response');
        this.isApiOnline = true;
        return json.members;
      } catch (e) {
        this.isApiOnline = false;
        const stored = localStorage.getItem(STORAGE_KEYS.MEMBERS);
        let members = stored ? JSON.parse(stored) : DEFAULT_MEMBERS;
        if (search) members = members.filter(m => (m.name || '').toLowerCase().includes(search.toLowerCase()) || (m.discord || '').toLowerCase().includes(search.toLowerCase()));
        if (role && role !== 'All') members = members.filter(m => m.role === role);
        if (status && status !== 'All') members = members.filter(m => m.status === status);
        return members;
      }
    }

    async getMember(id) {
      const res = await fetch(`${this.apiBase}/api/members/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success || !json.member) {
        throw new Error(json.message || 'Could not load member from the database.');
      }
      return json.member;
    }

    async updateMember(id, memberData) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}/api/members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(memberData)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to update member.');
      return json.member;
    }

    async addMember(member) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}/api/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(member)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add member.');
      return json.member;
    }

    async deleteMember(id) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}/api/members/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Could not delete member.');
      return true;
    }

    async updateMemberRole(id, newRole) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}/api/members/${id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Role update rejected.');
      return true;
    }

    // =========================================================================
    // COMMUNITY HIGHLIGHTS API
    // =========================================================================
    // =========================================================================
    // COMMUNITY HIGHLIGHTS API
    // =========================================================================

    async getHighlights(all = false) {
      try {
        const token = this.getStaffToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `${this.apiBase}/api/highlights${all ? '?all=1' : ''}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.highlights)) throw new Error('Bad response');
        return json.highlights;
      } catch (e) {
        const stored = localStorage.getItem(STORAGE_KEYS.HIGHLIGHTS);
        return stored ? JSON.parse(stored) : (DEFAULT_HIGHLIGHTS || []);
      }
    }

    async addHighlight(highlightData) {
      return this.saveManagedRecord('/api/highlights', 'POST', highlightData, 'Failed to create highlight.');
    }

    async updateHighlight(id, highlightData) {
      return this.saveManagedRecord(`/api/highlights/${id}`, 'PUT', highlightData, 'Failed to update highlight.');
    }

    async deleteHighlight(id) {
      return this.deleteManagedRecord(`/api/highlights/${id}`, 'Failed to delete highlight.');
    }

    async saveManagedRecord(url, method, data, errorMessage) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || errorMessage);
      return json.highlight || json.event || true;
    }

    async deleteManagedRecord(url, errorMessage) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}${url}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || errorMessage);
      return true;
    }

    // =========================================================================
    // EVENTS API
    // =========================================================================
    // =========================================================================
    // EVENTS API
    // =========================================================================

    async getEvents(all = false, type = '') {
      try {
        const token = this.getStaffToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const params = new URLSearchParams();
        if (all) params.set('all', '1');
        if (type) params.set('type', type);
        const res = await fetch(`${this.apiBase}/api/events?${params.toString()}`, { headers });
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.events)) throw new Error('Bad response');
        return json.events;
      } catch (e) {
        const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
        return stored ? JSON.parse(stored) : (DEFAULT_EVENTS || []);
      }
    }

    async addEvent(eventData) {
      return this.saveManagedRecord('/api/events', 'POST', eventData, 'Failed to create event.');
    }

    async updateEvent(id, eventData) {
      return this.saveManagedRecord(`/api/events/${id}`, 'PUT', eventData, 'Failed to update event.');
    }

    async deleteEvent(id) {
      return this.deleteManagedRecord(`/api/events/${id}`, 'Failed to delete event.');
    }
    async uploadEventImage(fileData, filename = 'event.jpg') {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      if (token) {
        try {
          const res = await fetch(`${this.apiBase}/api/events/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ file_data: fileData, filename })
          });
          const json = await res.json();
          if (res.ok && json.success) return json;
          throw new Error(json.message || 'Event image upload failed.');
        } catch (err) {
          throw err;
        }
      }
      throw new Error('Event image upload failed.');
    }

    // =========================================================================
    // GAMING PLATFORMS API (GTA ONLINE CREW & FIVEM)
    // =========================================================================

    async getGamingPlatforms(all = false) {
      try {
        const token = this.getStaffToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `${this.apiBase}/api/gaming-platforms${all ? '?all=1' : ''}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.platforms)) throw new Error('Bad response');
        this.isApiOnline = true;
        return json.platforms;
      } catch (e) {
        this.isApiOnline = false;
        return DEFAULT_PLATFORMS || [];
      }
    }

    async addGamingPlatform(platformData) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}/api/gaming-platforms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(platformData)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to add gaming platform.');
      }
      return json.platform;
    }

    async updateGamingPlatform(id, platformData) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}/api/gaming-platforms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(platformData)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to update gaming platform.');
      }
      return json.platform;
    }

    async deleteGamingPlatform(id) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      const res = await fetch(`${this.apiBase}/api/gaming-platforms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to delete gaming platform.');
      }
      return true;
    }

    // =========================================================================
    // WEBSITE SETTINGS API (CONFIGURABLE DISCORD INVITE, CREW NAME, ETC)
    // =========================================================================

    async getSettings() {
      try {
        const res = await fetch(`${this.apiBase}/api/settings`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.settings) {
            return json.settings;
          }
        }
      } catch (e) {}
      // Fallback to localStorage or defaults (static hosting / offline)
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    }

    async updateSetting(keyOrObj, value) {
      const payload = typeof keyOrObj === 'object' ? keyOrObj : { key: keyOrObj, value };
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      if (token) {
        try {
          const res = await fetch(`${this.apiBase}/api/settings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (res.ok && json.success) {
            return json.settings;
          }
          throw new Error(json.message || 'Failed to save settings.');
        } catch (err) {
          throw err;
        }
      }
      throw new Error('Failed to save settings to the database.');
    }

    async getStats() {
      try {
        const res = await fetch(`${this.apiBase}/api/stats`);
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!json.success || !json.stats) throw new Error('Bad response');
        return json.stats;
      } catch (e) {
        // Return default stats when API is not available (static hosting)
        const members = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || 'null') || DEFAULT_MEMBERS || [];
        const ratings = JSON.parse(localStorage.getItem(STORAGE_KEYS.RATINGS) || 'null') || DEFAULT_RATINGS || [];
        return {
          members: members.length || 0,
          events: 0,
          rating: ratings.length ? (ratings.reduce((s, r) => s + (r.stars || 5), 0) / ratings.length).toFixed(1) : '5.0',
          library: 0
        };
      }
    }

    // =========================================================================
    // DISCORD PRESENCE INTEGRATION
    // =========================================================================

    async getDiscordPresence(userId, memberId = null) {
      if (!userId) return null;
      try {
        const params = new URLSearchParams({ user_id: userId });
        if (memberId) params.set('member_id', memberId);
        const res = await fetch(`${this.apiBase}/api/discord/presence?${params.toString()}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
      return null;
    }

    // =========================================================================
    // RATINGS & REVIEWS API
    // =========================================================================

    async getRatings(category = '', stars = '') {
      try {
        const params = new URLSearchParams();
        if (category && category !== 'All') params.set('category', category);
        if (stars && stars !== 'All') params.set('stars', stars);
        const res = await fetch(`${this.apiBase}/api/ratings?${params.toString()}`);
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.ratings)) throw new Error('Bad response');
        this.isApiOnline = true;
        return json;
      } catch (e) {
        this.isApiOnline = false;
        let ratings = JSON.parse(localStorage.getItem(STORAGE_KEYS.RATINGS) || 'null') || DEFAULT_RATINGS || [];
        if (category && category !== 'All') ratings = ratings.filter(r => r.category === category);
        if (stars && stars !== 'All') ratings = ratings.filter(r => r.stars === parseInt(stars));
        return { success: true, ratings };
      }
    }

    async submitRating(ratingData) {
      try {
        const res = await fetch(`${this.apiBase}/api/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ratingData)
        });
        const json = await res.json();
        if (res.ok && json.success) {
          this.isApiOnline = true;
          return json;
        }
        throw new Error(json.message || 'Server rejected rating submission.');
      } catch (e) {
        // Fallback: save rating to localStorage
        const ratings = JSON.parse(localStorage.getItem(STORAGE_KEYS.RATINGS) || 'null') || DEFAULT_RATINGS.slice() || [];
        const newRating = { ...ratingData, id: Date.now(), helpful: 0, submitted_at: new Date().toISOString() };
        ratings.unshift(newRating);
        localStorage.setItem(STORAGE_KEYS.RATINGS, JSON.stringify(ratings));
        return { success: true, rating_id: newRating.id };
      }
    }

    async upvoteRating(id) {
      const res = await fetch(`${this.apiBase}/api/ratings/${id}/helpful`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Could not update rating helpful count.');
      }
      return json;
    }

    async deleteRating(id) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      if (token) {
        try {
          const res = await fetch(`${this.apiBase}/api/ratings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const json = await res.json();
          if (res.ok && json.success) return true;
          throw new Error(json.message || 'Could not delete rating.');
        } catch (err) {
          throw err;
        }
      }
      throw new Error('Could not delete rating from the database.');
    }

    // =========================================================================
    // MEDIA LIBRARY & UPLOADS API
    // =========================================================================

    async getLibraryMedia(category = '', search = '') {
      try {
        const params = new URLSearchParams();
        if (category && category !== 'All') params.set('category', category);
        if (search) params.set('search', search);
        const res = await fetch(`${this.apiBase}/api/library?${params.toString()}`);
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.media)) throw new Error('Bad response');
        this.isApiOnline = true;
        return json;
      } catch (e) {
        this.isApiOnline = false;
        // Fall back to built-in default library items
        let media = DEFAULT_LIBRARY.slice();
        if (category && category !== 'All') media = media.filter(m => m.category === category);
        if (search) media = media.filter(m => (m.title || '').toLowerCase().includes(search.toLowerCase()));
        return { success: true, media };
      }
    }

    async uploadLibraryMedia(uploadPayload) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      if (token) {
        try {
          const res = await fetch(`${this.apiBase}/api/library/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(uploadPayload)
          });
          const json = await res.json();
          if (res.ok && json.success) {
            return json;
          }
          throw new Error(json.message || 'Failed to upload image.');
        } catch (err) {
          throw err;
        }
      }
      throw new Error('Image upload failed.');
    }

    async deleteLibraryMedia(id) {
      const token = this.getStaffToken();
      if (!token) throw new Error('Staff session required.');
      if (token) {
        try {
          const res = await fetch(`${this.apiBase}/api/library/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const json = await res.json();
          if (res.ok && json.success) return true;
          throw new Error(json.message || 'Could not delete image.');
        } catch (err) {
          throw err;
        }
      }
      throw new Error('Could not delete library media from the database.');
    }

    // =========================================================================
    // APPLICATIONS & MESSAGES API
    // =========================================================================

    async getApplications() {
      try {
        const res = await fetch(`${this.apiBase}/api/applications`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.applications;
        }
      } catch (e) {}
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
    }

    async submitApplication(appData) {
      try {
        const res = await fetch(`${this.apiBase}/api/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appData)
        });
        const json = await res.json();
        if (res.ok && json.success) return { success: true, id: json.application_id };
      } catch (e) {}

      const apps = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
      const newApp = {
        ...appData,
        id: Date.now(),
        status: 'Pending',
        submitted_at: new Date().toISOString()
      };
      apps.unshift(newApp);
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
      return { success: true, id: newApp.id };
    }

    async updateApplicationStatus(id, status, addToMembers = false) {
      const token = this.getStaffToken();
      if (token) {
        try {
          const res = await fetch(`${this.apiBase}/api/applications/${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status, addToMembers })
          });
          const json = await res.json();
          if (res.ok && json.success) return true;
        } catch (e) {}
      }

      const apps = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
      const target = apps.find(a => a.id === id);
      if (target) {
        target.status = status;
        localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));

        if (status === 'Approved' && addToMembers) {
          await this.addMember({
            name: target.name,
            role: target.role || 'Member',
            game: target.game,
            discord: target.discord,
            discord_id: '',
            status: 'Online',
            avatar: ''
          });
        }
        return true;
      }
      return false;
    }

    async getMessages() {
      try {
        const res = await fetch(`${this.apiBase}/api/messages`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.messages;
        }
      } catch (e) {}
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    }

    async submitMessage(msgData) {
      try {
        const res = await fetch(`${this.apiBase}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msgData)
        });
        const json = await res.json();
        if (res.ok && json.success) return { success: true };
      } catch (e) {}

      const msgs = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
      msgs.unshift({
        ...msgData,
        id: Date.now(),
        submitted_at: new Date().toISOString()
      });
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(msgs));
      return { success: true };
    }

    async resetAll() {
      const token = this.getStaffToken();
      if (token) {
        try {
          await fetch(`${this.apiBase}/api/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
      }
      localStorage.removeItem(STORAGE_KEYS.MEMBERS);
      localStorage.removeItem(STORAGE_KEYS.APPLICATIONS);
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.RATINGS);
      localStorage.removeItem(STORAGE_KEYS.LIBRARY);
      this.initLocalStorage();
    }
  }

  window.ReaperzStore = new Store();
})(window);
