#!/usr/bin/env node
/**
 * PostToolUse hook: format + lint-fix đúng file Claude vừa sửa.
 * Nhận JSON tool-call qua stdin, lấy tool_input.file_path, chạy prettier --write
 * và eslint --fix trên file đó. Luôn exit 0 (không bao giờ chặn tool).
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function bail() {
  process.exit(0)
}

let raw = ''
try {
  raw = readFileSync(0, 'utf8')
} catch {
  bail()
}

let payload
try {
  payload = JSON.parse(raw)
} catch {
  bail()
}

const file = payload?.tool_input?.file_path
if (!file || typeof file !== 'string') bail()

const lower = file.toLowerCase()

// Bỏ qua file generated / thư mục build / deps.
if (
  lower.includes('database.types.ts') ||
  lower.includes('/node_modules/') ||
  lower.includes('\\node_modules\\') ||
  lower.includes('/.next/') ||
  lower.includes('\\.next\\')
) {
  bail()
}

const dot = lower.lastIndexOf('.')
if (dot < 0) bail()
const ext = lower.slice(dot)

const PRETTIER = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.md']
const ESLINT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

function run(cmd) {
  // shell:true để dùng được npx.cmd trên Windows; nuốt mọi output.
  spawnSync(cmd, { shell: true, stdio: 'ignore', timeout: 30000 })
}

if (PRETTIER.includes(ext)) run(`npx prettier --write "${file}"`)
if (ESLINT.includes(ext)) run(`npx eslint --fix "${file}"`)

process.exit(0)
