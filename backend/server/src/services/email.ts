import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const hasSmtp = !!(env.smtpHost && env.smtpUser && env.smtpPass)

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    })
  : null

function logFallback(to: string, subject: string, html: string) {
  console.log(`[Email] TO: ${to} | SUBJECT: ${subject}`)
  console.log(`[Email] HTML:\n${html.replace(/<[^>]+>/g, '').slice(0, 500)}...`)
}

async function send(to: string, subject: string, html: string) {
  if (transporter) {
    try {
      await transporter.sendMail({ from: env.smtpFrom, to, subject, html })
      return
    } catch (err: any) {
      console.warn('[Email] SMTP error, falling back to console:', err?.message)
    }
  }
  logFallback(to, subject, html)
}

function bannerTop() {
  const imgUrl = 'https://xwitkwbymmucultysyox.supabase.co/storage/v1/object/public/branding/banner%20chronos.png'
  return `
    <!--[if !mso]><!-->
    <img src="${imgUrl}" alt="Chronos" style="width:100%;display:block;max-width:700px;" onerror="this.style.display='none'">
    <!--<![endif]-->
    <div style="background:#071A3D;padding:20px;text-align:center;mso-hide:all;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:2px;">CHRONOS</h1>
      <p style="margin:4px 0 0;color:#94A3B8;font-size:13px;">Gestão de Pessoas</p>
    </div>`
}

function bannerBottom() {
  const imgUrl = 'https://xwitkwbymmucultysyox.supabase.co/storage/v1/object/public/branding/banner%20final%20do%20email.png'
  return `
    <hr style="margin:32px 0;border:none;border-top:1px solid #E2E8F0;">
    <div style="text-align:center;">
      <!--[if !mso]><!-->
      <img src="${imgUrl}" alt="Chronos" style="max-width:320px;width:100%;height:auto;display:block;margin:0 auto 20px auto;" onerror="this.style.display='none'">
      <!--<![endif]-->
      <div style="mso-hide:all;">
        <p style="margin:0;color:#64748B;font-size:14px;line-height:1.7;">
          <strong>Milena Alves</strong><br>
          Desenvolvedora Responsável
        </p>
        <p style="margin-top:12px;color:#94A3B8;font-size:12px;">
          © 2026 Chronos • Gestão de Pessoas<br>
          Gestão inteligente de jornadas e produtividade.
        </p>
      </div>
    </div>`
}

export async function sendWelcomeEmail(to: string, name: string, registrationNumber: string, role: string, company: string, verificationLink: string) {
  await send(to, 'Bem-vindo ao Chronos!', `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:20px;">
      <div style="max-width:700px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        ${bannerTop()}
        <div style="padding:32px;">
          <h2 style="color:#071A3D;">Sua conta corporativa foi criada</h2>
          <p>Olá <strong>${name}</strong>,</p>
          <p>Você foi adicionado ao Chronos por um administrador da organização.</p>
          <p>Sua matrícula é:</p>
          <p style="font-size:24px;text-align:center;padding:16px;background:#f8fafc;border-radius:8px;font-weight:bold;letter-spacing:4px;color:#071A3D;">
            CHR${registrationNumber}
          </p>
          <p>Você poderá acessar o sistema utilizando:</p>
          <ul>
            <li>Seu e-mail</li>
            <li>Sua matrícula</li>
          </ul>
          <p style="margin:30px 0;">
            <a href="${verificationLink}"
               style="background:#3B82F6;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              Ativar minha conta
            </a>
          </p>
          <p>Após a ativação você poderá registrar jornadas, acompanhar seu banco de horas e acessar os recursos da plataforma.</p>
          <p style="color:#64748b;">Se você não esperava este convite, ignore este e-mail.</p>
          ${bannerBottom()}
        </div>
      </div>
    </div>
  `)
}

export async function sendVerificationEmail(to: string, name: string, link: string) {
  await send(to, 'Confirme seu e-mail - Chronos', `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:20px;">
      <div style="max-width:700px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        ${bannerTop()}
        <div style="padding:32px;">
          <h2 style="color:#071A3D;">Bem-vindo(a) ao Chronos!</h2>
          <p>Olá <strong>${name}</strong>,</p>
          <p>Sua conta foi criada com sucesso.</p>
          <p>Para concluir seu cadastro e acessar a plataforma, confirme seu endereço de e-mail.</p>
          <p style="margin:30px 0;">
            <a href="${link}"
               style="background:#3B82F6;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              Confirmar meu e-mail
            </a>
          </p>
          <p style="color:#64748b;">Se você não solicitou este cadastro, ignore esta mensagem.</p>
          ${bannerBottom()}
        </div>
      </div>
    </div>
  `)
}

export async function sendPasswordResetEmail(to: string, name: string, link: string) {
  await send(to, 'Recuperação de senha - Chronos', `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:20px;">
      <div style="max-width:700px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        ${bannerTop()}
        <div style="padding:32px;">
          <h2 style="color:#071A3D;">Redefinição de senha</h2>
          <p>Olá <strong>${name}</strong>,</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
          <p>Clique no botão abaixo para criar uma nova senha.</p>
          <p style="margin:30px 0;">
            <a href="${link}"
               style="background:#3B82F6;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              Redefinir senha
            </a>
          </p>
          <p style="color:#64748b;">Se você não solicitou esta alteração, ignore este e-mail.</p>
          ${bannerBottom()}
        </div>
      </div>
    </div>
  `)
}

export async function sendSecurityNotification(to: string, name: string) {
  await send(to, 'Senha alterada - Chronos', `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:20px;">
      <div style="max-width:700px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        ${bannerTop()}
        <div style="padding:32px;">
          <h2 style="color:#071A3D;">Senha alterada com sucesso</h2>
          <p>Olá <strong>${name}</strong>,</p>
          <p>Sua senha foi atualizada com sucesso.</p>
          <p style="color:#64748b;">Se não foi você, entre em contato imediatamente com o administrador.</p>
          ${bannerBottom()}
        </div>
      </div>
    </div>
  `)
}
