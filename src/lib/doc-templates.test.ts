import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOC_TEMPLATES,
  DOC_KINDS,
  formatDocCode,
  isDocKind,
  resolveSignatures,
} from './doc-templates'

const at = new Date('2026-08-22T10:00:00+07:00')

describe('formatDocCode', () => {
  it('giữ ĐÚNG mã hiện hành khi chưa ai đổi cấu hình', () => {
    // Mặc định phải tái tạo y hệt `KIND-YYYY-NNNN` của next_doc_code cũ, nếu
    // không thì áp 0164 xong là mã chứng từ nhảy kiểu giữa chừng năm.
    expect(formatDocCode(DEFAULT_DOC_TEMPLATES.PO, 42, at)).toBe('PO-2026-0042')
    expect(formatDocCode(DEFAULT_DOC_TEMPLATES.PNK, 7, at)).toBe('PNK-2026-0007')
    expect(formatDocCode(DEFAULT_DOC_TEMPLATES.BG, 1234, at)).toBe('BG-2026-1234')
  })

  it('đủ ô thay thế: {yy} {mm} {prefix} {seq}', () => {
    const t = { prefix: 'PX', pattern: '{prefix}{yy}{mm}-{seq}', seq_pad: 3 }
    expect(formatDocCode(t, 5, at)).toBe('PX2608-005')
  })

  it('số vượt quá số chữ số đã khai thì KHÔNG bị cắt', () => {
    // Đơn thứ 10.000 trong năm vẫn phải ra mã dùng được, thà dài hơn khuôn còn
    // hơn trùng mã với đơn 0000.
    expect(formatDocCode(DEFAULT_DOC_TEMPLATES.PO, 12345, at)).toBe('PO-2026-12345')
  })

  it('khuôn LSX ghép được tên khách (ô {customer} do lsx-code điền)', () => {
    const t = DEFAULT_DOC_TEMPLATES.LSX
    expect(formatDocCode(t, 3, at)).toBe('03/26 - {customer}')
  })
})

describe('DEFAULT_DOC_TEMPLATES', () => {
  it('khai đủ mọi loại chứng từ, không thiếu không thừa', () => {
    expect(Object.keys(DEFAULT_DOC_TEMPLATES).sort()).toEqual([...DOC_KINDS].sort())
    for (const k of DOC_KINDS) expect(DEFAULT_DOC_TEMPLATES[k].kind).toBe(k)
  })

  it('phiếu kho mang mẫu số TT200 và KHÔNG in quốc hiệu', () => {
    // Luật quy định chỗ đó ghi "Mẫu số 01-VT", đứng thay chỗ quốc hiệu.
    expect(DEFAULT_DOC_TEMPLATES.PNK.form_no).toBe('01-VT')
    expect(DEFAULT_DOC_TEMPLATES.PXK.form_no).toBe('02-VT')
    expect(DEFAULT_DOC_TEMPLATES.KK.form_no).toBe('05-VT')
    for (const k of ['PNK', 'PXK', 'KK'] as const)
      expect(DEFAULT_DOC_TEMPLATES[k].national_heading).toBe(false)
  })

  it('báo giá gửi khách nước ngoài không in quốc hiệu Việt Nam', () => {
    expect(DEFAULT_DOC_TEMPLATES.BG.national_heading).toBe(false)
  })

  it('LSX không dùng bộ đếm chung (prefix null)', () => {
    // Số lệnh đếm theo TỪNG KHÁCH trong năm — xem lsx-code.ts.
    expect(DEFAULT_DOC_TEMPLATES.LSX.prefix).toBeNull()
  })

  it('loại KHÔNG in thì không được khai cột ký', () => {
    // MS/PM chỉ mượn bộ đếm để cấp mã, chưa có tờ giấy nào in ra; hợp đồng bán
    // in theo khuôn riêng, không dùng khối ký dùng chung. Bày ô chữ ký cho
    // người ta sửa ở những loại đó là hứa một thứ không in ra đâu.
    for (const k of DOC_KINDS)
      if (!DEFAULT_DOC_TEMPLATES[k].printable)
        expect(DEFAULT_DOC_TEMPLATES[k].signatures).toEqual([])
    expect(DEFAULT_DOC_TEMPLATES.DH.signatures).toEqual([])
    expect(DEFAULT_DOC_TEMPLATES.PO.signatures.length).toBe(3)
  })

  it('phiếu đặt vật tư in TÊN người lập dưới nét ký', () => {
    // Tờ gửi NCC phải nói rõ ai bên mình đứng ra đặt hàng.
    expect(DEFAULT_DOC_TEMPLATES.PO.signatures[1].slot).toBe('creator')
  })

  it('cột ký của phiếu kho móc đúng chỗ lấy tên người', () => {
    // slot là chỗ MÓC dữ liệu chứng từ, không phải chữ — sai slot thì phiếu in
    // ra tên người lập ở ô của người giao hàng.
    const pnk = DEFAULT_DOC_TEMPLATES.PNK.signatures
    expect(pnk[0].slot).toBe('creator')
    expect(pnk[1].slot).toBe('counterparty')
    expect(pnk[2].slot).toBeUndefined()
  })
})

describe('resolveSignatures', () => {
  it('thay {company} và {signer_role} bằng dữ liệu thật của phiếu', () => {
    const out = resolveSignatures(DEFAULT_DOC_TEMPLATES.PO.signatures, {
      company: 'Công ty TNHH SX-TM Hoàng Gia',
      signer_role: 'TRƯỞNG PHÒNG CUNG ỨNG',
    })
    expect(out[1].role).toBe('TRƯỞNG PHÒNG CUNG ỨNG')
    expect(out[2].role).toBe('CÔNG TY TNHH SX-TM HOÀNG GIA')
  })

  it('thiếu tên công ty thì vẫn ra chữ ký được (GIÁM ĐỐC)', () => {
    const out = resolveSignatures(DEFAULT_DOC_TEMPLATES.PO.signatures, {})
    expect(out[2].role).toBe('GIÁM ĐỐC')
  })

  it('gắn tên người theo slot, cột không có slot thì bỏ trống', () => {
    const out = resolveSignatures(DEFAULT_DOC_TEMPLATES.PNK.signatures, {
      names: { creator: 'Nguyễn Văn A', counterparty: 'NCC Tường Nguyên' },
    })
    expect(out[0].name).toBe('Nguyễn Văn A')
    expect(out[1].name).toBe('NCC Tường Nguyên')
    expect(out[2].name).toBeUndefined()
  })

  it('cột admin tự thêm (không slot, không ô thay thế) giữ nguyên chữ', () => {
    const out = resolveSignatures([{ role: 'PHÓ GIÁM ĐỐC', hint: 'Ký' }], {})
    expect(out[0]).toEqual({ role: 'PHÓ GIÁM ĐỐC', hint: 'Ký', name: undefined })
  })
})

/**
 * CHỐT CHẶN HỒI QUY: mặc định trong code phải bằng ĐÚNG những gì 6 trang in đang
 * in trước 0164. Sai một chữ ở đây là mọi phiếu của công ty đổi mà không ai gọi.
 */
describe('mặc định khớp bản in trước 0164', () => {
  it.each([
    ['BG', 'BÁO GIÁ', 'QUOTATION', false, null],
    ['PO', 'ĐƠN ĐẶT HÀNG', 'PURCHASE ORDER', true, null],
    // LSX: dòng dưới tiêu đề dành cho "CHỈNH SỬA LẦN N" nên title_en để trống.
    ['LSX', 'LỆNH SẢN XUẤT', null, true, null],
    ['PNK', 'PHIẾU NHẬP KHO', null, false, '01-VT'],
    ['PXK', 'PHIẾU XUẤT KHO', null, false, '02-VT'],
    ['KK', 'BIÊN BẢN KIỂM KÊ VẬT TƯ', null, false, '05-VT'],
    ['DH', 'SALES CONTRACT', null, false, null],
  ] as const)('%s', (kind, vi, en, national, formNo) => {
    const t = DEFAULT_DOC_TEMPLATES[kind]
    expect([t.title_vi, t.title_en, t.national_heading, t.form_no]).toEqual([
      vi,
      en,
      national,
      formNo,
    ])
  })

  it('khối ký của phiếu kho và đơn mua đúng từng cột', () => {
    expect(DEFAULT_DOC_TEMPLATES.PXK.signatures.map((s) => s.role)).toEqual([
      'Người lập phiếu',
      'Người nhận hàng',
      'Thủ kho',
      'Kế toán trưởng',
    ])
    expect(DEFAULT_DOC_TEMPLATES.KK.signatures.map((s) => s.role)).toEqual([
      'Người kiểm kê (lập biên bản)',
      'Thủ kho',
      'Quản lý Kho (duyệt)',
      'Kế toán trưởng',
    ])
    expect(DEFAULT_DOC_TEMPLATES.LSX.signatures.map((s) => s.role)).toEqual([
      'Người lập',
      'Trưởng phòng kế hoạch',
      'Giám Đốc',
    ])
  })

  it('mọi loại (trừ LSX) giữ khuôn đánh số KIND-YYYY-NNNN', () => {
    for (const k of DOC_KINDS) {
      if (k === 'LSX') continue
      const t = DEFAULT_DOC_TEMPLATES[k]
      expect([t.prefix, t.pattern, t.seq_pad, t.reset_scope]).toEqual([
        k,
        '{prefix}-{yyyy}-{seq}',
        4,
        'year',
      ])
    }
  })
})

describe('isDocKind', () => {
  it('nhận mã hợp lệ, chặn mã lạ', () => {
    expect(isDocKind('PO')).toBe(true)
    expect(isDocKind('po')).toBe(false)
    expect(isDocKind('XX')).toBe(false)
    expect(isDocKind(null)).toBe(false)
  })
})
