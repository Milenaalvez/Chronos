import type { Request, Response, NextFunction } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import jwt from 'jsonwebtoken'
import multer from 'multer'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Registro duplicado' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro não encontrado' })
      return
    }
    res.status(400).json({ error: `Erro no banco de dados (${err.code})` })
    return
  }

  if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json({ error: 'Token expirado' })
    return
  }

  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Arquivo muito grande. O limite é 2MB.' })
      return
    }
    res.status(400).json({ error: err.message })
    return
  }

  console.error('[ERROR]', err)
  res.status(500).json({ error: 'Erro interno do servidor' })
}
