import { describe, it, expect } from 'vitest'
import { initUploadSchema, MAX_UPLOAD_BYTES } from './files.schema'

describe('initUploadSchema', () => {
  const validBase = {
    filename: 'test.pdf',
    mime_type: 'application/pdf' as const,
    size_bytes: 1024,
    bucket: 'attachments' as const,
  }

  it('parse OK với parent kind=none', () => {
    const parsed = initUploadSchema.parse({ ...validBase, parent: { kind: 'none' } })
    expect(parsed.parent).toEqual({ kind: 'none' })
  })

  it('parse OK với parent kind=task', () => {
    const parsed = initUploadSchema.parse({
      ...validBase,
      parent: { kind: 'task', id: '11111111-1111-4111-8111-111111111111' },
    })
    expect(parsed.parent.kind).toBe('task')
  })

  it('reject file quá lớn', () => {
    expect(() =>
      initUploadSchema.parse({
        ...validBase,
        size_bytes: MAX_UPLOAD_BYTES + 1,
        parent: { kind: 'none' },
      }),
    ).toThrow()
  })

  it('reject mime không nằm trong allowlist', () => {
    expect(() =>
      initUploadSchema.parse({
        ...validBase,
        mime_type: 'application/x-shell' as unknown as 'application/pdf',
        parent: { kind: 'none' },
      }),
    ).toThrow()
  })

  it('reject bucket không hợp lệ', () => {
    expect(() =>
      initUploadSchema.parse({
        ...validBase,
        bucket: 'random' as unknown as 'attachments',
        parent: { kind: 'none' },
      }),
    ).toThrow()
  })

  it('reject task id không phải UUID', () => {
    expect(() =>
      initUploadSchema.parse({
        ...validBase,
        parent: { kind: 'task', id: 'not-a-uuid' },
      }),
    ).toThrow()
  })
})
