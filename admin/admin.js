(function () {
  'use strict';

  function qs(sel) {
    return document.querySelector(sel);
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      // non-JSON response; leave data as {}
    }
    return { ok: res.ok, status: res.status, data: data };
  }

  function initLoginPage() {
    const form = qs('#admin-login-form');
    if (!form) return;

    const errorEl = qs('#admin-login-error');
    const submitBtn = qs('#admin-login-submit');
    const emailInput = qs('#admin-email');
    const passwordInput = qs('#admin-password');

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    function hideError() {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideError();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showError('Введіть email та пароль.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Вхід...';

      postJSON('/api/admin/login', { email: email, password: password })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            window.location.href = '/admin/dashboard.html';
            return;
          }
          if (result.status === 429) {
            showError('Забагато спроб входу. Спробуйте пізніше.');
          } else if (result.status === 503) {
            showError('Адмін-панель тимчасово недоступна.');
          } else {
            showError('Невірний email або пароль.');
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Увійти';
        })
        .catch(function () {
          showError('Помилка з’єднання. Спробуйте ще раз.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Увійти';
        });
    });
  }

  function initDashboardPage() {
    const emailEl = qs('#admin-email-display');
    const logoutBtn = qs('#admin-logout');
    if (!emailEl && !logoutBtn) return;

    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.authenticated) {
          window.location.href = '/admin/login.html';
          return;
        }
        if (emailEl) emailEl.textContent = data.email;
      })
      .catch(function () {
        window.location.href = '/admin/login.html';
      });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logoutBtn.disabled = true;
        fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
          .catch(function () {})
          .then(function () {
            window.location.href = '/admin/login.html';
          });
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLoginPage();
    initDashboardPage();
  });
})();
