/**
 * Migration runner (Laravel-style)
 *
 * Usage:
 *   pnpm run migrate              # run all pending migrations
 *   pnpm run migrate:rollback     # rollback the last batch
 *
 * Each migration file in this folder must export:
 *   export async function up(): Promise<void>     // required
 *   export async function down(): Promise<void>   // optional, used by rollback
 *
 * Files are run in filename order (use a numeric prefix: 001_, 002_, ...).
 * Executed migrations are tracked in the `migrations` collection so a file
 * that already ran is skipped on the next `migrate`.
 */

import * as fs from 'fs'
import * as path from 'path'
import mongoose, { Schema, model } from 'mongoose'
import config from '../configs'

// ---- tracking model -------------------------------------------------------
const migrationSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    batch: { type: Number, required: true },
  },
  { timestamps: true, collection: 'migrations' },
)

const MigrationModel = model('Migration', migrationSchema)

// ---- helpers --------------------------------------------------------------
const MIGRATIONS_DIR = __dirname
// only consider migration files: numeric-prefixed .ts/.js, exclude this runner
const isMigrationFile = (file: string): boolean =>
  /^\d+_.+\.(ts|js)$/.test(file) && !file.startsWith('migrate.')

const getMigrationFiles = (): string[] =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(isMigrationFile)
    .sort()

const connect = async (): Promise<void> => {
  const dbUrl = config.dbUrl
  if (!dbUrl) {
    console.error('❌ MONGODB_URI (config.dbUrl) is not defined')
    process.exit(1)
  }
  console.log('🔌 Connecting to MongoDB...')
  await mongoose.connect(dbUrl)
  console.log('✅ Connected\n')
}

// ---- commands -------------------------------------------------------------
const runMigrate = async (): Promise<void> => {
  const files = getMigrationFiles()
  const done = await MigrationModel.find().select('name').lean()
  const doneSet = new Set(done.map((d) => d.name))

  const pending = files.filter((f) => !doneSet.has(f))

  if (pending.length === 0) {
    console.log('✨ Nothing to migrate. Everything is up to date.')
    return
  }

  // next batch number
  const last = await MigrationModel.findOne().sort({ batch: -1 }).lean()
  const batch = (last?.batch ?? 0) + 1

  console.log(`Running ${pending.length} migration(s) — batch ${batch}\n`)

  for (const file of pending) {
    const fullPath = path.join(MIGRATIONS_DIR, file)
    const mod = await import(fullPath)
    if (typeof mod.up !== 'function') {
      console.error(`❌ ${file} does not export an "up()" function — aborting`)
      process.exit(1)
    }

    console.log(`⏳ Migrating: ${file}`)
    await mod.up()
    await MigrationModel.create({ name: file, batch })
    console.log(`✅ Migrated:  ${file}\n`)
  }

  console.log('🎉 Migration completed successfully!')
}

const runRollback = async (target?: string): Promise<void> => {
  let records

  if (target) {
    // rollback a specific migration regardless of batch.
    // match by full filename or by prefix, e.g. "002" or "002_seed_roles_resources.ts"
    records = await MigrationModel.find({
      name: { $regex: `^${target}` },
    })
      .sort({ name: -1 })
      .lean()

    if (records.length === 0) {
      console.log(`✨ No applied migration matches "${target}".`)
      return
    }
    console.log(`Rolling back ${records.length} migration(s) matching "${target}"\n`)
  } else {
    // default Laravel behaviour: rollback the last batch
    const last = await MigrationModel.findOne().sort({ batch: -1 }).lean()
    if (!last) {
      console.log('✨ Nothing to rollback.')
      return
    }
    const batch = last.batch
    // rollback in reverse order of execution
    records = await MigrationModel.find({ batch }).sort({ name: -1 }).lean()
    console.log(`Rolling back batch ${batch} — ${records.length} migration(s)\n`)
  }

  for (const record of records) {
    const fullPath = path.join(MIGRATIONS_DIR, record.name)
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  File missing for ${record.name} — removing record only`)
      await MigrationModel.deleteOne({ _id: record._id })
      continue
    }

    const mod = await import(fullPath)
    console.log(`⏳ Rolling back: ${record.name}`)
    if (typeof mod.down === 'function') {
      await mod.down()
    } else {
      console.warn(`   (no down() exported — skipping data revert)`)
    }
    await MigrationModel.deleteOne({ _id: record._id })
    console.log(`✅ Rolled back:  ${record.name}\n`)
  }

  console.log('🎉 Rollback completed successfully!')
}

// ---- entrypoint -----------------------------------------------------------
const main = async (): Promise<void> => {
  const command = process.argv[2] === 'rollback' ? 'rollback' : 'migrate'
  const target = process.argv[3] // optional: e.g. "002" for targeted rollback
  await connect()
  try {
    if (command === 'rollback') {
      await runRollback(target)
    } else {
      await runMigrate()
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exitCode = 1
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

main()
