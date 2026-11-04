import { zipSync, strToU8, type Zippable } from 'fflate'
import type { User } from '@/modules/core/users/users.repo'
import { filesRepo } from '@/modules/core/files/files.repo'
import { storage } from '@/modules/core/files/storage'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { DOC_TYPE_LABEL, type DocType } from '@/lib/file-limits'
import { NotFound } from '@/server/http'
import { db } from '@/server/db'
import {
  buildTaiLieu,
  readmeText,
  safeName,
  zipEntries,
  type TaiLieuRow,
} from '@/lib/lsx-tai-lieu'

const labelOf = (t: string) => DOC_TYPE_LABEL[t as DocType] ?? t

async function load(lsxId: string) {
  const lines = await lsxLinesRepo.listLines(lsxId)
  const ids = [...new Set(lines.map((l) => l.product_id).filter((x): x is string => !!x))]
  // Đếm dòng định mức TỪNG SP bằng count head — select thẳng dính trần 1.000
  // dòng của PostgREST (lệnh 06 MX: 22 SP × ~40 dòng là vượt).
  const [rows, counts] = await Promise.all([
    filesRepo.listByProducts(ids),
    Promise.all(
      ids.map(async (id) => {
        const r = await db()
          .from('technical_product_parts')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', id)
        if (r.error) throw new Error(`technical_product_parts: ${r.error.message}`)
        return [id, r.count ?? 0] as const
      }),
    ),
  ])
  const parts = new Map(counts)
  const products = buildTaiLieu(
    lines.map((l) => ({
      product_id: l.product_id,
      product_code: l.product_code,
      name: l.name_vi || l.name_foreign || '',
      qty: l.qty,
      unit: l.unit,
    })),
    rows
      .filter((f) => f.product_id)
      .map((f) => ({
        id: f.id,
        product_id: f.product_id as string,
        doc_type: f.doc_type,
        filename: f.filename,
        size_bytes: f.size_bytes,
        is_current: f.is_current,
        created_at: f.created_at,
      })),
    labelOf,
  )
  const out: TaiLieuRow[] = products.map((p) => ({
    ...p,
    parts: p.product_id ? (parts.get(p.product_id) ?? 0) : 0,
  }))
  return { products: out, rows: new Map(rows.map((f) => [f.id, f])) }
}

/**
 * Tài liệu hồ sơ SP của MỘT lệnh — tab "Tài liệu SP" + nút zip ở Hồ sơ lệnh của
 * Cung ứng (04/11/2026, bản vẽ GTwUMER4sxSA8dHyZb8uRN).
 *
 * Quyền: đọc như màn Hồ sơ lệnh — mọi NV đã đăng nhập. File hồ sơ SP vốn đọc
 * được với mọi NV (`assertCanReadFile` không gác nhánh product), nên zip không
 * mở thêm đường nào mà từng file một không mở.
 */
export const lsxTaiLieuService = {
  async list(_user: User, lsxId: string): Promise<TaiLieuRow[]> {
    return (await load(lsxId)).products
  },

  /**
   * Nén ngay lúc bấm, không lưu bản zip (lệnh nặng nhất đang chạy 24,8 MB — đo
   * 04/11). File đã nén sẵn (xlsx, ảnh, pdf) để mức 0: nén lại chỉ tốn CPU.
   * File nào Storage không trả thì GHI vào "Đọc trước.txt" chứ không làm hỏng
   * cả gói — người dùng vẫn cầm được 37/38 file.
   */
  async buildZip(
    _user: User,
    lsxId: string,
    today: string,
  ): Promise<{ buf: Uint8Array; filename: string }> {
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('Không tìm thấy lệnh sản xuất')
    const { products, rows } = await load(lsxId)
    const entries = zipEntries(products)
    // 6 luồng một lúc: đủ nhanh mà không dội Storage bằng 40 request cùng lúc.
    // Gom kết quả theo CHỈ SỐ rồi mới xếp vào zip — để thứ tự trong gói đúng thứ
    // tự SP trên lệnh, không theo file nào tải xong trước.
    const bufs: (Buffer | null)[] = []
    for (let i = 0; i < entries.length; i += 6) {
      const part = await Promise.all(
        entries.slice(i, i + 6).map((e) => {
          const row = rows.get(e.fileId)
          return row
            ? storage.downloadBuffer(row.bucket, row.path)
            : Promise.resolve(null)
        }),
      )
      bufs.push(...part)
    }
    const tree: Zippable = {}
    const failed: string[] = []
    entries.forEach((e, i) => {
      const buf = bufs[i]
      if (buf) tree[e.path] = [new Uint8Array(buf), { level: 0 }]
      else failed.push(e.path)
    })
    // BOM UTF-8 đầu file để Notepad đời cũ đọc đúng dấu.
    tree['Đọc trước.txt'] = [
      strToU8('﻿' + readmeText(lsx.code, products, failed, today)),
      { level: 6 },
    ]
    return {
      buf: zipSync(tree),
      filename: `${safeName(`Tai lieu ${lsx.code}`)}_${today}.zip`,
    }
  },
}
