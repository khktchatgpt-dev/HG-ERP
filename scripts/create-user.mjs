// Provision a user account directly in Supabase (bypasses the API / self-register,
// which no longer exists). Use it to seed the FIRST admin, or to create test users.
//
// Usage (PowerShell / bash):
//   node scripts/create-user.mjs --email admin@hg.com --password "Str0ngPass!" --role admin --name "Quản trị"
//   node scripts/create-user.mjs --email m@hg.com --password "pass1234" --role manager --department <uuid>
//   node scripts/create-user.mjs --email admin@hg.com --promote --role admin   # promote an existing user
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from the environment,
// falling back to parsing .env.local. Run from the project root.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const ROLES = ['admin', 'manager', 'employee']
const ROUNDS = 12

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const val = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

loadEnvLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) die('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (env or .env.local)')

const args = parseArgs(process.argv.slice(2))
const email = (args.email || '').toString().trim().toLowerCase()
const role = (args.role || 'employee').toString()
if (!email) die('--email is required')
if (!ROLES.includes(role)) die(`--role must be one of: ${ROLES.join(', ')}`)

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing } = await db
  .from('users')
  .select('id, email, role')
  .eq('email', email)
  .maybeSingle()

if (existing) {
  if (!args.promote) {
    die(`User ${email} already exists (id=${existing.id}, role=${existing.role}). Pass --promote to change role/activate.`)
  }
  const { data, error } = await db
    .from('users')
    .update({ role, is_active: true })
    .eq('id', existing.id)
    .select('id, email, role, is_active')
    .single()
  if (error) die(error.message)
  console.log(`✓ Promoted ${data.email} → role=${data.role}, active=${data.is_active}`)
  process.exit(0)
}

const password = (args.password || '').toString()
if (password.length < 8) die('--password is required (≥ 8 chars) when creating a new user')

const password_hash = await bcrypt.hash(password, ROUNDS)
const row = {
  email,
  password_hash,
  name: args.name ? args.name.toString() : null,
  role,
  department_id: args.department ? args.department.toString() : null,
  title: args.title ? args.title.toString() : null,
}

const { data, error } = await db
  .from('users')
  .insert(row)
  .select('id, email, role, department_id')
  .single()
if (error) die(error.message)
console.log(`✓ Created ${data.email} (id=${data.id}, role=${data.role})`)
