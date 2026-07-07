import { describe, it, expect } from 'vitest'
import {
  materialCreateSchema,
  materialUpdateSchema,
  materialListQuerySchema,
  receiptSchema,
  issueSchema,
  stockListQuerySchema,
  movementListQuerySchema,
  receiptDocSchema,
  issueDocSchema,
} from './warehouse.schema'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('materialCreateSchema', () => {
  const valid = {
    code: 'VT-001',
    name: 'Ốc vít M6',
    unit: 'con',
    group_name: 'Ngũ kim',
    min_stock: 100,
    shelf_location: 'A-01',
  }

  it('parse OK đầy đủ', () => {
    const p = materialCreateSchema.parse(valid)
    expect(p.code).toBe('VT-001')
    expect(p.min_stock).toBe(100)
  })

  it('ĐVT mặc định "cái" khi bỏ trống', () => {
    const p = materialCreateSchema.parse({ code: 'X', name: 'Tấm gỗ' })
    expect(p.unit).toBe('cái')
  })

  it('min_stock mặc định 0 và ép kiểu từ chuỗi', () => {
    const p = materialCreateSchema.parse({ code: 'X', name: 'Y', min_stock: '5' })
    expect(p.min_stock).toBe(5)
    const p2 = materialCreateSchema.parse({ code: 'X', name: 'Y' })
    expect(p2.min_stock).toBe(0)
  })

  it('reject thiếu mã', () => {
    expect(() => materialCreateSchema.parse({ name: 'Y' })).toThrow()
  })

  it('reject mã rỗng', () => {
    expect(() => materialCreateSchema.parse({ code: '', name: 'Y' })).toThrow()
  })

  it('reject tên rỗng', () => {
    expect(() => materialCreateSchema.parse({ code: 'X', name: '' })).toThrow()
  })

  it('reject min_stock âm', () => {
    expect(() =>
      materialCreateSchema.parse({ code: 'X', name: 'Y', min_stock: -1 }),
    ).toThrow()
  })

  it('trim khoảng trắng ở mã/tên', () => {
    const p = materialCreateSchema.parse({ code: '  VT-9  ', name: '  Sơn  ' })
    expect(p.code).toBe('VT-9')
    expect(p.name).toBe('Sơn')
  })
})

describe('materialUpdateSchema', () => {
  it('partial — cập nhật 1 trường', () => {
    const p = materialUpdateSchema.parse({ shelf_location: 'B-02' })
    expect(p.shelf_location).toBe('B-02')
  })

  it('cho phép is_active', () => {
    const p = materialUpdateSchema.parse({ is_active: false })
    expect(p.is_active).toBe(false)
  })
})

describe('materialListQuerySchema', () => {
  it('mặc định: active_only=false, page=1, page_size=500', () => {
    const p = materialListQuerySchema.parse({})
    expect(p.active_only).toBe(false)
    expect(p.page).toBe(1)
    expect(p.page_size).toBe(500)
  })

  it('ép kiểu page/page_size từ chuỗi (query string)', () => {
    const p = materialListQuerySchema.parse({ page: '3', page_size: '50' })
    expect(p.page).toBe(3)
    expect(p.page_size).toBe(50)
  })

  it('reject page_size vượt 1000', () => {
    expect(() => materialListQuerySchema.parse({ page_size: '5000' })).toThrow()
  })
})

describe('receiptSchema (nhập kho)', () => {
  it('parse OK: mặc định ref_type=external, qty_rejected=0', () => {
    const p = receiptSchema.parse({ material_id: UUID, qty: 50 })
    expect(p.ref_type).toBe('external')
    expect(p.qty_rejected).toBe(0)
  })

  it('cho QC không đạt + theo đơn đặt', () => {
    const p = receiptSchema.parse({
      material_id: UUID,
      qty: 80,
      qty_rejected: 20,
      qc_status: 'partial',
      ref_type: 'po',
      ref_no: 'PO-001',
    })
    expect(p.qty).toBe(80)
    expect(p.qty_rejected).toBe(20)
    expect(p.qc_status).toBe('partial')
  })

  it('reject qty ≤ 0', () => {
    expect(() => receiptSchema.parse({ material_id: UUID, qty: 0 })).toThrow()
  })

  it('reject qty_rejected âm', () => {
    expect(() =>
      receiptSchema.parse({ material_id: UUID, qty: 10, qty_rejected: -1 }),
    ).toThrow()
  })

  it('reject material_id không phải UUID', () => {
    expect(() => receiptSchema.parse({ material_id: 'x', qty: 5 })).toThrow()
  })

  it('reject ref_type lạ', () => {
    expect(() =>
      receiptSchema.parse({ material_id: UUID, qty: 5, ref_type: 'lsx' }),
    ).toThrow()
  })
})

describe('issueSchema (xuất kho)', () => {
  it('parse OK: mặc định ref_type=daily', () => {
    const p = issueSchema.parse({ material_id: UUID, qty: 5 })
    expect(p.ref_type).toBe('daily')
  })

  it('xuất theo LSX', () => {
    const p = issueSchema.parse({
      material_id: UUID,
      qty: 12,
      ref_type: 'lsx',
      ref_no: 'LSX-2026-001',
    })
    expect(p.ref_type).toBe('lsx')
    expect(p.ref_no).toBe('LSX-2026-001')
  })

  it('reject qty ≤ 0', () => {
    expect(() => issueSchema.parse({ material_id: UUID, qty: 0 })).toThrow()
  })

  it('reject ref_type external (xuất không nhận external)', () => {
    expect(() =>
      issueSchema.parse({ material_id: UUID, qty: 5, ref_type: 'external' }),
    ).toThrow()
  })
})

describe('stockListQuerySchema & movementListQuerySchema', () => {
  it('stock: low_only mặc định false, ép từ chuỗi', () => {
    expect(stockListQuerySchema.parse({}).low_only).toBe(false)
    expect(stockListQuerySchema.parse({ low_only: 'true' }).low_only).toBe(true)
  })

  it('movement: mặc định page=1, page_size=50', () => {
    const p = movementListQuerySchema.parse({})
    expect(p.page).toBe(1)
    expect(p.page_size).toBe(50)
  })

  it('movement: direction chỉ nhận in/out', () => {
    expect(movementListQuerySchema.parse({ direction: 'in' }).direction).toBe('in')
    expect(() => movementListQuerySchema.parse({ direction: 'sideways' })).toThrow()
  })
})


describe('receiptDocSchema — phiếu nhập nhiều dòng', () => {
  it('parse OK: theo PO với QC', () => {
    const p = receiptDocSchema.parse({
      po_id: UUID,
      counterparty: 'Tài xế NCC Tiến Đạt',
      lines: [
        { material_id: UUID, qty: '60', qty_rejected: '5', qc_status: 'partial', po_line_id: UUID },
      ],
    })
    expect(p.lines[0].qty).toBe(60)
    expect(p.lines[0].qty_rejected).toBe(5)
  })

  it('từ chối phiếu 0 dòng và qty ≤ 0', () => {
    expect(() => receiptDocSchema.parse({ lines: [] })).toThrow()
    expect(() =>
      receiptDocSchema.parse({ lines: [{ material_id: UUID, qty: 0 }] }),
    ).toThrow()
  })
})

describe('issueDocSchema — BR-09 ở tầng schema', () => {
  it('xuất theo LSX bắt buộc production_order_id', () => {
    expect(() =>
      issueDocSchema.parse({ kind: 'lsx', lines: [{ material_id: UUID, qty: 1 }] }),
    ).toThrow()
    const p = issueDocSchema.parse({
      kind: 'lsx',
      production_order_id: UUID,
      lines: [{ material_id: UUID, qty: 1 }],
    })
    expect(p.production_order_id).toBe(UUID)
  })

  it('xuất thường ngày không cần LSX', () => {
    const p = issueDocSchema.parse({ kind: 'daily', lines: [{ material_id: UUID, qty: 2 }] })
    expect(p.kind).toBe('daily')
  })
})
