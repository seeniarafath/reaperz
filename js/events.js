/**
 * REAPERZ events page: renders database-managed active and completed events.
 */
(function () {
  'use strict';

  const upcomingGrid = document.getElementById('upcomingEventsGrid');
  const pastGrid = document.getElementById('pastEventsGrid');
  const upcomingGroup = document.getElementById('upcomingEventsGroup');
  const pastGroup = document.getElementById('pastEventsGroup');
  const yearFilter = document.getElementById('completedYearFilter');
  const filterButtons = document.querySelectorAll('.events-filter-bar .filter-btn');
  let completedEvents = [];
  let defaultDiscordLink = '';

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (['completed', 'complete', 'past'].includes(status)) return 'completed';
    if (['active', 'live', 'ongoing'].includes(status)) return 'active';
    return 'upcoming';
  }

  function getEventYear(dateValue) {
    const match = String(dateValue || '').match(/^(\d{4})/);
    if (match) return match[1];
    const parsedDate = new Date(dateValue);
    return Number.isNaN(parsedDate.getTime()) ? '' : String(parsedDate.getFullYear());
  }

  function formatDate(dateValue) {
    if (!dateValue) return 'DATE TO BE ANNOUNCED';
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return dateValue;
    return parsedDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function renderEventCard(event) {
    const status = normalizeStatus(event.status);
    const isCompleted = status === 'completed';
    const statusLabel = status.toUpperCase();
    const image = event.image_url || 'assets/images/gallery-1.jpg';
    const link = event.discord_link || defaultDiscordLink;
    const buttonLabel = String(event.button_text || '').trim() ||
      (isCompleted ? 'WATCH HIGHLIGHTS' : status === 'active' ? 'REGISTER NOW' : 'VIEW DETAILS');
    const card = document.createElement('article');
    card.className = `event-card event-card--${status}`;
    card.innerHTML = `
      <div class="event-image-wrap">
      <img class="event-image" src="${escapeHTML(image)}" alt="${escapeHTML(event.title)}" loading="lazy"
             onerror="this.onerror=null;this.src='assets/images/gallery-1.jpg';">
        <span class="event-badge event-badge--${status}">${statusLabel}</span>
      </div>
      <div class="event-body">
        <div class="event-category">${escapeHTML(event.category || event.location || 'COMMUNITY EVENT')}</div>
        <h3 class="event-title">${escapeHTML(event.title)}</h3>
        <p class="event-desc">${escapeHTML(event.description || 'Event details will be announced soon.')}</p>
        <div class="event-meta-bar">
          <span class="event-date"><span aria-hidden="true">▣</span> ${escapeHTML(formatDate(event.event_date))}</span>
          <span class="event-prize"><span aria-hidden="true">🏆</span> ${escapeHTML(event.prize || 'REWARDS TBA')}</span>
        </div>
        <button type="button" class="event-action-btn event-details-toggle" data-label="${escapeHTML(buttonLabel)}" aria-expanded="false">
          ${escapeHTML(buttonLabel)}
        </button>
        <div class="event-details" hidden>
          ${event.event_time ? `<p><strong>Time:</strong> ${escapeHTML(event.event_time)}</p>` : ''}
          ${event.location ? `<p><strong>Location:</strong> ${escapeHTML(event.location)}</p>` : ''}
          ${event.organizer ? `<p><strong>Host:</strong> ${escapeHTML(event.organizer)}</p>` : ''}
          ${link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer" class="event-detail-link">${isCompleted ? 'OPEN EVENT HIGHLIGHTS' : 'JOIN / REGISTER'} ↗</a>` : ''}
        </div>
      </div>`;
    return card;
  }

  function renderCompletedEvents() {
    if (!pastGrid) return;
    const selectedYear = yearFilter?.value || 'all';
    const filteredEvents = selectedYear === 'all'
      ? completedEvents
      : completedEvents.filter(event => getEventYear(event.event_date) === selectedYear);
    pastGrid.replaceChildren();
    if (!filteredEvents.length) {
      pastGrid.innerHTML = '<div class="no-events">No completed events found for this year.</div>';
      return;
    }
    filteredEvents.forEach(event => pastGrid.appendChild(renderEventCard(event)));
  }

  function populateYearFilter(events) {
    if (!yearFilter) return;
    const years = [...new Set(events.map(event => getEventYear(event.event_date)).filter(Boolean))]
      .sort((a, b) => Number(b) - Number(a));
    yearFilter.innerHTML = '<option value="all">All years</option>' +
      years.map(year => `<option value="${escapeHTML(year)}">${escapeHTML(year)}</option>`).join('');
    yearFilter.value = years[0] || 'all';
  }

  function setupCardActions() {
    [upcomingGrid, pastGrid].forEach(grid => {
      grid?.addEventListener('click', event => {
        const button = event.target.closest('.event-details-toggle');
        if (!button) return;
        const details = button.nextElementSibling;
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        button.textContent = expanded ? button.dataset.label : 'CLOSE DETAILS';
        details.hidden = expanded;
      });
    });

    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        filterButtons.forEach(item => item.classList.toggle('active', item === button));
        const filter = button.dataset.filter;
        if (upcomingGroup) upcomingGroup.hidden = filter === 'past';
        if (pastGroup) pastGroup.hidden = filter === 'upcoming';
      });
    });
  }

  async function loadEvents() {
    if (!upcomingGrid || !pastGrid || !window.ReaperzStore) return;
    try {
      const [events, settings] = await Promise.all([
        window.ReaperzStore.getEvents(false),
        window.ReaperzStore.getSettings().catch(error => {
          console.warn('[Events] Could not load configured Discord invite:', error);
          return null;
        })
      ]);
      if (settings?.discord_invite) defaultDiscordLink = settings.discord_invite;

      const activeEvents = events.filter(event => normalizeStatus(event.status) !== 'completed');
      completedEvents = events
        .filter(event => normalizeStatus(event.status) === 'completed')
        .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0) ||
          String(b.event_date || '').localeCompare(String(a.event_date || '')));

      upcomingGrid.replaceChildren();
      if (!activeEvents.length) {
        upcomingGrid.innerHTML = '<div class="no-events">No active campaigns are scheduled right now. Check back soon.</div>';
      } else {
        activeEvents
          .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0) ||
            String(a.event_date || '').localeCompare(String(b.event_date || '')))
          .forEach(event => upcomingGrid.appendChild(renderEventCard(event)));
      }

      populateYearFilter(completedEvents);
      renderCompletedEvents();
    } catch (error) {
      console.error('[Events] Error loading events:', error);
      upcomingGrid.innerHTML = '<div class="no-events">Events are temporarily unavailable. Please refresh the page.</div>';
      pastGrid.innerHTML = '<div class="no-events">Events are temporarily unavailable. Please refresh the page.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupCardActions();
    yearFilter?.addEventListener('change', renderCompletedEvents);
    loadEvents();
  });
})();
