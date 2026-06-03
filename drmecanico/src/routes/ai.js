// src/routes/ai.js — Proxy seguro para a API do Claude
// A chave fica APENAS no servidor, nunca exposta ao browser
const express  = require('express');
const https    = require('https');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Rate limit por usuário: 20 mensagens por minuto
const userCounts = new Map();
function rateLimit(userId) {
  const now = Date.now();
  const key = `${userId}:${Math.floor(now / 60000)}`;
  const count = (userCounts.get(key) || 0) + 1;
  userCounts.set(key, count);
  // Limpa entradas antigas
  if (count === 1) setTimeout(() => userCounts.delete(key), 65000);
  return count <= 20;
}

// System prompts por perfil
const SYSTEM_PROMPTS = {
  superadmin: 'Você é o assistente administrativo do dr Mecânico. Responda em português.',
  dono: `Você é o assistente técnico da oficina dr Mecânico. 
Ao receber descrição de problema ou código OBD:
1) Liste 2-4 causas prováveis
2) Classifique: URGENTE (não pode rodar), ATENÇÃO (reparar logo) ou PREVENTIVO
3) Sugira procedimento de reparo
4) Estime custo de peças + mão de obra em R$
Responda em português, de forma direta. Sem markdown.`,
  mecanico: `Você é assistente técnico para mecânicos da oficina dr Mecânico.
Responda sobre: torques de aperto, procedimentos de reparo, TSBs (boletins de serviço),
diagnóstico OBD, especificações de peças e fluidos.
Use terminologia técnica precisa. Responda em português.`,
  cliente: `Você é o assistente de atendimento ao cliente da dr Mecânico.
Explique problemas mecânicos de forma simples, sem jargão técnico.
1) Explique o problema em linguagem do dia a dia
2) Diga claramente se o carro pode ser dirigido ou não
3) Oriente se deve chamar guincho ou pode ir à oficina normalmente
4) Seja empático e tranquilizador
Responda em português.`,
  guincho: 'Você é o assistente operacional para guincheiros da dr Mecânico. Responda em português de forma objetiva.'
};

// POST /api/ai/chat
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ error: 'Campo messages é obrigatório' });

    if (messages.length > 50)
      return res.status(400).json({ error: 'Muitas mensagens no histórico' });

    if (!rateLimit(req.user.id))
      return res.status(429).json({ error: 'Muitas mensagens. Aguarde um momento.' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes('sua-chave'))
      return res.status(503).json({ error: 'Assistente IA não configurado. Contate o administrador.' });

    const role   = req.user.role;
    const system = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.cliente;

    // Adiciona contexto se enviado (placa, modelo, etc)
    const finalMessages = [...messages];
    if (context && finalMessages.length > 0) {
      finalMessages[finalMessages.length - 1] = {
        ...finalMessages[finalMessages.length - 1],
        content: context + '\n' + finalMessages[finalMessages.length - 1].content
      };
    }

    // Chama a API da Anthropic pelo servidor
    const body = JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages:   finalMessages
    });

    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.error('Anthropic API error:', parsed.error);
            return res.status(502).json({ error: 'Erro ao contatar assistente IA' });
          }
          const reply = parsed.content
            ? parsed.content.map(c => c.text || '').join('')
            : '';
          res.json({ reply });
        } catch (e) {
          res.status(502).json({ error: 'Resposta inválida da IA' });
        }
      });
    });

    apiReq.on('error', (e) => {
      console.error('API request error:', e);
      res.status(502).json({ error: 'Erro de conexão com a IA' });
    });

    apiReq.write(body);
    apiReq.end();

  } catch (e) {
    console.error('AI route error:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
