// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db  = require('../db');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token não fornecido' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Confirma que usuário ainda existe e está ativo
    const user = db.get('users').find({ id: payload.id }).value();
    if (!user || !user.active) return res.status(401).json({ error: 'Sessão inválida' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  const isAdmin = req.user.role === 'superadmin' ||
                  req.user.email === process.env.SUPER_ADMIN_EMAIL;
  if (!isAdmin) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  next();
}

module.exports = { authMiddleware, requireRole, requireAdmin };
