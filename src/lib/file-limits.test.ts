import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_BYTES,
  DOC_TYPES,
  DOC_TYPE_MAX_BYTES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  maxBytesFor,
} from './file-limits'

const MB = 1024 * 1024

describe('maxBytesFor', () => {
  it('ảnh SP bị siết chặt hơn bản vẽ', () => {
    expect(maxBytesFor('image')).toBe(5 * MB)
    expect(maxBytesFor('drawing')).toBe(20 * MB)
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
  it('bằng đúng mức cao nhất trong bảng — phải khớp file_size_limit ở migration 0060', () => {
    expect(MAX_UPLOAD_BYTES).toBe(20 * MB)
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
