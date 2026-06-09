// src/routes/agendamentos.js
const express = require('express');
const db      = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// GET /api/agendamentos — lista conforme perfil
router.get('/', (req, res) => {
  let query = db.get('agendamentos');

  if (req.user.role === 'cliente') {
    query = query.filter({ clienteId: req.user.id });
  } else if (req.user.role === 'mecanico') {
    query = query.filter({ mecanicoId: req.user.id });
  }
  // dono, superadmin e guincho veem todos

  res.json(query.orderBy('data', 'desc').value());
});

// GET /api/agendamentos/:id
router.get('/:id', (req, res) => {
  const ag = db.get('agendamentos').find({ id: req.params.id }).value();
  if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado' });

  // Cliente só vê os seus
  if (req.user.role === 'cliente' && ag.clienteId !== req.user.id)
    return res.status(403).json({ error: 'Sem permissão' });

  res.json(ag);
});

// POST /api/agendamentos — cria agendamento
router.post('/', (req, res) => {
  const { tipo, descricao, data, hora, placa, modelo, mecanicoId } = req.body;

  if (!tipo || !data || !hora)
    return res.status(400).json({ error: 'Tipo, data e hora são obrigatórios' });

  const novo = {
    id:         uid(),
    clienteId:  req.user.id,
    clienteNome:req.user.name,
    mecanicoId: mecanicoId || null,
    tipo,
    descricao:  descricao || '',
    data,
    hora,
    placa:      placa || '',
    modelo:     modelo || '',
    status:     'aguardando',
    criadoEm:   new Date().toISOString()
  };

  db.get('agendamentos').push(novo).write();
  res.status(201).json(novo);
});

// PUT /api/agendamentos/:id/status — muda status
router.put('/:id/status', requireRole('dono','mecanico','superadmin'), (req, res) => {
  const { status } = req.body;
  const validos = ['aguardando','confirmado','em_andamento','concluido','cancelado'];
  if (!validos.includes(status))
    return res.status(400).json({ error: 'Status inválido' });

  const ag = db.get('agendamentos').find({ id: req.params.id }).value();
  if (!ag) return res.status(404).json({ error: 'Não encontrado' });

  db.get('agendamentos').find({ id: req.params.id })
    .assign({ status, atualizadoEm: new Date().toISOString() }).write();

  res.json(db.get('agendamentos').find({ id: req.params.id }).value());
});

// DELETE /api/agendamentos/:id
router.delete('/:id', (req, res) => {
  const ag = db.get('agendamentos').find({ id: req.params.id }).value();
  if (!ag) return res.status(404).json({ error: 'Não encontrado' });

  if (req.user.role === 'cliente' && ag.clienteId !== req.user.id)
    return res.status(403).json({ error: 'Sem permissão' });

  db.get('agendamentos').remove({ id: req.params.id }).write();
  res.json({ ok: true });
});

module.exports = router;
