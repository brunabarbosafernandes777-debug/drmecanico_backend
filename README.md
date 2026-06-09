# dr Mecânico — Backend Node.js

Plataforma completa de gestão para oficina mecânica.

---

## 🚀 Como rodar localmente

### 1. Instale o Node.js
Baixe em https://nodejs.org (versão 18 ou superior)

### 2. Configure o ambiente
```bash
cp .env.example .env
```
Abra o arquivo `.env` e preencha:
```
JWT_SECRET=gere_uma_string_aleatoria_longa_aqui
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui
```
Para gerar o JWT_SECRET rode no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Instale as dependências
```bash
npm install
```

### 4. Rode o servidor
```bash
npm start
```
Acesse: http://localhost:3000

---

## ☁️ Como publicar online (hospedagem gratuita)

### Opção A — Railway.app (recomendado, mais fácil)
1. Crie conta em https://railway.app
2. Clique em "New Project" → "Deploy from GitHub"
3. Suba este código no GitHub primeiro
4. Configure as variáveis de ambiente no painel do Railway:
   - `JWT_SECRET` → sua string aleatória
   - `ANTHROPIC_API_KEY` → sua chave da Anthropic
   - `NODE_ENV` → production
5. Railway gera um link público automaticamente (ex: drmecanico.railway.app)

### Opção B — Render.com
1. Crie conta em https://render.com
2. New → Web Service → conecte seu repositório GitHub
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Adicione as variáveis de ambiente no painel

### Opção C — VPS (servidor próprio)
Se tiver um servidor Linux (DigitalOcean, Hostinger VPS, etc):
```bash
git clone seu-repositorio
cd drmecanico
npm install
# Instale PM2 para manter rodando
npm install -g pm2
pm2 start src/server.js --name drmecanico
pm2 startup  # para iniciar automaticamente
```
Use Nginx como proxy reverso para apontar seu domínio.

---

## 🔑 Usuários padrão (demonstração)

| Perfil           | E-mail                              | Senha    |
|-----------------|-------------------------------------|----------|
| Super Admin     | brunabarbosafernandes7@gmail.com    | admin123 |
| Dono da Oficina | carlos@drmecanico.com.br            | 123456   |
| Mecânico        | joao@drmecanico.com.br              | 123456   |
| Motorista       | ana@email.com                       | 123456   |
| Guincheiro      | pedro@guincho.com.br                | 123456   |

⚠️ **Troque as senhas antes de ir para produção!**

---

## 🔒 Segurança implementada

- Senhas com bcrypt (hash seguro, nunca salvas em texto puro)
- Autenticação JWT (token expira em 7 dias)
- Chave da API Anthropic nunca exposta ao navegador
- Rate limiting: 200 req/min global, 10 tentativas de login/min
- Helmet.js para headers de segurança
- Content Security Policy bloqueando chamadas externas à API

---

## 📁 Estrutura do projeto

```
drmecanico/
├── src/
│   ├── server.js          # Servidor principal
│   ├── db.js              # Banco de dados (arquivo JSON)
│   ├── middleware/
│   │   └── auth.js        # Verificação de JWT e permissões
│   └── routes/
│       ├── auth.js        # Login, cadastro, trocar senha
│       ├── users.js       # CRUD de usuários (admin)
│       ├── ai.js          # Proxy seguro para Claude API
│       ├── agendamentos.js
│       └── guinchos.js
├── public/
│   ├── index.html         # Frontend (SPA)
│   └── js/
│       └── app.js         # Toda a lógica do frontend
├── data/
│   └── db.json            # Banco de dados (criado automaticamente)
├── .env.example           # Template de configuração
├── .env                   # Suas configurações (NÃO suba no GitHub!)
└── package.json
```

---

## 📡 API Routes

| Método | Rota                        | Descrição                     | Permissão    |
|--------|-----------------------------|-------------------------------|--------------|
| POST   | /api/auth/login             | Fazer login                   | Público      |
| POST   | /api/auth/register          | Criar conta (motoristas)      | Público      |
| GET    | /api/auth/me                | Dados do usuário logado       | Autenticado  |
| PUT    | /api/auth/password          | Trocar senha                  | Autenticado  |
| GET    | /api/users                  | Listar usuários               | Admin        |
| POST   | /api/users                  | Criar usuário                 | Admin        |
| PUT    | /api/users/:id              | Editar usuário                | Admin        |
| DELETE | /api/users/:id              | Excluir usuário               | Admin        |
| POST   | /api/ai/chat                | Chat com Claude (seguro)      | Autenticado  |
| GET    | /api/agendamentos           | Listar agendamentos           | Autenticado  |
| POST   | /api/agendamentos           | Criar agendamento             | Autenticado  |
| PUT    | /api/agendamentos/:id/status| Atualizar status              | Dono/Mecânico|
| GET    | /api/guinchos               | Listar chamados               | Autenticado  |
| POST   | /api/guinchos               | Solicitar guincho             | Autenticado  |
| PUT    | /api/guinchos/:id/aceitar   | Guincheiro aceita chamado     | Guincheiro   |
| GET    | /api/health                 | Status do servidor            | Público      |

---

## 💡 Próximos passos recomendados

1. **Domínio próprio** — Registre `drmecanico.com.br` ou similar
2. **SSL/HTTPS** — Railway e Render incluem automaticamente
3. **Notificações** — Integrar WhatsApp API ou e-mail para alertas
4. **Pagamentos** — Integrar Stripe ou Mercado Pago
5. **Banco de dados real** — Migrar de JSON para PostgreSQL quando crescer
