/**
 * ====================================================================
 *   REAPERZ Community Portal - Rate Us & Reviews Controller
 *   Manages interactive star ratings, robust review submission, validation,
 *   live metric recalculation, dynamic filters, and helpful upvotes.
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentSelectedStars = 5;
  let activeFilterCategory = 'All';
  let activeFilterStars = 'All';

  const STAR_SENTIMENTS = {
    1: '1 Star — Needs Improvement',
    2: '2 Stars — Fair Experience',
    3: '3 Stars — Good Community',
    4: '4 Stars — Great Experience! 👍',
    5: '5 Stars — Outstanding! 🔥'
  };

  // --- 1. INTERACTIVE STAR RATING PICKER ---
  const starButtons = document.querySelectorAll('.star-picker-btn');
  const starHint = document.getElementById('starRatingHint');
  const starInput = document.getElementById('starRatingValue');

  function updateStarDisplay(rating, isHover = false) {
    starButtons.forEach(btn => {
      const val = parseInt(btn.dataset.value, 10);
      if (val <= rating) {
        btn.classList.add(isHover ? 'hovered' : 'active');
        if (!isHover) btn.classList.remove('hovered');
      } else {
        btn.classList.remove('active', 'hovered');
      }
    });

    if (starHint) {
      starHint.textContent = STAR_SENTIMENTS[rating] || `${rating} Stars`;
    }
    if (!isHover && starInput) {
      starInput.value = rating;
    }
  }

  starButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const val = parseInt(btn.dataset.value, 10);
      updateStarDisplay(val, true);
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentSelectedStars = parseInt(btn.dataset.value, 10);
      updateStarDisplay(currentSelectedStars, false);
    });
  });

  const starPickerContainer = document.querySelector('.star-rating-picker');
  if (starPickerContainer) {
    starPickerContainer.addEventListener('mouseleave', () => {
      updateStarDisplay(currentSelectedStars, false);
    });
  }

  // Initial star display setup (Default: 5 Stars)
  updateStarDisplay(currentSelectedStars, false);

  // --- 2. SUBMIT REVIEW FORM HANDLER WITH PROPER VALIDATION ---
  const rateForm = document.getElementById('rateForm');
  const rateMsg = document.getElementById('rateMessage');

  if (rateForm) {
    rateForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = rateForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : 'SUBMIT REVIEW';

      // Clear previous messages
      if (rateMsg) {
        rateMsg.innerHTML = '';
        rateMsg.className = 'form-message';
      }

      // Read form fields
      const nameInput = rateForm.querySelector('[name="name"]');
      const discordInput = rateForm.querySelector('[name="discord"]');
      const categoryInput = rateForm.querySelector('[name="category"]');
      const experienceInput = rateForm.querySelector('[name="experience"]');
      const titleInput = rateForm.querySelector('[name="title"]');
      const commentInput = rateForm.querySelector('[name="comment"]');
      const recommendedInput = rateForm.querySelector('[name="recommended"]');

      const name = nameInput ? nameInput.value.trim() : '';
      const discord = discordInput ? discordInput.value.trim() : '';
      const category = categoryInput ? categoryInput.value : 'FiveM Roleplay';
      const experience = experienceInput ? experienceInput.value : 'Member';
      const title = titleInput ? titleInput.value.trim() : 'Community Rating';
      const comment = commentInput ? commentInput.value.trim() : '';
      const recommended = recommendedInput ? recommendedInput.checked : true;
      const stars = currentSelectedStars || 5;

      // --- VALIDATION & ERROR HANDLING ---
      if (!name || name.length < 2) {
        showError('Please enter your Name or Gamertag (at least 2 characters).', nameInput);
        return;
      }

      if (!discord || discord.length < 2) {
        showError('Please enter your Discord Username (e.g. user#1234 or @username).', discordInput);
        return;
      }

      if (!comment || comment.length < 5) {
        showError('Please write your review feedback (at least 5 characters).', commentInput);
        return;
      }

      // Prepare UI for submission
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING REVIEW...';
      }

      if (rateMsg) {
        rateMsg.innerHTML = '<span style="color:var(--blue2);">Submitting your review to REAPERZ database...</span>';
      }

      const ratingPayload = {
        name: name,
        discord: discord,
        stars: stars,
        category: category,
        experience: experience,
        title: title,
        comment: comment,
        recommended: recommended
      };

      try {
        const result = await window.ReaperzStore.submitRating(ratingPayload);

        if (result && result.success) {
          rateForm.reset();
          currentSelectedStars = 5;
          updateStarDisplay(5, false);

          if (rateMsg) {
            rateMsg.innerHTML = `
              <div style="background:rgba(41,224,127,0.12); border:1px solid var(--green); border-radius:10px; padding:18px 22px; margin-top:16px; text-align:left; box-shadow:0 0 20px rgba(41,224,127,0.2);">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                  <span style="font-size:24px; color:var(--green); font-weight:800;">✓</span>
                  <strong style="color:#fff; font:800 16px 'Orbitron', sans-serif; letter-spacing:0.5px;">REVIEW SUBMITTED SUCCESSFULLY!</strong>
                </div>
                <p style="color:#c5e3d3; font-size:14px; margin:0 0 6px 0; line-height:1.5;">
                  Thank you, <strong>${escapeHtml(name)}</strong>! Your <strong>${stars}-star</strong> review has been permanently stored in the REAPERZ community database.
                </p>
                <div style="font-size:12px; color:var(--green); opacity:0.9;">
                  ★ Your feedback is now live on the public feed below.
                </div>
              </div>
            `;
            rateMsg.className = 'form-message success';
          }

          if (window.showToast) {
            window.showToast('✓ Review submitted successfully!', 'success');
          }

          // Reload ratings immediately so the new review appears at the top
          await loadAndRenderRatings();

          // Scroll smoothly to success message
          if (rateMsg) {
            rateMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          throw new Error((result && result.message) || 'Submission failed. Please try again.');
        }
      } catch (err) {
        console.error('Rating submission error:', err);
        showError(err.message || 'Submission error. Please verify the backend server is running on port 5000.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  function showError(msg, focusEl = null) {
    if (rateMsg) {
      rateMsg.innerHTML = `
        <div style="background:rgba(255,23,68,0.14); border:1px solid var(--red); border-radius:8px; padding:14px 18px; margin-top:14px; color:#ff859b; font-size:13.5px; text-align:left; box-shadow:0 0 15px rgba(255,23,68,0.2);">
          <strong style="font-weight:700;">✗ Error:</strong> ${escapeHtml(msg)}
        </div>
      `;
      rateMsg.className = 'form-message error';
    }
    if (focusEl) {
      focusEl.focus();
      focusEl.style.borderColor = 'var(--red)';
      setTimeout(() => { focusEl.style.borderColor = ''; }, 3500);
    }
    if (window.showToast) {
      window.showToast(msg, 'error');
    }
  }

  // --- 3. LOAD AND RENDER REVIEWS FEED & METRICS ---
  async function loadAndRenderRatings() {
    try {
      const data = await window.ReaperzStore.getRatings(activeFilterCategory, activeFilterStars);
      const ratings = data.ratings || [];
      const total = data.total || ratings.length;
      const average = data.average || 5.0;
      const distribution = data.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

      renderScoreOverview(total, average, distribution);
      renderReviewsGrid(ratings);
    } catch (err) {
      console.error('Error loading ratings:', err);
    }
  }

  function renderScoreOverview(total, average, distribution) {
    const avgScoreEl = document.getElementById('statAvgScore');
    const totalReviewsEl = document.getElementById('statTotalReviews');
    const starsOverviewEl = document.getElementById('statStarsOverview');

    if (avgScoreEl) avgScoreEl.textContent = Number(average).toFixed(1);
    if (totalReviewsEl) totalReviewsEl.textContent = `Based on ${total} verified community reviews`;

    if (starsOverviewEl) {
      const roundedStars = Math.min(5, Math.max(1, Math.round(average)));
      starsOverviewEl.textContent = '★'.repeat(roundedStars) + '☆'.repeat(5 - roundedStars);
    }

    // Update distribution bars (5 down to 1)
    for (let s = 5; s >= 1; s--) {
      const count = distribution[s] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const fillEl = document.getElementById(`barFill${s}`);
      const countEl = document.getElementById(`barCount${s}`);

      if (fillEl) fillEl.style.width = `${pct}%`;
      if (countEl) countEl.textContent = `${count}`;
    }
  }

  function renderReviewsGrid(ratings) {
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;

    if (!ratings || ratings.length === 0) {
      grid.innerHTML = `
        <div class="no-members" style="padding:40px 20px;">
          <p style="font:700 16px 'Orbitron', sans-serif; color:#fff; margin-bottom:8px;">No Reviews Found</p>
          <p style="color:var(--muted); font-size:13.5px;">Be the first player to submit a review for this category!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = ratings.map(r => {
      const starsStr = '★'.repeat(r.stars || 5) + '☆'.repeat(5 - (r.stars || 5));
      const initials = getInitials(r.name);
      const formattedDate = formatDate(r.submitted_at);

      return `
        <article class="review-card" data-id="${r.id}">
          <div class="review-card-header">
            <div class="review-author-info">
              <div class="review-author-avatar">${escapeHtml(initials)}</div>
              <div>
                <h3 class="review-author-name">${escapeHtml(r.name)}</h3>
                <div class="review-author-meta">
                  <span>${escapeHtml(r.experience || 'Member')}</span>
                  <span>•</span>
                  <span>${escapeHtml(r.discord || '')}</span>
                </div>
              </div>
            </div>
            <div class="review-stars-badge">${starsStr}</div>
          </div>

          <div class="review-badges-row">
            <span class="review-category-pill">${escapeHtml(r.category || 'FiveM')}</span>
            ${r.recommended ? `
              <span class="review-recommended-pill">
                ✓ Recommends REAPERZ
              </span>
            ` : ''}
          </div>

          <h4 class="review-title">${escapeHtml(r.title)}</h4>
          <p class="review-comment">${escapeHtml(r.comment)}</p>

          <div class="review-footer">
            <span class="review-date">${formattedDate}</span>
            <button class="helpful-btn" data-id="${r.id}" title="Mark this review as helpful">
              👍 Helpful (<span class="helpful-count">${r.helpful || 0}</span>)
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Attach helpful upvote listeners
    grid.querySelectorAll('.helpful-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        if (btn.disabled) return;
        btn.disabled = true;

        try {
          const res = await window.ReaperzStore.upvoteRating(id);
          if (res && res.success) {
            const countEl = btn.querySelector('.helpful-count');
            if (countEl) countEl.textContent = res.helpful;
            btn.classList.add('voted');
            if (window.showToast) window.showToast('Thanks for your feedback!', 'success');
          }
        } catch (e) {
          console.error('Error upvoting review:', e);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  // --- 4. FILTER BUTTONS ---
  const filterBtns = document.querySelectorAll('.review-filter-bar .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterType = btn.dataset.filterType;
      const filterValue = btn.dataset.filterValue;

      if (filterType === 'category') {
        activeFilterCategory = filterValue;
        activeFilterStars = 'All';
      } else if (filterType === 'stars') {
        activeFilterStars = filterValue;
        activeFilterCategory = 'All';
      } else {
        activeFilterCategory = 'All';
        activeFilterStars = 'All';
      }

      loadAndRenderRatings();
    });
  });

  // --- 5. UTILITY HELPERS ---
  function getInitials(name) {
    if (!name) return 'R';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatDate(isoString) {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return 'Recent';
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

  // Initial load
  loadAndRenderRatings();
});
