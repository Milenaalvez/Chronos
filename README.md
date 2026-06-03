<div align="center">
  <br/>
  <h1>Chronos — Gestão de Pessoas</h1>
  <p>
    <strong>Sistema completo de ponto eletrônico com verificação facial, geolocalização e notificações inteligentes</strong>
  </p>
  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19"/>
    <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6"/>
    <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8"/>
    <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5"/>
    <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma 7"/>
    <img src="https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL"/>
    <img src="https://img.shields.io/badge/Vercel-Frontend-000000?logo=vercel&logoColor=white" alt="Vercel"/>
    <img src="https://img.shields.io/badge/Render-Backend-46E3B7?logo=render&logoColor=white" alt="Render"/>
  </p>
  <br/>
</div>

> **URL de Produção:** [https://chronos-blond-gamma.vercel.app](https://chronos-blond-gamma.vercel.app)
>
> **API (Backend):** [https://chronos-1-wzqq.onrender.com](https://chronos-1-wzqq.onrender.com)


---

## Funcionalidades

### 📌 Registro de Ponto
- Marcação de entrada, almoço (início/fim) e saída
- Verificação facial opcional com **face-api.js**
- Captura de foto via webcam
- Geolocalização (latitude, longitude, endereço) via navegador
- Informações de dispositivo (IP, navegador, OS, timezone)

### 👥 Gestão de Equipe
- CRUD completo de colaboradores
- Controle de cargos, departamentos e contratos (CLT, PJ, Estágio)
- Permissões granulares por usuário
- Métricas em tempo real (presentes, atrasados, ausentes)
- Histórico de atividades por colaborador

### 📊 Relatórios
- Relatório consolidado mensal com filtros (departamento, cargo, colaborador, status)
- Fechamento mensal (abrir/fechar períodos)
- Exportação para **PDF** (jsPDF) e **Excel** (SheetJS)
- Log de auditoria

### 📅 Calendário
- Visualização mensal dos registros em calendário (FullCalendar)
- Código de cores por status (Normal, Extra, Falta, Pendente)
- Edição rápida e justificativa

### 🔔 Notificações Inteligentes
- Scheduler automático (verificação a cada 1h)
- Alertas: face pendente, almoço não registrado, atraso, hora extra, falta de entrada/saída
- Resolução automática de notificações resolvidas
- Tipos: INFO, WARNING, APPROVAL, SECURITY

### 🔐 Autenticação e Segurança
- Login com email/senha ou Google OAuth (via Supabase)
- JWT + Refresh Token (com "lembrar-me")
- Verificação de email obrigatória
- Recuperação de senha
- Impersonação de usuários (DEVELOPER)
- Senha com bcrypt (10 rounds)

### ⚙️ Configurações
- Perfil do usuário (nome, email, telefone, CPF, endereço, data de nascimento)
- Upload de avatar
- Tema (claro/escuro/sistema) e cor de destaque

### Outros
- 📄 Gestão de documentos por colaborador
- 🏖️ Controle de férias
- 📝 Justificativas de ausência com fluxo de aprovação
- 🗺️ Mapa interativo com Leaflet
- 🧠 Detecção de diagnóstico (dev only)

---

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 19, Vite 8, TypeScript 6, Tailwind CSS 3 |
| **Backend** | Express 5, TypeScript |
| **ORM** | Prisma 7 + @prisma/adapter-pg |
| **Banco** | PostgreSQL (Supabase) |
| **Auth** | JWT + Refresh Token + Supabase Auth (Google OAuth) |
| **Storage** | Supabase Storage (documentos, avatares) |
| **Email** | Nodemailer + SMTP Gmail |
| **Face API** | face-api.js (descritores faciais no navegador) |
| **Mapas** | Leaflet + react-leaflet |
| **PDF** | jsPDF + jspdf-autotable |
| **Planilhas** | xlsx (SheetJS) |
| **Calendário** | FullCalendar 6 |
| **Ícones** | Lucide React |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (Vercel)                   │
│  React 19 + Vite 8 + TypeScript + Tailwind          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Páginas    │  │ Componentes  │  │ Serviços  │ │
│  │  (15 pages)  │  │   (26 cmp)   │  │  api.ts   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                  │                 │       │
│         └──────────────────┴─────────────────┘       │
│                        │                             │
│                   HTTP /api/*                        │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────┐
│               BACKEND (Render)                       │
│  Express 5 + Prisma + TypeScript                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Routes  │→│ Services │→│     Database      │  │
│  │(11 mód.) │  │          │  │ PostgreSQL/Prisma │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                        │                             │
│  ┌──────────────────────────────────────────────┐   │
│  │          Supabase (Auth + Storage)           │   │
│  │  Google OAuth │ Armazenamento │ Emails SMTP  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Estrutura do Projeto

```
chronos/
├── backend/
│   ├── prisma/                  # Schema, migrations, seeds
│   │   └── schema.prisma        # 15 modelos (User, TimeRecord, PointEvent...)
│   ├── prisma.config.ts         # Configuração do Prisma
│   └── server/
│       └── src/
│           ├── index.ts         # Entry point (Express)
│           ├── config/          # env.ts (variáveis de ambiente)
│           ├── database/        # prisma.ts (conexão)
│           ├── generated/       # Prisma Client gerado
│           ├── middleware/      # auth, error, permissions
│           ├── modules/         # 11 módulos funcionais
│           │   ├── auth/        # Registro, login, OAuth, perfil, avatar
│           │   ├── timeRecord/  # Registros de jornada
│           │   ├── pointRecord/ # Eventos de ponto (GPS/foto/face)
│           │   ├── justification/ # Justificativas
│           │   ├── notification/ # Notificações
│           │   ├── team/        # Equipe (CRUD, métricas, permissões)
│           │   ├── reports/     # Relatórios consolidados, fechamento
│           │   ├── document/    # Documentos
│           │   ├── faceRegistration/ # Registro facial
│           │   ├── termAcceptance/   # Termos de uso
│           │   └── reference/   # Departamentos e cargos
│           ├── services/        # Email (Nodemailer)
│           └── utils/           # Scheduler, CPF, senha, permissões
├── frontend/
│   └── src/
│       ├── App.tsx             # Componente raiz com roteamento
│       ├── main.tsx            # Entry point React
│       ├── types.ts            # Interfaces compartilhadas
│       ├── context/            # ThemeContext
│       ├── paginas/            # 15 páginas
│       ├── componentes/        # 26 componentes reutilizáveis
│       ├── services/           # api.ts, supabase, validação, horas
│       └── utils/              # Face API, permissões
├── docs/
│   └── pipeline.md             # Documentação técnica detalhada
├── fotos/                      # Screenshots do sistema
├── Dockerfile                  # Build Docker para backend
├── vercel.json                 # Config de deploy Vercel
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json                # Raiz do monorepo
```

---

## Começando (Desenvolvimento Local)

### Pré-requisitos
- Node.js 22+
- PostgreSQL (ou Supabase)

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/Milenaalvez/Chronos.git
cd Chronos

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais (DATABASE_URL, JWT_SECRET, etc.)

# 4. Gere o Prisma Client
npm run db:generate

# 5. Execute as migrations
npm run db:push

# 6. Inicie o desenvolvimento (frontend + backend)
npm run dev:all
```

O frontend será aberto em `http://localhost:5173` e a API em `http://localhost:3001`.

### Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Frontend (Vite dev server) |
| `npm run dev:server` | Backend (tsx watch) |
| `npm run dev:all` | Frontend + Backend simultâneos |
| `npm run build` | Build de produção (tsc + Vite) |
| `npm start` | Iniciar servidor (produção) |
| `npm run db:generate` | Gerar Prisma Client |
| `npm run db:push` | Sincronizar schema com banco |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:seed` | Popular banco com dados iniciais |
| `npm run db:migrate` | Criar migration |

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | ✅ | URL de conexão PostgreSQL |
| `JWT_SECRET` | ✅ | Chave secreta para assinar tokens JWT |
| `PORT` | | Porta do servidor (default: 3001) |
| `SUPABASE_URL` | | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | | Chave anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | | Chave de serviço do Supabase |
| `SMTP_HOST` | | Host SMTP (ex: smtp.gmail.com) |
| `SMTP_PORT` | | Porta SMTP (default: 587) |
| `SMTP_USER` | | Usuário SMTP |
| `SMTP_PASS` | | Senha SMTP (App Password) |
| `SMTP_FROM` | | Remetente dos emails |
| `APP_URL` | | URL pública do frontend (links em emails) |
| `CORS_ORIGIN` | | Origens permitidas no CORS (separadas por vírgula) |
| `VITE_SUPABASE_URL` | ✅ | URL Supabase para o frontend |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon key para o frontend |
| `VITE_API_URL` | | URL da API (default: `/api`) |

---

## Deploy

### Frontend → Vercel

O frontend é implantado automaticamente no **Vercel** via integração com GitHub.

```bash
# Manual (caso necessário)
npx vercel --prod --yes
```

- Build: `npm run build` (tsc -b && vite build)
- Output: `frontend/dist/`
- Domínio: `https://chronos-blond-gamma.vercel.app`

### Backend → Render

O backend é implantado no **Render** como Web Service Node.js.

- Build: `npm install && npm run build`
- Start: `npm start` (`npx tsx backend/server/src/index.ts`)
- Health check: `/api/health`
- Domínio: `https://chronos-1-wzqq.onrender.com`

---

## Controle de Acesso (RBAC)

| Role | Nível | Acesso |
|------|-------|--------|
| **DEVELOPER** | 1 (maior) | Tudo — debug, monitoramento, impersonação, feature flags |
| **ADMIN** | 2 | Gestão completa — equipe, relatórios, cargos, permissões, auditoria |
| **RH** | 3 | Equipe, relatórios, férias, justificativas, aprovações |
| **EMPLOYEE** | 4 | Dashboard, registrar ponto, meus registros, banco de horas, calendário, notificações, configurações |

### Permissões Específicas

| Permissão | Descrição |
|-----------|-----------|
| `access_team` | Visualizar equipe |
| `manage_members` | Gerenciar membros (CRUD) |
| `approve_justifications` | Aprovar/rejeitar justificativas |
| `edit_time_records` | Editar registros de hora |
| `approve_time_records` | Aprovar jornadas |
| `reset_passwords` | Redefinir senhas |
| `view_logs` | Visualizar logs |
| `export_reports` | Exportar relatórios |
| `switch_accounts` | Trocar entre contas |
| `manage_permissions` | Gerenciar permissões |
| `manage_company` | Gerenciar empresa |

Usuários do departamento **TI** recebem automaticamente todas as permissões.

---

## Modelo de Dados

O banco possui **15 modelos** gerenciados pelo Prisma:

- `User` — Colaboradores com autenticação, perfil e preferências
- `Company` — Empresas (multi-tenant)
- `Department` / `Position` — Departamentos e cargos
- `TimeRecord` — Registros de jornada (entrada, almoço, saída)
- `PointEvent` — Eventos individuais de ponto (com GPS, foto, face)
- `Justification` — Justificativas de ausência
- `Notification` — Notificações do sistema
- `FaceRegistration` — Descritores faciais para verificação
- `Document` — Documentos dos colaboradores
- `Integration` — Integrações (Google Calendar, Slack, etc.)
- `TermAcceptance` — Aceitação dos termos de uso
- `ActivityLog` — Log de auditoria
- `MonthClosing` — Fechamento mensal

---

## Licença

Este projeto é privado e de uso interno.

---

<div align="center">
  <sub>Built with ❤️ by Milena Alvez</sub>
</div>
