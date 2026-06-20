/**
 * Migration: Create API Keys for Web App and Mobile App
 *
 * Runs via the migration runner: `pnpm run migrate`
 *
 * up():   Generates unique API keys for Web App and Mobile App and inserts
 *         them into the ApiKeys collection (skips if a key with the same
 *         name already exists).
 * down(): Removes the Web App / Mobile App API keys.
 */

import crypto from 'crypto'
import { ApiKeyModel } from '../features/apiKey/models'

interface ApiKeyEntry {
  name: string
  key: string
  permissions: string[]
  status: boolean
}

const generateKey = (): string => crypto.randomBytes(64).toString('hex')

const API_KEY_NAMES = ['Web App', 'Mobile App']

export async function up(): Promise<void> {
  const apiKeys: ApiKeyEntry[] = API_KEY_NAMES.map((name) => ({
    name,
    key: generateKey(),
    permissions: ['0000'],
    status: true,
  }))

  for (const entry of apiKeys) {
    const existing = await ApiKeyModel.findOne({ name: entry.name })
    if (existing) {
      console.log(`   ⚠️  [${entry.name}] already exists — skipped`)
      console.log(`      Key: ${existing.key}`)
      continue
    }

    const created = await ApiKeyModel.create(entry)
    console.log(`   ✅ [${entry.name}] created`)
    console.log(`      Key:         ${created.key}`)
    console.log(`      Permissions: ${entry.permissions.join(', ')}`)
  }

  console.log('   ⚠️  Save these keys — used as the x-api-key header value.')
}

export async function down(): Promise<void> {
  const result = await ApiKeyModel.deleteMany({ name: { $in: API_KEY_NAMES } })
  console.log(`   🗑️  Removed ${result.deletedCount} API key(s)`)
}
