// src/server.js — Servidor principal dr Mecânico
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const app = express();

// ── Segurança ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      fontSrc:    ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc:     ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"] // API do Claude só pelo servidor — nunca direto do browser
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || true
    : true,
  credentials: true
}));

// Rate limit global: 200 req/min por IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' }
}));

// Rate limit mais restrito para login: 10 tentativas/min
const loginLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Arquivos estáticos ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Rotas da API ───────────────────────────────────────────
app.use('/api/auth/login',    loginLimit);
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/ai',            require('./routes/ai'));
app.use('/api/agendamentos',  require('./routes/agendamentos'));
app.use('/api/guinchos',      require('./routes/guinchos'));

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app:    'dr Mecânico',
    version:'1.0.0',
    time:   new Date().toISOString()
  });
});

// ── SPA fallback: toda rota não-API serve o index.html ─────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Rota não encontrada' });
  }
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║        dr Mecânico — Servidor        ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Rodando em http://localhost:${PORT}   ║`);
  console.log(`║  Ambiente: ${(process.env.NODE_ENV||'development').padEnd(26)}║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('coloque'))
    console.warn('⚠️  AVISO: Configure JWT_SECRET no arquivo .env!');
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('sua-chave'))
    console.warn('⚠️  AVISO: Configure ANTHROPIC_API_KEY no .env para ativar a IA!');
});

module.exports = app;
