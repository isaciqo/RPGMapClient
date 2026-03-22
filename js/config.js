/**
 * config.js — URL do backend
 *
 * Em desenvolvimento (localhost) aponta para o servidor local.
 * Em produção aponta para o backend no Render.
 *
 * Para trocar a URL de produção: altere apenas PROD_BACKEND_URL abaixo.
 */

window.API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://rpgmapserver.onrender.com';
