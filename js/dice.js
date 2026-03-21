/**
 * dice.js — Sistema de dados
 *
 * Fluxo:
 *  1. Cliente clica → emite 'roll dice' ao servidor
 *  2. Servidor avisa todos: "fulano rolou dX" (sem resultado)
 *  3. CADA CLIENTE calcula o resultado localmente e exibe o popup
 */

(function initDice() {
  const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
  const DICE_MAX   = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

  const diceGrid = document.getElementById('dice-grid');
  const diceLog  = document.getElementById('dice-log');

  // ── Renderiza botões ───────────────────────────────────────────
  DICE_TYPES.forEach((diceType) => {
    const btn = document.createElement('button');
    btn.className = 'dice-btn';
    btn.textContent = diceType.toUpperCase();
    btn.title = `Rolar ${diceType}`;
    diceGrid.appendChild(btn);
    btn.addEventListener('click', () => rollDice(diceType));
  });

  // ── Rolar dado ────────────────────────────────────────────────
  function rollDice(diceType) {
    const campaignId = window.CAMPAIGN_ID;
    if (!campaignId) { console.warn('[dice] sem CAMPAIGN_ID'); return; }
    if (!window.socket?.connected) { console.warn('[dice] socket desconectado'); return; }

    const max    = DICE_MAX[diceType] || 20;
    const result = Math.floor(Math.random() * max) + 1;

    window.socket.emit('roll dice', { campaignId, diceType, result });
  }

  // ── Evento do servidor ────────────────────────────────────────
  // O servidor recebe o resultado do cliente que rolou e faz broadcast.
  // Todos os clientes recebem o mesmo resultado e exibem a mesma animação.
  function onDiceRolled({ username, diceType, result }) {
    showDicePopup(diceType, result, username);
    appendDiceLog(username, diceType, result);
  }

  // ── Popup ─────────────────────────────────────────────────────
  function showDicePopup(diceType, result, username) {
    const max = DICE_MAX[diceType] || 20;

    const overlay = document.createElement('div');
    overlay.className = 'dice-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'dice-popup';

    const label = document.createElement('div');
    label.className = 'dice-popup-label';
    label.textContent = diceType.toUpperCase();

    const numEl = document.createElement('div');
    numEl.className = 'dice-popup-number';
    numEl.textContent = '?';

    const userEl = document.createElement('div');
    userEl.className = 'dice-popup-user';
    userEl.textContent = `${username} rolou`;

    popup.appendChild(label);
    popup.appendChild(numEl);
    popup.appendChild(userEl);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    function close() {
      clearTimeout(timerId);
      overlay.remove();
    }

    // Desacelera e para no resultado
    const steps = [60, 60, 80, 80, 100, 130, 170, 220, 300, 400];
    let i = 0;
    let timerId;

    function spin() {
      if (i < steps.length) {
        numEl.textContent = Math.floor(Math.random() * max) + 1;
        timerId = setTimeout(spin, steps[i++]);
      } else {
        // Para no resultado final
        numEl.textContent = result;
        numEl.classList.add('final');
        setTimeout(close, 2000);
      }
    }
    spin();
  }

  // ── Log na sidebar ────────────────────────────────────────────
  function appendDiceLog(username, diceType, result) {
    const entry = document.createElement('div');
    entry.className = 'dice-log-entry';
    entry.innerHTML = `🎲 <strong>${escapeHtml(username)}</strong> rolou ${diceType.toUpperCase()}: <strong>${result}</strong>`;
    diceLog.appendChild(entry);
    diceLog.scrollTop = diceLog.scrollHeight;
    while (diceLog.children.length > 50) diceLog.removeChild(diceLog.firstChild);
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  // ── Exposição pública ──────────────────────────────────────────
  window.Dice = { onDiceRolled };
})();
