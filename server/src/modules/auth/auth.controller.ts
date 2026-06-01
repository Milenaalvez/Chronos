import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as authService from './auth.service.js'
import * as avatarService from './avatar.service.js'

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, email, password, cpf, phone, position, companySlug } = req.body
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, email e senha são obrigatórios' })
      return
    }
    const result = await authService.registerUser({ name, email, password, cpf, phone, position, companySlug })
    res.status(201).json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function sendVerification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email } = req.body
    if (!email) {
      res.status(400).json({ error: 'Email é obrigatório' })
      return
    }
    const result = await authService.sendVerificationCode(email)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function verifyEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { token } = req.body
    if (!token) {
      res.status(400).json({ error: 'Token de verificação é obrigatório' })
      return
    }
    const result = await authService.verifyEmail(token)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { login, password, rememberMe } = req.body
    if (!login || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' })
      return
    }
    const result = await authService.loginUser(login, password, !!rememberMe)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function loginSupabase(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { access_token } = req.body
    if (!access_token) {
      res.status(400).json({ error: 'Token de acesso é obrigatório' })
      return
    }
    const result = await authService.loginWithSupabase(access_token)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function forgotPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email } = req.body
    if (!email) {
      res.status(400).json({ error: 'Email é obrigatório' })
      return
    }
    const result = await authService.forgotPassword(email)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function updatePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      res.status(400).json({ error: 'Token e nova senha são obrigatórios' })
      return
    }
    const result = await authService.updatePassword(token, password)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, position, phone, email, birthDate, address } = req.body
    const result = await authService.updateOwnProfile(req.user!.userId, { name, position, phone, email, birthDate, address })
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await authService.getProfile(req.user!.userId)
    res.json(user)
  } catch (err) {
    next(err)
  }
}

export async function google(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, name, avatar } = req.body
    if (!email || !name) {
      res.status(400).json({ error: 'Email e nome são obrigatórios' })
      return
    }
    const result = await authService.googleAuth({ email, name, avatar })
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { themeMode, themeAccent } = req.body
    const user = await authService.updatePreferences(req.user!.userId, { themeMode, themeAccent })
    res.json(user)
  } catch (err) {
    next(err)
  }
}

export async function uploadAvatar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Arquivo de imagem é obrigatório' })
      return
    }
    const result = await avatarService.uploadAvatar(req.user!.userId, file.buffer, file.mimetype)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function impersonate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { targetUserId } = req.body
    if (!targetUserId) {
      res.status(400).json({ error: 'ID do usuário alvo é obrigatório' })
      return
    }
    const result = await authService.impersonateUser(req.user!, targetUserId)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function accessibleAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accounts = await authService.getAccessibleAccounts(req.user!)
    res.json(accounts)
  } catch (err) { next(err) }
}

export async function refresh(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token é obrigatório' })
      return
    }
    const result = await authService.refreshSession(refreshToken)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await authService.logoutUser(req.user!.userId)
    res.json({ message: 'Sessão encerrada' })
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}
