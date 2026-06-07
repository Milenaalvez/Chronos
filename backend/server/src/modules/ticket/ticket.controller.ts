import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as ticketService from './ticket.service.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tickets = await ticketService.listTickets(req.user!.userId, req.user!.role, req.user!.companyId)
    res.json(tickets)
  } catch (err) { next(err) }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.getTicketById(req.params['id'] as string, req.user!.userId, req.user!.role, req.user!.companyId)
    if (!ticket) {
      res.status(404).json({ error: 'Solicitação não encontrada' })
      return
    }
    res.json(ticket)
  } catch (err) { next(err) }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, description, category, subcategory } = req.body
    if (!title || !description || !category) {
      res.status(400).json({ error: 'Campos obrigatórios: title, description, category' })
      return
    }
    const result = await ticketService.createTicket(
      req.user!.userId,
      req.user!.companyId,
      { title, description, category, subcategory },
      req.file || undefined,
    )
    res.status(201).json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function addMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { message } = req.body
    const ticketId = req.params['id'] as string
    if (!message) {
      res.status(400).json({ error: 'Mensagem é obrigatória' })
      return
    }
    const result = await ticketService.addTicketMessage(
      ticketId,
      req.user!.userId,
      req.user!.role,
      req.user!.companyId,
      message,
      req.file || undefined,
    )
    if (!result) {
      res.status(404).json({ error: 'Solicitação não encontrada' })
      return
    }
    res.status(201).json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status, message } = req.body
    const ticketId = req.params['id'] as string
    if (!status) {
      res.status(400).json({ error: 'Status é obrigatório' })
      return
    }
    const result = await ticketService.updateTicketStatus(
      ticketId,
      status,
      message,
      req.user!.userId,
      req.user!.role,
      req.user!.companyId,
    )
    if (!result) {
      res.status(404).json({ error: 'Solicitação não encontrada' })
      return
    }
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}
