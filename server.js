/**
 * server.js — Servidor do cliente TableRise
 *
 * Responsabilidades:
 *  1. Serve os arquivos estáticos do cliente (HTML/CSS/JS)
 *  2. Serve o socket.io.js da lib instalada localmente
 *
 * O que NÃO faz:
 *  - Não faz proxy para o backend
 *  - Não abre conexão Socket.IO
 *
 * O browser conecta diretamente ao backend (porta 3000) via Socket.IO.
 * As chamadas REST (/api/*) também vão direto para a porta 3000.
 * O backend precisa ter CORS habilitado para http://localhost:PORT.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import express from 'express';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require   = createRequire(import.meta.url);

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = express();

// ── 1. CORS — libera o backend (porta 3000) acessar este servidor ─
// O próprio backend em :3000 vai receber requisições originadas de
// http://localhost:8080 — ele precisa permitir essa origem.
// Aqui configuramos os headers para respostas que saem deste servidor.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// ── 2. Serve socket.io.js da lib local ───────────────────────────
// O game.html pede /socket.io/socket.io.js — entregamos da nossa
// instalação local, sem precisar buscar nada no backend.
const SOCKET_IO_CLIENT = require.resolve('socket.io-client/dist/socket.io.js');

app.get('/socket.io/socket.io.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(SOCKET_IO_CLIENT);
});

// ── 3. Arquivos estáticos do cliente ─────────────────────────────
app.use(
  express.static(__dirname, {
    index: 'index.html',
    dotfiles: 'deny',
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    },
  })
);

// ── 4. Fallback SPA ───────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── 5. Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ⚔️  TableRise — servidor do cliente');
  console.log(`  Cliente:  http://localhost:${PORT}`);
  console.log(`  Backend:  http://localhost:3000  (conexão direta do browser)`);
  console.log('');
});
