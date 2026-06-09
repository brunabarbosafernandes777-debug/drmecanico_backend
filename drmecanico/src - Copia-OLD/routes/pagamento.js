// src/routes/pagamento.js — Integração Pagar.me com 2 cartões
const express = require('express');
const https   = require('https');
const router  = express.Router();

// POST /api/pagamento/pagarme
router.post('/pagarme', async (req, res) => {
  try {
    const { cliente, total, pagamentos } = req.body;
    if(!cliente || !pagamentos || !pagamentos.length) {
      return res.status(400).json({ error: 'Dados incompletos.' });
    }

    const apiKey = process.env.PAGARME_API_KEY;
    if(!apiKey) {
      return res.status(503).json({ error: 'Pagamento não configurado. Adicione PAGARME_API_KEY no Render.' });
    }

    // Monta charges (uma por cartão)
    const charges = pagamentos.map(function(p, i) {
      var exp = p.validade.split('/');
      var month = exp[0] || '12';
      var year  = '20' + (exp[1] || '30');

      return {
        amount: Math.round(p.valor * 100), // centavos
        payment_method: 'credit_card',
        installments: p.parcelas || 1,
        credit_card: {
          installments: p.parcelas || 1,
          statement_descriptor: 'drMecanico',
          card: {
            number: p.numero.replace(/\s/g,''),
            holder_name: p.nome.toUpperCase(),
            exp_month: parseInt(month),
            exp_year: parseInt(year),
            cvv: p.cvv
          }
        }
      };
    });

    // Monta o pedido
    var body = JSON.stringify({
      customer: {
        name:  cliente.nome,
        email: cliente.email,
        document: cliente.cpf.replace(/\D/g,''),
        document_type: 'CPF',
        type: 'individual',
        phones: {
          mobile_phone: {
            country_code: '55',
            area_code: cliente.tel.replace(/\D/g,'').substring(0,2),
            number: cliente.tel.replace(/\D/g,'').substring(2)
          }
        }
      },
      items: [{
        amount: Math.round(total * 100),
        description: 'Clube dr Mecânico — Assinatura Mensal',
        quantity: 1,
        code: 'drm-mensal'
      }],
      charges: charges
    });

    var result = await pagarmeRequest(apiKey, '/orders', body);
    console.log('Pagar.me result:', JSON.stringify(result).substring(0,300));

    if(result.status === 'paid' || result.status === 'pending') {
      res.json({ success: true, orderId: result.id, status: result.status });
    } else {
      // Verifica qual charge falhou
      var failedCharge = (result.charges || []).find(function(c) {
        return c.status === 'failed';
      });
      var motivo = failedCharge && failedCharge.last_transaction
        ? failedCharge.last_transaction.gateway_response && failedCharge.last_transaction.gateway_response.errors
          ? failedCharge.last_transaction.gateway_response.errors[0].message
          : 'Cartão recusado'
        : (result.message || 'Pagamento não aprovado');

      res.status(402).json({ error: motivo });
    }

  } catch(e) {
    console.error('Pagamento error:', e);
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
});

function pagarmeRequest(apiKey, path, body) {
  return new Promise((resolve, reject) => {
    var auth = Buffer.from(apiKey + ':').toString('base64');
    var options = {
      hostname: 'api.pagar.me',
      path: '/core/v5' + path,
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Basic ' + auth,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    var req = https.request(options, function(r) {
      var data = '';
      r.on('data', function(c){ data += c; });
      r.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Resposta inválida do Pagar.me: ' + data.substring(0,100))); }
      });
    });
    req.on('error', function(e){ reject(e); });
    req.write(body);
    req.end();
  });
}

module.exports = router;
