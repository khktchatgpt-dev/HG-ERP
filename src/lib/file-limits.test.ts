import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_MAX_BYTES,
  DOC_TYPES,
  DOC_TYPE_LABEL,
  DOC_TYPE_MAX_BYTES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  isAllowedMime,
  maxBytesFor,
} from './file-limits'

const MB = 1024 * 1024

describe('maxBytesFor', () => {
  it('ảnh siết 5MB (gốc lưu Drive), tài liệu khác 50MB — chốt 14/08/2026', () => {
    expect(maxBytesFor('image')).toBe(5 * MB)
    expect(maxBytesFor('drawing')).toBe(50 * MB)
    expect(maxBytesFor('bom')).toBe(50 * MB)
  })

  it('chưa phân loại → mức mặc định', () => {
    expect(maxBytesFor(null)).toBe(DEFAULT_MAX_BYTES)
    expect(maxBytesFor(undefined)).toBe(DEFAULT_MAX_BYTES)
  })

  it('doc_type lạ từ DB → mặc định, KHÔNG nới trần', () => {
    // files.doc_type là string thô; giá trị rác không được thành đường lách limit.
    expect(maxBytesFor('bogus')).toBe(DEFAULT_MAX_BYTES)
    expect(maxBytesFor('')).toBe(DEFAULT_MAX_BYTES)
    expect(maxBytesFor('__proto__')).toBe(DEFAULT_MAX_BYTES)
    expect(maxBytesFor('constructor')).toBe(DEFAULT_MAX_BYTES)
  })

  it('mọi doc_type đều có limit dương', () => {
    for (const t of DOC_TYPES) {
      expect(maxBytesFor(t)).toBeGreaterThan(0)
    }
  })
})

describe('MAX_UPLOAD_BYTES', () => {
  it('bằng đúng mức cao nhất trong bảng — phải khớp file_size_limit ở migration 0147', () => {
    expect(MAX_UPLOAD_BYTES).toBe(50 * MB)
    expect(MAX_UPLOAD_BYTES).toBe(
      Math.max(...Object.values(DOC_TYPE_MAX_BYTES), DEFAULT_MAX_BYTES),
    )
  })

  it('không loại nào vượt trần cứng của bucket', () => {
    for (const t of DOC_TYPES) {
      expect(maxBytesFor(t)).toBeLessThanOrEqual(MAX_UPLOAD_BYTES)
    }
  })
})

describe('DOC_TYPES ↔ check constraint dưới DB', () => {
  /**
   * Lệch nhau thì upload chỉ chết LÚC CHẠY THẬT (insert files vi phạm
   * files_doc_type_valid), sau khi đã PUT xong file lên storage. Đọc thẳng
   * migration mới nhất động tới constraint — cùng lối với actions.test.ts.
   */
  it('mọi doc_type đều nằm trong files_doc_type_valid (0150)', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/0150_files_doc_type_packing.sql'),
      'utf8',
    )
    const inList = sql.match(/doc_type in \(([^)]+)\)/)?.[1] ?? ''
    const allowed = new Set([...inList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
    expect([...DOC_TYPES].filter((t) => !allowed.has(t))).toEqual([])
    expect(allowed.size).toBe(DOC_TYPES.length)
  })

  it('mọi doc_type đều có nhãn tiếng Việt', () => {
    for (const t of DOC_TYPES) expect(DOC_TYPE_LABEL[t]).toBeTruthy()
  })
})

describe('isAllowedMime', () => {
  it('nhận PowerPoint — hồ sơ đóng gói của Kỹ thuật là .pptx (0150)', () => {
    expect(
      isAllowedMime(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).toBe(true)
    expect(isAllowedMime('application/vnd.ms-powerpoint')).toBe(true)
  })

  it('MIME rỗng (máy không cài Office) bị chặn ở client, không gửi lên server', () => {
    expect(isAllowedMime('')).toBe(false)
  })

  it('chặn thứ không nằm trong allowlist', () => {
    expect(isAllowedMime('application/x-msdownload')).toBe(false)
  })
})

describe('formatBytes', () => {
  it('hiển thị MB cho file lớn', () => {
    expect(formatBytes(5 * MB)).toBe('5 MB')
    expect(formatBytes(20 * MB)).toBe('20 MB')
  })

  it('giữ 1 chữ số lẻ để user hiểu vì sao bị chặn', () => {
    // "vượt giới hạn 5 MB" mà file 5.3 MB thì hiện "5 MB" sẽ khó hiểu.
    expect(formatBytes(5.3 * MB)).toBe('5.3 MB')
  })

  it('file nhỏ hiện KB thay vì "0 MB"', () => {
    expect(formatBytes(200 * 1024)).toBe('200 KB')
    expect(formatBytes(0)).toBe('1 KB')
  })
})
