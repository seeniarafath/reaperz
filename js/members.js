/**
 * ====================================================================
 *   REAPERZ Community Portal - Members Directory Controller
 *   Directly connected to SQL Database via ReaperzStore.
 *   Provides real-time search, role filter, status filter,
 *   live Discord presence integration (Online, Idle, DND, Offline),
 *   and Discord avatar image rendering.
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('membersGrid');
  const searchInput = document.getElementById('memberSearch');
  const roleFilter = document.getElementById('roleFilter');

  if (!grid) return;

  function getRoleBadgeClass(role) {
    const r = (role || '').toLowerCase();
    if (r === 'founder' || r === 'owner') return 'founder';
    if (r === 'admin') return 'admin';
    if (r === 'moderator' || r === 'mod') return 'moderator';
    return 'member';
  }

  function getStatusMeta(status) {
    const s = (status || 'Offline').toLowerCase();
    if (s === 'online') {
      return { label: 'Online', dotClass: 'online', color: 'var(--green)' };
    }
    if (s === 'idle') {
      return { label: 'Idle', dotClass: 'idle', color: 'var(--gold)' };
    }
    if (s.includes('disturb') || s === 'dnd') {
      return { label: 'Do Not Disturb', dotClass: 'dnd', color: 'var(--red)' };
    }
    return { label: 'Offline', dotClass: 'offline', color: '#556274' };
  }

  function getAvatarSrc(member) {
    if (member.avatar && member.avatar.trim() !== '') {
      return member.avatar;
    }
    if (member.discord_id && /^\d{17,20}$/.test(member.discord_id)) {
      try {
        const idx = Number((BigInt(member.discord_id) >> 22n) % 6n);
        return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
      } catch (e) {}
    }
    return '';
  }

  function renderAvatarHtml(member) {
    const src = getAvatarSrc(member);
    const initial = escapeHtml(member.name ? member.name.charAt(0).toUpperCase() : 'R');

    if (src) {
      return `
        <img class="member-avatar-img"
             src="${escapeHtml(src)}"
             alt="${escapeHtml(member.name)}"
             loading="lazy"
             onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="member-avatar-fallback" style="display:none;">${initial}</div>
      `;
    }
    return `<div class="member-avatar-fallback">${initial}</div>`;
  }

  async function loadAndRender() {
    grid.innerHTML = '<div class="no-members">Loading community roster from database...</div>';

    const q = searchInput ? searchInput.value.trim() : '';
    const r = roleFilter ? roleFilter.value : '';

    try {
      const members = await window.ReaperzStore.getMembers(q, r);

      if (!members || members.length === 0) {
        grid.innerHTML = `
          <div class="no-members">
            <p>No members found matching "<strong>${escapeHtml(q || r)}</strong>".</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = members.map(m => {
        const rawStatus = m.status || m.discord_status || 'Offline';
        const meta = getStatusMeta(rawStatus);
        const roleClass = getRoleBadgeClass(m.role);

        return `
          <article class="member" data-id="${m.id}" data-discord-id="${escapeHtml(m.discord_id || '')}">
            <div class="avatar">
              ${renderAvatarHtml(m)}
            </div>
            <h3>${escapeHtml(m.name)}</h3>
            <small>${escapeHtml(m.game || 'GTA V / FiveM')}</small>
            ${m.discord ? `<div class="member-discord">Discord: ${escapeHtml(m.discord)}</div>` : ''}

            <div class="member-status" title="Current Discord Status">
              <span class="status-dot ${meta.dotClass}"></span>
              <span class="status-label">${escapeHtml(rawStatus)}</span>
            </div>
            <span class="role ${roleClass}">${escapeHtml(m.role || 'Member')}</span>
          </article>
        `;
      }).join('');

      // Background Discord live presence enrichment
      enrichLiveDiscordStatuses(members);

    } catch (err) {
      console.error('Error rendering members:', err);
      grid.innerHTML = '<div class="no-members">Unable to connect to members database. Please ensure backend server is running.</div>';
    }
  }

  // --- BACKGROUND LIVE DISCORD ENRICHMENT ---
  function enrichLiveDiscordStatuses(members) {
    members.forEach(async (m) => {
      if (!m.discord_id || !/^\d{17,20}$/.test(m.discord_id)) return;

      try {
        const presence = await window.ReaperzStore.getDiscordPresence(m.discord_id, m.id);
        if (presence && presence.success) {
          const card = grid.querySelector(`article[data-id="${m.id}"]`);
          if (!card) return;

          const dot = card.querySelector('.status-dot');
          const label = card.querySelector('.status-label');
          const avatarImg = card.querySelector('.member-avatar-img');

          if (presence.status) {
            const meta = getStatusMeta(presence.status);
            if (dot) {
              dot.className = `status-dot ${meta.dotClass}`;
            }
            if (label) {
              label.textContent = meta.label;
            }
          }

          if (presence.avatar && avatarImg) {
            avatarImg.src = presence.avatar;
            avatarImg.style.display = 'block';
          }
        }
      } catch (e) {}
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event Listeners
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadAndRender, 200);
    });
  }

  if (roleFilter) {
    roleFilter.addEventListener('change', loadAndRender);
  }

  // Initial load
  loadAndRender();
});
