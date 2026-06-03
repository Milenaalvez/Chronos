import { useState, useEffect } from "react"
import { Building2, MapPin, Users, Save, Plus, Edit3, Trash2, X, Settings as SettingsIcon } from "lucide-react"
import { companies, branches, companyConfig } from "../services/api"

interface CompanyData {
  id: string
  name: string
  slug: string
  document?: string
  phone?: string
  address?: string
  logo?: string
  plan: string
  userLimit: number
  status: string
  isActive: boolean
  createdAt: string
  config?: {
    logo?: string
    primaryColor: string
    requireGeo: boolean
    requireFace: boolean
    defaultWeeklyHours: number
    lunchDuration: number
  }
  _count?: {
    users: number
    branches: number
  }
}

interface BranchData {
  id: string
  name: string
  code?: string
  cnpj?: string
  address?: string
  city?: string
  state?: string
  phone?: string
  responsible?: string
  isActive: boolean
  companyId: string
  _count?: { users: number }
}

export function AdminEmpresaPage({ user }: { user?: { companyId?: string; role?: string } | null }) {
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [branchList, setBranchList] = useState<BranchData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"empresa" | "filiais" | "config">("empresa")
  const [editBranch, setEditBranch] = useState<Partial<BranchData> | null>(null)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const list = await companies.list()
      const myCompany = list.find((c: CompanyData) => c.id === user?.companyId)
      if (myCompany) setCompany(myCompany)
      else if (list.length > 0) setCompany(list[0])

      const branchData = await branches.list(user?.companyId)
      setBranchList(branchData)

      const configData = await companyConfig.get(user?.companyId)
      setConfig(configData)
    } catch (e) {
      console.error("Erro ao carregar dados da empresa", e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveCompany() {
    if (!company) return
    setSaving(true)
    try {
      await companies.update(company.id, {
        name: company.name,
        document: company.document,
        phone: company.phone,
        address: company.address,
      })
    } finally { setSaving(false) }
  }

  async function handleSaveConfig() {
    if (!config) return
    setSaving(true)
    try {
      const updated = await companyConfig.update(user?.companyId, config)
      setConfig(updated)
    } finally { setSaving(false) }
  }

  async function handleSaveBranch() {
    if (!editBranch?.name) return
    setSaving(true)
    try {
      if (editBranch.id) {
        await branches.update(editBranch.id, editBranch)
      } else {
        await branches.create({ ...editBranch, name: editBranch.name!, companyId: user?.companyId })
      }
      setShowBranchForm(false)
      setEditBranch(null)
      const branchData = await branches.list(user?.companyId)
      setBranchList(branchData)
    } finally { setSaving(false) }
  }

  async function handleDeleteBranch(id: string) {
    if (!confirm("Remover esta filial?")) return
    try {
      await branches.delete(id)
      setBranchList((prev) => prev.filter((b) => b.id !== id))
    } catch (e: any) {
      alert(e.message || "Erro ao remover filial")
    }
  }

  const inputClass = "w-full h-10 px-3 text-sm rounded-lg bg-elevated border border-default/10 text-primary outline-none focus:border-[var(--accent-primary)]/50 transition-colors"

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-elevated rounded-lg" />
          <div className="h-64 bg-elevated rounded-xl" />
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="max-w-6xl mx-auto py-8 text-center">
        <Building2 size={48} className="mx-auto text-muted mb-4" />
        <h2 className="text-lg font-semibold text-primary mb-2">Empresa não encontrada</h2>
        <p className="text-sm text-muted">Entre em contato com o suporte.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <Building2 size={20} className="text-[var(--accent-primary)]" />
        <h1 className="text-xl font-bold text-primary">Configurações da Empresa</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-elevated rounded-xl w-fit">
        {[
          { key: "empresa" as const, label: "Empresa", icon: Building2 },
          { key: "filiais" as const, label: "Filiais", icon: MapPin },
          { key: "config" as const, label: "Configurações", icon: SettingsIcon },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                : "text-muted hover:text-primary"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Empresa */}
      {activeTab === "empresa" && (
        <div className="bg-surface border border-default/10 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">Nome da Empresa</label>
              <input className={inputClass} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">Slug</label>
              <input className={inputClass} value={company.slug} disabled />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">CNPJ</label>
              <input className={inputClass} value={company.document || ""} onChange={(e) => setCompany({ ...company, document: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">Telefone</label>
              <input className={inputClass} value={company.phone || ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-muted mb-1.5">Endereço</label>
              <input className={inputClass} value={company.address || ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-default/10">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Users size={12} />
              {company._count?.users || 0} usuários
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <MapPin size={12} />
              {company._count?.branches || 0} filiais
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              Plano: <span className="text-primary font-medium">{company.plan}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleSaveCompany} disabled={saving} className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-semibold bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all">
              <Save size={14} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Filiais */}
      {activeTab === "filiais" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditBranch({}); setShowBranchForm(true) }} className="flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all">
              <Plus size={14} /> Nova Filial
            </button>
          </div>

          {showBranchForm && (
            <div className="bg-surface border border-default/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">{editBranch?.id ? "Editar Filial" : "Nova Filial"}</h3>
                <button onClick={() => { setShowBranchForm(false); setEditBranch(null) }} className="text-muted hover:text-primary">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Nome *</label>
                  <input className={inputClass} value={editBranch?.name || ""} onChange={(e) => setEditBranch({ ...editBranch, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Código</label>
                  <input className={inputClass} value={editBranch?.code || ""} onChange={(e) => setEditBranch({ ...editBranch, code: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">CNPJ</label>
                  <input className={inputClass} value={editBranch?.cnpj || ""} onChange={(e) => setEditBranch({ ...editBranch, cnpj: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Telefone</label>
                  <input className={inputClass} value={editBranch?.phone || ""} onChange={(e) => setEditBranch({ ...editBranch, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Cidade</label>
                  <input className={inputClass} value={editBranch?.city || ""} onChange={(e) => setEditBranch({ ...editBranch, city: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Estado</label>
                  <input className={inputClass} value={editBranch?.state || ""} onChange={(e) => setEditBranch({ ...editBranch, state: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-medium text-muted mb-1">Endereço</label>
                  <input className={inputClass} value={editBranch?.address || ""} onChange={(e) => setEditBranch({ ...editBranch, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-medium text-muted mb-1">Responsável</label>
                  <input className={inputClass} value={editBranch?.responsible || ""} onChange={(e) => setEditBranch({ ...editBranch, responsible: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowBranchForm(false); setEditBranch(null) }} className="px-4 h-9 rounded-xl text-sm text-muted hover:text-primary border border-default/10">Cancelar</button>
                <button onClick={handleSaveBranch} disabled={saving || !editBranch?.name} className="flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all">
                  <Save size={14} />
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            {branchList.length === 0 && !showBranchForm && (
              <div className="text-center py-12 text-muted text-sm">Nenhuma filial cadastrada</div>
            )}
            {branchList.map((branch) => (
              <div key={branch.id} className="bg-surface border border-default/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)]/8 flex items-center justify-center">
                    <MapPin size={15} className="text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">{branch.name}</p>
                    <p className="text-[11px] text-muted">
                      {branch.city && branch.state ? `${branch.city}/${branch.state}` : ""}
                      {branch.responsible ? ` • Resp: ${branch.responsible}` : ""}
                      {branch._count?.users ? ` • ${branch._count.users} usuários` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditBranch(branch); setShowBranchForm(true) }} className="p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-all">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDeleteBranch(branch.id)} className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Configurações */}
      {activeTab === "config" && config && (
        <div className="bg-surface border border-default/10 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">Cor primária</label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-default/10" value={config.primaryColor || "#3B82F6"}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })} />
                <input className={inputClass} value={config.primaryColor || ""}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">Jornada semanal padrão (horas)</label>
              <input type="number" className={inputClass} value={config.defaultWeeklyHours || 40}
                onChange={(e) => setConfig({ ...config, defaultWeeklyHours: parseInt(e.target.value) || 40 })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">Duração do intervalo (min)</label>
              <input type="number" className={inputClass} value={config.lunchDuration || 60}
                onChange={(e) => setConfig({ ...config, lunchDuration: parseInt(e.target.value) || 60 })} />
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-default/30 accent-[var(--accent-primary)]" checked={config.requireGeo || false}
                  onChange={(e) => setConfig({ ...config, requireGeo: e.target.checked })} />
                <span className="text-sm text-primary">Exigir geolocalização no registro de ponto</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-default/30 accent-[var(--accent-primary)]" checked={config.requireFace || false}
                  onChange={(e) => setConfig({ ...config, requireFace: e.target.checked })} />
                <span className="text-sm text-primary">Exigir reconhecimento facial</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end pt-3 border-t border-default/10">
            <button onClick={handleSaveConfig} disabled={saving} className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-semibold bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all">
              <Save size={14} />
              {saving ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
