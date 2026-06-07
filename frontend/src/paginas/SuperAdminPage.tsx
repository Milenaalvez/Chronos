import { useState, useEffect } from "react"
import { Building2, Plus, Edit3, Trash2, Save, X, Users, MapPin, Search } from "lucide-react"
import { companies, type CompanyData } from "../services/api"

export function SuperAdminPage() {
  const [list, setList] = useState<CompanyData[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<CompanyData> | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => { loadCompanies() }, [])

  async function loadCompanies() {
    setLoading(true)
    try {
      const data = await companies.list()
      setList(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!editing?.name || !editing?.slug) return
    setSaving(true)
    try {
      if (editing.id) {
        await companies.update(editing.id, editing)
      } else {
        await companies.create({ name: editing.name, slug: editing.slug, document: editing.document, phone: editing.phone, plan: editing.plan, userLimit: editing.userLimit })
      }
      setShowForm(false)
      setEditing(null)
      await loadCompanies()
    } catch (e: any) { alert(e.message || "Erro ao salvar") }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return
    try {
      await companies.delete(id)
      setList((prev) => prev.filter((c) => c.id !== id))
    } catch (e: any) { alert(e.message || "Erro ao remover") }
  }

  const filtered = list.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  )

  const inputClass = "w-full h-10 px-3 text-sm rounded-lg bg-elevated border border-default/10 text-primary outline-none focus:border-[var(--accent-primary)]/50 transition-colors"

  return (
    <div className="max-w-7xl mx-auto py-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-[var(--accent-primary)]" />
          <h1 className="text-xl font-bold text-primary">Super Administrador</h1>
        </div>
        <button onClick={() => { setEditing({}); setShowForm(true) }} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all">
          <Plus size={14} /> Nova Empresa
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="w-full h-10 pl-9 pr-4 text-sm rounded-xl bg-elevated border border-default/10 text-primary outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
          placeholder="Buscar empresas..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface border border-default/10 rounded-xl p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">{editing?.id ? "Editar Empresa" : "Nova Empresa"}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-muted hover:text-primary"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Nome *</label>
              <input className={inputClass} value={editing?.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Slug *</label>
              <input className={inputClass} value={editing?.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">CNPJ</label>
              <input className={inputClass} value={editing?.document || ""} onChange={(e) => setEditing({ ...editing, document: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Telefone</label>
              <input className={inputClass} value={editing?.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Plano</label>
              <select className={inputClass} value={editing?.plan || "starter"} onChange={(e) => setEditing({ ...editing, plan: e.target.value })}>
                <option value="starter">Starter</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Limite de usuários</label>
              <input type="number" className={inputClass} value={editing?.userLimit || 20} onChange={(e) => setEditing({ ...editing, userLimit: parseInt(e.target.value) || 20 })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 h-9 rounded-xl text-sm text-muted hover:text-primary border border-default/10">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !editing?.name || !editing?.slug} className="flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all">
              <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-20 bg-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Companies list */}
      {!loading && (
        <div className="grid gap-3">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted text-sm">Nenhuma empresa encontrada</div>
          )}
          {filtered.map((company) => (
            <div key={company.id} className="bg-surface border border-default/10 rounded-xl p-4 flex items-center justify-between hover:bg-elevated/50 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/8 flex items-center justify-center">
                  <Building2 size={18} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{company.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-muted font-mono">{company.slug}</span>
                    <span className="text-[11px] text-muted flex items-center gap-1"><Users size={10} />{company._count?.users || 0}</span>
                    <span className="text-[11px] text-muted flex items-center gap-1"><MapPin size={10} />{company._count?.branches || 0}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      company.plan === "enterprise" ? "bg-purple-500/10 text-purple-400" :
                      company.plan === "business" ? "bg-blue-500/10 text-blue-400" :
                      "bg-green-500/10 text-green-400"
                    }`}>{company.plan}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditing(company); setShowForm(true) }} className="p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-all" title="Editar">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => handleDelete(company.id)} className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-all" title="Remover">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
