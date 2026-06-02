import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BUCKET = 'branding'

async function main() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.find((b) => b.name === BUCKET)

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
    })
    if (error) { console.error('Erro ao criar bucket:', error.message); process.exit(1) }
    console.log(`Bucket "${BUCKET}" criado`)
  }

  // Banner topo – "Chronos" + faixa azul escuro
  const topSvg = `<svg width="700" height="160" xmlns="http://www.w3.org/2000/svg">
    <rect width="700" height="160" fill="#071A3D"/>
    <text x="350" y="90" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle">Chronos</text>
    <text x="350" y="125" font-family="Arial,sans-serif" font-size="16" fill="#94A3B8" text-anchor="middle">Gestão de Pessoas</text>
  </svg>`

  // Banner rodapé – "Milena Alves • Desenvolvedora Responsável"
  const bottomSvg = `<svg width="700" height="120" xmlns="http://www.w3.org/2000/svg">
    <rect width="700" height="120" fill="#F8FAFC"/>
    <line x1="0" y1="0" x2="700" y2="0" stroke="#E2E8F0" stroke-width="1"/>
    <text x="350" y="50" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#1E293B" text-anchor="middle">Milena Alves</text>
    <text x="350" y="75" font-family="Arial,sans-serif" font-size="14" fill="#64748B" text-anchor="middle">Desenvolvedora Responsável</text>
    <text x="350" y="100" font-family="Arial,sans-serif" font-size="11" fill="#94A3B8" text-anchor="middle">© 2026 Chronos • Gestão inteligente de jornadas e produtividade.</text>
  </svg>`

  const banners = [
    { name: 'banner chronos.png', svg: topSvg },
    { name: 'banner final do email.png', svg: bottomSvg },
  ]

  for (const { name, svg } of banners) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(name, Buffer.from(svg), {
        contentType: 'image/svg+xml',
        upsert: true,
      })

    if (uploadError) {
      console.error(`Erro ao fazer upload de "${name}":`, uploadError.message)
    } else {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(name)
      console.log(`Upload OK: ${urlData.publicUrl}`)
    }
  }

  console.log('Concluído! Verifique os links acima.')
}

main().catch(console.error)
