// Nén-một-lần các ẢNH SP vượt trần 5MB (docs/ke-hoach-toi-uu-file-anh.md).
//
// Bối cảnh: 14/08/2026 trần ảnh nới 5MB → 50MB rồi siết lại 5MB trong ngày;
// trong khoảng hở đó vài ảnh máy ảnh ~13MB đã lọt vào. Chúng vẫn hiển thị được
// (đi qua tầng resize) nhưng chiếm kho và làm tầng resize tải nặng. Script này
// thu chúng về ≤2560px, GHI ĐÈ đúng path cũ nên mọi tham chiếu (image_file_id,
// URL đã ký) giữ nguyên — không đụng gì ngoài bytes + size_bytes/mime_type.
//
// Usage:
//   node scripts/images-compress-oversize.mjs           # xem sẽ nén gì (dry-run)
//   node scripts/images-compress-oversize.mjs --apply   # nén thật
//
// An toàn:
//   · Chỉ đụng doc_type='image', chưa xoá, size > 5MB — bản vẽ/BOM không bao giờ lọt.
//   · JPEG giữ JPEG; PNG chuyển WebP (giữ trong suốt) và cập nhật mime_type.
//   · Kết quả to hơn bản gốc (không tưởng nhưng đề phòng) → bỏ qua file đó.
//   · checksum trong DB đặt về null vì bytes đã đổi — cột này optional.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const LIMIT = 5 * 1024 * 1024
const MAX_DIM = 2560

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
    process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
}

loadEnvLocal()
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

const apply = process.argv.includes('--apply')

const { data: rows, error } = await db
  .from('files')
  .select('id, bucket, path, filename, mime_type, size_bytes')
  .eq('doc_type', 'image')
  .is('deleted_at', null)
  .gt('size_bytes', LIMIT)
  .order('size_bytes', { ascending: false })
if (error) throw new Error(error.message)

if (!rows.length) {
  console.log('Không còn ảnh nào vượt 5MB. Sạch.')
  process.exit(0)
}

console.log(
  `${rows.length} ảnh vượt 5MB${apply ? ' — NÉN THẬT' : ' (dry-run, thêm --apply để nén)'}\n`,
)

for (const f of rows) {
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`
  const { data: blob, error: de } = await db.storage.from(f.bucket).download(f.path)
  if (de) {
    console.log(`✗ ${f.filename}: tải về lỗi — ${de.message}`)
    continue
  }
  const input = Buffer.from(await blob.arrayBuffer())

  const isPng = f.mime_type === 'image/png'
  let pipe = sharp(input).rotate().resize(MAX_DIM, MAX_DIM, {
    fit: 'inside',
    withoutEnlargement: true,
  })
  // PNG ảnh chụp nén tệ → WebP (giữ alpha); JPEG giữ JPEG cho lành.
  pipe = isPng ? pipe.webp({ quality: 85 }) : pipe.jpeg({ quality: 82, mozjpeg: true })
  const out = await pipe.toBuffer()
  const newMime = isPng ? 'image/webp' : 'image/jpeg'

  if (out.length >= f.size_bytes) {
    console.log(`— ${f.filename}: bản nén không nhỏ hơn (${mb(out.length)}), bỏ qua`)
    continue
  }
  console.log(
    `${apply ? '✓' : '·'} ${f.filename}: ${mb(f.size_bytes)} → ${mb(out.length)}${isPng ? ' (png→webp)' : ''}`,
  )
  if (!apply) continue

  const { error: ue } = await db.storage
    .from(f.bucket)
    .upload(f.path, out, { contentType: newMime, upsert: true })
  if (ue) {
    console.log(`  ✗ upload đè lỗi: ${ue.message}`)
    continue
  }
  const { error: me } = await db
    .from('files')
    .update({ size_bytes: out.length, mime_type: newMime, checksum: null })
    .eq('id', f.id)
  if (me) console.log(`  ⚠ object đã đè nhưng update DB lỗi: ${me.message}`)
}

console.log('\nXong.')
