import { describe, expect, it } from 'vitest'
import { docTemplateUpdateSchema } from './doc-templates.schema'

describe('docTemplateUpdateSchema', () => {
  it('GIỮ `slot` của cột ký khi lưu', () => {
    // zod lược bỏ khoá không khai — thiếu `slot` trong schema thì mỗi lần admin
    // bấm Lưu là phiếu kho mất tên người lập / người giao hàng khi in.
    const p = docTemplateUpdateSchema.parse({
      signatures: [
        { role: 'Người lập phiếu', hint: 'Ký, ghi rõ họ tên', slot: 'creator' },
        { role: 'Thủ kho', hint: 'Ký, ghi rõ họ tên' },
      ],
    })
    expect(p.signatures?.[0].slot).toBe('creator')
    expect(p.signatures?.[1].slot).toBeUndefined()
  })

  it('chặn slot lạ', () => {
    expect(() =>
      docTemplateUpdateSchema.parse({ signatures: [{ role: 'X', slot: 'giam_doc' }] }),
    ).toThrow()
  })

  it('khuôn mã thiếu {seq} bị từ chối', () => {
    // Thiếu số thứ tự thì mọi phiếu cùng kỳ ra CÙNG một mã, cột code unique ném
    // lỗi ngay phiếu thứ hai — chặn từ biên chứ không để DB báo.
    expect(() => docTemplateUpdateSchema.parse({ pattern: '{prefix}-{yyyy}' })).toThrow()
    expect(docTemplateUpdateSchema.parse({ pattern: '{prefix}-{seq}' }).pattern).toBe(
      '{prefix}-{seq}',
    )
  })

  it('bỏ trống tiền tố / mẫu số = null, không phải chuỗi rỗng', () => {
    const p = docTemplateUpdateSchema.parse({ prefix: null, form_no: null })
    expect(p.prefix).toBeNull()
    expect(p.form_no).toBeNull()
  })

  it('quá 6 cột ký thì từ chối', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ role: `C${i}` }))
    expect(() => docTemplateUpdateSchema.parse({ signatures: many })).toThrow()
  })
})
