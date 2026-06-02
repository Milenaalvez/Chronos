import crypto from 'crypto'

export function generateCode(length = 6): string {
  const digits = '0123456789'
  let code = ''
  const bytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    code += digits[bytes[i]! % digits.length]
  }
  return code
}


