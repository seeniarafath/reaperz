/**
 * REAPERZ Community Portal - Media Library Controller
 * Loads uploaded images dynamically from SQL database / ReaperzStore,
 * provides live search and category filtering for the compact media gallery.
 */

document.addEventListener('DOMContentLoaded', () => {
  let activeCategory = 'All';
  let searchQuery = '';
  let mediaList = [];

  const grid = document.getElementById('libraryGrid');
  const searchInput = document.getElementById('librarySearch');
  const countDisplay = document.getElementById('libraryCountDisplay');
  const filterPills = document.querySelectorAll('#libraryFilterPills .filter-btn');

  // --- 1. LOAD AND RENDER MEDIA ---
  async function loadAndRender() {
    if (!grid) return;

    grid.innerHTML = '<div class="no-members" style="grid-column:1/-1;">Loading REAPERZ media archive...</div>';

    try {
      const data = await window.ReaperzStore.getLibraryMedia(activeCategory, searchQuery);
      mediaList = data.media || [];

      if (countDisplay) {
        const catLabel = activeCategory === 'All' ? 'All Divisions' : activeCategory;
        countDisplay.textContent = `Showing ${mediaList.length} captures (${catLabel})`;
      }

      if (mediaList.length === 0) {
        grid.innerHTML = `
          <div class="no-members" style="grid-column:1/-1; padding:60px 20px;">
            <p style="font:700 18px 'Orbitron', sans-serif; color:#fff; margin-bottom:8px;">No Captures Found</p>
            <p style="color:var(--muted); font-size:14px;">No media matches the search criteria or selected division. Authorized staff can upload new photos via the Staff Portal.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = mediaList.map(item => {
        const dateStr = item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Official';
        return `
          <article class="library-card">
            <div class="library-card-img-wrap">
              <img src="${escapeHtml(item.file_path)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.onerror=null; this.src='assets/images/gallery-1.jpg';">
              <span class="library-card-tag">${escapeHtml(item.category || 'General')}</span>
            </div>
            <div class="library-card-body">
              <h3 class="library-card-title">${escapeHtml(item.title)}</h3>
              ${item.description ? `<p class="library-card-desc">${escapeHtml(item.description)}</p>` : ''}
              <div class="library-card-footer">
                <span class="library-card-author">📸 ${escapeHtml(item.uploaded_by || 'Staff')}</span>
                <span class="library-card-date">${dateStr}</span>
              </div>
            </div>
          </article>
        `;
      }).join('');

    } catch (err) {
      console.error('Error rendering library media:', err);
      grid.innerHTML = '<div class="no-members" style="grid-column:1/-1;">Error loading media vault. Please try again.</div>';
    }
  }

  // --- 3. FILTER PILLS & SEARCH ---
  filterPills.forEach(btn => {
    btn.addEventListener('click', () => {
      filterPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category || 'All';
      loadAndRender();
    });
  });

  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        searchQuery = searchInput.value.trim();
        loadAndRender();
      }, 250);
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

  // Initial load
  loadAndRender();
});
