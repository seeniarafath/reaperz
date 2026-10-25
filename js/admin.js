/**
 * ====================================================================
 *   REAPERZ Community Portal - Staff Dashboard Controller
 *   Secure management of Members, Media Uploads, Join Applications,
 *   Community Reviews, and System Settings.
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const staffGate = document.getElementById('staffGateOverlay');
  const staffLoginForm = document.getElementById('staffLoginForm');
  const staffLoginError = document.getElementById('staffLoginError');
  const sessionChipContainer = document.getElementById('staffSessionChipContainer');
  const sessionChip = document.getElementById('staffSessionChip');
  const logoutBtn = document.getElementById('staffLogoutBtn');

  // --- 1. STAFF AUTHENTICATION & ACCESS GATE ---
  function updateStaffUI(session) {
    if (!session || (session.role !== 'Founder' && session.role !== 'Admin')) {
      if (staffGate) staffGate.classList.add('active');
      if (sessionChipContainer) sessionChipContainer.style.display = 'none';
      return false;
    }

    if (staffGate) staffGate.classList.remove('active');
    if (sessionChipContainer) sessionChipContainer.style.display = 'flex';
    if (sessionChip) {
      sessionChip.textContent = session.role === 'Founder'
        ? `👑 FOUNDER: ${session.name}`
        : `🛡️ ADMIN: ${session.name}`;
      sessionChip.className = `staff-session-chip ${session.role.toLowerCase()}`;
    }
    return true;
  }

  async function checkStaffAuth() {
    const isValid = await window.ReaperzStore.verifyStaffSession();
    if (isValid) {
      const session = window.ReaperzStore.getStaffSession();
      updateStaffUI(session);
      loadAllDashboardData();
      loadDiscordInviteSetting();
      return true;
    } else {
      window.ReaperzStore.clearStaffSession();
      updateStaffUI(null);
      return false;
    }

  }

  const discordInviteForm = document.getElementById('discordInviteForm');
  const discordInviteInput = document.getElementById('discordInviteInput');
  const discordInviteMessage = document.getElementById('discordInviteMessage');

  async function loadDiscordInviteSetting() {
    if (!discordInviteInput) return;
    try {
      const settings = await window.ReaperzStore.getSettings();
      discordInviteInput.value = settings.discord_invite || '';
    } catch (error) {
      if (discordInviteMessage) {
        discordInviteMessage.textContent = `Could not load settings: ${error.message}`;
        discordInviteMessage.className = 'form-message error';
      }
    }
  }

  discordInviteForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!discordInviteInput || !discordInviteMessage) return;
    let invite;
    try {
      invite = new URL(discordInviteInput.value.trim());
    } catch {
      discordInviteMessage.textContent = 'Enter a valid HTTPS Discord invite URL.';
      discordInviteMessage.className = 'form-message error';
      return;
    }
    const isDiscordInvite = invite.protocol === 'https:' &&
      (invite.hostname === 'discord.gg' ||
       (invite.hostname === 'discord.com' && invite.pathname.startsWith('/invite/')));
    if (!isDiscordInvite) {
      discordInviteMessage.textContent = 'Use an HTTPS discord.gg or discord.com/invite URL.';
      discordInviteMessage.className = 'form-message error';
      return;
    }
    try {
      await window.ReaperzStore.updateSetting('discord_invite', invite.href);
      discordInviteMessage.textContent = 'Discord invite saved.';
      discordInviteMessage.className = 'form-message success';
    } catch (error) {
      discordInviteMessage.textContent = `Could not save invite: ${error.message}`;
      discordInviteMessage.className = 'form-message error';
    }
  });

  if (staffLoginForm) {
    staffLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('staffLoginUsername').value;
      const key = document.getElementById('staffLoginKey').value;

      if (staffLoginError) {
        staffLoginError.textContent = 'Verifying credentials...';
        staffLoginError.style.color = 'var(--blue2)';
      }

      const res = await window.ReaperzStore.loginStaff(username, key);
      if (res && res.success) {
        if (staffLoginError) staffLoginError.textContent = '';
        staffLoginForm.reset();
        updateStaffUI(res.user);
        if (window.showToast) window.showToast(`Welcome back, ${res.name || res.user.name}!`, 'success');
        loadAllDashboardData();
        loadDiscordInviteSetting();
      } else {
        if (staffLoginError) {
          staffLoginError.textContent = '✗ ' + (res.message || 'Incorrect staff credentials.');
          staffLoginError.style.color = 'var(--red)';
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.ReaperzStore.logoutStaff();
      updateStaffUI(null);
      if (window.showToast) window.showToast('Logged out of Staff Portal.', 'info');
    });
  }

  // --- 2. TABS SWITCHING ---
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

      // Refresh specific tab data on open
      if (targetId === 'tab-library') renderLibraryMedia();
      if (targetId === 'tab-members') renderMembers();
      if (targetId === 'tab-applications') renderApplications();
      if (targetId === 'tab-ratings') renderRatings();
      if (targetId === 'tab-messages') renderMessages();
      if (targetId === 'tab-platforms') renderGamingPlatforms();
      if (targetId === 'tab-highlights') renderManagedContent('highlights');
      if (targetId === 'tab-events') renderManagedContent('events');
    });
  });

  // --- 3. OVERALL DASHBOARD DATA LOADER ---
  function loadAllDashboardData() {
    refreshStats();
    renderApplications();
    renderMembers();
    renderLibraryMedia();
    renderRatings();
    renderMessages();
    renderGamingPlatforms();
    renderManagedContent('highlights');
    renderManagedContent('events');
  }

  // --- GAMING PLATFORMS MANAGEMENT ---
  const gamingPlatformModal = document.getElementById('gamingPlatformModal');
  const gamingPlatformForm = document.getElementById('gamingPlatformForm');
  const gamingPlatformFormMessage = document.getElementById('gamingPlatformFormMessage');
  const gamingCrewList = document.getElementById('gamingCrewList');
  const gamingServerList = document.getElementById('gamingServerList');
  let gamingPlatformsCache = [];

  async function renderGamingPlatforms() {
    if (!gamingCrewList || !gamingServerList) return;
    gamingCrewList.innerHTML = '<p class="platform-loading">Loading crew...</p>';
    gamingServerList.innerHTML = '<p class="platform-loading">Loading servers...</p>';

    try {
      gamingPlatformsCache = await window.ReaperzStore.getGamingPlatforms(true);
      renderGamingPlatformList(
        gamingCrewList,
        gamingPlatformsCache.filter(platform => platform.type === 'gta_online'),
        'No GTA V Online crew entry exists. Add one to display the crew on Home.'
      );
      renderGamingPlatformList(
        gamingServerList,
        gamingPlatformsCache.filter(platform => platform.type === 'fivem'),
        'No FiveM servers have been added yet.'
      );
    } catch (error) {
      console.error('Error loading gaming platforms:', error);
      const errorHtml = `<p class="platform-error">Could not load platform records: ${escapeHtml(error.message)}</p>`;
      gamingCrewList.innerHTML = errorHtml;
      gamingServerList.innerHTML = errorHtml;
    }
  }

  function renderGamingPlatformList(container, platforms, emptyMessage) {
    if (!platforms.length) {
      container.innerHTML = `<p class="platform-empty">${escapeHtml(emptyMessage)}</p>`;
      return;
    }

    container.innerHTML = platforms.map(platform => `
      <article class="gaming-admin-card" data-platform-id="${platform.id}">
        ${platform.image_url ? `<img src="${escapeHtml(platform.image_url)}" alt="" loading="lazy">` : ''}
        <div class="gaming-admin-card-content">
          <div class="gaming-admin-card-heading">
            <h5>${escapeHtml(platform.name)}</h5>
            <span class="badge-status ${platform.is_published ? 'approved' : 'rejected'}">
              ${platform.is_published ? 'Published' : 'Hidden'}
            </span>
          </div>
          <p><strong>Status:</strong> ${escapeHtml(platform.status || 'Active')} <span class="gaming-order-label">Order ${Number(platform.display_order) || 0}</span></p>
          ${platform.description ? `<p>${escapeHtml(platform.description)}</p>` : ''}
          ${platform.link ? `<p class="gaming-admin-link">${escapeHtml(platform.link)}</p>` : ''}
        </div>
        <div class="gaming-admin-actions">
          <button type="button" class="btn btn-outline btn-sm" data-platform-action="edit" data-platform-id="${platform.id}">Edit</button>
          <button type="button" class="btn btn-outline btn-sm" data-platform-action="toggle" data-platform-id="${platform.id}">
            ${platform.is_published ? 'Hide' : 'Publish'}
          </button>
          <button type="button" class="btn btn-danger btn-sm" data-platform-action="delete" data-platform-id="${platform.id}">Delete</button>
        </div>
      </article>
    `).join('');
  }

  function openGamingPlatformModal(type, platform = null) {
    if (!gamingPlatformModal || !gamingPlatformForm) return;
    gamingPlatformForm.reset();
    document.getElementById('gamingPlatformId').value = platform ? platform.id : '';
    document.getElementById('gamingPlatformType').value = type;
    document.getElementById('gamingPlatformModalTitle').textContent = platform
      ? `Edit ${type === 'fivem' ? 'FiveM Server' : 'GTA V Online Crew'}`
      : `Add ${type === 'fivem' ? 'FiveM Server' : 'GTA V Online Crew'}`;
    document.getElementById('gamingPlatformNameLabel').textContent = type === 'fivem' ? 'Server Name' : 'Crew Name';
    document.getElementById('gamingPlatformName').value = platform ? platform.name : '';
    document.getElementById('gamingPlatformDescription').value = platform ? platform.description || '' : '';
    document.getElementById('gamingPlatformImage').value = platform ? platform.image_url || '' : '';
    document.getElementById('gamingPlatformLink').value = platform ? platform.link || '' : '';
    document.getElementById('gamingPlatformStatus').value = platform ? platform.status || 'Active' : 'Active';
    const nextOrder = gamingPlatformsCache
      .filter(item => item.type === type)
      .reduce((max, item) => Math.max(max, Number(item.display_order) || 0), 0) + 1;
    document.getElementById('gamingPlatformOrder').value = platform ? Number(platform.display_order) || 0 : nextOrder;
    document.getElementById('gamingPlatformPublished').checked = platform ? Boolean(platform.is_published) : true;
    gamingPlatformFormMessage.textContent = '';
    gamingPlatformModal.classList.add('open');
    gamingPlatformModal.setAttribute('aria-hidden', 'false');
    document.getElementById('gamingPlatformName').focus();
  }

  function closeGamingPlatformModal() {
    if (!gamingPlatformModal) return;
    gamingPlatformModal.classList.remove('open');
    gamingPlatformModal.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('addCrewPlatformBtn')?.addEventListener('click', () => openGamingPlatformModal('gta_online'));
  document.getElementById('addFiveMPlatformBtn')?.addEventListener('click', () => openGamingPlatformModal('fivem'));
  document.getElementById('closeGamingPlatformModalBtn')?.addEventListener('click', closeGamingPlatformModal);
  document.getElementById('cancelGamingPlatformBtn')?.addEventListener('click', closeGamingPlatformModal);

  if (gamingPlatformModal) {
    gamingPlatformModal.addEventListener('click', event => {
      if (event.target === gamingPlatformModal) closeGamingPlatformModal();
    });
  }

  if (gamingPlatformForm) {
    gamingPlatformForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(gamingPlatformForm);
      const id = formData.get('id');
      const platformData = {
        type: formData.get('type'),
        name: String(formData.get('name') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        image_url: String(formData.get('image_url') || '').trim(),
        link: String(formData.get('link') || '').trim(),
        status: formData.get('status'),
        display_order: Number(formData.get('display_order')),
        is_published: document.getElementById('gamingPlatformPublished').checked
      };
      const submitButton = gamingPlatformForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;

      try {
        if (id) {
          await window.ReaperzStore.updateGamingPlatform(id, platformData);
        } else {
          await window.ReaperzStore.addGamingPlatform(platformData);
        }
        closeGamingPlatformModal();
        await renderGamingPlatforms();
        if (window.showToast) window.showToast('Gaming platform saved to the database.', 'success');
      } catch (error) {
        gamingPlatformFormMessage.textContent = error.message;
        gamingPlatformFormMessage.className = 'form-message error';
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  [gamingCrewList, gamingServerList].forEach(container => {
    if (!container) return;
    container.addEventListener('click', async event => {
      const button = event.target.closest('[data-platform-action]');
      if (!button) return;
      const platform = gamingPlatformsCache.find(item => item.id === Number(button.dataset.platformId));
      if (!platform) return;

      if (button.dataset.platformAction === 'edit') {
        openGamingPlatformModal(platform.type, platform);
        return;
      }

      try {
        if (button.dataset.platformAction === 'toggle') {
          await window.ReaperzStore.updateGamingPlatform(platform.id, { is_published: !platform.is_published });
        } else if (button.dataset.platformAction === 'delete') {
          if (!confirm(`Delete "${platform.name}" permanently?`)) return;
          await window.ReaperzStore.deleteGamingPlatform(platform.id);
        }
        await renderGamingPlatforms();
        if (window.showToast) window.showToast('Gaming platform updated.', 'success');
      } catch (error) {
        alert(`Could not update gaming platform: ${error.message}`);
      }
    });
  });

  // --- COMMUNITY HIGHLIGHTS AND EVENTS MANAGEMENT ---
  const managedContentLists = {
    highlights: document.getElementById('adminHighlightsList'),
    events: document.getElementById('adminEventsList')
  };
  const contentEditorModal = document.getElementById('contentEditorModal');
  const contentEditorForm = document.getElementById('contentEditorForm');
  let managedContentCache = { highlights: [], events: [] };
  let selectedContentImage = null;

  async function renderManagedContent(kind) {
    const container = managedContentLists[kind];
    if (!container) return;
    container.innerHTML = '<p class="platform-loading">Loading...</p>';
    try {
      const records = kind === 'highlights'
        ? await window.ReaperzStore.getHighlights(true)
        : await window.ReaperzStore.getEvents(true);
      managedContentCache[kind] = records;
      container.innerHTML = records.length ? records.map(record => `
        <article class="content-admin-card">
          ${record.image_url ? `<img src="${escapeHtml(record.image_url)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='assets/images/gallery-1.jpg';">` : ''}
          <div class="content-admin-card-body">
            <div class="gaming-admin-card-heading">
              <h4>${escapeHtml(record.title)}</h4>
              <span class="badge-status ${record.is_published ? 'approved' : 'rejected'}">${record.is_published ? 'Published' : 'Hidden'}</span>
            </div>
            <p>${escapeHtml(kind === 'events' ? `${record.event_date || 'No date'} · ${record.event_time || 'No time'} · ${record.status || 'Upcoming'} · ${record.category || 'Community Event'} · Order ${Number(record.display_order) || 0}` : `${record.event_date || 'No date'} · Order ${Number(record.display_order) || 0}`)}</p>
            ${kind === 'events' && record.prize ? `<p>Prize: ${escapeHtml(record.prize)}</p>` : ''}
            ${record.description ? `<p>${escapeHtml(record.description)}</p>` : ''}
          </div>
          <div class="gaming-admin-actions">
            <button type="button" class="btn btn-outline btn-sm" data-content-action="edit" data-content-kind="${kind}" data-content-id="${record.id}">Edit</button>
            <button type="button" class="btn btn-outline btn-sm" data-content-action="toggle" data-content-kind="${kind}" data-content-id="${record.id}">${record.is_published ? 'Hide' : 'Publish'}</button>
            <button type="button" class="btn btn-danger btn-sm" data-content-action="delete" data-content-kind="${kind}" data-content-id="${record.id}">Delete</button>
          </div>
        </article>`).join('') : `<p class="platform-empty">No ${kind} have been created.</p>`;
    } catch (error) {
      console.error(`Error loading ${kind}:`, error);
      container.innerHTML = `<p class="platform-error">Could not load ${kind}: ${escapeHtml(error.message)}</p>`;
    }
  }

  function openContentEditor(kind, record = null) {
    if (!contentEditorModal || !contentEditorForm) return;
    contentEditorForm.reset();
    selectedContentImage = null;
    document.getElementById('contentImageFile').value = '';
    document.getElementById('contentImagePreviewWrap').hidden = !record?.image_url;
    document.getElementById('contentImagePreview').src = record?.image_url || '';
    document.getElementById('contentEditorId').value = record ? record.id : '';
    document.getElementById('contentEditorKind').value = kind;
    document.getElementById('contentEditorTitle').textContent = `${record ? 'Edit' : 'Add'} ${kind === 'events' ? 'Event' : 'Community Highlight'}`;
    document.getElementById('contentTitle').value = record?.title || '';
    document.getElementById('contentDescription').value = record?.description || '';
    document.getElementById('contentDescription').required = kind === 'events';
    document.getElementById('contentImageUrl').value = record?.image_url || '';
    document.getElementById('eventFields').hidden = kind !== 'events';
    document.getElementById('highlightFields').hidden = kind !== 'highlights';
    document.getElementById('contentEventDate').required = kind === 'events';
    document.getElementById('contentEventTime').required = false;
    if (kind === 'events') {
      document.getElementById('contentEventDate').value = record?.event_date || '';
      document.getElementById('contentEventTime').value = record?.event_time || '';
    document.getElementById('contentEventCategory').value = record?.category || '';
    document.getElementById('contentEventPrize').value = record?.prize || '';
    document.getElementById('contentEventButtonText').value = record?.button_text || '';
    const nextEventOrder = managedContentCache.events.reduce((max, item) => Math.max(max, Number(item.display_order) || 0), 0) + 1;
    document.getElementById('contentEventOrder').value = record ? Number(record.display_order) || 0 : nextEventOrder;
    document.getElementById('contentEventLocation').value = record?.location || '';
    document.getElementById('contentEventOrganizer').value = record?.organizer || '';
    document.getElementById('contentEventLink').value = record?.discord_link || '';
    const eventStatus = String(record?.status || 'Upcoming').toLowerCase();
    document.getElementById('contentEventStatus').value = ['past', 'completed', 'complete'].includes(eventStatus)
      ? 'Completed'
      : ['live', 'active', 'ongoing'].includes(eventStatus) ? 'Active' : 'Upcoming';
    } else {
      document.getElementById('contentHighlightDate').value = record?.event_date || '';
      const nextOrder = managedContentCache.highlights.reduce((max, item) => Math.max(max, Number(item.display_order) || 0), 0) + 1;
      document.getElementById('contentDisplayOrder').value = record ? Number(record.display_order) || 0 : nextOrder;
    }
    document.getElementById('contentPublished').checked = record ? Boolean(record.is_published) : true;
    document.getElementById('contentEditorMessage').textContent = '';
    contentEditorModal.classList.add('open');
    contentEditorModal.setAttribute('aria-hidden', 'false');
  }

  function closeContentEditor() {
    contentEditorModal?.classList.remove('open');
    contentEditorModal?.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('addHighlightBtn')?.addEventListener('click', () => openContentEditor('highlights'));
  document.getElementById('addEventBtn')?.addEventListener('click', () => openContentEditor('events'));
  document.getElementById('closeContentEditorBtn')?.addEventListener('click', closeContentEditor);
  document.getElementById('cancelContentEditorBtn')?.addEventListener('click', closeContentEditor);
  contentEditorModal?.addEventListener('click', event => {
    if (event.target === contentEditorModal) closeContentEditor();
  });

  document.getElementById('contentImageFile')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      event.target.value = '';
      document.getElementById('contentEditorMessage').textContent = 'Choose a JPG, PNG, WEBP, or GIF image.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      event.target.value = '';
      document.getElementById('contentEditorMessage').textContent = 'Image must be 10MB or smaller.';
      return;
    }
    selectedContentImage = file;
    const preview = document.getElementById('contentImagePreview');
    preview.src = URL.createObjectURL(file);
    document.getElementById('contentImagePreviewWrap').hidden = false;
  });

  contentEditorForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const kind = document.getElementById('contentEditorKind').value;
    const id = document.getElementById('contentEditorId').value;
    const formData = new FormData(contentEditorForm);
    const saveButton = document.getElementById('saveContentBtn');
    const message = document.getElementById('contentEditorMessage');
    saveButton.disabled = true;
    message.textContent = '';
    try {
      let image_url = String(formData.get('image_url') || '').trim();
      if (selectedContentImage) {
        const fileData = await readImageAsDataUrl(selectedContentImage);
        const uploaded = await window.ReaperzStore.uploadEventImage(fileData, selectedContentImage.name);
        image_url = uploaded.file_path;
      }
      const is_published = document.getElementById('contentPublished').checked;
      if (kind === 'highlights') {
        const data = {
          title: String(formData.get('title') || '').trim(),
          description: String(formData.get('description') || '').trim(),
          image_url,
          event_date: document.getElementById('contentHighlightDate').value,
          display_order: Number(document.getElementById('contentDisplayOrder').value),
          is_published
        };
        if (id) await window.ReaperzStore.updateHighlight(id, data);
        else await window.ReaperzStore.addHighlight(data);
      } else {
        const data = {
          title: String(formData.get('title') || '').trim(),
          description: String(formData.get('description') || '').trim(),
          image_url,
          event_date: document.getElementById('contentEventDate').value,
          event_time: document.getElementById('contentEventTime').value,
          category: document.getElementById('contentEventCategory').value.trim(),
          prize: document.getElementById('contentEventPrize').value.trim(),
          button_text: document.getElementById('contentEventButtonText').value.trim(),
          display_order: Number(document.getElementById('contentEventOrder').value),
          location: document.getElementById('contentEventLocation').value.trim(),
          organizer: document.getElementById('contentEventOrganizer').value.trim(),
          discord_link: document.getElementById('contentEventLink').value.trim(),
          status: document.getElementById('contentEventStatus').value,
          is_published
        };
        if (id) await window.ReaperzStore.updateEvent(id, data);
        else await window.ReaperzStore.addEvent(data);
      }
      closeContentEditor();
      await renderManagedContent(kind);
      if (window.showToast) window.showToast(`${kind === 'events' ? 'Event' : 'Highlight'} saved.`, 'success');
    } catch (error) {
      message.textContent = error.message;
      message.className = 'form-message error';
    } finally {
      saveButton.disabled = false;
    }
  });

  [managedContentLists.highlights, managedContentLists.events].forEach(container => {
    container?.addEventListener('click', async event => {
      const button = event.target.closest('[data-content-action]');
      if (!button) return;
      const { contentAction, contentKind, contentId } = button.dataset;
      const record = managedContentCache[contentKind].find(item => item.id === Number(contentId));
      if (!record) return;
      try {
        if (contentAction === 'edit') {
          openContentEditor(contentKind, record);
          return;
        }
        if (contentAction === 'delete') {
          if (!confirm(`Delete "${record.title}" permanently?`)) return;
          if (contentKind === 'events') await window.ReaperzStore.deleteEvent(record.id);
          else await window.ReaperzStore.deleteHighlight(record.id);
        } else if (contentKind === 'events') {
          await window.ReaperzStore.updateEvent(record.id, { is_published: !record.is_published });
        } else {
          await window.ReaperzStore.updateHighlight(record.id, { is_published: !record.is_published });
        }
        await renderManagedContent(contentKind);
        if (window.showToast) window.showToast('Changes saved.', 'success');
      } catch (error) {
        alert(`Could not update ${contentKind}: ${error.message}`);
      }
    });
  });

  function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read selected image.'));
      reader.readAsDataURL(file);
    });
  }

  async function refreshStats() {
    try {
      const members = await window.ReaperzStore.getMembers();
      const applications = await window.ReaperzStore.getApplications();
      const messages = await window.ReaperzStore.getMessages();
      const ratingsData = await window.ReaperzStore.getRatings();
      const libraryData = await window.ReaperzStore.getLibraryMedia();

      const totalMembersEl = document.getElementById('statTotalMembers');
      const onlineMembersEl = document.getElementById('statOnlineMembers');
      const pendingAppsEl = document.getElementById('statPendingApps');
      const totalMediaEl = document.getElementById('statTotalMedia');
      const totalRatingsEl = document.getElementById('statTotalRatings');
      const totalMessagesEl = document.getElementById('statTotalMessages');

      if (totalMembersEl) totalMembersEl.textContent = members.length;
      if (onlineMembersEl) onlineMembersEl.textContent = members.filter(m => (m.status || m.discord_status || '').toLowerCase() === 'online').length;
      if (pendingAppsEl) pendingAppsEl.textContent = applications.filter(a => a.status === 'Pending').length;
      if (totalMediaEl) totalMediaEl.textContent = libraryData.total || (libraryData.media && libraryData.media.length) || 0;
      if (totalRatingsEl) totalRatingsEl.textContent = ratingsData.total || (ratingsData.ratings && ratingsData.ratings.length) || 0;
      if (totalMessagesEl) totalMessagesEl.textContent = messages.length;
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  }

  // --- 4. MEDIA LIBRARY MANAGEMENT & IMAGE UPLOAD ---
  let selectedFileBase64 = '';
  let selectedFileName = '';

  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('uploadFileInput');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const dropzonePreview = document.getElementById('dropzonePreview');
  const previewImg = document.getElementById('previewImg');
  const previewFilename = document.getElementById('previewFilename');
  const previewFilesize = document.getElementById('previewFilesize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const mediaUploadForm = document.getElementById('mediaUploadForm');
  const uploadMsg = document.getElementById('uploadMessage');
  const submitUploadBtn = document.getElementById('submitUploadBtn');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== removeFileBtn) {
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelection(fileInput.files[0]);
      }
    });
  }

  function handleFileSelection(file) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      showUploadError('Invalid file type. Please choose a JPG, PNG, WEBP, or GIF image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showUploadError('File is too large. Maximum size is 10MB.');
      return;
    }

    selectedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedFileBase64 = e.target.result;
      if (previewImg) previewImg.src = selectedFileBase64;
      if (previewFilename) previewFilename.textContent = file.name;
      if (previewFilesize) previewFilesize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

      if (dropzonePrompt) dropzonePrompt.style.display = 'none';
      if (dropzonePreview) dropzonePreview.style.display = 'flex';
      if (uploadMsg) uploadMsg.textContent = '';
    };
    reader.readAsDataURL(file);
  }

  function resetFileSelection() {
    selectedFileBase64 = '';
    selectedFileName = '';
    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (dropzonePrompt) dropzonePrompt.style.display = 'block';
    if (dropzonePreview) dropzonePreview.style.display = 'none';
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetFileSelection();
    });
  }

  function showUploadError(msg) {
    if (uploadMsg) {
      uploadMsg.innerHTML = `<span style="color:var(--red);">✗ ${escapeHtml(msg)}</span>`;
      uploadMsg.className = 'form-message error';
    }
    if (window.showToast) window.showToast(msg, 'error');
  }

  if (mediaUploadForm) {
    mediaUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const titleInput = document.getElementById('uploadTitle');
      const catSelect = document.getElementById('uploadCategory');
      const descInput = document.getElementById('uploadDescription');

      const title = titleInput ? titleInput.value.trim() : '';
      const category = catSelect ? catSelect.value : 'General';
      const description = descInput ? descInput.value.trim() : '';

      if (!title) {
        showUploadError('Please enter a title for the media capture.');
        if (titleInput) titleInput.focus();
        return;
      }

      if (!selectedFileBase64) {
        showUploadError('Please select or drop an image file to upload.');
        return;
      }

      if (submitUploadBtn) {
        submitUploadBtn.disabled = true;
        submitUploadBtn.textContent = 'UPLOADING TO LIBRARY...';
      }

      if (uploadMsg) {
        uploadMsg.innerHTML = '<span style="color:var(--blue2);">Uploading image to server storage...</span>';
        uploadMsg.className = 'form-message';
      }

      try {
        const payload = {
          title,
          category,
          description,
          filename: selectedFileName,
          file_data: selectedFileBase64
        };

        const result = await window.ReaperzStore.uploadLibraryMedia(payload);

        if (result && result.success) {
          mediaUploadForm.reset();
          resetFileSelection();

          if (uploadMsg) {
            uploadMsg.innerHTML = `
              <div style="color:var(--green); font-weight:700; margin-top:10px;">
                ✓ Image uploaded successfully! It is now live in the Library.
              </div>
            `;
            uploadMsg.className = 'form-message success';
          }

          if (window.showToast) window.showToast('Image uploaded to Library!', 'success');
          renderLibraryMedia();
          refreshStats();
        } else {
          throw new Error((result && result.message) || 'Upload failed.');
        }
      } catch (err) {
        console.error('Upload error:', err);
        showUploadError(err.message || 'Failed to upload image. Please try again.');
      } finally {
        if (submitUploadBtn) {
          submitUploadBtn.disabled = false;
          submitUploadBtn.textContent = 'UPLOAD TO LIBRARY';
        }
      }
    });
  }

  async function renderLibraryMedia() {
    const tbody = document.getElementById('libraryTableBody');
    const badge = document.getElementById('mediaCountBadge');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading media vault...</td></tr>';

    try {
      const data = await window.ReaperzStore.getLibraryMedia('All', '');
      const media = data.media || [];

      if (badge) badge.textContent = `${media.length} items in library`;

      if (media.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">No images in the library. Use the upload form above to add screenshots.</td></tr>';
        return;
      }

      tbody.innerHTML = media.map(m => {
        const dateStr = m.uploaded_at ? new Date(m.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Official';
        return `
          <tr>
            <td>
              <a href="${escapeHtml(m.file_path)}" target="_blank" title="View Full Image">
                <img class="media-table-thumb" src="${escapeHtml(m.file_path)}" alt="${escapeHtml(m.title)}" onerror="this.src='assets/images/gallery-1.jpg';">
              </a>
            </td>
            <td>
              <strong style="color:#fff;">${escapeHtml(m.title)}</strong>
              ${m.description ? `<p style="color:var(--muted); font-size:12px; margin-top:2px;">${escapeHtml(m.description)}</p>` : ''}
            </td>
            <td>
              <span class="media-cat-pill">${escapeHtml(m.category || 'General')}</span>
            </td>
            <td>${escapeHtml(m.uploaded_by || 'Staff')}</td>
            <td style="font-size:12px; color:var(--muted);">${dateStr}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-danger btn-sm" onclick="window.handleDeleteMedia(${m.id}, '${escapeHtml(m.title)}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering media table:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--red);">Error loading library media.</td></tr>';
    }
  }

  window.handleDeleteMedia = async function (id, title) {
    if (!confirm(`Are you sure you want to permanently delete "${title}" from the media library?`)) {
      return;
    }

    try {
      const res = await window.ReaperzStore.deleteLibraryMedia(id);
      if (res) {
        if (window.showToast) window.showToast('Image deleted from library.', 'info');
        renderLibraryMedia();
        refreshStats();
      }
    } catch (err) {
      alert('Could not delete image: ' + err.message);
    }
  };

  // --- 5. MEMBERS MANAGEMENT & ROLE SELECTOR ---
  async function renderMembers() {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading members...</td></tr>';

    try {
      const session = window.ReaperzStore.getStaffSession();
      const callerRole = session ? session.role : 'Founder';
      const isFounder = callerRole === 'Founder';

      const search = document.getElementById('adminMemberSearch')?.value.trim() || '';
      const roleFilter = document.getElementById('adminMemberRoleFilter')?.value || '';
      const departmentFilter = document.getElementById('adminMemberDepartmentFilter')?.value || '';
      const statusFilter = document.getElementById('adminMemberStatusFilter')?.value || '';
      const [members, allMembers] = await Promise.all([
        window.ReaperzStore.getMembers(search, roleFilter, departmentFilter, statusFilter),
        window.ReaperzStore.getMembers()
      ]);
      const departmentSelect = document.getElementById('adminMemberDepartmentFilter');
      if (departmentSelect) {
        const selectedDepartment = departmentFilter;
        const departments = [...new Set(allMembers.map(member => member.department).filter(Boolean))].sort();
        departmentSelect.innerHTML = '<option value="">All Departments</option>' +
          departments.map(department => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`).join('');
        departmentSelect.value = selectedDepartment;
      }
      if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No members found.</td></tr>';
        return;
      }

      tbody.innerHTML = members.map(m => {
        const rawStatus = (m.status || m.discord_status || 'Offline').toLowerCase();
        let statusDotClass = 'offline';
        let statusLabel = 'Offline';

        if (rawStatus === 'online') {
          statusDotClass = 'online';
          statusLabel = 'Online';
        } else if (rawStatus === 'idle') {
          statusDotClass = 'idle';
          statusLabel = 'Idle';
        } else if (rawStatus.includes('disturb') || rawStatus === 'dnd') {
          statusDotClass = 'dnd';
          statusLabel = 'Do Not Disturb';
        }

        const role = m.role || 'Member';
        const roleClass = role.toLowerCase();

        // Role Selector logic
        let roleSelectorHtml = '';
        if (role === 'Founder' && !isFounder) {
          roleSelectorHtml = `<span class="role founder" title="Protected role">👑 Founder</span>`;
        } else {
          roleSelectorHtml = `
            <select class="role-select role-${roleClass}"
                    data-id="${m.id}"
                    data-old="${escapeHtml(role)}"
                    data-name="${escapeHtml(m.name)}">
              ${isFounder ? `<option value="Founder" ${role === 'Founder' ? 'selected' : ''}>👑 Founder</option>` : ''}
              <option value="Admin" ${role === 'Admin' ? 'selected' : ''}>🛡️ Admin</option>
              <option value="Moderator" ${role === 'Moderator' ? 'selected' : ''}>⚔️ Moderator</option>
              <option value="Member" ${role === 'Member' ? 'selected' : ''}>🎮 Member</option>
            </select>
          `;
        }

        const avatarHtml = m.avatar && m.avatar.trim() !== ''
          ? `<img class="member-table-avatar" src="${escapeHtml(m.avatar)}" alt="${escapeHtml(m.name)}" onerror="this.remove()">`
          : `<div class="member-table-avatar">${escapeHtml(m.name ? m.name.charAt(0).toUpperCase() : 'R')}</div>`;

        return `
          <tr data-id="${m.id}">
            <td>
              <div class="member-table-cell">
                ${avatarHtml}
                <strong>${escapeHtml(m.name)}</strong>
              </div>
            </td>
            <td>${roleSelectorHtml}</td>
            <td>${escapeHtml(m.department || 'Community')}</td>
            <td>
              <div>${escapeHtml(m.discord || 'N/A')}</div>
              ${m.discord_id ? `<small style="color:var(--muted); font-size:11px;">ID: ${escapeHtml(m.discord_id)}</small>` : ''}
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="status-dot ${statusDotClass}"></span>
                <span style="font-size:13px;">${statusLabel}</span>
              </div>
            </td>
            <td>
              <div class="action-btn-group">
                ${role === 'Founder' && !isFounder ? '' : `
                  <button class="btn btn-outline btn-sm" data-member-action="edit" data-member-id="${m.id}">Edit</button>
                  <button class="btn btn-danger btn-sm" data-member-action="delete" data-member-id="${m.id}" data-member-name="${escapeHtml(m.name)}">Remove</button>`}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering members:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--red);">Error loading members roster.</td></tr>';
    }
  }

  document.getElementById('membersTableBody')?.addEventListener('click', event => {
    const button = event.target.closest('[data-member-action]');
    if (!button) return;
    if (button.dataset.memberAction === 'edit') {
      window.handleEditMember(Number(button.dataset.memberId));
    } else if (button.dataset.memberAction === 'delete') {
      window.handleDeleteMember(Number(button.dataset.memberId), button.dataset.memberName);
    }
  });

  document.getElementById('membersTableBody')?.addEventListener('change', event => {
    const select = event.target.closest('.role-select');
    if (!select) return;
    window.handleRoleChange(
      Number(select.dataset.id),
      select.value,
      select.dataset.old,
      select.dataset.name
    );
  });

  window.handleRoleChange = async function (id, newRole, oldRole, name) {
    if (newRole === oldRole) return;
    if (!confirm(`Are you sure you want to promote/demote ${name} to "${newRole}"?`)) {
      renderMembers();
      return;
    }

    try {
      const success = await window.ReaperzStore.updateMemberRole(id, newRole);
      if (success) {
        if (window.showToast) window.showToast(`Updated ${name} to ${newRole}`, 'success');
        renderMembers();
      }
    } catch (err) {
      alert('Failed to update role: ' + err.message);
      renderMembers();
    }
  };

  ['adminMemberSearch', 'adminMemberRoleFilter', 'adminMemberDepartmentFilter', 'adminMemberStatusFilter'].forEach(id => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener(id === 'adminMemberSearch' ? 'input' : 'change', () => {
      clearTimeout(control.searchTimer);
      control.searchTimer = setTimeout(renderMembers, id === 'adminMemberSearch' ? 200 : 0);
    });
  });

  window.handleDeleteMember = async function (id, name) {
    if (!confirm(`Are you sure you want to remove ${name} from the REAPERZ crew roster?`)) {
      return;
    }

    try {
      const success = await window.ReaperzStore.deleteMember(id);
      if (success) {
        if (window.showToast) window.showToast(`Removed ${name} from roster.`, 'info');
        renderMembers();
        refreshStats();
      }
    } catch (err) {
      alert('Could not remove member: ' + err.message);
    }
  };

  // Add Member Modal
  const addMemberModal = document.getElementById('addMemberModal');
  const openAddMemberBtn = document.getElementById('openAddMemberBtn');
  const closeAddMemberBtn = document.getElementById('closeAddMemberBtn');
  const addMemberForm = document.getElementById('addMemberForm');

  if (openAddMemberBtn && addMemberModal) {
    openAddMemberBtn.addEventListener('click', () => {
      addMemberForm.reset();
      document.getElementById('memberId').value = '';
      const roleSelect = addMemberForm.elements.namedItem('role');
      roleSelect.querySelector('option[value="Founder"]').disabled =
        window.ReaperzStore.getStaffSession()?.role !== 'Founder';
      document.getElementById('memberModalTitle').textContent = 'Add New Member';
      document.getElementById('saveMemberBtn').textContent = 'SAVE MEMBER TO DATABASE';
      addMemberModal.classList.add('open');
    });
  }

  if (closeAddMemberBtn && addMemberModal) {
    closeAddMemberBtn.addEventListener('click', () => {
      addMemberModal.classList.remove('open');
    });
  }

  if (addMemberForm) {
    addMemberForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(addMemberForm);
      const memberData = {
        name: String(formData.get('name') || '').trim(),
        role: formData.get('role'),
        game: String(formData.get('game') || 'GTA V / FiveM').trim(),
        discord: String(formData.get('discord') || '').trim(),
        discord_id: String(formData.get('discord_id') || '').trim(),
        status: formData.get('status'),
        avatar: String(formData.get('avatar') || '').trim(),
        department: String(formData.get('department') || 'Community').trim(),
        joined_at: formData.get('joined_at') || new Date().toISOString().slice(0, 10),
        details: String(formData.get('details') || '').trim()
      };
      const memberId = formData.get('id');

      try {
        if (memberId) {
          await window.ReaperzStore.updateMember(memberId, memberData);
        } else {
          await window.ReaperzStore.addMember(memberData);
        }
        {
          addMemberForm.reset();
          document.getElementById('memberId').value = '';
          if (addMemberModal) addMemberModal.classList.remove('open');
          if (window.showToast) window.showToast(`Saved ${memberData.name} to the roster.`, 'success');
          renderMembers();
          refreshStats();
        }
      } catch (err) {
        alert(`Failed to save member: ${err.message}`);
      }
    });
  }

  window.handleEditMember = async function (id) {
    try {
      const member = await window.ReaperzStore.getMember(id);
      const roleSelect = addMemberForm.elements.namedItem('role');
      roleSelect.querySelector('option[value="Founder"]').disabled =
        window.ReaperzStore.getStaffSession()?.role !== 'Founder';
      for (const [field, value] of Object.entries({
        name: member.name,
        role: member.role,
        game: member.game,
        discord: member.discord,
        discord_id: member.discord_id,
        status: member.status || member.discord_status,
        avatar: member.avatar,
        department: member.department,
        details: member.details,
        joined_at: String(member.joined_at || '').slice(0, 10),
        id: member.id
      })) {
        const input = addMemberForm.elements.namedItem(field);
        if (input) input.value = value || '';
      }
      document.getElementById('memberModalTitle').textContent = `Edit ${member.name}`;
      document.getElementById('saveMemberBtn').textContent = 'SAVE MEMBER CHANGES';
      addMemberModal.classList.add('open');
    } catch (error) {
      alert(`Could not load member: ${error.message}`);
    }
  };

  // --- 6. APPLICATIONS QUEUE ---
  async function renderApplications() {
    const tbody = document.getElementById('applicationsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading applications...</td></tr>';

    try {
      const apps = await window.ReaperzStore.getApplications();
      if (!apps || apps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No pending applications in queue.</td></tr>';
        return;
      }

      tbody.innerHTML = apps.map(a => {
        const isPending = a.status === 'Pending';
        const statusClass = a.status.toLowerCase();

        return `
          <tr>
            <td>
              <strong>${escapeHtml(a.name)}</strong>
              ${a.about ? `<p style="font-size:12px; color:var(--muted); max-width:250px;">${escapeHtml(a.about)}</p>` : ''}
            </td>
            <td>${escapeHtml(a.discord)}</td>
            <td>${a.age}</td>
            <td>${escapeHtml(a.game)}</td>
            <td><span class="role ${escapeHtml(a.role.toLowerCase())}">${escapeHtml(a.role)}</span></td>
            <td><span class="badge-status ${statusClass}">${escapeHtml(a.status)}</span></td>
            <td>
              <div class="action-btn-group">
                ${isPending ? `
                  <button class="btn btn-success btn-sm" onclick="window.handleApproveApplication(${a.id})">Approve &amp; Add</button>
                  <button class="btn btn-danger btn-sm" onclick="window.handleRejectApplication(${a.id})">Reject</button>
                ` : `
                  <span style="font-size:12px; color:var(--muted);">Completed</span>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering applications:', err);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--red);">Error loading applications.</td></tr>';
    }
  }

  window.handleApproveApplication = async function (id) {
    if (!confirm('Approve candidate and automatically add them to the official members roster?')) {
      return;
    }

    try {
      const res = await window.ReaperzStore.updateApplicationStatus(id, 'Approved', true);
      if (res) {
        if (window.showToast) window.showToast('Candidate approved and added to roster!', 'success');
        renderApplications();
        renderMembers();
        refreshStats();
      }
    } catch (err) {
      alert('Error updating application: ' + err.message);
    }
  };

  window.handleRejectApplication = async function (id) {
    if (!confirm('Reject candidate application?')) {
      return;
    }

    try {
      const res = await window.ReaperzStore.updateApplicationStatus(id, 'Rejected', false);
      if (res) {
        if (window.showToast) window.showToast('Application marked as Rejected.', 'info');
        renderApplications();
        refreshStats();
      }
    } catch (err) {
      alert('Error rejecting application: ' + err.message);
    }
  };

  // --- 7. COMMUNITY RATINGS & REVIEWS MODERATION ---
  async function renderRatings() {
    const tbody = document.getElementById('ratingsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading reviews...</td></tr>';

    try {
      const data = await window.ReaperzStore.getRatings('All', 'All');
      const ratings = data.ratings || [];

      if (ratings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No ratings submitted yet.</td></tr>';
        return;
      }

      tbody.innerHTML = ratings.map(r => {
        const starsStr = '★'.repeat(r.stars || 5);
        const dateStr = r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

        return `
          <tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td>${escapeHtml(r.discord)}</td>
            <td><span class="media-cat-pill">${escapeHtml(r.category || 'General')}</span></td>
            <td style="color:var(--gold); font-weight:700;">${starsStr}</td>
            <td>
              <strong style="color:#fff;">${escapeHtml(r.title)}</strong>
              <p style="color:var(--muted); font-size:12px; margin-top:3px; max-width:320px;">${escapeHtml(r.comment)}</p>
            </td>
            <td>👍 ${r.helpful || 0}</td>
            <td style="font-size:12px; color:var(--muted);">${dateStr}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="window.handleDeleteRating(${r.id})">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering ratings:', err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--red);">Error loading reviews.</td></tr>';
    }
  }

  window.handleDeleteRating = async function (id) {
    if (!confirm('Are you sure you want to delete this player review?')) {
      return;
    }

    try {
      const res = await window.ReaperzStore.deleteRating(id);
      if (res) {
        if (window.showToast) window.showToast('Review deleted.', 'info');
        renderRatings();
        refreshStats();
      }
    } catch (err) {
      alert('Could not delete review: ' + err.message);
    }
  };

  // --- 8. CONTACT MESSAGES ---
  async function renderMessages() {
    const tbody = document.getElementById('messagesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading messages...</td></tr>';

    try {
      const msgs = await window.ReaperzStore.getMessages();
      if (!msgs || msgs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No contact messages received.</td></tr>';
        return;
      }

      tbody.innerHTML = msgs.map(m => {
        const dateStr = m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : 'Recent';
        return `
          <tr>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td><a href="mailto:${escapeHtml(m.email)}" style="color:var(--blue2);">${escapeHtml(m.email)}</a></td>
            <td>${escapeHtml(m.subject)}</td>
            <td style="max-width:320px;">${escapeHtml(m.message)}</td>
            <td style="font-size:12px; color:var(--muted);">${dateStr}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering messages:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--red);">Error loading messages.</td></tr>';
    }
  }

  // --- 9. CHANGE STAFF PASSWORD & SETTINGS ---
  const changePassForm = document.getElementById('changePasswordForm');
  const changePassMsg = document.getElementById('changePassMessage');

  if (changePassForm) {
    changePassForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const curPass = document.getElementById('currentPassInput').value;
      const newPass = document.getElementById('newPassInput').value;
      const confPass = document.getElementById('confirmPassInput').value;

      if (newPass !== confPass) {
        if (changePassMsg) {
          changePassMsg.innerHTML = '<span style="color:var(--red);">✗ New passwords do not match.</span>';
          changePassMsg.className = 'form-message error';
        }
        return;
      }

      if (newPass.length < 8) {
        if (changePassMsg) {
          changePassMsg.innerHTML = '<span style="color:var(--red);">✗ Password must be at least 8 characters.</span>';
          changePassMsg.className = 'form-message error';
        }
        return;
      }

      if (changePassMsg) {
        changePassMsg.innerHTML = '<span style="color:var(--blue2);">Updating password...</span>';
        changePassMsg.className = 'form-message';
      }

      try {
        const res = await window.ReaperzStore.changeStaffPassword(curPass, newPass);
        if (res && res.success) {
          changePassForm.reset();
          if (changePassMsg) {
            changePassMsg.innerHTML = '<span style="color:var(--green);">✓ Password changed successfully!</span>';
            changePassMsg.className = 'form-message success';
          }
          if (window.showToast) window.showToast('Password changed successfully!', 'success');
        }
      } catch (err) {
        if (changePassMsg) {
          changePassMsg.innerHTML = `<span style="color:var(--red);">✗ ${escapeHtml(err.message)}</span>`;
          changePassMsg.className = 'form-message error';
        }
      }
    });
  }

  const resetDbBtn = document.getElementById('resetDbBtn');
  if (resetDbBtn) {
    resetDbBtn.addEventListener('click', async () => {
      if (!confirm('WARNING: Are you sure you want to reset the database to factory defaults?')) {
        return;
      }

      try {
        await window.ReaperzStore.resetAll();
        if (window.showToast) window.showToast('Database reset to defaults.', 'info');
        loadAllDashboardData();
      } catch (err) {
        alert('Could not reset database: ' + err.message);
      }
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

  // Initial gate & session check
  checkStaffAuth();
});
