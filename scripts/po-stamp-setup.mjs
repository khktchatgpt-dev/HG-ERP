// CÀI ẢNH DẤU + CHỮ KÝ GIÁM ĐỐC cho phiếu in đơn mua (06/10/2026).
//
// Tải ảnh PNG (nền trong suốt) lên bucket RIÊNG TƯ `private` rồi ghi key
// `po_stamp` vào bảng `settings`: ảnh ở đâu + chữ ký trong ảnh là của AI. Phiếu
// in chỉ đóng dấu đơn do chính người đó bấm duyệt (src/lib/po-stamp.ts).
//
// Ảnh KHÔNG nằm trong repo — truyền đường dẫn lúc chạy. Thay ảnh: chạy lại.
//
//   node scripts/po-stamp-setup.mjs --file "D:/dau-gd.png" --signer dien@hoanggia.de
//   node scripts/po-stamp-setup.mjs --remove     # gỡ: phiếu in về ký tay như cũ

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (!a.startsWith('--')) continue
  const next = process.argv[i + 1]
  if (next && !next.startsWith('--')) args[a.slice(2)] = process.argv[++i]
  else args[a.slice(2)] = true
}

loadEnvLocal()
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false },
  },
)
const BUCKET = 'private'
const PATH = 'company/po-stamp.png'

if (args.remove) {
  await db.from('settings').delete().eq('key', 'po_stamp')
  await db.storage.from(BUCKET).remove([PATH])
  console.log('Đã gỡ dấu — phiếu in đơn mua về ô ký trống.')
  process.exit(0)
}

if (!args.file || !args.signer) {
  console.error('Thiếu --file <ảnh.png> hoặc --signer <email người ký>')
  process.exit(1)
}

const buf = readFileSync(args.file)
// PNG magic number — ảnh JPG không có nền trong suốt, in ra thành ô trắng đè chữ.
if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  console.error('Ảnh phải là PNG nền trong suốt.')
  process.exit(1)
}

const { data: user, error: uErr } = await db
  .from('users')
  .select('id, name, email')
  .eq('email', String(args.signer).toLowerCase())
  .maybeSingle()
if (uErr || !user) {
  console.error(`Không tìm thấy tài khoản ${args.signer}`)
  process.exit(1)
}

const { error: upErr } = await db.storage
  .from(BUCKET)
  .upload(PATH, buf, { contentType: 'image/png', upsert: true })
if (upErr) {
  console.error('Tải ảnh lỗi:', upErr.message)
  process.exit(1)
}

const { error: sErr } = await db
  .from('settings')
  .upsert({ key: 'po_stamp', value: { signer_user_id: user.id, path: PATH } })
if (sErr) {
  console.error('Ghi settings lỗi:', sErr.message)
  process.exit(1)
}

console.log(
  `Đã cài dấu: ${BUCKET}/${PATH} (${buf.length} byte), người ký ${user.name} <${user.email}>`,
)
