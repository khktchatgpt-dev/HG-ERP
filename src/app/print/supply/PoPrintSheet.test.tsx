// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PO_PRINT_ORDER } from '@/lib/po-fields'
import { deriveLine, PO_TEMPLATES, type PoTemplate } from '@/lib/po-template'
import { poLsxRefs } from '@/lib/po-lsx-refs'
import { PoPrintSheet, type PoPrintHeader, type PoPrintLine } from './PoPrintSheet'

/**
 * PHIẾU IN ĐƠN MUA — MỌI MẪU (02/10/2026).
 *
 * User chụp PO-2026-0130 (nhôm): khung "Số ĐH / LSX / Đơn hàng" phình hết bề
 * ngang vì dòng "Đơn hàng" nối 11 đơn LAURA, cột "Kính gửi" bị bóp còn một chữ
 * mỗi dòng. Bài này dựng phiếu của CẢ 12 mẫu (3 mẫu chưa có đơn thật nào —
 * hoá chất, MRO, đơn giản) với dữ liệu cực đoan: tên NCC dài, 11 đơn hàng cùng
 * gốc, mọi ô thông số có số. Bố cục đo bằng mắt trên trình duyệt; ở đây canh
 * những thứ máy đọc được.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))
afterEach(cleanup)

const ORDERS = ['30/12/26', '20/01/27', '10/02/27', '17/02/27', '25/02/27', '03/02/27', '24/02/27', '13/01/27', '10/03/27', '17/03/27', '24/03/27'].map((d) => `LAURA 01/26-27 g.${d}`) // prettier-ignore

function header(template: PoTemplate): PoPrintHeader {
  const refs = poLsxRefs({ code: '01/26-27 - LAURA', order_codes: ORDERS }, [])
  return {
    code: 'PO-2026-0130',
    template,
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    discount_amount: null,
    contract_no: null,
    expected_at: '2026-10-20',
    note: null,
    terms: null,
    terms_quality: 'Đúng quy cách',
    terms_delivery_place: null,
    terms_payment: null,
    terms_invoice: null,
    terms_lead_time: null,
    signer_role: null,
    supplier_name: 'Công Ty TNHH Sản xuất thương mại Ngô Sơn',
    created_at: '2026-10-02T03:00:00Z',
    ...refs,
  } as PoPrintHeader
}

function line(template: PoTemplate): PoPrintLine {
  const raw = {
    qty_ordered: 227,
    weight_per_m: 0.221,
    bar_length_m: 4.6,
    weight_per_unit: 1.5,
    m3_per_unit: 0.0064,
    area_m2: 1.2,
    inner_l_mm: 500,
    inner_w_mm: 400,
    inner_h_mm: 30,
    carton_basis: template === 'foam' ? ('m3' as const) : ('m2' as const),
    unit2_per_unit: 17.5,
    unit2_label: 'Lít',
  }
  const d = deriveLine(template, raw)
  return {
    id: 'l1',
    material_code: 'NH-0569',
    material_name: 'Nhôm phi 27 (1.0) mềm 4.6m',
    material_unit: 'Cây',
    unit_price: 113_000,
    ...raw,
    ...d,
    spec: '25×50×1li',
    note: 'Ghế - Bộ góc Sigrid',
    material_grade: 'Sắt xi trắng',
    dm_per_sp: 4,
    qty_demand: 60,
    qty_on_hand: 3,
    die_code: 'K-1234',
    dimension_text: 'Inox phi 15.9x1.5li',
    finish: 'inox bóng',
    warranty_text: '12 tháng',
    open_style: 'AD',
    pcs_per_ctn: 1,
    price_per_m2: 18_770,
    print_fee: 3_278,
    pack_size: null,
    pack_unit: null,
  } as PoPrintLine
}

const company = {
  company_name: 'CÔNG TY TNHH SX-TM HOÀNG GIA',
  address: 'Lô C3 - Cụm công nghiệp Cát Nhơn',
  phone: '+84 56 3501516',
} as never

describe('phiếu in đơn mua — 12 mẫu', () => {
  it.each(PO_TEMPLATES)(
    'mẫu %s: đủ cột theo mẫu, không chữ lạ, khung số hiệu có trần',
    (t) => {
      const { container } = render(
        <PoPrintSheet
          company={company}
          po={header(t)}
          supplier={{ name: header(t).supplier_name, address: 'Q33, Đường số 7, KDC Xuyên Á', tax_no: '1102022847', phone: '056.3749073' }} // prettier-ignore
          lines={[line(t)]}
        />,
      )
      const text = container.textContent ?? ''
      expect(text, 'chữ lạ trên phiếu').not.toMatch(
        /\b(NaN|undefined|null|Infinity)\b|\[object/,
      )

      // Số cột của bảng hàng = khai báo in của mẫu (token '@…' và key cột riêng).
      const main = container.querySelector('table.border-collapse')!
      const head = [...main.querySelectorAll('thead td')]
      expect(head).toHaveLength(PO_PRINT_ORDER[t].length)

      // Khung Số ĐH: có trần bề ngang + được xuống dòng (lỗi PO-2026-0130).
      const box = container.querySelector('div.divide-black') as HTMLElement
      expect(box.className).toContain('max-w-[45%]')
      expect(box.className).toContain('break-words')
      expect(box.className).not.toContain('shrink-0')
      // Dòng "Đơn hàng" BỎ HẲN (02/10/2026, user chốt): mã đơn bán của lệnh là
      // việc bên Sale, không lên phiếu NCC. Số ĐH + LSX vẫn phải còn.
      expect(box.textContent).not.toContain('Đơn hàng')
      expect(text).not.toContain('LAURA 01/26-27 g.')
      expect(box.textContent).toContain('PO-2026-0130')
      expect(box.textContent).toContain('01/26-27 - LAURA')
      // Số ĐH và mã LSX in đậm.
      const bold = [...box.querySelectorAll('b')].map((b) => b.textContent)
      expect(bold).toEqual(['PO-2026-0130', '01/26-27 - LAURA'])
    },
  )
})

/*
 * CỘT "CHIA LỆNH" (10/10/2026 — user chọn cột trên phiếu): chỉ đơn gộp từ 2 lệnh,
 * đứng ngay trước Ghi chú, mỗi lệnh một dòng. Dòng chưa chia = trọn lệnh chính.
 */
describe('phiếu in đơn gộp lệnh — cột Chia lệnh', () => {
  const SET = [
    { id: 'L08', code: '08/26-27 - MX' },
    { id: 'L09', code: '09/26-27 - MX' },
  ]
  const ve = (lsxSet: typeof SET, lines: PoPrintLine[]) => {
    const { container } = render(
      <PoPrintSheet company={company} po={{ ...header('aluminium'), lsx_set: lsxSet }} supplier={null} lines={lines} />, // prettier-ignore
    )
    const main = container.querySelector('table.border-collapse')!
    const head = [...main.querySelectorAll('thead td')].map((td) => td.textContent)
    const rows = [...main.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    )
    return { head, rows }
  }

  it('đơn gộp: cột Chia lệnh trước Ghi chú; dòng chia tay + dòng chưa chia (trọn lệnh chính)', () => {
    const chia = { ...line('aluminium'), id: 'a', qty_ordered: 288, lsx_split: [{ production_order_id: 'L08', qty: 200 }, { production_order_id: 'L09', qty: 88 }] } // prettier-ignore
    const tron = { ...line('aluminium'), id: 'b', qty_ordered: 63, lsx_split: [{ production_order_id: 'L09', qty: 63 }] } // prettier-ignore
    const chuaChia = { ...line('aluminium'), id: 'c', qty_ordered: 7, lsx_split: null }
    const { head, rows } = ve(SET, [chia, tron, chuaChia])
    const at = head.indexOf('Chia lệnh')
    expect(at).toBeGreaterThan(-1)
    expect(head[at + 1]).toBe('Ghi chú')
    expect(rows[0][at]).toBe('08 MX: 20009 MX: 88')
    expect(rows[1][at]).toBe('09 MX: 63')
    expect(rows[2][at]).toBe('08 MX: 7')
  })

  it('đơn MỘT lệnh: không có cột Chia lệnh — phiếu y như mẫu cũ', () => {
    const { head } = ve([SET[0]], [line('aluminium')])
    expect(head).not.toContain('Chia lệnh')
    expect(head).toHaveLength(PO_PRINT_ORDER.aluminium.length)
  })
})
