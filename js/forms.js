/**
 * REAPERZ Community Portal - Form Handlers (Join Us & Contact)
 * Interfaces with ReaperzStore to persist applications and contact inquiries.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. JOIN APPLICATION FORM ---
  const joinForm = document.getElementById('joinForm');
  const joinMsg = document.getElementById('joinMessage');

  if (joinForm && joinMsg) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = joinForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : 'SUBMIT';
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING...';
      }
      joinMsg.textContent = 'Processing your application...';
      joinMsg.className = 'form-message';

      const formData = new FormData(joinForm);
      const data = {
        name: formData.get('name'),
        discord: formData.get('discord'),
        age: parseInt(formData.get('age'), 10),
        game: formData.get('game'),
        role: formData.get('role') || 'Member',
        timezone: formData.get('timezone') || 'IST',
        about: formData.get('about') || ''
      };

      try {
        const result = await window.ReaperzStore.submitApplication(data);
        if (result && result.success) {
          joinForm.reset();
          joinMsg.textContent = '✓ Application submitted successfully! Welcome to the REAPERZ applicant queue.';
          joinMsg.className = 'form-message success';
          if (window.showToast) window.showToast('Application submitted successfully!', 'success');
        } else {
          throw new Error('Could not submit application.');
        }
      } catch (err) {
        joinMsg.textContent = '✗ ' + (err.message || 'Submission failed. Please try again.');
        joinMsg.className = 'form-message error';
        if (window.showToast) window.showToast('Submission error', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }

  // --- 2. CONTACT FORM ---
  const contactForm = document.getElementById('contactForm');
  const contactMsg = document.getElementById('contactMessage');

  if (contactForm && contactMsg) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : 'SEND';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SENDING...';
      }
      contactMsg.textContent = 'Sending message...';
      contactMsg.className = 'form-message';

      const formData = new FormData(contactForm);
      const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        subject: formData.get('subject') || 'General Inquiry',
        message: formData.get('message')
      };

      try {
        const result = await window.ReaperzStore.submitMessage(data);
        if (result && result.success) {
          contactForm.reset();
          contactMsg.textContent = '✓ Message received! REAPERZ Staff will get in touch with you shortly.';
          contactMsg.className = 'form-message success';
          if (window.showToast) window.showToast('Message sent to REAPERZ HQ!', 'success');
        } else {
          throw new Error('Message sending failed.');
        }
      } catch (err) {
        contactMsg.textContent = '✗ ' + (err.message || 'Could not send message.');
        contactMsg.className = 'form-message error';
        if (window.showToast) window.showToast('Message sending error', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }
});
