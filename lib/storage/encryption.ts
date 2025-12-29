"use client"

// Web Crypto API utilities for AES-GCM encryption
// Used to encrypt sensitive data stored in IndexedDB

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits recommended for GCM
const SALT_LENGTH = 16

// Store the derived key in memory (not persisted)
let cachedKey: CryptoKey | null = null

/**
 * Derives an encryption key from a passphrase using PBKDF2
 */
export async function deriveKey(passphrase: string, salt?: Uint8Array): Promise<{
  key: CryptoKey
  salt: Uint8Array
}> {
  const encoder = new TextEncoder()
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  const usedSalt = salt ?? crypto.getRandomValues(new Uint8Array(SALT_LENGTH))

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: usedSalt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )

  return { key, salt: usedSalt }
}

/**
 * Generates a random encryption key (no passphrase needed)
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable for export
    ["encrypt", "decrypt"]
  )
}

/**
 * Exports a CryptoKey to base64 for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key)
  return arrayBufferToBase64(exported)
}

/**
 * Imports a key from base64 string
 */
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key)
  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  )
}

/**
 * Encrypts data using AES-GCM
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ iv: string; encrypted: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(data)
  )

  return {
    iv: arrayBufferToBase64(iv),
    encrypted: arrayBufferToBase64(encrypted),
  }
}

/**
 * Decrypts data using AES-GCM
 */
export async function decrypt(
  encryptedData: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder()

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: base64ToArrayBuffer(iv) },
    key,
    base64ToArrayBuffer(encryptedData)
  )

  return decoder.decode(decrypted)
}

/**
 * Sets the cached encryption key
 */
export function setCachedKey(key: CryptoKey): void {
  cachedKey = key
}

/**
 * Gets the cached encryption key
 */
export function getCachedKey(): CryptoKey | null {
  return cachedKey
}

/**
 * Clears the cached encryption key
 */
export function clearCachedKey(): void {
  cachedKey = null
}

/**
 * Checks if encryption is available (Web Crypto API)
 */
export function isEncryptionAvailable(): boolean {
  return typeof crypto !== "undefined" && crypto.subtle !== undefined
}

// Utility functions for base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
