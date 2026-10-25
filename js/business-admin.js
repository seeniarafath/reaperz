/**
 * REAPERZ Staff Portal — Business Management Module
 * Manages Apex Motors vehicles, pre-bookings, Hoonigan services & requests
 */
(function() {
  'use strict';

  function escapeHTML(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatPrice(n) {
    return '$' + Number(n || 0).toLocaleString();
  }

  // --- SUB TABS SWITCHER ---
  const subBtns = document.querySelectorAll('.biz-sub-nav-btn');
  const subPanels = {
    'sub-apex-bookings': document.getElementById('sub-apex-bookings'),
    'sub-apex-vehicles': document.getElementById('sub-apex-vehicles'),
    'sub-hoon-requests': document.getElementById('sub-hoon-requests'),
    'sub-hoon-services': document.getElementById('sub-hoon-services')
  };

  subBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.sub;
      Object.entries(subPanels).forEach(([key, panel]) => {
        if (panel) panel.style.display = (key === target) ? 'block' : 'none';
      });
      if (target === 'sub-apex-bookings') loadBookings();
      if (target === 'sub-apex-vehicles') loadVehicles();
      if (target === 'sub-hoon-requests') loadHoonRequests();
      if (target === 'sub-hoon-services') loadServices();
    });
  });

  // --- 1. BUSINESS STATS ---
  async function loadBusinessStats() {
    try {
      const res = await fetch('/api/business-stats');
      const data = await res.json();
      if (data.success && data.stats) {
        const s = data.stats;
        document.getElementById('bizStatTotalVeh').textContent = s.totalVehicles || 0;
        document.getElementById('bizStatAvailVeh').textContent = s.availableVehicles || 0;
        document.getElementById('bizStatPendingBookings').textContent = s.pendingBookings || 0;
        document.getElementById('bizStatTotalBookings').textContent = s.totalBookings || 0;
        document.getElementById('bizStatPendingReq').textContent = s.pendingRequests || 0;
        document.getElementById('bizStatTotalServices').textContent = s.totalServices || 0;
      }
    } catch(err) {
      console.warn('[Biz Admin] Error loading stats:', err);
    }
  }

  // --- 2. APEX PRE-BOOKINGS ---
  let bookingsList = [];
  const bookingsTbody = document.getElementById('bookingsTableBody');
  const bookingSearch = document.getElementById('bookingSearchInput');
  const bookingFilter = document.getElementById('bookingStatusFilter');

  function renderBookings(list) {
    if (!bookingsTbody) return;
    if (!list.length) {
      bookingsTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#8e9fb5;">No pre-bookings found.</td></tr>';
      return;
    }

    bookingsTbody.innerHTML = list.map(b => {
      const statusClass = (b.status || 'Pending').toLowerCase();
      return `
        <tr>
          <td><strong style="color:var(--blue2); font-family:'Orbitron'; font-size:12px;">${escapeHTML(b.reference)}</strong></td>
          <td><strong>${escapeHTML(b.customer_name)}</strong><br><small style="color:#8e9fb5;">📞 ${escapeHTML(b.contact_number)}</small></td>
          <td><span style="color:#c8d4e8;">@${escapeHTML(b.discord_username)}</span></td>
          <td><strong>${escapeHTML(b.vehicle_name)}</strong><br><small style="color:#8e9fb5;">${escapeHTML(b.vehicle_model)}</small></td>
          <td style="color:var(--apex-gold); font-weight:700;">${formatPrice(b.vehicle_price)}</td>
          <td>${escapeHTML(b.preferred_date || 'TBA')}</td>
          <td><span class="booking-status-badge ${statusClass}">${escapeHTML(b.status)}</span></td>
          <td>
            <div style="display:flex; gap:6px;">
              <select class="change-booking-status" data-id="${b.id}" style="background:#0b1019; border:1px solid #1c2a40; color:#fff; border-radius:6px; padding:4px 8px; font-size:12px;">
                <option value="" disabled selected>Update Status</option>
                <option value="Approved">Approve</option>
                <option value="Reserved">Reserve</option>
                <option value="Completed">Complete / Delivered</option>
                <option value="Rejected">Reject</option>
                <option value="Cancelled">Cancel</option>
              </select>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadBookings() {
    if (!bookingsTbody) return;
    try {
      const q = bookingSearch ? bookingSearch.value.trim() : '';
      const st = bookingFilter ? bookingFilter.value : 'all';
      const url = `/api/vehicle-bookings?search=${encodeURIComponent(q)}&status=${encodeURIComponent(st)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.bookings) {
        bookingsList = data.bookings;
        renderBookings(bookingsList);
      }
    } catch(err) {
      console.error('[Biz Admin] Failed to load bookings:', err);
    }
  }

  bookingsTbody?.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('change-booking-status')) return;
    const id = e.target.dataset.id;
    const newStatus = e.target.value;
    if (!newStatus) return;

    if (!confirm(`Change booking status to ${newStatus}? A Discord notification will be generated.`)) {
      e.target.value = '';
      return;
    }

    try {
      const res = await fetch(`/api/vehicle-bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✓ Booking status updated to ${newStatus}!`);
        loadBookings();
        loadBusinessStats();
      } else {
        alert(data.message || 'Failed to update status.');
      }
    } catch(err) {
      alert('Error updating status.');
    }
  });

  bookingSearch?.addEventListener('input', () => {
    clearTimeout(bookingSearch._t);
    bookingSearch._t = setTimeout(loadBookings, 300);
  });
  bookingFilter?.addEventListener('change', loadBookings);
  document.getElementById('refreshBookingsBtn')?.addEventListener('click', loadBookings);

  // --- 3. APEX FLEET INVENTORY ---
  const vehGrid = document.getElementById('vehicleAdminGrid');
  const catFilter = document.getElementById('vehicleCategoryFilter');
  const availFilter = document.getElementById('vehicleAvailFilter');

  function renderVehicles(list) {
    if (!vehGrid) return;
    if (!list.length) {
      vehGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:24px; color:#8e9fb5;">No vehicles found.</div>';
      return;
    }

    vehGrid.innerHTML = list.map(v => {
      const avail = (v.availability || 'Available').toLowerCase();
      const defaultImg = 'assets/images/gallery-3.jpg';
      const imgSrc = v.image_url ? escapeHTML(v.image_url) : defaultImg;
      return `
        <div class="vehicle-admin-card" data-id="${v.id}">
          <img class="vehicle-admin-img" src="${imgSrc}" alt="${escapeHTML(v.name)}" onerror="this.onerror=null;this.src='${defaultImg}';">
          <div class="vehicle-admin-body">
            <h4 class="vehicle-admin-name">${escapeHTML(v.name)}</h4>
            <div class="vehicle-admin-meta">
              <span>${escapeHTML(v.model)}</span>
              <span>${escapeHTML(v.category)}</span>
              <span style="color:var(--apex-gold); font-weight:700;">${formatPrice(v.price)}</span>
              <span class="booking-status-badge ${avail}">${escapeHTML(v.availability)}</span>
            </div>
            <div class="vehicle-admin-actions">
              <select class="change-veh-avail" data-id="${v.id}" style="background:#0b1019; border:1px solid #1c2a40; color:#fff; border-radius:6px; padding:4px 8px; font-size:12px; flex:1;">
                <option value="" disabled selected>Set Status</option>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
                <option value="Sold">Sold</option>
              </select>
              <button class="btn btn-outline btn-sm delete-veh-btn" data-id="${v.id}" style="color:var(--red); border-color:rgba(255,23,68,0.3);">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadVehicles() {
    if (!vehGrid) return;
    try {
      const c = catFilter ? catFilter.value : 'all';
      const a = availFilter ? availFilter.value : 'all';
      const res = await fetch(`/api/vehicles?all=1&category=${encodeURIComponent(c)}&availability=${encodeURIComponent(a)}`);
      const data = await res.json();
      if (data.success && data.vehicles) {
        renderVehicles(data.vehicles);
      }
    } catch(err) {
      console.error('[Biz Admin] Failed to load vehicles:', err);
    }
  }

  vehGrid?.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('change-veh-avail')) return;
    const id = e.target.dataset.id;
    const availability = e.target.value;
    if (!availability) return;

    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability })
      });
      const data = await res.json();
      if (data.success) {
        loadVehicles();
        loadBusinessStats();
      }
    } catch(err) { alert('Failed to update availability.'); }
  });

  vehGrid?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-veh-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm('Are you sure you want to delete this vehicle from the showroom?')) return;

    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('✓ Vehicle removed from showroom.');
        loadVehicles();
        loadBusinessStats();
      }
    } catch(err) { alert('Failed to delete vehicle.'); }
  });

  catFilter?.addEventListener('change', loadVehicles);
  availFilter?.addEventListener('change', loadVehicles);
  document.getElementById('refreshVehiclesBtn')?.addEventListener('click', loadVehicles);

  // --- 4. HOONIGAN REQUESTS ---
  const hoonTbody = document.getElementById('hoonRequestsTableBody');
  const hoonSearch = document.getElementById('hoonSearchInput');
  const hoonFilter = document.getElementById('hoonStatusFilter');

  function renderHoonRequests(list) {
    if (!hoonTbody) return;
    if (!list.length) {
      hoonTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#8e9fb5;">No customization requests found.</td></tr>';
      return;
    }

    hoonTbody.innerHTML = list.map(r => {
      let svc = r.services;
      if (typeof svc === 'string') {
        try { svc = JSON.parse(svc); } catch(e) { svc = []; }
      }
      const svcStr = Array.isArray(svc) ? svc.join(', ') : '';
      const stClass = (r.status || 'Pending').toLowerCase();

      return `
        <tr>
          <td><strong style="color:var(--hoon-orange); font-family:'Orbitron'; font-size:12px;">${escapeHTML(r.reference)}</strong></td>
          <td><strong>${escapeHTML(r.customer_name)}</strong><br><small style="color:#8e9fb5;">📞 ${escapeHTML(r.contact_number)}</small></td>
          <td><span style="color:#c8d4e8;">@${escapeHTML(r.discord_username)}</span></td>
          <td><strong>${escapeHTML(r.vehicle_name)}</strong><br><small style="color:#8e9fb5;">${escapeHTML(r.vehicle_model || '-')}</small></td>
          <td style="font-size:12px; max-width:200px; color:#c8d4e8;">${escapeHTML(svcStr || 'Custom build')}</td>
          <td>${escapeHTML(r.preferred_date || 'TBA')}</td>
          <td><span class="booking-status-badge ${stClass}">${escapeHTML(r.status)}</span></td>
          <td>
            <select class="change-hoon-status" data-id="${r.id}" style="background:#0b1019; border:1px solid #1c2a40; color:#fff; border-radius:6px; padding:4px 8px; font-size:12px;">
              <option value="" disabled selected>Update</option>
              <option value="Approved">Approve</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Reject</option>
              <option value="Cancelled">Cancel</option>
            </select>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadHoonRequests() {
    if (!hoonTbody) return;
    try {
      const q = hoonSearch ? hoonSearch.value.trim() : '';
      const st = hoonFilter ? hoonFilter.value : 'all';
      const res = await fetch(`/api/customization-requests?search=${encodeURIComponent(q)}&status=${encodeURIComponent(st)}`);
      const data = await res.json();
      if (data.success && data.requests) {
        renderHoonRequests(data.requests);
      }
    } catch(err) {
      console.error('[Biz Admin] Failed to load Hoonigan requests:', err);
    }
  }

  hoonTbody?.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('change-hoon-status')) return;
    const id = e.target.dataset.id;
    const newStatus = e.target.value;
    if (!newStatus) return;

    if (!confirm(`Change request status to ${newStatus}? Discord webhook will be updated.`)) {
      e.target.value = '';
      return;
    }

    try {
      const res = await fetch(`/api/customization-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✓ Customization request updated to ${newStatus}!`);
        loadHoonRequests();
        loadBusinessStats();
      }
    } catch(err) { alert('Error updating status.'); }
  });

  hoonSearch?.addEventListener('input', () => {
    clearTimeout(hoonSearch._t);
    hoonSearch._t = setTimeout(loadHoonRequests, 300);
  });
  hoonFilter?.addEventListener('change', loadHoonRequests);
  document.getElementById('refreshHoonRequestsBtn')?.addEventListener('click', loadHoonRequests);

  // --- 5. HOONIGAN SERVICES ---
  const svcTbody = document.getElementById('servicesTableBody');

  async function loadServices() {
    if (!svcTbody) return;
    try {
      const res = await fetch('/api/customization-services?all=1');
      const data = await res.json();
      if (data.success && data.services) {
        svcTbody.innerHTML = data.services.map(s => `
          <tr>
            <td><strong>${escapeHTML(s.name)}</strong><br><small style="color:#8e9fb5;">${escapeHTML(s.description || '')}</small></td>
            <td><span style="color:var(--hoon-orange);">${escapeHTML(s.category)}</span></td>
            <td>${formatPrice(s.price_from)} – ${formatPrice(s.price_to)}</td>
            <td>${escapeHTML(s.duration || 'TBA')}</td>
            <td><span style="color:${s.is_available ? 'var(--green)' : 'var(--red)'};">${s.is_available ? '✓ Yes' : '✕ No'}</span></td>
            <td>
              <button class="btn btn-outline btn-sm delete-svc-btn" data-id="${s.id}" style="color:var(--red); border-color:rgba(255,23,68,0.3);">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    } catch(err) {
      console.error('[Biz Admin] Failed to load services:', err);
    }
  }

  svcTbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-svc-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm('Delete this service from Hoonigan catalog?')) return;
    try {
      const res = await fetch(`/api/customization-services/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('✓ Service deleted.');
        loadServices();
        loadBusinessStats();
      }
    } catch(err) { alert('Failed to delete service.'); }
  });

  // --- 6. ADD VEHICLE MODAL ---
  document.getElementById('openAddVehicleBtn')?.addEventListener('click', async () => {
    const name = prompt('Vehicle Name (e.g. Pegassi Torero):');
    if (!name) return;
    const model = prompt('Vehicle Model (e.g. Torero):', name);
    if (!model) return;
    const category = prompt('Category (Sports, Supercar, SUV, Luxury, Muscle, Race):', 'Sports');
    const priceStr = prompt('Vehicle Price (in $):', '750000');
    const price = parseInt(priceStr, 10) || 0;
    const imgUrl = prompt('Image URL (optional, leave blank for default):', '');

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          model,
          category: category || 'Sports',
          price,
          image_url: imgUrl,
          availability: 'Available'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✓ New vehicle added to Apex Motors showroom!');
        loadVehicles();
        loadBusinessStats();
      } else {
        alert(data.message || 'Failed to add vehicle.');
      }
    } catch(err) { alert('Error adding vehicle.'); }
  });

  // --- 7. ADD HOONIGAN SERVICE MODAL ---
  document.getElementById('openAddServiceBtn')?.addEventListener('click', async () => {
    const name = prompt('Service Name (e.g. Quad Exhaust Conversion):');
    if (!name) return;
    const category = prompt('Category (Performance, Exterior, Interior):', 'Performance');
    const priceFrom = parseInt(prompt('Min Price ($):', '50000'), 10) || 0;
    const priceTo = parseInt(prompt('Max Price ($):', '150000'), 10) || 0;
    const duration = prompt('Estimated Duration (e.g. 2-3 hours):', '1-2 hours');

    try {
      const res = await fetch('/api/customization-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: category || 'Performance',
          price_from: priceFrom,
          price_to: priceTo,
          duration: duration || 'TBA'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✓ New service added to Hoonigan catalog!');
        loadServices();
        loadBusinessStats();
      } else {
        alert(data.message || 'Failed to add service.');
      }
    } catch(err) { alert('Error adding service.'); }
  });

  // Listen for tab switch to Businesses to auto-load
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'tab-businesses') {
        loadBusinessStats();
        loadBookings();
      }
    });
  });

  // Init on load
  setTimeout(() => {
    loadBusinessStats();
    loadBookings();
  }, 1000);

})();
