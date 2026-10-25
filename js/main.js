/**
 * REAPERZ Community Portal - Main Navigation & UI Enhancements
 */

document.addEventListener('DOMContentLoaded', () => {
  const siteHeader = document.querySelector('.site-header');
  let menuToggle = document.getElementById('menuToggle') || document.querySelector('.menu-toggle');
  let nav = document.getElementById('primaryNav') || document.querySelector('.site-header nav');
  if (siteHeader && nav && menuToggle) {
    menuToggle.id = 'menuToggle';
    menuToggle.setAttribute('aria-controls', 'primaryNav');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation menu');
    menuToggle.innerHTML = '☰';
    nav.id = 'primaryNav';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = `
      <button class="nav-close-btn" id="navCloseBtn" type="button" aria-label="Close navigation menu">✕</button>
      <a href="index.html">Home</a>
      <a href="businesses.html">Businesses</a>
      <a href="members.html">Members</a>
      <a href="events.html">Events</a>
      <a href="library.html">Library</a>
      <a href="rate.html">Rate Us</a>
      <a href="about.html">About Us</a>
      <a href="join.html">Join Us</a>
      <a href="rules.html">Rules</a>
      <a href="contact.html">Contact</a>
      <a class="nav-admin-link" href="/staff"><span class="lock-icon">🔒</span> Staff Portal</a>`;
    let overlay = document.getElementById('navOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'navOverlay';
      overlay.className = 'nav-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      siteHeader.insertAdjacentElement('afterend', overlay);
    }
  }
  menuToggle = document.getElementById('menuToggle') || menuToggle;
  nav = document.getElementById('primaryNav') || nav;
  const navCloseBtn = document.getElementById('navCloseBtn');
  const navOverlay = document.getElementById('navOverlay');

  function openNav() {
    if (!nav) return;
    nav.classList.add('open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'true');
      menuToggle.setAttribute('aria-label', 'Close navigation menu');
      menuToggle.textContent = '✕';
    }
    if (navOverlay) navOverlay.classList.add('active');
    document.body.classList.add('scroll-locked');
  }

  function closeNav() {
    if (!nav) return;
    nav.classList.remove('open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation menu');
      menuToggle.textContent = '☰';
    }
    if (navOverlay) navOverlay.classList.remove('active');
    document.body.classList.remove('scroll-locked');
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = nav && nav.classList.contains('open');
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    });
  }

  if (navCloseBtn) {
    navCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNav();
    });
  }

  if (navOverlay) {
    navOverlay.addEventListener('click', () => {
      closeNav();
    });
  }

  document.addEventListener('click', (e) => {
    if (nav && nav.classList.contains('open')) {
      if (!nav.contains(e.target) && (!menuToggle || !menuToggle.contains(e.target))) {
        closeNav();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav && nav.classList.contains('open')) {
      closeNav();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 992 && nav && nav.classList.contains('open')) closeNav();
  });

  // Close drawer when clicking any link inside nav
  if (nav) {
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        closeNav();
      });
    });
  }

  // 2. Active Link Highlight
  const currentPath = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  document.querySelectorAll('nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const cleanHref = href.split('/').pop().replace(/\.html$/, '');
    const matchesPage = cleanHref === currentPath ||
      (cleanHref === 'staff' && currentPath === 'admin') ||
      (cleanHref === 'admin' && currentPath === 'staff');
    if (matchesPage) {
      link.classList.add('active');
    }
  });

  // 3. Dynamic Stats Counter (if present on homepage)
  const statsContainer = document.querySelector('.stats');
  if (statsContainer && window.ReaperzStore) {
    window.ReaperzStore.getMembers().then(members => {
      const totalMemberEl = statsContainer.querySelector('div:first-child strong');
      if (totalMemberEl && members && members.length) {
        totalMemberEl.textContent = `${members.length}+`;
      }
    }).catch(() => {});
  }

  loadGamingPlatforms();
  loadHomeHighlights();
  loadDiscordInvite();
});

async function loadGamingPlatforms() {
  const crewDisplay = document.getElementById('gtaCrewDisplay');
  const serversDisplay = document.getElementById('fivemServersDisplay');
  if (!crewDisplay || !serversDisplay || !window.ReaperzStore) return;

  try {
    const platforms = await window.ReaperzStore.getGamingPlatforms();
    const crew = platforms.filter(platform => platform.type === 'gta_online');
    const servers = platforms.filter(platform => platform.type === 'fivem');

    crewDisplay.innerHTML = crew.length
      ? crew.map(platform => renderGamingPlatform(platform, 'crew')).join('')
      : '<p class="platform-empty">No GTA V Online crew is currently published.</p>';
    serversDisplay.innerHTML = servers.length
      ? servers.map(platform => renderGamingPlatform(platform, 'server')).join('')
      : '<p class="platform-empty">No FiveM servers are currently published.</p>';
  } catch (error) {
    console.error('Could not load gaming platforms:', error);
    crewDisplay.innerHTML = '<p class="platform-error">Crew information is temporarily unavailable.</p>';
    serversDisplay.innerHTML = '<p class="platform-error">Server information is temporarily unavailable.</p>';
  }
}

function renderGamingPlatform(platform, kind) {
  const image = platform.image_url
    ? `<img src="${escapePlatformHtml(platform.image_url)}" alt="" loading="lazy">`
    : '';
  const description = platform.description
    ? `<p>${escapePlatformHtml(platform.description)}</p>`
    : '';
  const link = getPlatformLink(platform.link);
  const content = `
    ${image ? `<div class="gallery-image-wrap gaming-platform-image">${image}</div>` : ''}
    <div class="gallery-card-body gaming-platform-card-body">
      <span class="gaming-platform-status">${escapePlatformHtml(platform.status || 'Active')}</span>
      <h4>${escapePlatformHtml(platform.name)}</h4>
      ${description}
    </div>`;

  return `<article class="gallery-item gaming-platform-card ${kind}-platform-card">
    ${link
      ? `<a class="gaming-platform-card-link" href="${escapePlatformHtml(link)}" target="_blank" rel="noopener noreferrer">${content}</a>`
      : content}
  </article>`;
}

function getPlatformLink(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:', 'fivem:'].includes(url.protocol) ? value : '';
  } catch {
    return '';
  }
}

function escapePlatformHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadHomeHighlights() {
  const gallery = document.getElementById('communityHighlightsGrid');
  if (!gallery || !window.ReaperzStore) return;
  try {
    const highlights = await window.ReaperzStore.getHighlights();
    gallery.innerHTML = highlights.length
      ? highlights.map(highlight => `
        <article class="gallery-item">
          <div class="gallery-image-wrap">
            <img src="${escapePlatformHtml(highlight.image_url || 'assets/images/gallery-1.jpg')}"
                 alt="${escapePlatformHtml(highlight.title)}" loading="lazy"
                 onerror="this.onerror=null;this.src='assets/images/gallery-1.jpg';">
          </div>
          <div class="gallery-card-body">
            <h3 class="gallery-caption">${escapePlatformHtml(highlight.title)}</h3>
            ${highlight.description ? `<p class="gallery-description">${escapePlatformHtml(highlight.description)}</p>` : ''}
            ${highlight.event_date ? `<time class="gallery-date">${escapePlatformHtml(highlight.event_date)}</time>` : ''}
          </div>
        </article>`).join('')
      : '<p class="platform-empty">Community highlights will appear here when published.</p>';
  } catch (error) {
    console.error('Could not load community highlights:', error);
    gallery.innerHTML = '<p class="platform-error">Community highlights are temporarily unavailable.</p>';
  }
}

async function loadDiscordInvite() {
  const button = document.getElementById('joinDiscordButton');
  if (!button || !window.ReaperzStore) return;
  try {
    const settings = await window.ReaperzStore.getSettings();
    const invite = settings && settings.discord_invite;
    if (invite) {
      const url = new URL(invite);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        button.href = url.href;
        button.hidden = false;
      }
    }
  } catch (error) {
    console.error('Could not load the configured Discord invite:', error);
  }
}

// Toast notification helper
function showToast(message, type = 'info') {
  let toast = document.getElementById('reaperz-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'reaperz-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.padding = '14px 22px';
    toast.style.borderRadius = '8px';
    toast.style.font = "700 13px 'Orbitron', sans-serif";
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    toast.style.transition = 'all 0.3s ease';
    document.body.appendChild(toast);
  }

  if (type === 'success') {
    toast.style.background = '#0a2e1d';
    toast.style.color = '#29e07f';
    toast.style.border = '1px solid #29e07f';
  } else if (type === 'error') {
    toast.style.background = '#380a13';
    toast.style.color = '#ff1744';
    toast.style.border = '1px solid #ff1744';
  } else {
    toast.style.background = '#0d1e38';
    toast.style.color = '#00b7ff';
    toast.style.border = '1px solid #00b7ff';
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
  }, 3500);
}

window.showToast = showToast;

// ==========================================================================
// 3D CARD TILT & DEPTH INTERACTION ENGINE
// ==========================================================================
(function init3DCardTilt() {
  document.addEventListener('mousemove', (e) => {
    const target = e.target.closest('.card, .member-card, .event-card, .business-hub-card, .vehicle-card, .service-card, .highlight-card-3d');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;

    target.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale(1.02)`;
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('.card, .member-card, .event-card, .business-hub-card, .vehicle-card, .service-card, .highlight-card-3d');
    if (!target) return;
    target.style.transform = '';
  });
})();
