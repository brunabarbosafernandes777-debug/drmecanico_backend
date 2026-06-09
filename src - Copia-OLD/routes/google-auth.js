// src/routes/google-auth.js
// Valida token Google e verifica se é assinante
const express = require('express');
const https   = require('https');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const router = express.Router();

// POST /api/auth/google
// Body: { credential: "google_id_token" }
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if(!credential) return res.status(400).json({ error: 'Token Google não fornecido' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if(!clientId) return res.status(503).json({ error: 'Login Google não configurado' });

    // Verifica o token com a API do Google
    const googleData = await verifyGoogleToken(credential, clientId);
    if(!googleData) return res.status(401).json({ error: 'Token Google inválido' });

    const { email, name, picture } = googleData;

    // Verifica se é assinante
    const user = db.get('users')
      .find(u => u.email.toLowerCase() === email.toLowerCase())
      .value();

    if(!user) {
      return res.status(403).json({
        error: 'Você ainda não é assinante do Clube dr Mecânico. Assine em nosso site para ter acesso!'
      });
    }

    if(!user.active) {
      return res.status(403).json({
        error: 'Sua conta está inativa. Entre em contato com o suporte.'
      });
    }

    // Gera JWT e retorna
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });

  } catch(e) {
    console.error('Google auth error:', e);
    res.status(500).json({ error: 'Erro ao autenticar com Google' });
  }
});

// Verifica o ID token do Google
function verifyGoogleToken(credential, clientId) {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`;
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Verifica se o token é para nosso app
          if(parsed.aud !== clientId) {
            resolve(null);
            return;
          }
          if(parsed.error) {
            resolve(null);
            return;
          }
          resolve({
            email:   parsed.email,
            name:    parsed.name,
            picture: parsed.picture
          });
        } catch(e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = router;
