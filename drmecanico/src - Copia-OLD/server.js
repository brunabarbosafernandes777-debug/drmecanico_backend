require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();
app.set('trust proxy', 1); // Render.com usa proxy

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'"],
      imgSrc:        ["'self'", "data:", "blob:"],
      connectSrc:    ["'self'", "https://accounts.google.com"],
      frameSrc:      ["https://www.mercadopago.com", "https://www.mercadopago.com.br", "https://accounts.google.com"]
    }
  }
}));

app.use(cors());
app.use(rateLimit({ windowMs: 60000, max: 200 }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Rotas da API ──────────────────────────────────────────────
const authLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Aguarde 1 minuto.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/auth',         require('./routes/google-auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/ai',           require('./routes/ai'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/guinchos',     require('./routes/guinchos'));
app.use('/api/pagamento',    require('./routes/pagamento'));

// ── Config pública (client IDs, etc) ──────────────────────────
app.get('/api/config/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

// Debug v1780853344482
app.get('/api/debug-env', (req, res) => {
  res.json({
    hasOpenAI:    !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    openAIStart:  process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0,8) : 'não definida',
    nodeEnv:      process.env.NODE_ENV
  });
});

app.get('/comprar', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'comprar.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'dr Mecânico Landing', time: new Date().toISOString() });
});

// ── Páginas de cliente ──────────────────────────────────────────
app.get('/login.html',   (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/cliente.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cliente.html')));
app.get('/agendar.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'agendar.html')));

app.get('/carousel-test', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'carousel-test.html'));
});

// Saiba mais page
app.get('/saiba-mais', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'saiba-mais.html'));
});

// TODO: Mercado Pago webhook quando tiver o token
// app.post('/api/pagamento/webhook', ...)

// Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Rota não encontrada' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║   dr Mecânico Landing — :${PORT}   ║`);
  console.log(`╚══════════════════════════════════╝\n`);
});
