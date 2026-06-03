import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as branchService from './branch.service.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const companyId = (req.query.companyId as string) || req.user!.companyId
    const data = await branchService.listBranches(companyId, req.user!.role, req.user!.companyId)
    res.json(data)
  } catch (err) { next(err) }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await branchService.getBranch(req.params.id as string, req.user!.companyId, req.user!.role)
    if (!data) {
      res.status(404).json({ error: 'Filial não encontrada' })
      return
    }
    res.json(data)
  } catch (err) { next(err) }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, code, cnpj, address, city, state, zip, phone, responsible, companyId } = req.body
    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório' })
      return
    }
    const branch = await branchService.createBranch({
      name, code, cnpj, address, city, state, zip, phone, responsible,
      companyId: companyId || req.user!.companyId,
    }, req.user!.role, req.user!.companyId)
    res.status(201).json(branch)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, code, cnpj, address, city, state, zip, phone, responsible, isActive } = req.body
    const branch = await branchService.updateBranch(req.params.id as string, {
      name, code, cnpj, address, city, state, zip, phone, responsible, isActive,
    }, req.user!.companyId, req.user!.role)
    res.json(branch)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await branchService.deleteBranch(req.params.id as string, req.user!.role, req.user!.companyId)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}
