# Chronos — Gestão de Pessoas

Sistema de controle de ponto eletrônico com verificação facial, geolocalização e notificações automatizadas.

**Frontend:** [https://chronos-blond-gamma.vercel.app](https://chronos-blond-gamma.vercel.app)
**API:** [https://chronos-1-wzqq.onrender.com](https://chronos-1-wzqq.onrender.com)


---

## Funcionalidades

<<<<<<< Updated upstream
###  Registro de Ponto
- Marcação de entrada, almoço (início/fim) e saída
- Verificação facial opcional com **face-api.js**
- Captura de foto via webcam
- Geolocalização (latitude, longitude, endereço) via navegador
- Informações de dispositivo (IP, navegador, OS, timezone)

### Gestão de Equipe
- CRUD completo de colaboradores
- Controle de cargos, departamentos e contratos (CLT, PJ, Estágio)
- Permissões granulares por usuário
- Métricas em tempo real (presentes, atrasados, ausentes)
- Histórico de atividades por colaborador

###  Relatórios
=======
### Registro de Ponto
- Marcação de entrada, intervalo (início/fim) e saída
- Verificação facial via face-api.js (descritores de 512 floats, threshold Euclidiano 0.6)
- Captura de foto por webcam
- Geolocalização (coordenadas, endereço reverso) obtida via API do navegador
- Identificação de dispositivo (IP público via ip-api.com, user-agent, timezone)

### Gestao de Equipe
- CRUD de colaboradores com vínculo a departamentos e cargos
- Controle de regimes contratuais (CLT, PJ, EstAGIO)
- Permissões granulares por usuário (11 permissoes)
- Métricas em tempo real (total, ativos, presentes no dia, atrasados, ausentes, justificativas pendentes)
- Histórico de atividades por colaborador

### Relatorios
>>>>>>> Stashed changes
- Relatório consolidado mensal com filtros (departamento, cargo, colaborador, status)
- Fechamento mensal com controle de abertura/reabertura
- Exportação para PDF (jsPDF com auto-table) e Excel (SheetJS)
- Log de auditoria de ações sobre relatorios

<<<<<<< Updated upstream
###  Calendário
- Visualização mensal dos registros em calendário (FullCalendar)
- Código de cores por status (Normal, Extra, Falta, Pendente)
- Edição rápida e justificativa

###  Notificações Inteligentes
- Scheduler automático (verificação a cada 1h)
- Alertas: face pendente, almoço não registrado, atraso, hora extra, falta de entrada/saída
- Resolução automática de notificações resolvidas
- Tipos: INFO, WARNING, APPROVAL, SECURITY

###  Autenticação e Segurança
- Login com email/senha ou Google OAuth (via Supabase)
- JWT + Refresh Token (com "lembrar-me")
- Verificação de email obrigatória
- Recuperação de senha
- Impersonação de usuários (DEVELOPER)
- Senha com bcrypt (10 rounds)

###  Configurações
- Perfil do usuário (nome, email, telefone, CPF, endereço, data de nascimento)
=======
### Calendario
- Visualização mensal FullCalendar (dayGrid, timeGrid, list)
- Codificação por cores conforme status (Normal, Extra, Ausencia, Pendente, Negativo)
- Edição rápida e associação de justificativas

### Notificacoes Inteligentes
- Scheduler com verificação a cada 1 hora
- Categorias: PENDING_FACE_REGISTRATION, PENDING_BREAK, OVERTIME_DONE, LATE_ENTRY, MISSING_ENTRY, MISSING_EXIT, NO_LUNCH_TODAY, BELOW_MIN_HOURS_WEEK
- Resolução automatica quando a condição deixa de existir
- Deduplicação por metadados (date, shift)

### Autenticacao e Seguranca
- Login por email/senha e Google OAuth (Supabase Auth)
- Autenticação stateless via JWT (validade de 7 dias) + Refresh Token (30 ou 365 dias)
- Verificação de email obrigatoria com codigo via crypto.randomBytes
- Recuperação de senha com token expirável (1 hora)
- Impersonação de usuarios (permissao switch_accounts, apenas DEVELOPER)
- Hashing de senha com bcrypt (10 rounds)

### Configuracoes
- Edição de perfil (nome, email, telefone, CPF, endereço, data de nascimento)
>>>>>>> Stashed changes
- Upload de avatar
- Personalização de tema (claro, escuro, sistema) e cor de destaque (6 opcoes)

<<<<<<< Updated upstream
### Outros
-  Gestão de documentos por colaborador
-  Controle de férias
-  Justificativas de ausência com fluxo de aprovação
-  Mapa interativo com Leaflet
-  Detecção de diagnóstico (dev only)
=======
### Recursos Adicionais
- Gestão de documentos por colaborador com upload para Supabase Storage
- Controle de ferias
- Justificativas de ausencia com fluxo de aprovacao (RH/Admin)
- Mapa interativo com Leaflet para visualização de coordenadas de registro
- Pagina de diagnostico para desenvolvimento (acessivel via Ctrl+Shift+D)
>>>>>>> Stashed changes

---

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind CSS 3 |
| Backend | Express 5, TypeScript |
| ORM | Prisma 7 + @prisma/adapter-pg |
| Banco | PostgreSQL (Supabase) |
| Autenticacao | JWT + Refresh Token + Supabase Auth (Google OAuth) |
| Storage | Supabase Storage (documentos, avatares, banners) |
| Email | Nodemailer + SMTP Gmail |
| Face API | face-api.js (inferencia no navegador) |
| Mapas | Leaflet + react-leaflet |
| PDF | jsPDF + jspdf-autotable |
| Planilhas | xlsx (SheetJS) |
| Calendario | FullCalendar 6 (core, daygrid, timegrid, list, interaction) |
| Icones | Lucide React |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (Vercel)                   │
│  React 19 + Vite 8 + TypeScript + Tailwind          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Paginas    │  │ Componentes  │  │ Servicos  │ │
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
│  │  Routes  │  │ Services │  │     Database      │  │
│  │(11 mod.) │  │          │  │ PostgreSQL/Prisma │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                        │                             │
│  ┌──────────────────────────────────────────────┐   │
│  │          Supabase (Auth + Storage)           │   │
│  │  Google OAuth  Storage  Emails SMTP          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Fluxo de Dados

1. Cliente React faz requisicao HTTP para `/api/*`
2. Express roteia para o modulo correspondente
3. Middleware de autenticacao valida JWT
4. Controller processa a requisicao e chama servicos
5. Servicos acessam banco via Prisma ORM
6. Resposta JSON retorna ao cliente

---

## Estrutura do Projeto

```
chronos/
├── backend/
│   ├── prisma/                  # Schema ORM, migrations, seeds
│   │   └── schema.prisma        # 15 modelos de dados
│   ├── prisma.config.ts         # Configuracao do Prisma
│   └── server/
│       └── src/
│           ├── index.ts         # Entry point Express
│           ├── config/          # Variaveis de ambiente
│           ├── database/        # Conexao Prisma
│           ├── generated/       # Prisma Client (gerado)
│           ├── middleware/      # Autenticacao, error handler, permissoes
│           ├── modules/         # 11 modulos funcionais
│           ├── services/        # Email (Nodemailer)
│           └── utils/           # Scheduler, validadores
├── frontend/
│   └── src/
│       ├── App.tsx             # Componente raiz com estado de roteamento
│       ├── main.tsx            # Inicializacao React
│       ├── types.ts            # Interfaces TypeScript
│       ├── context/            # ThemeProvider (modo claro/escuro)
│       ├── paginas/            # 15 paginas do sistema
│       ├── componentes/        # 26 componentes reutilizaveis
│       ├── services/           # Cliente HTTP, Supabase, validacao, calculo de horas
│       └── utils/              # Face API, permissoes, mascaras
├── docs/
│   └── pipeline.md             # Documentacao tecnica de processos e fluxos
├── fotos/                      # Screenshots
├── Dockerfile                  # Build Docker para deploy
├── vercel.json                 # Configuracao Vercel
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json               # Configuracao TypeScript (monorepo)
└── package.json                # Dependencias e scripts
```

---

## Setup Local

### Requisitos
- Node.js 22+
- PostgreSQL (ou Supabase)

### Instalacao

```bash
git clone https://github.com/Milenaalvez/Chronos.git
cd Chronos
npm install
cp .env.example .env
# Configurar DATABASE_URL, JWT_SECRET no .env
npm run db:generate
npm run db:push
npm run dev:all
```

Frontend em `http://localhost:5173`, API em `http://localhost:3001`.

### Scripts

| Script | Descricao |
|--------|-----------|
| `npm run dev` | Frontend (Vite dev server) |
| `npm run dev:server` | Backend (tsx watch) |
| `npm run dev:all` | Frontend + Backend |
| `npm run build` | Build producao (tsc + Vite) |
| `npm start` | Iniciar servidor em producao |
| `npm run db:generate` | Gerar Prisma Client |
| `npm run db:push` | Sincronizar schema |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed de dados |
| `npm run db:migrate` | Criar migration |

---

## Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL de conexao PostgreSQL |
| `JWT_SECRET` | Sim | Chave para assinatura de tokens JWT |
| `PORT` | Nao | Porta do servidor (default: 3001) |
| `SUPABASE_URL` | Nao | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Nao | Chave anonima Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Nao | Chave de servico Supabase |
| `SMTP_HOST` | Nao | Host SMTP (smtp.gmail.com) |
| `SMTP_PORT` | Nao | Porta SMTP (default: 587) |
| `SMTP_USER` | Nao | Usuario SMTP |
| `SMTP_PASS` | Nao | Senha SMTP (App Password) |
| `SMTP_FROM` | Nao | Remetente de emails |
| `APP_URL` | Nao | URL publica do frontend |
| `CORS_ORIGIN` | Nao | Origens CORS permitidas (separadas por virgula) |
| `VITE_SUPABASE_URL` | Sim | URL Supabase para o frontend |
| `VITE_SUPABASE_ANON_KEY` | Sim | Anon key para o frontend |
| `VITE_API_URL` | Nao | URL da API (default: `/api`) |

---

## Deploy

### Frontend (Vercel)

Build: `npm run build` (tsc -b && vite build)
Output: `frontend/dist/`
URL: `https://chronos-blond-gamma.vercel.app`

### Backend (Render)

Runtime: Node.js
Build: `npm install && npm run build`
Start: `npm start` (npx tsx backend/server/src/index.ts)
Health check: `GET /api/health`
URL: `https://chronos-1-wzqq.onrender.com`

---

## Controle de Acesso (RBAC)

### Roles

| Role | Nivel | Permissoes Padrao |
|------|-------|-------------------|
| DEVELOPER | 1 (maior) | Acesso total ao sistema |
| ADMIN | 2 | Gestao completa (equipe, relatorios, permissoes, auditoria) |
| RH | 3 | Equipe, relatorios, ferias, justificativas, aprovacoes |
| EMPLOYEE | 4 | Registro de ponto, dashboard, calendario, notificacoes, configuracoes |

### Permissoes

| Permissao | Descricao |
|-----------|-----------|
| `access_team` | Visualizar equipe |
| `manage_members` | Gerenciar membros (CRUD) |
| `approve_justifications` | Aprovar/rejeitar justificativas |
| `edit_time_records` | Editar registros de hora |
| `approve_time_records` | Aprovar jornadas |
| `reset_passwords` | Redefinir senhas |
| `view_logs` | Visualizar logs |
| `export_reports` | Exportar relatorios |
| `switch_accounts` | Trocar contas (impersonacao) |
| `manage_permissions` | Gerenciar permissoes |
| `manage_company` | Gerenciar empresa |

Usuarios alocados ao departamento **TI** recebem automaticamente todas as permissoes.

---

## Modelo de Dados

15 modelos gerenciados pelo Prisma ORM:

- `User` — Colaboradores (autenticacao, perfil, preferencias)
- `Company` — Empresas (multi-tenant)
- `Department` — Departamentos
- `Position` — Cargos
- `TimeRecord` — Registros de jornada (entrada, saida, intervalos)
- `PointEvent` — Eventos de ponto individuais (GPS, foto, face)
- `Justification` — Justificativas de ausencia
- `Notification` — Notificacoes do sistema
- `FaceRegistration` — Descritores faciais
- `Document` — Documentos dos colaboradores
- `Integration` — Integracoes (Google Calendar, Slack, Teams, Outlook)
- `TermAcceptance` — Aceitacao dos termos de uso
- `ActivityLog` — Auditoria
- `MonthClosing` — Fechamento mensal
- `ContractType` — Tipo de contrato (enum: CLT, PJ, ESTAGIO)

---

## Documentacao Detalhada

Consulte `docs/pipeline.md` para documentacao tecnica completa de processos e fluxos:

- Fluxo de autenticacao (registro, login, OAuth, refresh token, recuperacao de senha)
- Fluxo de registro de ponto (ciclo ENTRY -> BREAK_START -> BREAK_END -> EXIT)
- Fluxo de verificacao facial (registro e matching)
- Fluxo de justificativas (criacao e aprovacao)
- Fluxo de notificacoes inteligentes (scheduler e tipos)
- Fluxo de emails (SMTP e templates)
- Fluxo de times e membros
- Fluxo de documentos (upload/download)
- Pipeline de deploy (Vercel + Render)
- Modelo de dados completo (Prisma schema)

---

## Licenca

Uso interno. Projeto privado.
