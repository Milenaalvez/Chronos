import type { TimeRecord } from "../types"
import type { Justificacao } from "../types"
import { computeSaldo, computeMonthStats, filterMonthRecordsStrict } from "./workHoursEngine"

export interface ValidationResult {
  passed: boolean
  checks: { name: string; passed: boolean; expected: any; actual: any; message: string }[]
}

export function validateConsistency(
  allRecords: TimeRecord[],
  justificacoes: Record<string, Justificacao>,
  monthBounds?: { start: string; end: string },
): ValidationResult {
  const checks: ValidationResult["checks"] = []

  // 1. computeSaldo self-consistency
  const saldo = computeSaldo(allRecords, justificacoes)
  checks.push({
    name: "netSaldo = positiveMins - negativeMins",
    passed: saldo.netSaldo === saldo.positiveMins - saldo.negativeMins,
    expected: saldo.positiveMins - saldo.negativeMins,
    actual: saldo.netSaldo,
    message: `netSaldo (${saldo.netSaldo}) deve ser positivo (${saldo.positiveMins}) - negativo (${saldo.negativeMins}) = ${saldo.positiveMins - saldo.negativeMins}`,
  })
  checks.push({
    name: "extraMins = positiveMins",
    passed: saldo.extraMins === saldo.positiveMins,
    expected: saldo.positiveMins,
    actual: saldo.extraMins,
    message: `extraMins (${saldo.extraMins}) deve ser igual a positiveMins (${saldo.positiveMins})`,
  })

  // 2. computeMonthStats self-consistency
  if (monthBounds) {
    const monthRecords = filterMonthRecordsStrict(allRecords, monthBounds)
    const stats = computeMonthStats(monthRecords)
    const workedMins = stats.totalMins
    const expectedMins = stats.normalHours * 60 + stats.totalNormalExtraMins
    checks.push({
      name: "monthStats: normalHours em minutos + totalNormalExtraMins ≈ totalMins",
      passed: Math.abs(workedMins - expectedMins) < 1,
      expected: expectedMins,
      actual: workedMins,
      message: `totalMins (${workedMins}) deve ≈ normalHours*60 (${stats.normalHours * 60}) + totalNormalExtraMins (${stats.totalNormalExtraMins}) = ${expectedMins}`,
    })
  }

  // 3. Verify no month record has totalHours > 24 (data integrity)
  const suspiciousRecords = allRecords.filter((r) => r.totalHours > 24 || r.totalHours < 0)
  checks.push({
    name: "Nenhum registro tem horas inválidas (>24h ou <0h)",
    passed: suspiciousRecords.length === 0,
    expected: 0,
    actual: suspiciousRecords.length,
    message: suspiciousRecords.length > 0
      ? `Registros suspeitos: ${suspiciousRecords.map((r) => `${r.dataISO}(${r.totalHours}h)`).join(", ")}`
      : "Todos os registros têm horas válidas",
  })

  const passed = checks.every((c) => c.passed)
  return { passed, checks }
}

export function reportValidation(result: ValidationResult): void {
  const failed = result.checks.filter((c) => !c.passed)
  if (failed.length > 0) {
    console.error(`[VALIDATION] ${failed.length}/${result.checks.length} verificações falharam:`)
    for (const f of failed) {
      console.error(`  ❌ ${f.name}: ${f.message}`)
      console.error(`     Esperado: ${f.expected}, Obtido: ${f.actual}`)
    }
  } else {
    console.log(`[VALIDATION] ✅ Todas as ${result.checks.length} verificações passaram.`)
  }
}
