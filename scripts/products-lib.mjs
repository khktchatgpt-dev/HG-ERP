// Hàm dùng chung cho products-reset.mjs và products-import.mjs.
//
// - loadEnv():   đọc .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY)
// - client():    Supabase client bằng secret key (bypass RLS, server-only)
// - readCsv():   parser CSV tối thiểu — có xử lý dấu nháy kép và BOM UTF-8
// - chunk():     chia mảng để gọi API theo lô, tránh payload quá lớn
//
// Không import gì từ src/ để script chạy được bằng `node` trần, không cần build.

import { readFileSync } from 'node:fs'

export function loadEnv(metaUrl) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', metaUrl), 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

export async function client(metaUrl) {
  loadEnv(metaUrl)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    console.error(
      '✗ thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY trong .env.local',
    )
    process.exit(1)
  }
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { persistSession: false } })
}

/** CSV → mảng object. Cột lấy từ dòng đầu. Ô trống trả về ''. */
export function readCsv(path) {
  let txt = readFileSync(path, 'utf8')
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1) // BOM của Excel
  const rows = []
  let row = [],
    cell = '',
    quoted = false
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i]
    if (quoted) {
      if (c === '"') {
        if (txt[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
      continue
    }
    if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (c !== '\r') cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const head = rows.shift() ?? []
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

export const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/,/g, '.'))
  return Number.isFinite(n) ? n : null
}

/** Bỏ dấu tiếng Việt + hạ chữ thường, để so khớp tên không phụ thuộc cách gõ. */
export const nostr = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
