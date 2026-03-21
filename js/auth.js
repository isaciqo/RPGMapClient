/**
 * auth.js — Lógica de login e registro
 * Tela: index.html
 */

const API_BASE = 'http://localhost:3000';

// ── Elementos ───────────────────────────────────────────────
const loginForm      = document.getElementById('login-form');
const registerForm   = document.getElementById('register-form');
const loginError     = document.getElementById('login-error');
const registerError  = document.getElementById('register-error');
const registerSuccess = document.getElementById('register-success');

document.getElementById('show-register').addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

// ── Utilidades ──────────────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError(el) {
  el.classList.add('hidden');
  el.textContent = '';
}
function setLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const load = btn.querySelector('.btn-loading');
  btn.disabled = loading;
  text.classList.toggle('hidden', loading);
  load.classList.toggle('hidden', !loading);
}

// ── Login ────────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');

  if (!username || !password) {
    showError(loginError, 'Preencha todos os campos.');
    return;
  }

  setLoading(btn, true);

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(loginError, data.message || 'Credenciais inválidas.');
      return;
    }

    if (!data.token) {
      showError(loginError, 'Resposta inválida do servidor.');
      return;
    }

    localStorage.setItem('jwt', data.token);
    window.location.href = 'campaigns.html';

  } catch (err) {
    showError(loginError, 'Erro de conexão. Verifique o servidor.');
  } finally {
    setLoading(btn, false);
  }
});

// ── Registro ─────────────────────────────────────────────────
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(registerError);
  registerSuccess.classList.add('hidden');

  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const btn = document.getElementById('register-btn');

  if (!username || !password) {
    showError(registerError, 'Preencha todos os campos.');
    return;
  }
  if (password !== confirm) {
    showError(registerError, 'As senhas não coincidem.');
    return;
  }
  if (password.length < 4) {
    showError(registerError, 'Senha deve ter pelo menos 4 caracteres.');
    return;
  }

  setLoading(btn, true);

  try {
    
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(registerError, data.message || 'Erro ao criar conta.');
      return;
    }

    registerSuccess.textContent = 'Conta criada! Faça login.';
    registerSuccess.classList.remove('hidden');
    registerForm.reset();

    // Volta ao login após 1.5s
    setTimeout(() => {
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    }, 1500);

  } catch (err) {
    showError(registerError, 'Erro de conexão. Verifique o servidor.');
  } finally {
    setLoading(btn, false);
  }
});

// ── Redireciona se já estiver logado ─────────────────────────
(function checkAlreadyLoggedIn() {
  const token = localStorage.getItem('jwt');
  if (!token) return;

  // Verifica validade básica sem requisição (decode simples)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() / 1000 < payload.exp) {
      window.location.href = 'campaigns.html';
    }
  } catch (_) {
    localStorage.removeItem('jwt');
  }
})();
