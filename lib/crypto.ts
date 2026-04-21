// Simple XOR encryption for API keys in localStorage
// Note: This is basic obfuscation. For production, consider using proper encryption
// with the Web Crypto API or server-side encryption

const ENCRYPTION_KEY = 'poe-api-key-2024'

export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return ''

  // Convert to base64 first
  const base64 = btoa(apiKey)

  // XOR with key
  let encrypted = ''
  for (let i = 0; i < base64.length; i++) {
    encrypted += String.fromCharCode(
      base64.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    )
  }

  return btoa(encrypted) // Encode the XOR result
}

export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return ''

  try {
    // Decode base64
    const xorResult = atob(encryptedKey)

    // XOR with key to get back the original base64
    let base64 = ''
    for (let i = 0; i < xorResult.length; i++) {
      base64 += String.fromCharCode(
        xorResult.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      )
    }

    // Decode the original base64 to get the API key
    return atob(base64)
  } catch (error) {
    console.error('Failed to decrypt API key:', error)
    return ''
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return apiKey
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}
