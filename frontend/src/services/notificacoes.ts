const STORAGE_KEY = "chronos-notifications"
const CHANNEL_KEY = "chronos-notif-channel"

type Channel = "internal" | "email" | "both"

interface NotifEvent {
  key: string
  title: string
  body: string
  icon?: string
}

function getPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function getChannel(): Channel {
  return (localStorage.getItem(CHANNEL_KEY) as Channel) || "internal"
}

function isEnabled(key: string): boolean {
  return !!getPrefs()[key]
}

function showInternal(title: string, body: string) {
  const ev = new CustomEvent("chronos-toast", {
    detail: { title, body, type: "notification" },
  })
  window.dispatchEvent(ev)
}

function simulateEmail(title: string, body: string) {
  console.log(`[EMAIL] Para: usuario@chronos.com`)
  console.log(`[EMAIL] Assunto: ${title}`)
  console.log(`[EMAIL] Corpo: ${body}`)
  const ev = new CustomEvent("chronos-toast", {
    detail: { title: `📧 ${title}`, body: `Simulação de e-mail enviado.`, type: "email" },
  })
  window.dispatchEvent(ev)
}

function dispatch(event: NotifEvent) {
  if (!isEnabled(event.key)) return
  const channel = getChannel()

  if (channel === "internal" || channel === "both") {
    showInternal(event.title, event.body)
  }
  if (channel === "email" || channel === "both") {
    simulateEmail(event.title, event.body)
  }
}

export const NotificacaoService = {
  isEnabled,
  getChannel,
  getPrefs,
  dispatch,
  dispatchNow(event: NotifEvent) {
    const channel = getChannel()
    if (channel === "internal" || channel === "both") {
      showInternal(event.title, event.body)
    }
    if (channel === "email" || channel === "both") {
      simulateEmail(event.title, event.body)
    }
  },
}
