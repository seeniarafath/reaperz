/**
 * REAPERZ Community Portal - Admin Dashboard Controller
 * Full CRUD for Members, Applications Review & Approvals, and Message Logs.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. TABS SWITCHING ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.admin-panel-section');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      const targetSection = document.getElementById(targetId);
      if (targetSection) targetSection.classList.add('active');
    });
  });

  // --- 2. STATS REFRESH ---
  async function refreshStats() {
    try {
      const members = await window.ReaperzStore.getMembers();
      const applications = await window.ReaperzStore.getApplications();
      const messages = await window.ReaperzStore.getMessages();

      const totalMembersEl = document.getElementById('statTotalMembers');
      const onlineMembersEl = document.getElementById('statOnlineMembers');
      const pendingAppsEl = document.getElementById('statPendingApps');
      const totalMessagesEl = document.getElementById('statTotalMessages');

      if (totalMembersEl) totalMembersEl.textContent = members.length;
      if (onlineMembersEl) onlineMembersEl.textContent = members.filter(m => (m.status || '').toLowerCase() === 'online').length;
      if (pendingAppsEl) pendingAppsEl.textContent = applications.filter(a => a.status === 'Pending').length;
      if (totalMessagesEl) totalMessagesEl.textContent = messages.length;
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  }

  // --- 3. APPLICATIONS TABLE RENDER ---
  async function renderApplications() {
    const tbody = document.getElementById('applicationsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading applications...</td></tr>';

    try {
      const apps = await window.ReaperzStore.getApplications();
      if (!apps || apps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No applications found in queue.</td></tr>';
        return;
      }

      tbody.innerHTML = apps.map(app => {
        const statusClass = (app.status || 'Pending').toLowerCase();
        const dateStr = app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'N/A';

        return `
          <tr>
            <td><strong>${escapeHtml(app.name)}</strong><br><small style="color:var(--muted);">${escapeHtml(app.timezone || '')}</small></td>
            <td><code>${escapeHtml(app.discord)}</code></td>
            <td>${escapeHtml(app.age)} yrs</td>
            <td>${escapeHtml(app.game)}</td>
            <td><span class="role">${escapeHtml(app.role || 'Member')}</span></td>
            <td><span class="badge-status ${statusClass}">${escapeHtml(app.status)}</span></td>
            <td>
              <div class="action-btn-group">
                ${app.status === 'Pending' ? `
                  <button class="btn btn-sm btn-success" onclick="approveApplication(${app.id})">✓ Approve & Add</button>
                  <button class="btn btn-sm btn-danger" onclick="rejectApplication(${app.id})">✗ Reject</button>
                ` : `
                  <button class="btn btn-sm btn-outline" onclick="viewApplicationDetails(${app.id})">View Details</button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading applications:', err);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--red);">Error loading applications.</td></tr>';
    }
  }

  // --- 4. MEMBERS TABLE RENDER ---
  async function renderMembers() {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading members...</td></tr>';

    try {
      const members = await window.ReaperzStore.getMembers();
      if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No members found.</td></tr>';
        return;
      }

      tbody.innerHTML = members.map(m => {
        const isOnline = (m.status || 'Online').toLowerCase() === 'online';
        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <div class="avatar" style="width:36px; height:36px; font-size:14px; margin:0;">${m.name.charAt(0)}</div>
                <strong>${escapeHtml(m.name)}</strong>
              </div>
            </td>
            <td><span class="role">${escapeHtml(m.role || 'Member')}</span></td>
            <td>${escapeHtml(m.game || 'GTA V / FiveM')}</td>
            <td><code>${escapeHtml(m.discord || '—')}</code></td>
            <td>
              <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
              ${escapeHtml(m.status || 'Offline')}
            </td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-sm btn-danger" onclick="deleteMemberRow(${m.id}, '${escapeHtml(m.name)}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading members:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--red);">Error loading members.</td></tr>';
    }
  }

  // --- 5. CONTACT MESSAGES RENDER ---
  async function renderMessages() {
    const tbody = document.getElementById('messagesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading messages...</td></tr>';

    try {
      const msgs = await window.ReaperzStore.getMessages();
      if (!msgs || msgs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No messages received yet.</td></tr>';
        return;
      }

      tbody.innerHTML = msgs.map(m => `
        <tr>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td><a href="mailto:${escapeHtml(m.email)}" style="color:var(--blue2);">${escapeHtml(m.email)}</a></td>
          <td>${escapeHtml(m.subject || 'General')}</td>
          <td><div style="max-width:350px; white-space:pre-wrap;">${escapeHtml(m.message)}</div></td>
          <td><small style="color:var(--muted);">${m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : 'N/A'}</small></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error loading messages:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--red);">Error loading messages.</td></tr>';
    }
  }

  // --- 6. ADD MEMBER MODAL ---
  const addMemberModal = document.getElementById('addMemberModal');
  const openAddMemberBtn = document.getElementById('openAddMemberBtn');
  const closeAddMemberBtn = document.getElementById('closeAddMemberBtn');
  const addMemberForm = document.getElementById('addMemberForm');

  if (openAddMemberBtn && addMemberModal) {
    openAddMemberBtn.addEventListener('click', () => addMemberModal.classList.add('open'));
  }
  if (closeAddMemberBtn && addMemberModal) {
    closeAddMemberBtn.addEventListener('click', () => addMemberModal.classList.remove('open'));
  }

  if (addMemberForm) {
    addMemberForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(addMemberForm);
      const newMember = {
        name: formData.get('name'),
        role: formData.get('role'),
        game: formData.get('game') || 'GTA V / FiveM',
        discord: formData.get('discord') || '',
        status: formData.get('status') || 'Online',
        avatar: ''
      };

      try {
        await window.ReaperzStore.addMember(newMember);
        addMemberForm.reset();
        addMemberModal.classList.remove('open');
        if (window.showToast) window.showToast(`Added ${newMember.name} to members!`, 'success');
        await renderMembers();
        await refreshStats();
      } catch (err) {
        alert('Failed to add member: ' + err.message);
      }
    });
  }

  // Reset database button
  const resetBtn = document.getElementById('resetDbBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset the database to original seed data?')) {
        await window.ReaperzStore.resetAll();
        if (window.showToast) window.showToast('Database reset successfully!', 'success');
        refreshStats();
        renderMembers();
        renderApplications();
        renderMessages();
      }
    });
  }

  // Global window functions for table buttons
  window.approveApplication = async function (id) {
    if (confirm('Approve this application and add user directly to REAPERZ members list?')) {
      await window.ReaperzStore.updateApplicationStatus(id, 'Approved', true);
      if (window.showToast) window.showToast('Application Approved! Member added.', 'success');
      refreshStats();
      renderApplications();
      renderMembers();
    }
  };

  window.rejectApplication = async function (id) {
    if (confirm('Reject this application?')) {
      await window.ReaperzStore.updateApplicationStatus(id, 'Rejected', false);
      if (window.showToast) window.showToast('Application Rejected.', 'info');
      refreshStats();
      renderApplications();
    }
  };

  window.deleteMemberRow = async function (id, name) {
    if (confirm(`Are you sure you want to remove ${name} from the crew?`)) {
      await window.ReaperzStore.deleteMember(id);
      if (window.showToast) window.showToast(`Removed ${name}`, 'info');
      refreshStats();
      renderMembers();
    }
  };

  window.viewApplicationDetails = async function (id) {
    const apps = await window.ReaperzStore.getApplications();
    const app = apps.find(a => a.id === id);
    if (app) {
      alert(`Candidate: ${app.name}\nDiscord: ${app.discord}\nAge: ${app.age}\nRole: ${app.role}\nGame: ${app.game}\nTimezone: ${app.timezone}\nStatus: ${app.status}\n\nExperience:\n${app.about || 'None specified'}`);
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial runs
  refreshStats();
  renderApplications();
  renderMembers();
  renderMessages();
});
