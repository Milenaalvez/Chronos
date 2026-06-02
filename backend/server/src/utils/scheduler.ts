import { runDailyNotificationSchedule } from '../modules/notification/notification.service.js'

let intervalId: ReturnType<typeof setInterval> | null = null

export function startScheduler() {
  if (intervalId) return

  console.log('[Scheduler] Iniciando agendador de notificações...')

  // Run every 1 hour to check for smart notifications
  intervalId = setInterval(async () => {
    try {
      await runDailyNotificationSchedule()
    } catch (err) {
      console.error('[Scheduler] Erro na execução:', err)
    }
  }, 60 * 60 * 1000)

  // Also run immediately on startup (with error isolation so it doesn't crash the server)
  setTimeout(() => {
    runDailyNotificationSchedule().catch((err) => {
      console.error('[Scheduler] Erro na execução inicial (não crítico):', err?.message || err)
    })
  }, 1000)

  console.log('[Scheduler] Agendador iniciado (intervalo: 1h)')
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[Scheduler] Agendador parado')
  }
}
