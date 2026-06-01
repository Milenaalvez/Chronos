export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: 'A senha deve ter no mínimo 8 caracteres' }
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'A senha deve conter pelo menos uma letra maiúscula' }
  if (!/[a-z]/.test(password)) return { valid: false, message: 'A senha deve conter pelo menos uma letra minúscula' }
  if (!/\d/.test(password)) return { valid: false, message: 'A senha deve conter pelo menos um número' }
  return { valid: true, message: '' }
}
