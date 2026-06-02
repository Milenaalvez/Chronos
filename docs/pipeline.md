# Chronos — Pipeline de Processos e Fluxos

> Sistema de gestão de ponto eletrônico com verificação facial, geolocalização e smart notifications.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Fluxo de Autenticação](#fluxo-de-autenticação)
- [Fluxo de Registro de Ponto](#fluxo-de-registro-de-ponto)
- [Fluxo de Verificação Facial](#fluxo-de-verificação-facial)
- [Fluxo de Justificativas](#fluxo-de-justificativas)
- [Fluxo de Notificações Inteligentes](#fluxo-de-notificações-inteligentes)
- [Fluxo de Emails](#fluxo-de-emails)
- [Fluxo de Times e Membros](#fluxo-de-times-e-membros)
- [Fluxo de Documentos](#fluxo-de-documentos)
- [Controle de Acesso](#controle-de-acesso)
- [Pipeline de Deploy](#pipeline-de-deploy)
- [Modelo de Dados](#modelo-de-dados)
- [Estrutura do Projeto](#estrutura-do-projeto)

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
│               BACKEND (Render/Railway)               │
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

### Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind 3 |
| Backend | Express 5, TypeScript |
| ORM | Prisma 7 + @prisma/adapter-pg |
| Banco | PostgreSQL (Supabase) |
| Auth | JWT + Refresh Token + Supabase Auth (Google OAuth) |
| Storage | Supabase Storage (documentos, avatares, banners) |
| Email | Nodemailer + SMTP Gmail |
| Mapas | Leaflet + react-leaflet |
| Face API | @vladmandic/face-api (face-api.js) |
| Gráficos | Chart.js via componentes próprios |
| PDF | jsPDF + jspdf-autotable |
| Planilhas | xlsx (SheetJS) |

---

## Fluxo de Autenticação

### 1. Registro (`POST /auth/register`)

```
Usuário → [Frontend: LoginPage] → POST /api/auth/register
  ├→ Valida: nome (≥2), email (regex), senha (8+ chars, maiúscula+minúscula+dígito)
  ├→ Normaliza: email.toLowerCase().trim()
  ├→ Verifica duplicidade: email único, CPF único
  ├→ Busca ou cria Company pelo slug
  ├→ Define role: DEVELOPER (1º usuário) ou EMPLOYEE
  ├→ Gera registrationNumber: sequencial (10001+)
  ├→ Hash senha (bcrypt, 10 rounds)
  ├→ Gera verificationCode (crypto.randomBytes(32) hex)
  ├→ Cria User no banco
  ├→ Envia email de boas-vindas com link de verificação (sendWelcomeEmail)
  ├→ Cria notificação de boas-vindas
  ├→ Cria usuário no Supabase Auth (admin.createUser) [não crítico]
  ├→ Gera JWT (7d) + Refresh Token (30d)
  └→ Retorna { token, refreshToken, user, registrationNumber }
```

### 2. Verificação de Email (`POST /auth/verify-email`)

```
Email → Link: {APP_URL}/?action=verify-email&token={code}
  ├→ Frontend detecta action=verify-email
  ├→ Renderiza VerifyEmailPage
  ├→ POST /api/auth/verify-email { token }
  ├→ Busca user por verificationCode (não expirado)
  ├→ Marca emailVerified = true
  ├→ Limpa verificationCode + verificationExpiresAt
  ├→ Seta lastAccessAt
  ├→ Gera activity log
  ├→ Gera novo JWT
  └→ Redireciona ao dashboard
```

### 3. Login (`POST /auth/login`)

```
{ login, password }
  ├→ Detecta se é email (contém @) ou matrícula (CHRXXXXX)
  ├→ Busca user por email ou registrationNumber
  ├→ bcrypt.compare(password)
  ├→ Verifica isActive
  ├→ Atualiza lastAccessAt
  ├→ Migra para Supabase Auth (se não existir)
  ├→ Gera JWT + Refresh Token
  └→ Retorna { token, refreshToken, user }
```

### 4. Google OAuth (`POST /auth/google`)

```
{ email, name, avatar }
  ├→ Busca user por email
  ├→ Se existe: atualiza emailVerified + lastAccessAt
  ├→ Se não: cria user (empresa default, role EMPLOYEE)
  ├→ Gera JWT + Refresh Token
  └→ Retorna { token, refreshToken, user }
```

### 5. Refresh Token (`POST /auth/refresh`)

```
{ refreshToken }
  ├→ bcrypt.compare(hash armazenado)
  ├→ Gera nova versão (incrementa refreshTokenVersion)
  ├→ Gera novo JWT + novo Refresh Token
  ├→ Atualiza hash + expiry
  └→ Retorna { token, refreshToken }
```

### 6. Recuperação de Senha (`POST /auth/forgot-password` + `/auth/update-password`)

```
Forgot:
  { email }
  ├→ Busca user
  ├→ Gera resetPasswordCode (crypto.randomBytes(32) hex) + expires (1h)
  ├→ Envia email com link: {APP_URL}/?action=reset-password&token={code}
  └→ Retorna { message }

Update:
  { token, password }
  ├→ Valida nova senha
  ├→ Busca por resetPasswordCode (não expirado)
  ├→ bcrypt.hash nova senha
  ├→ Atualiza senha + invalida refresh tokens
  ├→ Envia notificação de segurança
  └→ Retorna { token, user }
```

### 7. Impersonação (ADMIN only)

```
{ targetUserId }
  ├→ Verifica permissão switch_accounts
  ├→ Gera JWT para o usuário alvo
  ├→ Activity log com actor info
  └→ Retorna { token, refreshToken, user, message }
```

---

## Fluxo de Registro de Ponto

### Ciclo Obrigatório

```
ENTRY → BREAK_START → BREAK_END → EXIT
```

Cada etapa é registrada via `POST /api/point-records`.

### Etapas

```
1. Usuário abre RegistrarPontoPage
   ├→ Busca geolocalização (navigator.geolocation)
   ├→ Obtém device info (browser, OS, screen, timezone)
   ├→ Busca IP via ip-api.com
   ├→ Carrega eventos do dia: GET /api/point-records?date=today
   ├→ Determina qual ação está disponível (baseado no último evento)
   └→ Exibe botão correspondente

2. Usuário clica no botão de ação
   ├→ Abre PointVerificationModal
   ├→ Etapa 1: Senha (bcrypt.compare)
   ├→ Etapa 2: Captcha visual (confirmação)
   ├→ Etapa 3: Captura facial (câmera + face-api)
   │   ├→ Carrega modelos face-api do CDN
   │   ├→ Ativa câmera (video stream)
   │   ├→ Detecta face + verifica centralização (moldura oval)
   │   ├→ Extrai descritor facial (512 floats)
   │   └→ Compara com descritor registrado (distância Euclidiana, threshold 0.6)
   └→ Confirma: POST /api/point-records

3. Servidor recebe o ponto
   ├→ Valida ordenação (não permite repetir mesmo tipo)
   ├→ Armazena: tipo, timestamp, location, deviceInfo, photoData, faceVerified
   ├→ Se for EXIT: upsertRecord() → cria/atualiza TimeRecord do dia
   │   ├→ Calcula total de minutos trabalhados
   │   ├→ Define status com base no horário (PONTUAL/ATRASADO)
   │   └→ Upsert (cria se não existe, atualiza se já existe)
   └→ Retorna { pointRecord, timeRecord? }
```

### Estrutura do PointRecord

```typescript
{
  id: string
  userId: string
  pointType: "ENTRY" | "BREAK_START" | "BREAK_END" | "EXIT"
  timestamp: DateTime
  latitude: number
  longitude: number
  locationAccuracy: number
  locationAddress: string
  locationCity: string
  locationState: string
  deviceInfo: JSON { browser, os, ip, timezone, language, screen }
  photoData: string | null  // base64
  faceVerified: boolean | null
  password: string  // bcrypt hash
}
```

---

## Fluxo de Verificação Facial

### Registro Facial (`POST /api/face-registration/register`)

```
Frontend: FaceRegistrationModal
  ├→ 5 capturas em ângulos diferentes (frente, esquerda, direita, cima, baixo)
  ├→ Cada captura extrai descritor facial via face-api.js
  ├→ Envia array de descritores + imagens para o backend
  ├→ Servidor armazena no banco (JSON)
  └→ Marca como registro ativo

Backend:
  { descriptors: number[][], images: string[] }
  ├→ Inativa registros anteriores do usuário
  ├→ Cria novo FaceRegistration
  └→ Retorna { id }
```

### Verificação no Ponto (`POST /api/point-records`)

```
PointVerificationModal:
  ├→ Carrega modelos face-api do CDN (http://cdn.jsdelivr.net)
  ├→ Ativa stream de vídeo
  ├→ Detecta face em cada frame
  ├→ Valida posição dentro da moldura oval
  ├→ Após 1.5s contínuos centrados → captura automática
  ├→ Extrai descritor do frame capturado
  ├→ Compara com descritores registrados (distância Euclidiana mínima)
  └→ Se distância < 0.6 → match ✓ | senão → erro
```

---

## Fluxo de Justificativas

### Criação (`POST /api/justifications`)

```
{ reason, description, startDate, endDate }
  ├→ Valida: reason obrigatório, startDate ≤ endDate
  ├→ Cria justificativa com status PENDING
  ├→ Cria notificação para RH/ADMIN
  ├→ Activity log
  └→ Retorna justificativa
```

### Aprovação/Rejeição (`PATCH /api/justifications/:id`)

```
{ status: "APPROVED" | "REJECTED", rhResponse?: string }
  ├→ Verifica permissão: approve_justifications
  ├→ Atualiza status + rhResponse + reviewedBy + reviewedAt
  ├→ Se APPROVED: upsertRecords para cada dia no período
  │   ├→ Cria/atualiza TimeRecord com justificativa
  │   └→ Define clockIn/Out como horário da justificativa
  ├→ Notifica usuário
  └→ Activity log
```

---

## Fluxo de Notificações Inteligentes

### Scheduler (execução a cada 1 hora)

```
startScheduler() → setInterval(checkAllUsers, 60 * 60 * 1000)

checkAllUsers:
  Para cada usuário ativo:
    ├─ PENDING_FACE_REGISTRATION
    │   └→ Se não tem FaceRegistration ativo → cria notificação
    ├─ PENDING_BREAK
    │   └→ Se entrou mas não saiu para almoço até 13h → notifica
    ├─ OVERTIME_DONE
    │   └→ Se fez hora extra ontem → notifica
    ├─ LATE_ENTRY
    │   └→ Se entrou após horário (com tolerância) → notifica
    ├─ MISSING_ENTRY
    │   └→ Hoje, se não bateu entrada até horário limite → notifica
    ├─ MISSING_EXIT
    │   └→ Ontem, se não bateu saída → notifica
    ├─ NO_LUNCH_TODAY
    │   └→ Se está há 6h+ sem bater almoço → notifica
    └─ BELOW_MIN_HOURS_WEEK
        └→ Se está abaixo da carga semanal mínima → notifica

Resolução automática:
  → Se notificação existe e condição não existe mais → marca como resolvida
  → Matching por metadados (ex: { date, shift } para evitar duplicatas)
```

### Tipos de Notificação

| Tipo | Categoria | Descrição |
|------|-----------|-----------|
| PENDING_FACE_REGISTRATION | SECURITY | Usuário não registrou face |
| PENDING_BREAK | WORK_HOURS | Almoço pendente |
| OVERTIME_DONE | WORK_HOURS | Hora extra concluída |
| LATE_ENTRY | WORK_HOURS | Entrada atrasada |
| MISSING_ENTRY | WORK_HOURS | Sem entrada hoje |
| MISSING_EXIT | WORK_HOURS | Sem saída ontem |
| NO_LUNCH_TODAY | WORK_HOURS | Sem almoço hoje |
| BELOW_MIN_HOURS_WEEK | WORK_HOURS | Abaixo da carga mínima |
| INFO | INFO | Informativa |
| SECURITY | SECURITY | Segurança (senha alterada, etc.) |
| APPROVAL | APPROVAL | Aprovação de justificativa/registro |

---

## Fluxo de Emails

### Configuração SMTP

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="chronos.sistem@gmail.com"
SMTP_PASS="kgbz egvf nrxh zzuy"  # App Password do Google
SMTP_FROM="Chronos <chronos.sistem@gmail.com>"
```

### Templates de Email

Todos usam HTML com fallback visual (CSS inline), banners do Supabase Storage com fallback em texto.

| Função | Disparo | Template |
|--------|---------|----------|
| `sendWelcomeEmail` | Registro (admin ou self) | Boas-vindas com matrícula + link de ativação |
| `sendVerificationEmail` | Reenvio de verificação | Confirmação de email |
| `sendPasswordResetEmail` | Recuperação de senha | Redefinição de senha |
| `sendSecurityNotification` | Senha alterada | Alerta de segurança |

### Fluxo de Envio

```
send(to, subject, html):
  ├→ Se SMTP configurado → tenta transporter.sendMail()
  │   ├→ Se falhar → console.warn + fallback console.log
  │   └→ Se OK → return
  └→ Se SMTP não configurado → logFallback (console.log)
```

### Banners

Os banners dos emails são hospedados no Supabase Storage (`branding` bucket). Se as imagens não carregarem, o fallback HTML/CSS é exibido (fundo azul escuro com texto "CHRONOS").

---

## Fluxo de Times e Membros

### Gerenciamento de Membros

| Ação | Método | Permissão |
|------|--------|-----------|
| Listar membros | `GET /api/team` | access_team |
| Convidar | `POST /api/team` | manage_members |
| Atualizar | `PATCH /api/team/:id` | manage_members |
| Remover | `DELETE /api/team/:id` | manage_members |
| Obter | `GET /api/team/:id` | access_team |
| Métricas | `GET /api/team/metrics` | access_team |
| Activity logs | `GET /api/team/:id/activity` | view_audit |
| Relatório PDF | `GET /api/team/:id/report` | export_data |

### Fluxo de Convite

```
POST /api/team { name, email, position, role, departmentId, companySlug }
  ├→ Valida dados obrigatórios
  ├→ Verifica email duplicado no banco
  ├→ Verifica restrições de role (não criar DEVELOPER)
  ├→ Cria usuário (email não verificado)
  ├→ Gera registrationNumber
  ├→ Envia email de boas-vindas com link de ativação
  ├→ Cria notificação de boas-vindas
  ├→ Envia convite Supabase Auth (inviteUserByEmail)
  └→ Activity log
```

---

## Fluxo de Documentos

### Upload (`POST /api/documents/upload`)

```
multipart/form-data: { file, name, type, category, notes? }
  ├→ Garante bucket "documents" no Supabase Storage (público, 10MB)
  ├→ Gera path: {userId}/{timestamp}_{random}.{ext}
  ├→ Upload para Supabase Storage
  ├→ Cria registro no banco (Document)
  └→ Retorna { url, document }
```

### Download

```
GET /api/documents/:id/download
  ├→ Verifica permissão
  ├→ Busca documento
  ├→ Redireciona para URL pública do Supabase Storage
  └→ Download do arquivo
```

---

## Controle de Acesso

### Roles

| Role | Hierarquia | Acesso Padrão |
|------|------------|---------------|
| DEVELOPER | 1 (maior) | Todas permissões |
| ADMIN | 2 | Gerenciamento completo |
| RH | 3 | Membros, justificativas, relatórios |
| EMPLOYEE | 4 | Próprio perfil, registro de ponto |

### Permissões (13)

| Permissão | Descrição |
|-----------|-----------|
| `access_team` | Visualizar equipe |
| `manage_members` | Gerenciar membros (CRUD) |
| `view_reports` | Ver relatórios |
| `approve_justifications` | Aprovar/rejeitar justificativas |
| `manage_roles` | Alterar roles |
| `manage_permissions` | Gerenciar permissões |
| `view_audit` | Ver logs de auditoria |
| `manage_company` | Gerenciar empresa |
| `export_data` | Exportar dados (PDF/XLSX) |
| `manage_documents` | Gerenciar documentos |
| `manage_system` | Configurações do sistema |
| `view_financial` | Dados financeiros |
| `manage_work_hours` | Gerenciar horas trabalhadas |

### Hierarquia de Departamento

Usuários do departamento **TI** recebem automaticamente todas as permissões.

---

## Pipeline de Deploy

### Frontend → Vercel

```
┌──────────┐     git push     ┌──────────┐     build     ┌──────────┐
│  GitHub  │ ───────────────→ │  Vercel  │ ────────────→ │  Live    │
│  main    │                  │          │               │  Site    │
└──────────┘                  └──────────┘               └──────────┘

Build: npm run build → tsc -b && vite build → dist/
```

### Backend → Render

```
┌──────────┐     git push     ┌──────────┐     build     ┌──────────┐
│  GitHub  │ ───────────────→ │  Render  │ ────────────→ │  API     │
│  main    │                  │ Web Serv │               │  Live    │
└──────────┘                  └──────────┘               └──────────┘

Build: npm install && npx prisma generate
Start: npx tsx server/src/index.ts
Root: server/
```

### Variáveis de Ambiente

| Variável | Local | Vercel (front) | Render (back) |
|----------|-------|----------------|---------------|
| DATABASE_URL | `.env` | — | ✅ |
| JWT_SECRET | `.env` | — | ✅ |
| SUPABASE_URL | `.env` | — | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | `.env` | — | ✅ |
| SUPABASE_ANON_KEY | `.env` | ✅ | ✅ |
| SMTP_* | `.env` | — | ✅ |
| APP_URL | `.env` | — | ✅ |
| CORS_ORIGIN | `.env` | — | ✅ |
| VITE_SUPABASE_URL | `.env` | ✅ | — |
| VITE_SUPABASE_ANON_KEY | `.env` | ✅ | — |
| VITE_API_URL | — | ✅ (opcional) | — |

---

## Modelo de Dados (Prisma)

### User

```prisma
model User {
  id                    String   @id @default(cuid())
  name                  String
  email                 String   @unique
  password              String
  cpf                   String?  @unique
  phone                 String?
  avatar                String?
  role                  UserRole @default(EMPLOYEE)
  registrationNumber    String?  @unique
  emailVerified         Boolean  @default(false)
  isActive              Boolean  @default(true)
  hireDate              DateTime @default(now())
  contractType          ContractType?
  workSchedule          WorkSchedule?
  departmentId          String?
  positionId            String?
  companyId             String
  department            Department?  @relation(fields: [departmentId], references: [id])
  position              Position?    @relation(fields: [positionId], references: [id])
  company               Company      @relation(fields: [companyId], references: [id])
  timeRecords           TimeRecord[]
  pointRecords          PointRecord[]
  justifications        Justification[]
  notifications         Notification[]
  faceRegistrations     FaceRegistration[]
  documents             Document[]
  activityLogs          ActivityLog[]
  termAcceptances       TermAcceptance[]
  verificationCode      String?
  verificationExpiresAt DateTime?
  resetPasswordCode     String?
  resetPasswordExpiresAt DateTime?
  refreshTokenHash      String?
  refreshTokenExpiresAt DateTime?
  refreshTokenVersion   Int      @default(1)
  lastAccessAt          DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  permissions           Json?
  themeMode             String   @default("system")
  themeAccent           String   @default("blue")
  birthDate             DateTime?
  address               String?
}
```

### TimeRecord

```prisma
model TimeRecord {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id])
  dataISO       String         // "YYYY-MM-DD"
  clockIn       String?        // "HH:mm"
  clockOut      String?
  breakStart    String?
  breakEnd      String?
  totalMinutes  Int?
  type          TimeRecordType? @default(NORMAL)
  status        String?        // PONTUAL | ATRASADO
  reviewStatus  ReviewStatus   @default(PENDING)
  reviewedBy    String?
  reviewedAt    DateTime?
  justificationId String?
  justification Justification? @relation(fields: [justificationId], references: [id])
  version       Int            @default(0)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@unique([userId, dataISO])
  @@index([userId, dataISO])
}
```

### PointRecord

```prisma
model PointEvent {
  id               String    @id @default(cuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id])
  pointType        PointType // ENTRY, BREAK_START, BREAK_END, EXIT
  timestamp        DateTime  @default(now())
  latitude         Float?
  longitude        Float?
  locationAccuracy Float?
  locationAddress  String?
  locationCity     String?
  locationState    String?
  deviceInfo       Json?
  photoData        String?   @db.Text
  faceVerified     Boolean?
  password         String
  createdAt        DateTime  @default(now())
}
```

---

## Estrutura do Projeto

```
chronos/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── server/
│   └── src/
│       ├── index.ts
│       ├── config/env.ts
│       ├── database/
│       │   ├── prisma.ts
│       │   └── supabase.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── error.ts
│       │   └── roles.ts
│       ├── modules/
│       │   ├── auth/          (controller, routes, service)
│       │   ├── pointRecord/
│       │   ├── timeRecord/
│       │   ├── justification/
│       │   ├── notification/
│       │   ├── team/
│       │   ├── document/
│       │   ├── reference/
│       │   ├── faceRegistration/
│       │   └── termAcceptance/
│       ├── services/
│       │   └── email.ts
│       └── utils/
│           ├── scheduler.ts
│           ├── permissions.ts
│           ├── password.ts
│           ├── cpf.ts
│           ├── phone.ts
│           └── code.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── contexts/
│   │   └── ThemeContext.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── supabase.ts
│   │   ├── workHoursEngine.ts
│   │   ├── calculo-horas.ts
│   │   ├── notificacoes.ts
│   │   └── validation.ts
│   ├── utils/
│   │   ├── face.ts
│   │   ├── masks.ts
│   │   └── permissions.ts
│   ├── componentes/    (26 componentes)
│   └── paginas/        (15 páginas)
├── fotos/
├── vite.config.ts
├── .env
└── package.json
```
