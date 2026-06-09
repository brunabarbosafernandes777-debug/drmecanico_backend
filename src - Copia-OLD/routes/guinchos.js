// src/routes/guinchos.js
const express = require('express');
const db      = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// GET /api/guinchos — lista chamados
router.get('/', (req, res) => {
  let query = db.get('guinchos');

  if (req.user.role === 'cliente')
    query = query.filter({ clienteId: req.user.id });
  else if (req.user.role === 'guincho')
    query = query.filter(g => !g.guincheiroId || g.guincheiroId === req.user.id);

  res.json(query.orderBy('criadoEm', 'desc').value());
});

// POST /api/guinchos — solicita guincho
router.post('/', (req, res) => {
  const { ocorrencia, localizacao, destino, observacoes, placa, modelo } = req.body;

  if (!ocorrencia || !localizacao)
    return res.status(400).json({ error: 'Ocorrência e localização são obrigatórios' });

  const novo = {
    id:           uid(),
    clienteId:    req.user.id,
    clienteNome:  req.user.name,
    clienteTel:   req.user.phone || '',
    guincheiroId: null,
    ocorrencia,
    localizacao,
    destino:      destino || '',
    observacoes:  observacoes || '',
    placa:        placa || '',
    modelo:       modelo || '',
    status:       'aguardando',
    criadoEm:     new Date().toISOString()
  };

  db.get('guinchos').push(novo).write();
  res.status(201).json(novo);
});

// PUT /api/guinchos/:id/aceitar — guincheiro aceita chamado
router.put('/:id/aceitar', requireRole('guincho'), (req, res) => {
  const g = db.get('guinchos').find({ id: req.params.id }).value();
  if (!g) return res.status(404).json({ error: 'Chamado não encontrado' });
  if (g.guincheiroId) return res.status(409).json({ error: 'Chamado já aceito por outro guincheiro' });

  db.get('guinchos').find({ id: req.params.id }).assign({
    guincheiroId:   req.user.id,
    guincheiroNome: req.user.name,
    status:         'aceito',
    aceitoEm:       new Date().toISOString()
  }).write();

  res.json(db.get('guinchos').find({ id: req.params.id }).value());
});

// PUT /api/guinchos/:id/status
router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const validos = ['aguardando','aceito','em_rota','chegou','concluido','cancelado'];
  if (!validos.includes(status))
    return res.status(400).json({ error: 'Status inválido' });

  db.get('guinchos').find({ id: req.params.id })
    .assign({ status, atualizadoEm: new Date().toISOString() }).write();

  res.json(db.get('guinchos').find({ id: req.params.id }).value());
});

module.exports = router;
