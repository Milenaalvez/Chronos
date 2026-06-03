import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as companyService from './company.service.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await companyService.listCompanies(req.user!.role)
    res.json(data)
  } catch (err) { next(err) }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await companyService.getCompany(req.params.id as string, req.user!.companyId, req.user!.role)
    if (!data) {
      res.status(404).json({ error: 'Empresa não encontrada' })
      return
    }
    res.json(data)
  } catch (err) { next(err) }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, slug, document, phone, address, plan, userLimit } = req.body
    if (!name || !slug) {
      res.status(400).json({ error: 'Nome e slug são obrigatórios' })
      return
    }
    const company = await companyService.createCompany({ name, slug, document, phone, address, plan, userLimit })
    res.status(201).json(company)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, slug, document, phone, address, logo, plan, userLimit, status } = req.body
    const company = await companyService.updateCompany(req.params.id as string, {
      name, slug, document, phone, address, logo, plan, userLimit, status,
    }, req.user!.companyId, req.user!.role)
    res.json(company)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await companyService.deleteCompany(req.params.id as string, req.user!.role)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}
