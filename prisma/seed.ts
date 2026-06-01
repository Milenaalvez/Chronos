import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const departments: { slug: string; name: string; positions: string[] }[] = [
  { slug: "tecnologia", name: "Tecnologia", positions: [
    "Desenvolvedor Front-end Jr", "Desenvolvedor Front-end Pleno", "Desenvolvedor Front-end Sênior",
    "Desenvolvedor Back-end Jr", "Desenvolvedor Back-end Pleno", "Desenvolvedor Back-end Sênior",
    "Desenvolvedor Full Stack Jr", "Desenvolvedor Full Stack Pleno", "Desenvolvedor Full Stack Sênior",
    "Analista de Sistemas", "Analista de Dados", "Cientista de Dados",
    "QA Tester", "DevOps", "Tech Lead", "Arquiteto de Software",
    "Product Owner", "Scrum Master",
  ]},
  { slug: "engenharia", name: "Engenharia", positions: [
    "Engenheiro Civil", "Engenheiro Mecânico",
    "Engenheiro Elétrico", "Engenheiro de Produção",
    "Engenheiro de Software", "Coordenador de Engenharia", "Gerente de Engenharia",
  ]},
  { slug: "recursos-humanos", name: "Recursos Humanos", positions: [
    "Assistente de RH", "Analista de RH", "Recrutador", "Business Partner",
    "Coordenador de RH", "Gerente de RH",
  ]},
  { slug: "financeiro", name: "Financeiro", positions: [
    "Assistente Financeiro", "Analista Financeiro",
    "Coordenador Financeiro", "Gerente Financeiro", "Controller",
  ]},
  { slug: "administrativo", name: "Administrativo", positions: [
    "Assistente Administrativo", "Auxiliar Administrativo",
    "Recepcionista", "Secretária", "Coordenador Administrativo",
  ]},
  { slug: "comercial", name: "Comercial", positions: [
    "SDR", "Executivo de Vendas", "Consultor Comercial",
    "Coordenador Comercial", "Gerente Comercial",
  ]},
  { slug: "marketing", name: "Marketing", positions: [
    "Social Media", "Designer Gráfico", "Copywriter",
    "Analista de Marketing", "Gestor de Tráfego", "Coordenador de Marketing",
  ]},
  { slug: "produto", name: "Produto", positions: [
    "Analista de Produto", "Product Manager", "Head de Produto",
  ]},
  { slug: "design", name: "Design", positions: [
    "Designer UI", "Designer UX", "Product Designer", "Diretor de Arte",
  ]},
  { slug: "atendimento", name: "Atendimento", positions: [
    "Atendente", "Operador de Atendimento", "Supervisor de Atendimento",
  ]},
  { slug: "suporte-tecnico", name: "Suporte Técnico", positions: [
    "Técnico de Suporte N1", "Técnico de Suporte N2", "Técnico de Suporte N3",
    "Coordenador de Suporte",
  ]},
  { slug: "juridico", name: "Jurídico", positions: [] },
  { slug: "compras", name: "Compras", positions: [] },
  { slug: "logistica", name: "Logística", positions: [] },
  { slug: "operacoes", name: "Operações", positions: [] },
  { slug: "qualidade", name: "Qualidade", positions: [] },
  { slug: "diretoria", name: "Diretoria", positions: [
    "Coordenador", "Supervisor", "Gerente", "Diretor",
    "CEO", "CTO", "COO", "CFO",
  ]},
  { slug: "gestao-de-projetos", name: "Gestão de Projetos", positions: [] },
  { slug: "seguranca-da-informacao", name: "Segurança da Informação", positions: [] },
  { slug: "infraestrutura", name: "Infraestrutura", positions: [] },
  { slug: "pesquisa-e-desenvolvimento", name: "Pesquisa e Desenvolvimento", positions: [] },
  { slug: "treinamento", name: "Treinamento", positions: [] },
  { slug: "customer-success", name: "Customer Success", positions: [] },
  { slug: "auditoria", name: "Auditoria", positions: [] },
  { slug: "outro", name: "Outro", positions: [] },
]

async function main() {
  let order = 0
  for (const dept of departments) {
    const created = await prisma.department.upsert({
      where: { slug: dept.slug },
      update: { name: dept.name, order },
      create: { slug: dept.slug, name: dept.name, order },
    })
    for (const pos of dept.positions) {
      const posSlug = pos.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      await prisma.position.upsert({
        where: { slug: posSlug },
        update: { name: pos, departmentId: created.id },
        create: { slug: posSlug, name: pos, departmentId: created.id },
      })
    }
    order++
  }
  console.log(`✅ ${departments.length} departamentos e posições sincronizados.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
