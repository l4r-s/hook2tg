const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Get the encryption key from environment variable
 * @param env - Environment object containing ENCRYPTION_KEY
 * @returns Uint8Array containing the 32-byte encryption key
 * @throws Error if ENCRYPTION_KEY is not set or invalid
 */
export function getEncryptionKey(env: { ENCRYPTION_KEY?: string }): Uint8Array {
  const key = env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  // Convert base64 key to Uint8Array
  let keyBuffer: Uint8Array
  try {
    const decoded = atob(key)
    keyBuffer = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      keyBuffer[i] = decoded.charCodeAt(i)
    }
  } catch (e) {
    throw new Error('ENCRYPTION_KEY is not valid base64')
  }
  
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded)`)
  }

  return keyBuffer
}

/**
 * Decrypt a ciphertext string encrypted with AES-256-GCM
 * @param ciphertext - Base64-encoded string containing IV, auth tag, and ciphertext
 * @param env - Environment object containing ENCRYPTION_KEY
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails
 */
export async function decrypt(ciphertext: string, env: { ENCRYPTION_KEY?: string }): Promise<string> {
  const key = getEncryptionKey(env)
  
  // Decode base64 to get combined buffer
  let combined: Uint8Array
  try {
    const decoded = atob(ciphertext)
    combined = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      combined[i] = decoded.charCodeAt(i)
    }
  } catch (e) {
    throw new Error('Invalid base64 ciphertext')
  }
  
  // Extract IV, auth tag, and encrypted data
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext too short')
  }
  
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  
  // Import the key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: ALGORITHM },
    false,
    ['decrypt']
  )
  
  // Combine encrypted data with auth tag for Web Crypto API
  // Web Crypto API expects the auth tag to be appended to the ciphertext
  const ciphertextWithTag = new Uint8Array(encrypted.length + AUTH_TAG_LENGTH)
  ciphertextWithTag.set(encrypted, 0)
  ciphertextWithTag.set(authTag, encrypted.length)
  
  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv,
        tagLength: AUTH_TAG_LENGTH * 8 // tag length in bits
      },
      cryptoKey,
      ciphertextWithTag
    )
    
    // Convert decrypted ArrayBuffer to string
    return new TextDecoder().decode(decrypted)
  } catch (e) {
    throw new Error('Decryption failed: invalid ciphertext or key')
  }
}

