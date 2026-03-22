/**
 * campaigns.js — Listagem e gestão de campanhas
 * Tela: campaigns.html
 */

const API_BASE = window.API_BASE;

// ── Verificação de autenticação ──────────────────────────────
const token = localStorage.getItem('jwt');
if (!token) window.location.href = 'index.html';

// ── Decodifica JWT (sem lib) ─────────────────────────────────
function decodeJwt(t) {
  try {
    const parts = t.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (_) { return null; }
}

const jwtPayload = decodeJwt(token);
if (!jwtPayload) { localStorage.removeItem('jwt'); window.location.href = 'index.html'; }

const currentUserId   = jwtPayload.userId || jwtPayload.id || jwtPayload.sub;
const currentUsername = jwtPayload.username || jwtPayload.name || 'Usuário';

// ── Cabeçalho ─────────────────────────────────────────────────
document.getElementById('header-username').textContent = currentUsername;
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('jwt');
  window.location.href = 'index.html';
});

// ── Elementos ─────────────────────────────────────────────────
const campaignsList     = document.getElementById('campaigns-list');
const campaignsError    = document.getElementById('campaigns-error');
const createModal       = document.getElementById('create-modal');
const createForm        = document.getElementById('create-campaign-form');
const createError       = document.getElementById('create-campaign-error');
const campaignNameInput = document.getElementById('campaign-name');
const joinModal         = document.getElementById('join-modal');
const joinForm          = document.getElementById('join-by-code-form');
const joinError         = document.getElementById('join-by-code-error');
const campaignCodeInput = document.getElementById('campaign-code');
const detailModal       = document.getElementById('detail-modal');

// ── Helpers ───────────────────────────────────────────────────
function showCampaignsError(msg) {
  campaignsError.textContent = msg;
  campaignsError.classList.remove('hidden');
}
function hideCampaignsError() { campaignsError.classList.add('hidden'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-loading').classList.toggle('hidden', !loading);
}

function masterId(campaign) {
  // masterId pode ser string (não populado) ou objeto populado { _id, username }
  return campaign.masterId?._id ?? campaign.masterId;
}

function isMaster(campaign) {
  return String(masterId(campaign)) === String(currentUserId);
}

// ── Carregar campanhas ─────────────────────────────────────────
async function loadCampaigns() {
  campaignsList.innerHTML = '<div class="campaigns-loading">Carregando campanhas...</div>';
  hideCampaignsError();
  try {
    const res = await fetch(`${API_BASE}/api/campaigns`, { headers: authHeaders() });
    if (res.status === 401) { localStorage.removeItem('jwt'); window.location.href = 'index.html'; return; }
    const data = await res.json();
    if (!res.ok) { showCampaignsError(data.error || 'Erro ao carregar campanhas.'); campaignsList.innerHTML = ''; return; }
    renderCampaigns(Array.isArray(data) ? data : (data.campaigns || []));
  } catch {
    showCampaignsError('Erro de conexão com o servidor.');
    campaignsList.innerHTML = '';
  }
}

function renderCampaigns(campaigns) {
  if (campaigns.length === 0) {
    campaignsList.innerHTML = `<div class="campaigns-loading">Nenhuma campanha encontrada. Crie ou entre em uma!</div>`;
    return;
  }

  campaignsList.innerHTML = '';
  campaigns.forEach((campaign) => {
    const card = document.createElement('div');
    card.className = 'campaign-card campaign-card-clickable';

    const masterUsername = campaign.masterId?.username || 'Desconhecido';
    const mine = isMaster(campaign);
    const playerCount = campaign.players?.length ?? 0;
    const role = mine ? 'Mestre' : 'Jogador';

    card.innerHTML = `
      <div class="campaign-card-name">${escapeHtml(campaign.name)}</div>
      <div class="campaign-card-master">
        Mestre: <span>${escapeHtml(masterUsername)}</span>
      </div>
      <div class="campaign-card-meta">
        <span class="campaign-card-role ${mine ? 'role-master' : 'role-player'}">${role}</span>
        <span class="campaign-card-players">${playerCount} jogador${playerCount !== 1 ? 'es' : ''}</span>
      </div>
    `;

    card.addEventListener('click', () => openDetailModal(campaign));
    campaignsList.appendChild(card);
  });
}

// ── Modal: detalhes da campanha ───────────────────────────────
let detailCampaign = null;

function openDetailModal(campaign) {
  detailCampaign = campaign;

  const masterUsername = campaign.masterId?.username || 'Desconhecido';
  const mine = isMaster(campaign);
  const players = campaign.players || [];
  const playerNames = players.map(p => p.username || '?').join(', ') || 'Nenhum ainda';
  const createdAt = campaign.createdAt
    ? new Date(campaign.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  document.getElementById('detail-campaign-name').textContent = campaign.name;
  document.getElementById('detail-master-name').textContent = masterUsername + (mine ? ' (você)' : '');
  document.getElementById('detail-players').textContent = playerNames;
  document.getElementById('detail-created-at').textContent = createdAt;
  document.getElementById('detail-campaign-code').textContent = campaign.slug;
  document.getElementById('detail-error').classList.add('hidden');

  // Mostra código só pro mestre
  document.getElementById('detail-code-row').classList.toggle('hidden', !mine);

  // Botões de ação
  document.getElementById('detail-leave-btn').classList.toggle('hidden', mine);
  document.getElementById('detail-delete-btn').classList.toggle('hidden', !mine);

  // Reset loading state dos botões
  ['detail-leave-btn', 'detail-delete-btn'].forEach(id => {
    const btn = document.getElementById(id);
    btn.disabled = false;
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-loading').classList.add('hidden');
  });

  detailModal.classList.remove('hidden');
}

function closeDetailModal() {
  detailModal.classList.add('hidden');
  detailCampaign = null;
}

document.getElementById('detail-close-btn').addEventListener('click', closeDetailModal);
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetailModal(); });

document.getElementById('detail-play-btn').addEventListener('click', () => {
  if (detailCampaign) {
    window.location.href = `game.html?campaign=${encodeURIComponent(detailCampaign.slug)}`;
  }
});

document.getElementById('detail-copy-code-btn').addEventListener('click', () => {
  const code = document.getElementById('detail-campaign-code').textContent;
  const btn = document.getElementById('detail-copy-code-btn');
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '⧉'; }, 1500);
  });
});

document.getElementById('detail-leave-btn').addEventListener('click', async () => {
  if (!detailCampaign) return;
  if (!confirm(`Sair de "${detailCampaign.name}"? Você precisará do código para entrar novamente.`)) return;

  setLoading('detail-leave-btn', true);
  document.getElementById('detail-error').classList.add('hidden');
  try {
    const res = await fetch(`${API_BASE}/api/campaigns/${detailCampaign.slug}/leave`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('detail-error').textContent = data.error || 'Erro ao sair.';
      document.getElementById('detail-error').classList.remove('hidden');
      setLoading('detail-leave-btn', false);
      return;
    }
    closeDetailModal();
    await loadCampaigns();
  } catch {
    document.getElementById('detail-error').textContent = 'Erro de conexão.';
    document.getElementById('detail-error').classList.remove('hidden');
    setLoading('detail-leave-btn', false);
  }
});

document.getElementById('detail-delete-btn').addEventListener('click', async () => {
  if (!detailCampaign) return;
  if (!confirm(`Deletar "${detailCampaign.name}" permanentemente? Esta ação não pode ser desfeita.`)) return;

  setLoading('detail-delete-btn', true);
  document.getElementById('detail-error').classList.add('hidden');
  try {
    const res = await fetch(`${API_BASE}/api/campaigns/${detailCampaign.slug}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('detail-error').textContent = data.error || 'Erro ao deletar.';
      document.getElementById('detail-error').classList.remove('hidden');
      setLoading('detail-delete-btn', false);
      return;
    }
    closeDetailModal();
    await loadCampaigns();
  } catch {
    document.getElementById('detail-error').textContent = 'Erro de conexão.';
    document.getElementById('detail-error').classList.remove('hidden');
    setLoading('detail-delete-btn', false);
  }
});

// ── Modal: criar campanha ─────────────────────────────────────
document.getElementById('create-campaign-btn').addEventListener('click', () => {
  createError.classList.add('hidden');
  campaignNameInput.value = '';
  document.getElementById('create-campaign-form').classList.remove('hidden');
  document.getElementById('create-campaign-success').classList.add('hidden');
  document.getElementById('create-modal-title').textContent = 'Nova Campanha';
  createModal.classList.remove('hidden');
  campaignNameInput.focus();
});

function closeCreateModal() { createModal.classList.add('hidden'); }

document.getElementById('modal-close-btn').addEventListener('click', closeCreateModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeCreateModal);
createModal.addEventListener('click', (e) => { if (e.target === createModal) closeCreateModal(); });

let createdCampaignSlug = null;

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  createError.classList.add('hidden');
  const name = campaignNameInput.value.trim();
  if (!name) {
    createError.textContent = 'Informe o nome da campanha.';
    createError.classList.remove('hidden');
    return;
  }

  setLoading('create-campaign-submit', true);
  try {
    const res = await fetch(`${API_BASE}/api/campaigns`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      createError.textContent = data.error || 'Erro ao criar campanha.';
      createError.classList.remove('hidden');
      return;
    }

    createdCampaignSlug = data.slug;
    document.getElementById('created-campaign-name').textContent = data.name;
    document.getElementById('created-master-name').textContent = data.masterName || currentUsername;
    document.getElementById('created-campaign-code').textContent = data.slug;
    document.getElementById('created-campaign-id').textContent = data._id;
    document.getElementById('create-campaign-form').classList.add('hidden');
    document.getElementById('create-campaign-success').classList.remove('hidden');
    document.getElementById('create-modal-title').textContent = 'Campanha Criada!';
    await loadCampaigns();
  } catch {
    createError.textContent = 'Erro de conexão.';
    createError.classList.remove('hidden');
  } finally {
    setLoading('create-campaign-submit', false);
  }
});

document.getElementById('created-close-btn').addEventListener('click', closeCreateModal);
document.getElementById('created-enter-btn').addEventListener('click', () => {
  if (createdCampaignSlug) window.location.href = `game.html?campaign=${encodeURIComponent(createdCampaignSlug)}`;
});
document.getElementById('created-copy-btn').addEventListener('click', () => {
  const code = document.getElementById('created-campaign-code').textContent;
  const btn = document.getElementById('created-copy-btn');
  navigator.clipboard.writeText(code).then(() => { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⧉'; }, 1500); });
});
document.getElementById('created-copy-id-btn').addEventListener('click', () => {
  const id = document.getElementById('created-campaign-id').textContent;
  const btn = document.getElementById('created-copy-id-btn');
  navigator.clipboard.writeText(id).then(() => { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⧉'; }, 1500); });
});

// ── Modal: entrar por código ──────────────────────────────────
document.getElementById('join-by-code-btn').addEventListener('click', () => {
  joinError.classList.add('hidden');
  campaignCodeInput.value = '';
  joinModal.classList.remove('hidden');
  campaignCodeInput.focus();
});

function closeJoinModal() { joinModal.classList.add('hidden'); }
document.getElementById('join-modal-close-btn').addEventListener('click', closeJoinModal);
document.getElementById('join-modal-cancel-btn').addEventListener('click', closeJoinModal);
joinModal.addEventListener('click', (e) => { if (e.target === joinModal) closeJoinModal(); });

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  joinError.classList.add('hidden');
  const code = campaignCodeInput.value.trim();
  if (!code) {
    joinError.textContent = 'Informe o código da campanha.';
    joinError.classList.remove('hidden');
    return;
  }

  setLoading('join-by-code-submit', true);
  try {
    const res = await fetch(`${API_BASE}/api/campaigns/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (res.status === 401) { localStorage.removeItem('jwt'); window.location.href = 'index.html'; return; }
    const data = await res.json();
    if (!res.ok) {
      joinError.textContent = data.error || 'Campanha não encontrada.';
      joinError.classList.remove('hidden');
      return;
    }
    closeJoinModal();
    await loadCampaigns();
  } catch {
    joinError.textContent = 'Erro de conexão.';
    joinError.classList.remove('hidden');
  } finally {
    setLoading('join-by-code-submit', false);
  }
});

// ── Init ──────────────────────────────────────────────────────
loadCampaigns();
