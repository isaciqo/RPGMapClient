/**
 * game.js — Lógica principal da tela de jogo
 *
 * Responsabilidades:
 *  • Decodifica JWT para identificar o usuário atual (sem lib)
 *  • Registra TODOS os eventos de socket UMA VEZ no topo deste módulo
 *  • Gerencia objetos no mapa (criar, mover, redimensionar, deletar)
 *  • Drag & drop com throttle de 50 ms
 *  • Resize com throttle de 50 ms — envia width/height, NÃO coordenadas do mouse
 *  • Chat e log de dados
 *  • Biblioteca de imagens (sidebar direita)
 *  • Controle de permissões: mestre x jogador
 */

(function initGame() {
  'use strict';

  // ── 1. Autenticação e identificação ──────────────────────────
  const token = localStorage.getItem('jwt');
  if (!token) { window.location.href = 'index.html'; return; }

  function decodeJwt(t) {
    try {
      const parts = t.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) { return null; }
  }

  const jwtPayload = decodeJwt(token);
  if (!jwtPayload) { localStorage.removeItem('jwt'); window.location.href = 'index.html'; return; }

  // IDs podem vir em campos diferentes dependendo da implementação do servidor
  const currentUserId   = String(jwtPayload.userId || jwtPayload.id || jwtPayload.sub || '');
  const currentUsername = jwtPayload.username || jwtPayload.name || 'Usuário';

  // ── 2. Campanha ───────────────────────────────────────────────
  const params     = new URLSearchParams(window.location.search);
  const campaignSlug = params.get('campaign');
  if (!campaignSlug) { window.location.href = 'campaigns.html'; return; }

  // Expõe o ID da campanha globalmente para dice.js
  window.CAMPAIGN_ID = campaignSlug;

  let campaignId   = campaignSlug; // pode ser sobrescrito pelo 'initial state'
  let isMaster     = false;        // definido pelo 'initial state'
  let selectedObjectId = null;     // objeto atualmente selecionado na UI

  // ── 3. Elementos DOM ──────────────────────────────────────────
  const map             = document.getElementById('map');
  const chatMessages    = document.getElementById('chat-messages');
  const chatForm        = document.getElementById('chat-form');
  const chatInput       = document.getElementById('chat-input');
  const sidebarUsername = document.getElementById('sidebar-username');
  const campaignLabel   = document.getElementById('game-campaign-name');
  const changeBgWrapper = document.getElementById('change-bg-wrapper');
  const changeBgInput   = document.getElementById('change-bg-input');
  const changeBgBtn     = document.getElementById('change-bg-btn');
  const objectImageInput = document.getElementById('object-image-input');
  const libraryContainer = document.getElementById('image-library');
  const libraryUploadInput = document.getElementById('library-upload-input');

  sidebarUsername.textContent = currentUsername;

  // ── 4. Registro de eventos do socket — UMA VEZ ───────────────
  //
  // IMPORTANTE: todos os listeners de socket são registrados aqui,
  // antes de qualquer criação de elemento. Nunca re-registre dentro
  // de funções de criação de objetos.

  const socket = window.socket;

  socket.on('initial state', onInitialState);
  socket.on('object created',       (data) => onObjectCreated(data));
  socket.on('object moved',         (data) => onObjectMoved(data));
  socket.on('object resized',       (data) => onObjectResized(data));
  socket.on('object deleted',       (data) => onObjectDeleted(data));
  socket.on('object image updated', (data) => onObjectImageUpdated(data));
  socket.on('background changed',   (data) => onBackgroundChanged(data));
  socket.on('dice rolled',          (data) => onDiceRolled(data));
  socket.on('chat message',         (data) => onChatMessage(data));

  // ── 5. Ingressa na sala da campanha ──────────────────────────
  socket.emit('join campaign', { campaignSlug });

  // ── 6. Handlers de eventos do servidor ───────────────────────

  // Servidor envia: { campaignId, role, gameState: { background, objects, messages } }
  function onInitialState({ campaignId: serverCampaignId, role, gameState }) {
    console.log('[game] onInitialState recebido', { serverCampaignId, role, gameState });

    // Atualiza campaignId para o MongoDB ObjectId real (não o slug)
    if (serverCampaignId) {
      campaignId = serverCampaignId;
      window.CAMPAIGN_ID = serverCampaignId;
    }

    // Determina papel pelo campo role
    isMaster = role === 'master';

    // Título
    document.title = `TableRise — ${campaignSlug}`;
    campaignLabel.textContent = campaignSlug;

    // Mostra botão de trocar fundo apenas para mestre
    if (isMaster) changeBgWrapper.classList.remove('hidden');

    // Fundo do mapa
    if (gameState?.background) {
      map.style.backgroundImage = `url('${gameState.background}')`;
    }

    // Limpa e reconstrói objetos
    map.querySelectorAll('.map-object').forEach(el => el.remove());
    if (Array.isArray(gameState?.objects)) {
      gameState.objects.forEach(createObjectElement);
    }

    // Reconstrói histórico de chat — mensagens são strings "[username]: texto"
    if (Array.isArray(gameState?.messages)) {
      gameState.messages.forEach((msg) => appendChatMessage(null, msg));
    }
  }

  // Servidor envia: { campaignId, object: { id, type, ownerId, ... } }
  function onObjectCreated({ object }) {
    if (object) createObjectElement(object);
  }

  function onObjectMoved({ objectId, position, userId }) {
    // Ignora próprios eventos de movimento (otimismo: já atualizou visualmente)
    if (String(userId) === currentUserId) return;

    const el = getObjectEl(objectId);
    if (!el) return;
    el.style.left = `${position.x}px`;
    el.style.top  = `${position.y}px`;
  }

  function onObjectResized({ objectId, size }) {
    // O servidor envia pixels absolutos; aplica diretamente
    const el = getObjectEl(objectId);
    if (!el) return;
    el.style.width  = `${size.width}px`;
    el.style.height = `${size.height}px`;
  }

  function onObjectDeleted({ objectId }) {
    const el = getObjectEl(objectId);
    if (el) el.remove();
    if (selectedObjectId === objectId) selectedObjectId = null;
  }

  function onObjectImageUpdated({ objectId, imageUrl }) {
    const el = getObjectEl(objectId);
    if (!el) return;
    el.style.backgroundImage = `url('${imageUrl}')`;
  }

  function onBackgroundChanged({ imageUrl }) {
    map.style.backgroundImage = `url('${imageUrl}')`;
  }

  function onDiceRolled(data) {
    const { username, diceType, result } = data;
    // Delega ao módulo de dados (animação, log de dados)
    if (window.Dice) window.Dice.onDiceRolled(data);
    // Também exibe no chat
    appendChatMessage(null, `🎲 ${username} rolou ${diceType.toUpperCase()}: ${result}`);
  }

  function onChatMessage({ username, text }) {
    appendChatMessage(username, text);
  }

  // ── 7. Criação de elementos de objeto no mapa ─────────────────

  function createObjectElement(obj) {
    const {
      id: objectId,
      objectId: objectId2,   // suporte a ambos os formatos
      ownerId,
      type,
      position = { x: 60, y: 60 },
      size     = { width: 80, height: 80 },
      imageUrl,
    } = obj;

    const id = objectId || objectId2;
    if (!id) return;

    // Remove se já existir (idempotência)
    const existing = getObjectEl(id);
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `map-object object-${type === 'player' ? 'player' : 'image'}`;
    el.dataset.objectId = id;
    el.dataset.ownerId  = String(ownerId || '');
    el.dataset.type     = type;

    el.style.left   = `${position.x}px`;
    el.style.top    = `${position.y}px`;
    el.style.width  = `${size.width}px`;
    el.style.height = `${size.height}px`;

    if (imageUrl) {
      el.style.backgroundImage = `url('${imageUrl}')`;
    }

    // Botão de exclusão — visível apenas para dono ou mestre
    const canDelete = isMaster || String(ownerId) === currentUserId;
    if (canDelete) {
      const delBtn = document.createElement('button');
      delBtn.className = 'object-delete-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Remover objeto';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteObject(id);
      });
      el.appendChild(delBtn);
    }

    // Botão de upload de imagem no objeto
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'object-upload-btn';
    uploadBtn.textContent = '📷 Imagem';
    uploadBtn.title = 'Trocar imagem do objeto';
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openObjectImagePicker(id);
    });
    el.appendChild(uploadBtn);

    // Handle de resize
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    el.appendChild(resizeHandle);

    // Cursor indica se pode mover (avaliado no momento da criação e atualizado após initial state)
    const canMove = isMaster || String(ownerId) === currentUserId;
    el.style.cursor = canMove ? 'grab' : 'default';
    resizeHandle.style.display = canMove ? '' : 'none';

    // Interatividade
    el.addEventListener('mousedown', (e) => onObjectMouseDown(e, el, id));
    resizeHandle.addEventListener('mousedown', (e) => onResizeMouseDown(e, el, id));
    el.addEventListener('click', () => selectObject(id));

    map.appendChild(el);
  }

  function getObjectEl(objectId) {
    return map.querySelector(`[data-object-id="${CSS.escape(String(objectId))}"]`);
  }

  // ── 8. Seleção de objeto ──────────────────────────────────────

  function selectObject(objectId) {
    // Desseleciona anterior
    if (selectedObjectId) {
      const prev = getObjectEl(selectedObjectId);
      if (prev) prev.classList.remove('selected');
    }
    selectedObjectId = objectId;
    const el = getObjectEl(objectId);
    if (el) el.classList.add('selected');
  }

  // Clique no mapa fora de um objeto desseleciona
  map.addEventListener('click', (e) => {
    if (e.target === map) {
      if (selectedObjectId) {
        const el = getObjectEl(selectedObjectId);
        if (el) el.classList.remove('selected');
        selectedObjectId = null;
      }
    }
  });

  // ── 9. Drag & Drop ────────────────────────────────────────────

  let dragState = null;  // { el, objectId, offsetX, offsetY, lastEmit }

  function canManipulate(el) {
    // Mestre pode mover/redimensionar qualquer coisa; jogador só os seus
    return isMaster || el.dataset.ownerId === currentUserId;
  }

  function onObjectMouseDown(e, el, objectId) {
    // Ignora clique no resize handle e botões
    if (e.target.classList.contains('resize-handle')) return;
    if (e.target.tagName === 'BUTTON') return;

    if (!canManipulate(el)) {
      selectObject(objectId); // seleciona mas não arrasta
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const rect = el.getBoundingClientRect();
    dragState = {
      el,
      objectId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      lastEmit: 0,
    };

    selectObject(objectId);
  }

  document.addEventListener('mousemove', (e) => {
    if (!dragState) return;

    const { el, objectId, offsetX, offsetY } = dragState;
    const mapRect = map.getBoundingClientRect();

    // Posição relativa ao mapa, em pixels absolutos
    const x = Math.max(0, e.clientX - mapRect.left - offsetX);
    const y = Math.max(0, e.clientY - mapRect.top  - offsetY);

    // Atualiza visual imediatamente (sem esperar confirmação do servidor)
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    // Throttle: emite no máximo a cada 50 ms
    const now = Date.now();
    if (now - dragState.lastEmit >= 50) {
      dragState.lastEmit = now;
      socket.emit('move object', {
        campaignId,
        objectId,
        position: { x, y },
      });
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (!dragState) return;

    const { el, objectId, offsetX, offsetY } = dragState;
    const mapRect = map.getBoundingClientRect();

    const x = Math.max(0, e.clientX - mapRect.left - offsetX);
    const y = Math.max(0, e.clientY - mapRect.top  - offsetY);

    // Posição final garantida
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    socket.emit('move object', {
      campaignId,
      objectId,
      position: { x, y },
    });

    dragState = null;
  });

  // ── 10. Resize ────────────────────────────────────────────────

  let resizeState = null;  // { el, objectId, startX, startY, startW, startH, lastEmit }

  function onResizeMouseDown(e, el, objectId) {
    if (!canManipulate(el)) return;

    e.preventDefault();
    e.stopPropagation();

    resizeState = {
      el,
      objectId,
      startX: e.clientX,
      startY: e.clientY,
      startW: el.offsetWidth,
      startH: el.offsetHeight,
      lastEmit: 0,
    };
  }

  document.addEventListener('mousemove', (e) => {
    if (!resizeState) return;

    const { el, objectId, startX, startY, startW, startH } = resizeState;

    // Calcula tamanho em pixels — NÃO usa coordenadas do mouse diretamente
    const newW = Math.max(40, startW + (e.clientX - startX));
    const newH = Math.max(40, startH + (e.clientY - startY));

    el.style.width  = `${newW}px`;
    el.style.height = `${newH}px`;

    // Throttle
    const now = Date.now();
    if (now - resizeState.lastEmit >= 50) {
      resizeState.lastEmit = now;
      socket.emit('resize object', {
        campaignId,
        objectId,
        size: { width: newW, height: newH },
      });
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (!resizeState) return;

    const { el, objectId, startX, startY, startW, startH } = resizeState;
    const newW = Math.max(40, startW + (e.clientX - startX));
    const newH = Math.max(40, startH + (e.clientY - startY));

    el.style.width  = `${newW}px`;
    el.style.height = `${newH}px`;
    socket.emit('resize object', {
      campaignId,
      objectId,
      size: { width: newW, height: newH },
    });

    resizeState = null;
  });

  // ── 11. Criar objetos ─────────────────────────────────────────

  document.getElementById('add-player-btn').addEventListener('click', () => {
    socket.emit('create object', {
      campaignId,
      type: 'player',
      position: { x: 100, y: 100 },
      size: { width: 80, height: 80 },
    });
  });

  document.getElementById('add-image-btn').addEventListener('click', () => {
    socket.emit('create object', {
      campaignId,
      type: 'image',
      position: { x: 120, y: 120 },
      size: { width: 100, height: 100 },
    });
  });

  // ── 12. Deletar objeto ─────────────────────────────────────────

  function deleteObject(objectId) {
    socket.emit('delete object', { campaignId, objectId });
  }

  // ── 13. Upload de imagem no objeto ────────────────────────────

  let pendingUploadObjectId = null;

  function openObjectImagePicker(objectId) {
    pendingUploadObjectId = objectId;
    objectImageInput.value = '';
    objectImageInput.click();
  }

  objectImageInput.addEventListener('change', () => {
    const file = objectImageInput.files[0];
    if (!file || !pendingUploadObjectId) return;
    compressAndReadImage(file, (base64) => {
      socket.emit('upload object image', {
        campaignId,
        objectId: pendingUploadObjectId,
        imageData: base64,
      });
      pendingUploadObjectId = null;
    });
  });

  // ── 14. Trocar fundo (mestre) ─────────────────────────────────

  changeBgBtn.addEventListener('click', () => {
    changeBgInput.value = '';
    changeBgInput.click();
  });

  changeBgInput.addEventListener('change', () => {
    const file = changeBgInput.files[0];
    if (!file) return;
    // Fundo do mapa pode ser maior: 1920px, qualidade um pouco menor
    compressAndReadImage(file, (base64) => {
      socket.emit('change background', { campaignId, imageUrl: base64 });
    }, 1920, 0.80);
  });

  // ── 15. Chat ──────────────────────────────────────────────────

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    socket.emit('chat message', { campaignId, text });
    chatInput.value = '';
  });

  function appendChatMessage(username, text) {
    const div = document.createElement('div');
    div.className = 'chat-message';

    if (username) {
      div.innerHTML = `<span class="chat-message-author">${escapeHtml(username)}:</span>${escapeHtml(text)}`;
    } else {
      // Mensagens de sistema (dados, etc.)
      div.style.color = 'var(--text-dim)';
      div.textContent = text;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Limita histórico visual
    while (chatMessages.children.length > 200) {
      chatMessages.removeChild(chatMessages.firstChild);
    }
  }

  // ── 16. Biblioteca de imagens ─────────────────────────────────

  async function loadImageLibrary() {
    try {
      const res = await fetch('http://localhost:3000/api/users/images', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const images = Array.isArray(data) ? data : (data.images || []);
      renderImageLibrary(images);
    } catch (_) {
      // Falha silenciosa na biblioteca
    }
  }

  function renderImageLibrary(images) {
    if (images.length === 0) {
      libraryContainer.innerHTML = '<p class="library-empty">Nenhuma imagem ainda.</p>';
      return;
    }
    libraryContainer.innerHTML = '';
    images.forEach((img) => {
      const url = typeof img === 'string' ? img : (img.url || img.imageUrl || '');
      const id  = typeof img === 'object' ? img.id : null;
      if (!url) return;

      const wrap = document.createElement('div');
      wrap.className = 'library-thumb-wrap';

      const thumb = document.createElement('img');
      thumb.src = url;
      thumb.className = 'library-thumb';
      thumb.loading = 'lazy';
      thumb.title = 'Clique para aplicar ao objeto selecionado';
      thumb.addEventListener('click', () => applyLibraryImage(url));

      wrap.appendChild(thumb);

      if (id) {
        const delBtn = document.createElement('button');
        delBtn.className = 'library-thumb-delete';
        delBtn.title = 'Remover da biblioteca';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteLibraryImage(id, wrap);
        });
        wrap.appendChild(delBtn);
      }

      libraryContainer.appendChild(wrap);
    });
  }

  async function deleteLibraryImage(imageId, wrapEl) {
    try {
      const res = await fetch(`http://localhost:3000/api/users/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        // Mostra mensagem de erro inline perto do thumbnail
        const msg = document.createElement('div');
        msg.className = 'library-error-msg';
        msg.textContent = data.error || 'Erro ao deletar.';
        wrapEl.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
        return;
      }
      wrapEl.remove();
      // Se a biblioteca ficou vazia, mostra mensagem
      if (libraryContainer.children.length === 0) {
        libraryContainer.innerHTML = '<p class="library-empty">Nenhuma imagem ainda.</p>';
      }
    } catch {
      console.error('[library] erro ao deletar imagem');
    }
  }

  function applyLibraryImage(url) {
    if (!selectedObjectId) return;
    socket.emit('upload object image', {
      campaignId,
      objectId: selectedObjectId,
      imageUrl: url,   // Usa URL direta em vez de base64
    });
  }

  // Upload de nova imagem para a biblioteca
  document.getElementById('upload-library-btn').addEventListener('click', () => {
    libraryUploadInput.value = '';
    libraryUploadInput.click();
  });

  libraryUploadInput.addEventListener('change', async () => {
    const file = libraryUploadInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('http://localhost:3000/api/users/images', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        await loadImageLibrary();
      }
    } catch (_) {
      // Falha silenciosa
    }
  });

  // ── 17. Utilitários ───────────────────────────────────────────

  /**
   * Comprime uma imagem antes de converter para base64.
   * Redimensiona para no máximo maxPx em qualquer dimensão e aplica
   * compressão JPEG (quality). SVG e GIF animados passam sem compressão.
   */
  function compressAndReadImage(file, callback, maxPx = 1024, quality = 0.82) {
    // SVG não precisa de compressão via canvas
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => callback(reader.result);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Redimensiona mantendo proporção
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else                 { width = Math.round(width * maxPx / height);  height = maxPx; }
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        const originalKB   = Math.round(file.size / 1024);
        const compressedKB = Math.round(compressed.length * 0.75 / 1024);
        console.log(`[image] comprimido: ${originalKB}KB → ${compressedKB}KB  (${width}x${height})`);
        callback(compressed);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  // ── 18. Init ──────────────────────────────────────────────────
  loadImageLibrary();

})();
