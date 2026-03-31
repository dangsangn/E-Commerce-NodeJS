/**
 * Migration: Create API Keys for Web App and Mobile App
 *
 * Usage:
 *   npx ts-node src/migrations/001_create_api_keys.ts
 *
 * This script will:
 *   1. Connect to MongoDB
 *   2. Generate unique API keys for Web App and Mobile App
 *   3. Insert them into the ApiKeys collection (skip if already exists)
 *   4. Print the generated keys to the console
 */

import mongoose from 'mongoose'
import crypto from 'crypto'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
const NODE_ENV = process.env.NODE_ENV || 'development'
dotenv.config()
dotenv.config({
  path: path.resolve(process.cwd(), `.env.${NODE_ENV}`),
})

// Import the ApiKey model
import { ApiKeyModel } from '../features/apiKey/models'

interface ApiKeyEntry {
  name: string
  key: string
  permissions: string[]
  status: boolean
}

const generateKey = (): string => {
  return crypto.randomBytes(64).toString('hex')
}

const apiKeys: ApiKeyEntry[] = [
  {
    name: 'Web App',
    key: generateKey(),
    permissions: ['0000'],
    status: true,
  },
  {
    name: 'Mobile App',
    key: generateKey(),
    permissions: ['0000'],
    status: true,
  },
]

const migrate = async () => {
  const dbUrl = process.env.MONGODB_URI
  if (!dbUrl) {
    console.error('❌ MONGODB_URI is not defined in environment variables')
    process.exit(1)
  }

  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(dbUrl)
    console.log('✅ Connected to MongoDB\n')

    console.log('='.repeat(60))
    console.log('  API Key Migration')
    console.log('='.repeat(60))

    for (const entry of apiKeys) {
      // Check if a key with the same name already exists
      const existing = await ApiKeyModel.findOne({ name: entry.name })

      if (existing) {
        console.log(`\n⚠️  [${entry.name}] already exists — skipped`)
        console.log(`   Key: ${existing.key}`)
        continue
      }

      const created = await ApiKeyModel.create(entry)
      console.log(`\n✅ [${entry.name}] created successfully`)
      console.log(`   Key:         ${created.key}`)
      console.log(`   Permissions: ${entry.permissions.join(', ')}`)
      console.log(`   Status:      ${entry.status ? 'Active' : 'Inactive'}`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('  ⚠️  IMPORTANT: Save these keys securely!')
    console.log('  They will be used as the x-api-key header value.')
    console.log('='.repeat(60))
    console.log('\n🎉 Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

migrate()
