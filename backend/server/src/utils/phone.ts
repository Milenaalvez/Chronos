export function stripPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function maskPhone(phone: string): string {
  const d = stripPhone(phone)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}
