# ⚔️ TableRise — Cliente Web

Interface web para o **TableRise**, um sistema de RPG de mesa virtual. Permite que jogadores e mestres se conectem em campanhas, movam personagens num mapa compartilhado, rolem dados e troquem mensagens em tempo real.

---

## O que faz

- **Login e registro** de usuários
- **Listagem e criação de campanhas**, com identificação do mestre
- **Mapa interativo** com objetos arrastáveis e redimensionáveis em tempo real para todos os participantes
- **Dois tipos de objeto no mapa:** personagens (circular) e imagens/cenário (quadrado)
- **Chat** em tempo real por campanha
- **Sistema de dados** (d4, d6, d8, d10, d12, d20, d100) — resultado calculado pelo servidor
- **Biblioteca de imagens** pessoal por usuário, aplicável a qualquer objeto no mapa
- **Troca de fundo do mapa** (exclusivo para o mestre da campanha)

---

## Pré-requisitos

- [Node.js](https://nodejs.org) 18+ (para rodar o servidor do cliente)
- O servidor **TableRise** (Express + Socket.IO) rodando
- Um navegador moderno (Chrome, Firefox, Edge)

---

## Como rodar

### 1. Inicie o backend TableRise

O cliente depende do servidor TableRise para funcionar. Siga as instruções do repositório do servidor para iniciá-lo. Por padrão ele sobe em `http://localhost:3000`.

### 2. Instale as dependências do cliente

```bash
npm install
```

### 3. Configure o ambiente

```bash
cp .env.example .env
```

Edite o `.env` se o backend estiver em uma URL diferente de `http://localhost:3000`:

```env
PORT=8080
BACKEND_URL=http://localhost:3000
```

### 4. Inicie o servidor do cliente

```bash
npm start
```

Acesse `http://localhost:8080` no navegador.

> **Por que um servidor próprio?**
> O `server.js` faz proxy de `/api/*` e `/socket.io/*` para o backend, colocando cliente e backend na **mesma origem**. Isso elimina qualquer necessidade de configurar CORS no backend e evita que o token JWT seja exposto em requisições cross-origin.

---

## Estrutura de arquivos

```
RPGMapClient/
├── server.js           # Servidor do cliente (proxy + arquivos estáticos)
├── .env.example        # Variáveis de ambiente (copie para .env)
├── package.json
├── index.html          # Tela de login e registro
├── campaigns.html      # Lista e criação de campanhas
├── game.html           # Tela principal do jogo
├── styles.css          # Tema escuro RPG
└── js/
    ├── auth.js         # Login, registro, redirecionamento
    ├── campaigns.js    # Listar, criar e entrar em campanhas
    ├── socket.js       # Conexão Socket.IO autenticada via JWT
    ├── dice.js         # Botões de dados e log de resultados
    └── game.js         # Mapa, objetos, drag/resize, chat, biblioteca
```

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8080` | Porta em que o servidor do cliente vai ouvir |
| `BACKEND_URL` | `http://localhost:3000` | URL do servidor TableRise |
| `ALLOWED_ORIGINS` | _(vazio)_ | Origens externas permitidas via CORS, separadas por vírgula. Deixe vazio para aceitar apenas same-origin (recomendado). |

### Sobre o CORS

O `server.js` adota a política mais segura por padrão: **same-origin only**. Nenhum header `Access-Control-Allow-Origin` é enviado enquanto `ALLOWED_ORIGINS` estiver vazio, o que significa que o browser bloqueará qualquer requisição cross-origin — comportamento correto para produção.

Se precisar liberar uma origem específica (ex: um app mobile em Capacitor):

```env
ALLOWED_ORIGINS=https://app.tablerise.com
```

---

## Fluxo de uso

1. Acesse `index.html` → crie uma conta ou faça login
2. Na tela de campanhas, crie uma nova campanha ou entre em uma existente
3. Na tela de jogo:
   - Clique em **+ Personagem** ou **+ Imagem** para adicionar objetos ao mapa
   - Arraste os objetos para reposicioná-los
   - Use o handle no canto inferior direito para redimensionar
   - Clique num objeto e depois numa imagem da biblioteca para aplicar a imagem
   - Role dados clicando nos botões D4–D100 na sidebar esquerda
   - O mestre pode trocar o fundo do mapa com o botão **Mudar Fundo**

---

## Rotas da API esperadas no servidor

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria conta |
| POST | `/api/auth/login` | Retorna JWT |
| GET | `/api/campaigns` | Lista campanhas |
| POST | `/api/campaigns` | Cria campanha |
| POST | `/api/campaigns/:slug/join` | Entra na campanha |
| GET | `/api/users/images` | Lista imagens do usuário |
| POST | `/api/users/images` | Faz upload de imagem |

## Eventos Socket.IO esperados no servidor

| Emitido pelo cliente | Emitido pelo servidor |
|---|---|
| `join campaign` | `initial state` |
| `create object` | `object created` |
| `move object` | `object moved` |
| `resize object` | `object resized` |
| `delete object` | `object deleted` |
| `upload object image` | `object image updated` |
| `change background` | `background changed` |
| `roll dice` | `dice rolled` |
| `chat message` | `chat message` |
