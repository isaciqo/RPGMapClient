/**
 * socket.js — Conexão Socket.IO autenticada
 *
 * Exporta `window.socket` para uso nos demais módulos.
 * Redireciona para login se o token for inválido ou ausente.
 */

(function initSocket() {
  const token = localStorage.getItem('jwt');
  if (!token) { window.location.href = 'index.html'; return; }

  const SERVER_URL = window.API_BASE;

  const socket = io(SERVER_URL, {
    auth: { token },
    reconnectionAttempts: 5,
    reconnectionDelay: 1500,
  });

  // ── Logs de conexão ────────────────────────────────────────
  socket.on('connect', () => {
    console.log(`%c[SOCKET] conectado  id=${socket.id}`, 'color:#4ade80;font-weight:bold');
  });

  socket.on('disconnect', (reason) => {
    console.log(`%c[SOCKET] desconectado  reason=${reason}`, 'color:#f87171;font-weight:bold');
  });

  // ── Log de todos os eventos RECEBIDOS do servidor ──────────
  socket.onAny((event, data) => {
    console.log(
      `%c[SOCKET IN ] ← "${event}"`,
      'color:#4ade80;font-weight:bold',
      data,
    );
  });

  // ── Wrap socket.emit para logar todos os eventos ENVIADOS ──
  const _emit = socket.emit.bind(socket);
  socket.emit = function (event, ...args) {
    console.log(
      `%c[SOCKET OUT] → "${event}"`,
      'color:#60a5fa;font-weight:bold',
      args[0],
    );
    return _emit(event, ...args);
  };

  // ── Erros de autenticação ──────────────────────────────────
  socket.on('connect_error', (err) => {
    console.error('[SOCKET] connect_error:', err.message);
    const msg = err?.message || '';
    const isAuthError =
      msg.toLowerCase().includes('auth') ||
      msg.toLowerCase().includes('unauthorized') ||
      msg.toLowerCase().includes('token') ||
      msg.toLowerCase().includes('jwt') ||
      err?.data?.type === 'AuthError';
    if (isAuthError) {
      localStorage.removeItem('jwt');
      window.location.href = 'index.html';
    }
  });

  window.socket = socket;
})();
