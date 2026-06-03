// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('crypto');
const db      = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Gera UUID simples sem dependência extra
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });

    const user = db.get('users')
      .find(u => u.email.toLowerCase() === email.toLowerCase().trim())
      .value();

    if (!user)
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    if (!user.active)
      return res.status(401).json({ error: 'Conta desativada. Entre em contato com o suporte.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Retorna usuário sem a senha
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });

  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/register — apenas clientes podem se registrar sozinhos
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

    const exists = db.get('users')
      .find(u => u.email.toLowerCase() === email.toLowerCase().trim())
      .value();

    if (exists)
      return res.status(409).json({ error: 'Este e-mail já está cadastrado' });

    const hash = await bcrypt.hash(password, 10);
    const newUser = {
      id:        uid(),
      name:      name.trim(),
      email:     email.toLowerCase().trim(),
      password:  hash,
      phone:     phone || '',
      role:      'cliente',
      active:    true,
      createdAt: new Date().toISOString(),
      createdBy: 'self'
    };

    db.get('users').push(newUser).write();

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ token, user: safeUser });

  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me — retorna dados do usuário logado
router.get('/me', authMiddleware, (req, res) => {
  const { password: _, ...safeUser } = req.user;
  res.json(safeUser);
});

// PUT /api/auth/password — troca senha
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Preencha a senha atual e a nova senha' });

    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });

    const match = await bcrypt.compare(currentPassword, req.user.password);
    if (!match)
      return res.status(401).json({ error: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.get('users').find({ id: req.user.id }).assign({ password: hash }).write();

    res.json({ ok: true, message: 'Senha atualizada com sucesso' });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
