/**
 * REAPERZ Unified Data Store (Python Backend & LocalStorage Dual-Mode)
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    MEMBERS: 'reaperz_members',
    APPLICATIONS: 'reaperz_applications',
    MESSAGES: 'reaperz_messages',
    API_AVAILABLE: 'reaperz_api_available'
  };

  const DEFAULT_MEMBERS = [
    { id: 1, name: "REAPER ARAFATH", role: "Founder", game: "GTA V / FiveM", discord: "arafath", status: "Online", avatar: "" },
    { id: 2, name: "WOLF", role: "Admin", game: "FiveM", discord: "wolf", status: "Online", avatar: "" },
    { id: 3, name: "SHADOW", role: "Moderator", game: "GTA V Online", discord: "shadow", status: "Offline", avatar: "" },
    { id: 4, name: "KING", role: "Moderator", game: "FiveM", discord: "king", status: "Online", avatar: "" },
    { id: 5, name: "VIKRAM", role: "Member", game: "GTA V Online", discord: "vikram", status: "Online", avatar: "" },
    { id: 6, name: "SURIYA", role: "Member", game: "FiveM", discord: "suriya", status: "Online", avatar: "" },
    { id: 7, name: "RAJ", role: "Member", game: "GTA V Online", discord: "raj", status: "Online", avatar: "" },
    { id: 8, name: "KARTHI", role: "Member", game: "FiveM", discord: "karthi", status: "Online", avatar: "" }
  ];

  class Store {
    constructor() {
      // If served directly from Python server (port 5000 or any port)
      if (window.location.protocol.startsWith('http') && !window.location.port.startsWith('550')) {
        this.apiBase = window.location.origin;
      } else {
        this.apiBase = 'http://localhost:5000';
      }
      this.isApiOnline = null;
      this.initLocalStorage();
    }

    initLocalStorage() {
      if (!localStorage.getItem(STORAGE_KEYS.MEMBERS)) {
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(DEFAULT_MEMBERS));
      }
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
      if (this.isApiOnline !== null) return this.isApiOnline;
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 1200);
        const res = await fetch(`${this.apiBase}/api/stats`, { signal: ctrl.signal });
        clearTimeout(timeout);
        this.isApiOnline = res.ok;
      } catch (e) {
        // Try fallback to port 3000 if 5000 is not responding
        try {
          const ctrl = new AbortController();
          const timeout = setTimeout(() => ctrl.abort(), 1000);
          const res = await fetch('http://localhost:3000/api/stats', { signal: ctrl.signal });
          clearTimeout(timeout);
          if (res.ok) {
            this.apiBase = 'http://localhost:3000';
            this.isApiOnline = true;
            return true;
          }
        } catch (err2) {}
        this.isApiOnline = false;
      }
      return this.isApiOnline;
    }

    // Members methods
    async getMembers(search = '', role = '') {
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const params = new URLSearchParams();
          if (search) params.set('search', search);
          if (role && role !== 'All') params.set('role', role);
          const res = await fetch(`${this.apiBase}/api/members?${params.toString()}`);
          const json = await res.json();
          if (json.success) return json.members;
        } catch (e) {
          console.warn('API fetch failed, using local storage', e);
        }
      }

      let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '[]');
      const q = search.toLowerCase().trim();
      const r = role.toLowerCase().trim();

      if (q) {
        list = list.filter(m =>
          (m.name && m.name.toLowerCase().includes(q)) ||
          (m.game && m.game.toLowerCase().includes(q)) ||
          (m.discord && m.discord.toLowerCase().includes(q))
        );
      }
      if (r && r !== 'all') {
        list = list.filter(m => m.role && m.role.toLowerCase() === r);
      }
      return list;
    }

    async addMember(member) {
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const res = await fetch(`${this.apiBase}/api/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(member)
          });
          const json = await res.json();
          if (json.success) return json.member;
        } catch (e) {
          console.warn('API add failed, saving to local storage', e);
        }
      }

      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '[]');
      const newMember = {
        ...member,
        id: Date.now(),
        status: member.status || 'Online',
        joined_at: new Date().toISOString()
      };
      list.unshift(newMember);
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(list));
      return newMember;
    }

    async deleteMember(id) {
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const res = await fetch(`${this.apiBase}/api/members/${id}`, { method: 'DELETE' });
          const json = await res.json();
          if (json.success) return true;
        } catch (e) {
          console.warn('API delete failed, updating local storage', e);
        }
      }

      let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '[]');
      list = list.filter(m => m.id !== id);
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(list));
      return true;
    }

    // Applications methods
    async getApplications() {
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const res = await fetch(`${this.apiBase}/api/applications`);
          const json = await res.json();
          if (json.success) return json.applications;
        } catch (e) {}
      }
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
    }

    async submitApplication(appData) {
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const res = await fetch(`${this.apiBase}/api/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData)
          });
          const json = await res.json();
          if (json.success) return { success: true, id: json.application_id };
        } catch (e) {}
      }

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
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const res = await fetch(`${this.apiBase}/api/applications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, addToMembers })
          });
          const json = await res.json();
          if (json.success) return true;
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
            status: 'Online',
            avatar: ''
          });
        }
        return true;
      }
      return false;
    }

    // Messages methods
    async getMessages() {
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const res = await fetch(`${this.apiBase}/api/messages`);
          const json = await res.json();
          if (json.success) return json.messages;
        } catch (e) {}
      }
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    }

    async submitMessage(msgData) {
      const hasApi = await this.checkApi();
      if (hasApi) {
        try {
          const res = await fetch(`${this.apiBase}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msgData)
          });
          const json = await res.json();
          if (json.success) return { success: true };
        } catch (e) {}
      }

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
      localStorage.removeItem(STORAGE_KEYS.MEMBERS);
      localStorage.removeItem(STORAGE_KEYS.APPLICATIONS);
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      this.initLocalStorage();
      try {
        await fetch(`${this.apiBase}/api/reset`, { method: 'POST' });
      } catch (e) {}
    }
  }

  window.ReaperzStore = new Store();
})(window);
