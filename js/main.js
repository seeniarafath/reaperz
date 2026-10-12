/**
 * REAPERZ Community Portal - Main Navigation & UI Enhancements
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Drawer Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('nav');

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      nav.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !menuToggle.contains(e.target)) {
        nav.classList.remove('open');
      }
    });
  }

  // 2. Active Link Highlight
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
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
});

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
