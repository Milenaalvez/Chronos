import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as documentService from './document.service.js'

export async function upload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { userId, name, type, category, notes } = req.body
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Arquivo é obrigatório' })
      return
    }
    if (!name || !type || !category || !userId) {
      res.status(400).json({ error: 'Campos obrigatórios: userId, name, type, category' })
      return
    }
    const result = await documentService.uploadDocument(
      userId,
      req.user!.userId,
      req.user!.companyId,
      file.buffer,
      file.mimetype,
      file.originalname,
      { name, type, category, notes },
    )
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.params['userId'] as string
    if (!userId) {
      res.status(400).json({ error: 'userId é obrigatório' })
      return
    }
    const result = await documentService.listDocuments(userId, req.user!.companyId, req.user!.userId)
    res.json(result)
  } catch (err: any) {
    next(err)
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const { userId } = req.body
    const ok = await documentService.deleteDocument(id, userId || req.user!.userId, req.user!.userId, req.user!.role, req.user!.companyId)
    if (!ok) {
      res.status(404).json({ error: 'Documento não encontrado' })
      return
    }
    res.json({ success: true })
  } catch (err: any) {
    next(err)
  }
}
