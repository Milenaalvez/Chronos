import nodemailer from "npm:nodemailer"

interface EmailPayload {
  to: string
  subject: string
  html: string
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const payload: EmailPayload = await req.json()

  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com"
  const port = Number(Deno.env.get("SMTP_PORT")) || 587
  const user = Deno.env.get("SMTP_USER") || ""
  const pass = Deno.env.get("SMTP_PASS") || ""
  const from = Deno.env.get("SMTP_FROM") || "Chronos <chronos.sistem@gmail.com>"

  if (!user || !pass) {
    return new Response(JSON.stringify({ ok: false, error: "SMTP not configured on Edge Function" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  })

  try {
    const info = await transporter.sendMail({ from, to: payload.to, subject: payload.subject, html: payload.html })
    return new Response(JSON.stringify({ ok: true, messageId: info.messageId }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
