// src/routes/users.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// Todos os endpoints precisam de auth
router.use(authMiddleware);

// GET /api/users — lista todos (só admin/dono)
router.get('/', requireAdmin, (req, res) => {
  const users = db.get('users').map(u => {
    const { password, ...safe } = u;
    return safe;
  }).value();
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', requireAdmin, (req, res) => {
  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const { password, ...safe } = user;
  res.json(safe);
});

// POST /api/users — cria novo usuário (só admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'Nome, e-mail, senha e perfil são obrigatórios' });

    const validRoles = ['superadmin','dono','mecanico','cliente','guincho'];
    if (!validRoles.includes(role))
      return res.status(400).json({ error: 'Perfil inválido' });

    // Só superadmin pode criar outro superadmin
    if (role === 'superadmin' && req.user.role !== 'superadmin')
      return res.status(403).json({ error: 'Apenas o super admin pode criar outros admins' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

    const exists = db.get('users')
      .find(u => u.email.toLowerCase() === email.toLowerCase().trim())
      .value();
    if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const hash = await bcrypt.hash(password, 10);
    const newUser = {
      id:        uid(),
      name:      name.trim(),
      email:     email.toLowerCase().trim(),
      password:  hash,
      phone:     phone || '',
      role,
      active:    true,
      createdAt: new Date().toISOString(),
      createdBy: req.user.email
    };

    db.get('users').push(newUser).write();
    const { password: _, ...safe } = newUser;
    res.status(201).json(safe);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/users/:id — edita usuário
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const user = db.get('users').find({ id: req.params.id }).value();
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Não pode editar o super admin master a não ser que seja ele mesmo
    const isMaster = user.email === process.env.SUPER_ADMIN_EMAIL;
    if (isMaster && req.user.email !== process.env.SUPER_ADMIN_EMAIL)
      return res.status(403).json({ error: 'Sem permissão para editar este usuário' });

    const { name, email, phone, role, active, password } = req.body;
    const updates = {};

    if (name)   updates.name   = name.trim();
    if (email)  updates.email  = email.toLowerCase().trim();
    if (phone !== undefined) updates.phone = phone;
    if (role && ['superadmin','dono','mecanico','cliente','guincho'].includes(role)) {
      if (role === 'superadmin' && req.user.role !== 'superadmin')
        return res.status(403).json({ error: 'Apenas superadmin pode promover outros' });
      updates.role = role;
    }
    if (active !== undefined) updates.active = active;
    if (password && password.length >= 6) {
      updates.password = await bcrypt.hash(password, 10);
    }

    db.get('users').find({ id: req.params.id }).assign(updates).write();
    const updated = db.get('users').find({ id: req.params.id }).value();
    const { password: _, ...safe } = updated;
    res.json(safe);

  } catch (e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  // Não pode deletar o super admin master
  if (user.email === process.env.SUPER_ADMIN_EMAIL)
    return res.status(403).json({ error: 'Não é possível excluir o super administrador' });

  // Não pode deletar a si mesmo
  if (user.id === req.user.id)
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });

  db.get('users').remove({ id: req.params.id }).write();
  res.json({ ok: true, message: 'Usuário excluído com sucesso' });
});

// GET /api/users/role/:role — lista por perfil
router.get('/role/:role', requireAdmin, (req, res) => {
  const users = db.get('users')
    .filter({ role: req.params.role, active: true })
    .map(u => { const { password, ...s } = u; return s; })
    .value();
  res.json(users);
});

module.exports = router;
