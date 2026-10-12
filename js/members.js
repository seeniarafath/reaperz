/**
 * REAPERZ Community Portal - Members Directory
 * Dynamically renders members from ReaperzStore (API or LocalStorage)
 * Provides real-time search, category filtering, and status badges.
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
    return '';
  }

  function getAvatarHtml(member) {
    if (member.avatar && member.avatar.trim() !== '') {
      return `<img src="${encodeURI(member.avatar)}" alt="${encodeURIComponent(member.name)}" onerror="this.onerror=null; this.parentElement.innerHTML='${member.name.charAt(0).toUpperCase()}';">`;
    }
    return member.name ? member.name.charAt(0).toUpperCase() : 'R';
  }

  async function loadAndRender() {
    grid.innerHTML = '<div class="no-members">Loading community roster...</div>';

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
        const isOnline = (m.status || 'Online').toLowerCase() === 'online';
        const roleClass = getRoleBadgeClass(m.role);

        return `
          <article class="member" data-id="${m.id}">
            <div class="avatar">${getAvatarHtml(m)}</div>
            <h3>${escapeHtml(m.name)}</h3>
            <small>${escapeHtml(m.game || 'GTA V / FiveM')}</small>
            
            ${m.discord ? `<div class="member-discord">Discord: ${escapeHtml(m.discord)}</div>` : ''}

            <div class="member-status">
              <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
              ${escapeHtml(m.status || 'Offline')}
            </div>

            <span class="role ${roleClass}">${escapeHtml(m.role || 'Member')}</span>
          </article>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering members:', err);
      grid.innerHTML = '<div class="no-members">Unable to load members. Please try again.</div>';
    }
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
