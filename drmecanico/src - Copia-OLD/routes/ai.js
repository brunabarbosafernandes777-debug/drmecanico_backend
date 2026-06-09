// src/routes/ai.js — Proxy para OpenAI GPT
const express  = require('express');
const https    = require('https');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Rate limit por usuário
const userCounts = new Map();
function rateLimit(userId) {
  const now = Date.now();
  const key = `${userId}:${Math.floor(now / 60000)}`;
  const count = (userCounts.get(key) || 0) + 1;
  userCounts.set(key, count);
  if (count === 1) setTimeout(() => userCounts.delete(key), 65000);
  return count <= 20;
}

// POST /api/ai/chat
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ error: 'Campo messages é obrigatório' });

    if (!rateLimit(req.user.id))
      return res.status(429).json({ error: 'Muitas mensagens. Aguarde um momento.' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return res.status(503).json({ error: 'Assistente IA não configurado. Adicione OPENAI_API_KEY no Render.' });

    const systemPrompt = `Você é o assistente técnico do Clube dr Mecânico.
Quando o cliente descrever um problema no carro, responda em 3 parágrafos:
1) Diagnóstico provável em linguagem simples
2) Serviço recomendado
3) Tempo estimado de reparo
Seja empático, claro e direto. Responda sempre em português brasileiro.`;

    const body = JSON.stringify({
      model: 'gpt-3.5-turbo',
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    });

    const options = {
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.error('OpenAI error:', parsed.error);
            return res.status(502).json({ error: 'IA: ' + (parsed.error.message || parsed.error.type) });
          }
          const reply = parsed.choices && parsed.choices[0]
            ? parsed.choices[0].message.content
            : '';
          res.json({ reply });
        } catch(e) {
          res.status(502).json({ error: 'Resposta inválida da IA' });
        }
      });
    });

    apiReq.on('error', (e) => {
      console.error('OpenAI request error:', e);
      res.status(502).json({ error: 'Erro de conexão com a IA' });
    });

    apiReq.write(body);
    apiReq.end();

  } catch(e) {
    console.error('AI route error:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
