import { describe, expect, it } from 'vitest'
import { PO_STATUSES } from '@/lib/po-status'
import { actionsFor, bulkActionsFor } from './actions'

const own = { own: true, approve: false }
const boss = { own: true, approve: true, privileged: true }
const other = { own: false, approve: false }

describe('actionsFor — mỗi bước đúng một nút chính, luôn có đường mở đơn', () => {
  for (const s of PO_STATUSES) {
    it(`bước ${s}`, () => {
      const acts = actionsFor(s, boss)
      expect(acts.filter((a) => a.primary)).toHaveLength(1)
      expect(acts.some((a) => a.id === 'open' || a.id === 'edit')).toBe(true)
      // Nút chính đứng đầu — người dùng học vị trí.
      expect(acts[0].primary).toBe(true)
    })
  }
})

describe('khoá kèm lý do, không giấu', () => {
  it('không phải người phụ trách thì nút vẫn CÓ, chỉ bị khoá', () => {
    const acts = actionsFor('draft', other)
    const submit = acts.find((a) => a.id === 'submit')!
    expect(submit.blocked).toMatch(/người khác phụ trách/)
    expect(acts.find((a) => a.id === 'delete')!.blocked).toBeTruthy()
  })

  it('không có quyền duyệt thì Duyệt và Từ chối bị khoá, Rút về nháp thì không', () => {
    const acts = actionsFor('pending_approval', own)
    expect(acts.find((a) => a.id === 'approve')!.blocked).toMatch(/quyền duyệt/)
    expect(acts.find((a) => a.id === 'reject')!.blocked).toMatch(/quyền duyệt/)
    expect(acts.find((a) => a.id === 'withdraw')!.blocked).toBeUndefined()
  })
})

describe('lỗ hổng màn cũ được lấp', () => {
  it('Rút về nháp có mặt ở bước chờ duyệt và gọi đúng route withdraw', () => {
    const w = actionsFor('pending_approval', own).find((a) => a.id === 'withdraw')!
    expect(w.build!({ id: 'p', reason: '', date: '' })).toEqual([
      { path: '/api/dept/supply/pos/p/withdraw', method: 'POST' },
    ])
  })

  /**
   * `closeShort` đẩy người dùng sang "Huỷ đơn" bằng câu lỗi. Nút đó phải có
   * thật ở đúng những bước mà service `cancel` nhận, không thì câu lỗi kia trỏ
   * vào chỗ trống.
   */
  it('Huỷ đơn có mặt ở mọi bước service cancel nhận, kèm lý do và đúng route', () => {
    for (const s of [
      'pending_approval',
      'approved',
      'ordered',
      'confirmed',
      'in_transit',
      'partial',
    ] as const) {
      // prettier-ignore
      const c = actionsFor(s, own).find((a) => a.id === 'cancel')
      expect(c, `bước ${s} phải có nút Huỷ đơn`).toBeTruthy()
      expect(c!.blocked, `bước ${s} không được khoá với người phụ trách`).toBeUndefined()
      expect(c!.needReason).toBe(true)
      expect(c!.danger).toBe(true)
      expect(c!.build!({ id: 'p', reason: 'NCC hết hàng', date: '' })).toEqual([
        { path: '/api/dept/supply/pos/p/cancel', method: 'POST', body: { reason: 'NCC hết hàng' } }, // prettier-ignore
      ])
    }
  })

  it('nháp thì nút Huỷ có mặt nhưng KHOÁ — nháp là xoá hẳn, không huỷ', () => {
    const c = actionsFor('draft', own).find((a) => a.id === 'cancel')!
    expect(c.blocked).toMatch(/xoá hẳn/)
    // Và nút đúng cho bước đó thì mở.
    expect(
      actionsFor('draft', own).find((a) => a.id === 'delete')!.blocked,
    ).toBeUndefined()
  })

  it('đơn đã đóng thì không còn nút Huỷ — service cũng chặn', () => {
    for (const s of ['received', 'cancelled'] as const) {
      expect(actionsFor(s, own).some((a) => a.id === 'cancel')).toBe(false)
    }
  })

  it('không phải người phụ trách thì Huỷ bị khoá, không bị giấu', () => {
    const c = actionsFor('ordered', other).find((a) => a.id === 'cancel')!
    expect(c.blocked).toMatch(/người khác phụ trách/)
  })

  /**
   * Chữ trên phiếu (điều khoản, số HĐ, người ký, ghi chú) sửa được cả sau khi
   * duyệt — đúng phạm vi `posService.updateTerms` mở. Không có nút này thì
   * người mua phải huỷ đơn tạo lại chỉ vì NCC đổi nơi giao.
   */
  it('Sửa điều khoản có mặt ở mọi bước service updateTerms nhận', () => {
    for (const s of [
      'pending_approval',
      'approved',
      'ordered',
      'confirmed',
      'in_transit',
      'partial',
      'received',
    ] as const) {
      // prettier-ignore
      const a = actionsFor(s, own).find((x) => x.id === 'edit_terms')
      expect(a, `bước ${s} phải có nút Sửa điều khoản`).toBeTruthy()
      expect(a!.blocked, `bước ${s} không được khoá với người phụ trách`).toBeUndefined()
      // Không gọi route nào ngay — nó bật chế độ sửa hẹp tại màn.
      expect(a!.build).toBeUndefined()
    }
  })

  it('nháp thì Sửa điều khoản KHOÁ và chỉ sang "Sửa đơn"', () => {
    const a = actionsFor('draft', own).find((x) => x.id === 'edit_terms')!
    expect(a.blocked).toMatch(/Sửa đơn/)
    expect(actionsFor('draft', own).find((x) => x.id === 'edit')!.blocked).toBeUndefined()
  })

  it('đơn đã huỷ thì không sửa điều khoản — service cũng chặn', () => {
    expect(actionsFor('cancelled', own).some((a) => a.id === 'edit_terms')).toBe(false)
  })

  it('Nhân bản có mặt ở nháp, đã duyệt, đang về, đã đóng', () => {
    for (const s of ['draft', 'approved', 'ordered', 'received', 'cancelled'] as const) {
      expect(actionsFor(s, own).some((a) => a.id === 'duplicate')).toBe(true)
    }
  })
})

describe('route — không mở đường ghi mới', () => {
  it('mọi route đều thuộc tập màn chi tiết đang dùng', () => {
    const allowed = new Set([
      '/api/doc-notes',
      '/api/dept/supply/pos/p',
      '/api/dept/supply/pos/p/submit',
      '/api/dept/supply/pos/p/withdraw',
      '/api/dept/supply/pos/p/decide',
      '/api/dept/supply/pos/p/advance',
      '/api/dept/supply/pos/p/reschedule',
      // Màn cũ gọi ở `PoDetailScreen.tsx:711` — không phải đường ghi mới.
      '/api/dept/supply/pos/p/cancel',
      // Đường MỚI 15/09/2026: hạ đơn đã gửi về nháp để sửa số nhập sai.
      '/api/dept/supply/pos/p/reopen',
      // Bàn giao (0128) — route màn chi tiết đã gọi từ lâu; 16/09/2026 đưa
      // lên danh sách để chuyển nhiều đơn một lượt thay vì mở từng trang.
      '/api/dept/supply/pos/p/reassign',
    ])
    for (const s of PO_STATUSES) {
      for (const a of actionsFor(s, boss)) {
        for (const c of a.build?.({ id: 'p', reason: 'r', date: '2026-09-20' }) ?? []) {
          expect(allowed.has(c.path)).toBe(true)
        }
      }
    }
  })

  it('từ chối gửi lý do; duyệt thì không', () => {
    const acts = actionsFor('pending_approval', boss)
    expect(acts.find((a) => a.id === 'reject')!.build!({ id: 'p', reason: 'thiếu giá', date: '' })[0].body) // prettier-ignore
      .toEqual({ decision: 'reject', reason: 'thiếu giá' })
    expect(acts.find((a) => a.id === 'approve')!.build!({ id: 'p', reason: '', date: '' })[0].body) // prettier-ignore
      .toEqual({ decision: 'approve' })
  })

  it('ghi việc đã giục: ghi chú trước, dời hẹn sau và chỉ khi có ngày', () => {
    const n = actionsFor('ordered', own).find((a) => a.id === 'nudge')!
    expect(n.build!({ id: 'p', reason: 'gọi rồi', date: '' }).map((c) => c.path)).toEqual(['/api/doc-notes']) // prettier-ignore
    expect(
      n.build!({ id: 'p', reason: 'gọi rồi', date: '2026-09-20' }).map((c) => c.path),
    ).toEqual([
      // prettier-ignore
      '/api/doc-notes',
      '/api/dept/supply/pos/p/reschedule',
    ])
  })

  it('đổi hẹn giao khoá đúng theo canReschedule', () => {
    expect(
      actionsFor('approved', own).find((a) => a.id === 'reschedule')!.blocked,
    ).toBeUndefined()
    // Đã nhận đủ / đã huỷ không có nút đổi hẹn (không xuất hiện) — kiểm gián tiếp:
    expect(actionsFor('received', own).some((a) => a.id === 'reschedule')).toBe(false)
  })
})

describe('hạ về nháp để sửa — đường sửa sai dữ liệu của đơn đã gửi', () => {
  const buoc = ['pending_approval', 'approved', 'ordered', 'confirmed', 'in_transit', 'partial'] as const // prettier-ignore

  it.each(buoc)('có mặt ở bước %s và gọi đúng route reopen', (s) => {
    const a = actionsFor(s, boss).find((x) => x.id === 'reopen')
    expect(a).toBeDefined()
    expect(a!.blocked).toBeUndefined()
    expect(a!.needReason).toBe(true)
    expect(a!.build?.({ id: 'p', reason: 'gõ nhầm SL', date: '' })).toEqual([
      { path: '/api/dept/supply/pos/p/reopen', method: 'POST', body: { reason: 'gõ nhầm SL' } }, // prettier-ignore
    ])
  })

  it('người thường thấy nút nhưng BỊ KHOÁ, kèm lý do — không giấu', () => {
    const a = actionsFor('ordered', own).find((x) => x.id === 'reopen')
    expect(a).toBeDefined()
    expect(a!.blocked).toMatch(/Giám đốc hoặc trưởng phòng/)
  })

  it('đơn đã có phiếu nhập kho thì khoá, nói rõ vì sao', () => {
    const a = actionsFor('partial', { ...boss, hasReceipts: true }).find((x) => x.id === 'reopen') // prettier-ignore
    expect(a!.blocked).toMatch(/phiếu nhập kho/)
  })

  it('không bày ở nháp, đã về đủ và đã huỷ — service cũng chặn ba chỗ đó', () => {
    for (const s of ['draft', 'received', 'cancelled'] as const) {
      expect(actionsFor(s, boss).some((x) => x.id === 'reopen')).toBe(false)
    }
  })

  it('là việc NẶNG và nói trước hậu quả mất dấu duyệt', () => {
    const a = actionsFor('ordered', boss).find((x) => x.id === 'reopen')!
    expect(a.stakes).toBe('nang')
    expect(a.consequence).toMatch(/duyệt lại/)
  })
})

/**
 * HÀNG LOẠT — bày ĐỦ việc, mỗi việc tự nói vướng gì.
 *
 * Bản cũ (`bulkActionFor`) trả đúng MỘT hành động và chỉ trả khi mọi đơn cùng
 * bước; chọn lẫn bước thì thanh nói "không cùng một bước" rồi thôi, người dùng
 * không biết mình vừa mất gì. Cặp test này canh hành vi mới: danh sách đầy đủ,
 * lý do khoá ĐẾM ĐƯỢC, và bàn giao chạy được kể cả khi tập lẫn bước.
 */
describe('bulkActionsFor — bày đủ việc, khoá kèm lý do đếm được', () => {
  const boss2 = { approve: true, reassign: true }

  it('không chọn gì thì không có việc nào', () => {
    expect(bulkActionsFor([], boss2)).toEqual([])
  })

  it('cùng bước nháp, đều của mình → Gửi duyệt mở', () => {
    const r = bulkActionsFor([{ status: 'draft', own: true }, { status: 'draft', own: true }], { approve: false }) // prettier-ignore
    const submit = r.find((x) => x.action.id === 'submit')
    expect(submit).toBeTruthy()
    expect(submit!.blocked).toBeUndefined()
  })

  it('có một đơn của người khác → khoá kèm lý do, nút vẫn có mặt', () => {
    const r = bulkActionsFor([{ status: 'draft', own: true }, { status: 'draft', own: false }], { approve: false }) // prettier-ignore
    const submit = r.find((x) => x.action.id === 'submit')!
    expect(submit.blocked).toMatch(/người khác phụ trách/)
  })

  it('lẫn bước: việc riêng của một bước bị khoá, lý do ĐẾM được và kể tên bước', () => {
    const r = bulkActionsFor([{ status: 'draft', own: true }, { status: 'approved', own: true }], boss2) // prettier-ignore
    const submit = r.find((x) => x.action.id === 'submit')!
    expect(submit.blocked).toMatch(/1\/2 đơn/)
    expect(submit.blocked).toMatch(/2 bước/)
  })

  it('BÀN GIAO chạy được dù tập lẫn bước — giao việc không phụ thuộc đơn ở đâu', () => {
    const r = bulkActionsFor(
      [
        { status: 'draft', own: true },
        { status: 'approved', own: true },
        { status: 'ordered', own: true },
      ],
      boss2,
    )
    const re = r.find((x) => x.action.id === 'reassign')!
    expect(re.blocked).toBeUndefined()
  })

  it('không có quyền bàn giao → nút vẫn có mặt, khoá kèm lý do', () => {
    const r = bulkActionsFor([{ status: 'draft', own: true }], { approve: false })
    const re = r.find((x) => x.action.id === 'reassign')!
    expect(re.blocked).toMatch(/trưởng phòng Cung ứng/)
  })

  it('chờ duyệt mà không có quyền duyệt → Duyệt bị khoá vì quyền', () => {
    const r = bulkActionsFor([{ status: 'pending_approval', own: true }], { approve: false }) // prettier-ignore
    const ap = r.find((x) => x.action.id === 'approve')
    if (ap) expect(ap.blocked).toMatch(/quyền duyệt/)
  })
})

/**
 * XOÁ ĐƠN — nút phải có mặt ở MỌI bước.
 *
 * Chủ dự án 17/09/2026: _"tôi chưa thấy tính năng xoá đơn khi tạo nhầm"_. Nút
 * có thật, nhưng chỉ tồn tại ở bước `draft` — tạo nhầm rồi lỡ gửi duyệt là đi
 * tìm không thấy gì. Cặp test này canh hai vế: nút luôn có mặt, và khi khoá thì
 * lý do phải CHỈ ĐƯỜNG đi tiếp chứ không chỉ nói "không được".
 */
describe('xoá đơn — nút luôn có mặt, khoá thì chỉ đường', () => {
  for (const s of PO_STATUSES) {
    it(`bước ${s} có nút Xoá nháp`, () => {
      expect(actionsFor(s, boss).some((a) => a.id === 'delete')).toBe(true)
    })
  }

  it('nháp của mình: xoá được thật', () => {
    const d = actionsFor('draft', own).find((a) => a.id === 'delete')!
    expect(d.blocked).toBeUndefined()
    expect(d.build!({ id: 'p', reason: '', date: '' })[0].method).toBe('DELETE')
  })

  it('đã gửi duyệt: khoá, và chỉ sang Rút về nháp', () => {
    const d = actionsFor('pending_approval', boss).find((a) => a.id === 'delete')!
    expect(d.blocked).toMatch(/Rút về nháp/)
  })

  it('đã duyệt / đang về: khoá, và chỉ sang Huỷ đơn', () => {
    for (const s of ['approved', 'ordered', 'in_transit', 'partial'] as const) {
      expect(actionsFor(s, boss).find((a) => a.id === 'delete')!.blocked).toMatch(/Huỷ đơn/) // prettier-ignore
    }
  })

  it('đã đóng sổ: khoá, nói thẳng là hết đường', () => {
    for (const s of ['received', 'cancelled'] as const) {
      expect(actionsFor(s, boss).find((a) => a.id === 'delete')!.blocked).toMatch(/đóng sổ/) // prettier-ignore
    }
  })

  it('CHỈ bước nháp mới thật sự xoá được — luật sổ, không phải luật giao diện', () => {
    const mo = PO_STATUSES.filter(
      (s) => !actionsFor(s, boss).find((a) => a.id === 'delete')!.blocked,
    )
    expect(mo).toEqual(['draft'])
  })
})

/**
 * TRẢ LẠI ĐỂ SỬA — không phải từ chối, và không được bày như việc nguy hiểm.
 *
 * `decide('reject')` đưa đơn về NHÁP, giữ số phiếu và lịch sử, người soạn sửa
 * rồi gửi lại. Đó là *Request change*, không phải đóng cửa. Bày nó bằng nút đỏ
 * "Từ chối" thì người duyệt ngần ngại bấm đúng cái nút họ nên bấm — và quay ra
 * ký bừa hoặc để phiếu nằm im, đúng thứ đang xảy ra với 15 đơn chờ 15 ngày.
 *
 * Test này canh cả hai vế: nhãn nói đúng việc, và mức độ không bị nâng lên
 * `nang`/`danger` khi ai đó sửa lại sau này.
 */
describe('trả lại để sửa — từ vựng và mức độ', () => {
  const r = () => actionsFor('pending_approval', boss).find((a) => a.id === 'reject')!

  it('nhãn nói đúng việc đã xảy ra', () => {
    expect(r().label).toBe('Trả lại để sửa')
    expect(r().done).toMatch(/trả lại/i)
  })

  it('KHÔNG phải việc nguy hiểm — đơn về nháp, không mất gì', () => {
    expect(r().danger).toBeFalsy()
    expect(r().stakes).not.toBe('nang')
  })

  it('hậu quả nói rõ đơn đi đâu, để người duyệt dám bấm', () => {
    expect(r().consequence).toMatch(/nháp/i)
    expect(r().consequence).toMatch(/gửi duyệt lại|giữ nguyên số/i)
  })

  it('mã gửi lên server VẪN là reject — đổi nhãn, không đổi sổ', () => {
    expect(r().build!({ id: 'p', reason: 'thiếu giá', date: '' })[0].body).toEqual({
      decision: 'reject',
      reason: 'thiếu giá',
    })
  })

  it('huỷ đơn thì vẫn là việc nguy hiểm — hai thứ khác nhau', () => {
    const c = actionsFor('ordered', boss).find((a) => a.id === 'cancel')!
    expect(c.danger).toBe(true)
    expect(c.stakes).toBe('nang')
  })
})

describe('gửi NCC đòi hẹn giao (17/09/2026)', () => {
  const approved = { own: true, approve: false }
  it('thiếu hẹn giao thì nút "Gửi nhà cung cấp" KHOÁ, lý do chỉ luôn cách gỡ', () => {
    const send = actionsFor('approved', { ...approved, noEta: true }).find(
      (a) => a.id === 'send',
    )!
    expect(send.blocked).toMatch(/Chưa có hẹn giao/)
    expect(send.blocked).toMatch(/Đổi hẹn giao/)
    // Nút gỡ phải có mặt ngay trong cùng bảng hành động, không thì lời khuyên
    // kia là lời khuyên suông.
    expect(
      actionsFor('approved', { ...approved, noEta: true }).some(
        (a) => a.id === 'reschedule',
      ),
    ).toBe(true)
  })
  it('có hẹn giao thì nút mở', () => {
    const send = actionsFor('approved', approved).find((a) => a.id === 'send')!
    expect(send.blocked).toBeUndefined()
  })
  it('không phải người phụ trách thì lý do đó ĐỨNG TRƯỚC — nói cái gần nhất', () => {
    const send = actionsFor('approved', { own: false, approve: false, noEta: true }).find(
      (a) => a.id === 'send',
    )!
    expect(send.blocked).toMatch(/người khác phụ trách/)
  })
})
