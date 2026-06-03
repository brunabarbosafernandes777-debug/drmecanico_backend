// src/db.js — Banco de dados JSON com lowdb
const low  = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Garante que a pasta data existe
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(DB_PATH);
const db = low(adapter);

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'brunabarbosafernandes7@gmail.com';

// Schema padrão
db.defaults({
  users:        [],
  agendamentos: [],
  diagnosticos: [],
  guinchos:     [],
  veiculos:     []
}).write();

// Cria usuários padrão se banco estiver vazio
async function seed() {
  if (db.get('users').size().value() === 0) {
    const hash = (p) => bcrypt.hashSync(p, 10);
    const now  = new Date().toISOString();

    const defaults = [
      {
        id: 'sa_001',
        name: 'Bruna Barbosa',
        email: SUPER_ADMIN_EMAIL,
        password: hash('admin123'),
        role: 'superadmin',
        phone: '',
        active: true,
        createdAt: now,
        createdBy: 'system'
      },
      {
        id: 'dono_001',
        name: 'Carlos Silva',
        email: 'carlos@drmecanico.com.br',
        password: hash('123456'),
        role: 'dono',
        phone: '(27) 99999-0001',
        active: true,
        createdAt: now,
        createdBy: 'system'
      },
      {
        id: 'mec_001',
        name: 'João Costa',
        email: 'joao@drmecanico.com.br',
        password: hash('123456'),
        role: 'mecanico',
        phone: '(27) 99999-0002',
        active: true,
        createdAt: now,
        createdBy: 'system'
      },
      {
        id: 'cli_001',
        name: 'Ana Lima',
        email: 'ana@email.com',
        password: hash('123456'),
        role: 'cliente',
        phone: '(27) 99812-3344',
        active: true,
        createdAt: now,
        createdBy: 'system'
      },
      {
        id: 'gui_001',
        name: 'Pedro Alves',
        email: 'pedro@guincho.com.br',
        password: hash('123456'),
        role: 'guincho',
        phone: '(27) 99888-5566',
        active: true,
        createdAt: now,
        createdBy: 'system'
      }
    ];

    db.get('users').push(...defaults).write();
    console.log('✅ Banco inicializado com usuários padrão');
  }
}

seed();

module.exports = db;
