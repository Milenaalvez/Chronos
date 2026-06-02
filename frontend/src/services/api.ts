const BASE_URL = import.meta.env.VITE_API_URL || '/api'

let token: string | null = localStorage.getItem('chronos_token')
let refreshToken: string | null = localStorage.getItem('chronos_refresh')
let rememberMe = localStorage.getItem('chronos_remember') === 'true'

let onAuthExpired: ((reason: string) => void) | null = null
let refreshPromise: Promise<boolean> | null = null

export function setOnAuthExpired(fn: ((reason: string) => void) | null) {
  onAuthExpired = fn
}

export function setToken(t: string | null) {
  token = t
  if (t) localStorage.setItem('chronos_token', t)
  else localStorage.removeItem('chronos_token')
}

export function setRefreshToken(t: string | null, remMe?: boolean) {
  refreshToken = t
  rememberMe = remMe ?? rememberMe
  if (t) {
    localStorage.setItem('chronos_refresh', t)
    localStorage.setItem('chronos_remember', String(rememberMe))
  } else {
    localStorage.removeItem('chronos_refresh')
    localStorage.removeItem('chronos_remember')
  }
}

export function getToken() {
  return token
}

export function getRefreshToken() {
  return refreshToken
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        setRefreshToken(null)
        return false
      }
      const data = await res.json()
      setToken(data.token)
      setRefreshToken(data.refreshToken, rememberMe)
      return true
    } catch {
      setRefreshToken(null)
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch (err) {
    throw new Error(`Falha de conexão: ${(err as Error)?.message || 'Servidor indisponível'}`)
  }

  if (res.status === 401) {
    const body = await res.text().catch(() => '(error reading body)')

    // Login/register/auth endpoints: just throw the server error
    if (path.startsWith('/auth/login') || path.startsWith('/auth/register')) {
      let data: any
      try { data = JSON.parse(body) } catch { }
      throw new Error(data?.error || 'Email ou senha incorretos')
    }

    // Non-auth endpoints: try refresh if we have a refresh token
    if (refreshToken) {
      const ok = await tryRefresh()
      if (ok) {
        headers['Authorization'] = `Bearer ${token}`
        try {
          res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
        } catch (err) {
          throw new Error(`Falha de conexão: ${(err as Error)?.message || 'Servidor indisponível'}`)
        }
        if (res.status !== 401) {
          const text = await res.text()
          if (!text) throw new Error(`Resposta vazia (${res.status}) para ${path}`)
          let data: any
          try { data = JSON.parse(text) } catch { throw new Error(`Resposta inválida (${res.status})`) }
          if (!res.ok) throw new Error(data.error || 'Erro na requisição')
          return data
        }
      }
      console.warn(`[API] 401 em ${path}:`, body)
      setToken(null)
      setRefreshToken(null)
      onAuthExpired?.('Sua sessão expirou. Faça login novamente.')
      throw new Error('Sessão expirada')
    }

    console.warn(`[API] 401 em ${path}:`, body)
    setToken(null)
    setRefreshToken(null)
    onAuthExpired?.('Não foi possível validar sua autenticação.')
    throw new Error('Sessão expirada')
  }

  const text = await res.text()
  if (!text) {
    throw new Error(`Resposta vazia (${res.status}) para ${path}`)
  }
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Resposta inválida (${res.status}) para ${path}: ${text.slice(0, 100)}`)
  }
  if (!res.ok) throw new Error(data.error || 'Erro na requisição')
  return data
}

export const auth = {
  register: (data: {
    name: string
    email: string
    password: string
    cpf?: string
    phone?: string
    position?: string
    companySlug?: string
  }) =>
    request<{ token: string; refreshToken: string; user: any; registrationNumber: string; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendVerification: (email: string) =>
    request<{ message: string }>('/auth/send-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyEmail: (token: string) =>
    request<{ token: string; user: any; message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  login: (login: string, password: string, rememberMe?: boolean) =>
    request<{ token: string; refreshToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password, rememberMe }),
    }),

  loginSupabase: (access_token: string) =>
    request<{ token: string; refreshToken: string; user: any }>('/auth/login/supabase', {
      method: 'POST',
      body: JSON.stringify({ access_token }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  updatePassword: (token: string, password: string) =>
    request<{ token: string; user: any; message: string }>('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  google: (data: { email: string; name: string; avatar?: string }) =>
    request<{ token: string; refreshToken: string; user: any }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => request<any>('/auth/me'),
  refresh: (refreshToken: string) =>
    request<{ token: string; refreshToken: string; user: any }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  updatePreferences: (data: { themeMode?: string; themeAccent?: string }) =>
    request<any>('/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateProfile: (data: { name?: string; position?: string; phone?: string | null; email?: string; birthDate?: string | null; address?: string | null }) =>
    request<any>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  impersonate: (targetUserId: string) =>
    request<{ token: string; refreshToken: string; user: any; message: string }>('/auth/impersonate', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
  accessibleAccounts: () => request<any[]>('/auth/accessible-accounts'),
}

export const timeRecords = {
  list: (params?: { startDate?: string; endDate?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(params as any).toString()
      : ''
    return request<any[]>(`/time-records${qs}`)
  },

  getById: (id: string) => request<any>(`/time-records/${id}`),

  upsert: (data: {
    date: string
    clockIn: string
    clockOut?: string
    breakStart?: string
    breakEnd?: string
    description?: string
  }) =>
    request<any>('/time-records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<any>(`/time-records/${id}`, { method: 'DELETE' }),

  pendingReviews: () => request<any[]>('/time-records/pending-reviews'),

  approve: (id: string, note?: string) =>
    request<any>(`/time-records/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    }),

  reject: (id: string, note?: string) =>
    request<any>(`/time-records/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    }),
}

export const justifications = {
  list: () => request<any[]>('/justifications'),

  create: (data: {
    reason: string
    description?: string
    startDate: string
    endDate: string
  }) =>
    request<any>('/justifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approve: (id: string) =>
    request<any>(`/justifications/${id}/approve`, { method: 'PUT' }),

  reject: (id: string, rhResponse?: string) =>
    request<any>(`/justifications/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ rhResponse }),
    }),
}

export const notifications = {
  create: (data: {
    title: string
    message: string
    type: 'APPROVAL' | 'WARNING' | 'INFO' | 'SYSTEM'
    link?: string
    metadata?: Record<string, unknown>
    sendEmail?: boolean
    collaboratorEmail?: string
    collaboratorName?: string
    period?: string
  }) => request<any>('/notifications', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  list: () => request<any[]>('/notifications'),

  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    request<any>(`/notifications/${id}/read`, { method: 'PUT' }),

  markAllRead: () =>
    request<any>('/notifications/read-all', { method: 'PUT' }),

  delete: (id: string) =>
    request<any>(`/notifications/${id}`, { method: 'DELETE' }),

  refresh: () =>
    request<{ ok: boolean; count: number }>('/notifications/refresh', { method: 'POST' }),
}

export const team = {
  list: () => request<any[]>('/team'),

  getById: (id: string) => request<any>(`/team/${id}`),

  metrics: () => request<{
    total: number; active: number; inactive: number; verified: number;
    presentToday: number; lateToday: number; absentToday: number; pendingJustifications: number;
  }>('/team/metrics'),

  activityLogs: (limit?: number) =>
    request<any[]>(`/team/activity/logs${limit ? `?limit=${limit}` : ''}`),

  create: (data: {
    name: string
    email: string
    role?: string
    department?: string
    departmentId?: string
    position?: string
    positionId?: string
    contractType?: string
    weeklyHours?: number
    workSchedule?: string
    hireDate?: string
    phone?: string
  }) =>
    request<any>('/team', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    request<any>(`/team/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateRole: (id: string, role: string) =>
    request<any>(`/team/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  updateStatus: (id: string, isActive: boolean) =>
    request<any>(`/team/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    }),

  enriched: () => request<any[]>('/team/enriched'),

  delete: (id: string) =>
    request<any>(`/team/${id}`, { method: 'DELETE' }),

  deactivate: (id: string) =>
    request<any>(`/team/${id}/deactivate`, { method: 'PUT' }),

  resetPassword: (id: string) =>
    request<{ tempPassword: string; message: string }>(`/team/${id}/reset-password`, {
      method: 'POST',
    }),

  resendVerification: (id: string) =>
    request<{ message: string }>(`/team/${id}/resend-verification`, {
      method: 'POST',
    }),

  getProfile: (id: string) => request<any>(`/team/${id}/profile`),

  getPermissions: (id: string) => request<{ id: string; role: string; permissions: string[] }>(`/team/${id}/permissions`),

  updatePermissions: (id: string, permissions: string[]) =>
    request<any>(`/team/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
}

export const reference = {
  departments: () =>
    request<any[]>('/reference/departments'),

  positions: (departmentId?: string) =>
    request<any[]>(`/reference/positions${departmentId ? `?departmentId=${departmentId}` : ''}`),
}

export function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData()
  form.append('avatar', file)
  return request<{ avatarUrl: string }>('/auth/avatar', {
    method: 'POST',
    body: form,
  })
}

export const pointRecords = {
  list: (date?: string, includePhoto?: boolean) => {
    const params = new URLSearchParams()
    if (date) params.set('date', date)
    if (includePhoto) params.set('includePhoto', 'true')
    const qs = params.toString()
    return request<any[]>(`/point-records${qs ? `?${qs}` : ''}`)
  },
  create: (data: {
    pointType: string
    timeValue: string
    latitude?: number | null
    longitude?: number | null
    locationAccuracy?: number | null
    locationAddress?: string | null
    locationCity?: string | null
    locationState?: string | null
    deviceInfo?: Record<string, unknown> | null
    photoData?: string | null
    hasPhoto?: boolean
    password?: string
    faceVerified?: boolean | null
  }) =>
    request<any>('/point-records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

export const termAcceptance = {
  accept: () =>
    request<any>('/term-acceptance/accept', { method: 'POST' }),
  status: () =>
    request<{ accepted: boolean; acceptance: any }>('/term-acceptance/status'),
}

export const faceRegistration = {
  register: (descriptors: number[][], images: string[]) =>
    request<any>('/face-registration/register', {
      method: 'POST',
      body: JSON.stringify({ descriptors, images }),
    }),
  status: () =>
    request<{ registered: boolean; registration: any }>('/face-registration/status'),
  descriptors: () =>
    request<{ descriptors: number[][] | null; status: string | null }>('/face-registration/descriptors'),
}

export const documents = {
  list: (userId: string) =>
    request<any[]>(`/documents/user/${userId}`),

  upload: (file: File, data: { userId: string; name: string; type: string; category: string; notes?: string }) => {
    const form = new FormData()
    form.append('file', file)
    form.append('userId', data.userId)
    form.append('name', data.name)
    form.append('type', data.type)
    form.append('category', data.category)
    if (data.notes) form.append('notes', data.notes)
    return request<{ id: string }>('/documents/upload', {
      method: 'POST',
      body: form,
    })
  },

  delete: (id: string, userId: string) =>
    request<any>(`/documents/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    }),
}
