import { describe, expect, it } from 'vitest'
import {
  SHARED_SECTION,
  WORKSPACES,
  resolveNavSections,
  withNavBadges,
} from './workspaces.config'

/**
 * HÀNG RÀO CỦA CUỘC CHUYỂN NHÀ (dời từ `app/(mua-hang)/_shell/nav.test.ts`
 * ngày 16/09/2026, khi hai thanh điều hướng gộp về một).
 *
 * Sidebar phòng Cung ứng là thứ DUY NHẤT người mua nhìn thấy. Mất một mục là
 * mất một tính năng họ dùng hằng ngày — và mất IM LẶNG, vì không có lỗi nào
 * nổ ra: menu vẫn dựng, chỉ là thiếu một dòng.
 *
 * Bảng dưới liệt kê mọi mục của sidebar Cung ứng TRƯỚC khi chuyển, kèm chỗ đi
 * tới. Gỡ một màn mới mà quên đường thay thế thì test này đỏ.
 */
const CUA_CU: { cu: string; nhan: string; moi: string; vi_sao: string }[] = [
  { cu: '/planning', nhan: 'Tổng quan', moi: '/mua-hang', vi_sao: 'Bàn làm việc gộp 4 trang cũ (Tổng quan, Chờ tôi xử lý, Vấn đề, Họp)' }, // prettier-ignore
  { cu: '/planning/pos', nhan: 'Phiếu mua', moi: '/mua-hang/don', vi_sao: 'Đơn mua' },
  { cu: '/planning/materials', nhan: 'Vật tư & giá mua', moi: '/mua-hang/vat-tu', vi_sao: 'Danh mục Vật tư; phần giá tách sang Bảng giá' }, // prettier-ignore
  { cu: '/planning/suppliers', nhan: 'Nhà cung cấp', moi: '/mua-hang/ncc', vi_sao: 'Danh sách NCC kèm lịch sử mua' }, // prettier-ignore
  { cu: '/planning/stock', nhan: 'Kho & tồn', moi: '/mua-hang/ton', vi_sao: 'Tồn & cân đối — trục là vị thế, không phải tồn kho' }, // prettier-ignore
  { cu: '/planning/lsx', nhan: 'Vật tư theo lệnh', moi: '/mua-hang/yeu-cau', vi_sao: 'Yêu cầu mua — lệnh nào còn thiếu đồ' }, // prettier-ignore
  { cu: '/planning/viec-cua-toi', nhan: 'Chờ tôi xử lý', moi: '/mua-hang/hop-thu', vi_sao: 'Hộp thư việc' }, // prettier-ignore
  { cu: '/planning/hang-sap-ve', nhan: 'Hàng sắp về', moi: '/mua-hang/theo-doi', vi_sao: 'Theo dõi đơn hàng (01/10/2026) — trục là thời gian' }, // prettier-ignore
  { cu: '/planning/van-de', nhan: 'Vấn đề cần xử lý', moi: '/mua-hang', vi_sao: 'một khối của Bàn làm việc' }, // prettier-ignore
  { cu: '/planning/hop', nhan: 'Việc cần quyết định', moi: '/mua-hang', vi_sao: 'một khối của Bàn làm việc' }, // prettier-ignore
]

const supplyHrefs = WORKSPACES.planning.sections.flatMap((s) =>
  s.items.map((i) => i.href),
)

describe('sidebar Cung ứng giữ đủ tính năng sau khi gộp hai thanh điều hướng', () => {
  for (const m of CUA_CU) {
    it(`"${m.nhan}" còn đường vào — ${m.moi} (${m.vi_sao})`, () => {
      expect(supplyHrefs).toContain(m.moi)
    })
  }

  // Khu cũ `/planning/*` đã xoá hẳn 29/09/2026 — link cũ do proxy.ts chuyển hướng.
  it('không mục nào còn trỏ về khu cũ đã xoá', () => {
    expect(supplyHrefs.filter((h) => h.startsWith('/planning'))).toEqual([])
  })

  it('không mục nào trùng href', () => {
    expect(new Set(supplyHrefs).size).toBe(supplyHrefs.length)
  })

  /*
    Trang DÙNG CHUNG được vỏ cũ tự nối vào sidebar mọi phòng
    (`resolveNavSections`), nên KHÔNG được khai lại ở đây — khai lại là hiện
    hai lần. Test canh đúng chiều đó.
  */
  it('trang dùng chung không bị chép lại vào cây của phòng', () => {
    for (const i of SHARED_SECTION.items) expect(supplyHrefs).not.toContain(i.href)
  })

  it('cửa vào phòng là màn mới, không phải trang cũ', () => {
    expect(WORKSPACES.planning.home).toBe('/mua-hang')
  })
})

describe('mọi workspace bật sẵn đều có cây menu dùng được', () => {
  for (const ws of Object.values(WORKSPACES)) {
    if (!ws.ready) continue
    it(`${ws.label}: có mục, và mục nào cũng có nhãn + href`, () => {
      const items = ws.sections.flatMap((s) => s.items)
      expect(items.length).toBeGreaterThan(0)
      for (const i of items) {
        expect(i.label.trim().length, i.href).toBeGreaterThan(0)
        expect(i.href.startsWith('/'), i.href).toBe(true)
      }
    })
  }
})

/**
 * NHÓM VIỆC ĐỨNG ĐẦU MỌI KHU (B2, 05/11/2026) — menu phải nói "bạn có việc" ở
 * mọi phòng, không giấu cuối nhóm Dùng chung.
 */
describe('nhóm VIỆC đứng đầu sidebar mọi khu (B2)', () => {
  const ctx = (caps: string[]) => ({
    role: 'employee',
    isHead: false,
    capabilities: new Set(caps),
  })
  const ws = Object.values(WORKSPACES).filter((w) => w.ready)

  it('mọi workspace bật sẵn: section đầu tiên là "Việc" với "Việc của tôi"', () => {
    for (const w of ws) {
      const s = resolveNavSections(w, ctx([]))
      expect(s[0].heading, w.id).toBe('Việc')
      expect(
        s[0].items.map((i) => i.label),
        w.id,
      ).toEqual(['Việc của tôi'])
    }
  })

  it('"Việc tôi giao" chỉ hiện cho ai giao được việc (tasks.give)', () => {
    const s = resolveNavSections(WORKSPACES.planning, ctx(['tasks.give']))
    expect(s[0].items.map((i) => i.label)).toEqual(['Việc của tôi', 'Việc tôi giao'])
  })

  it('defaultTab = đúng tab trang mở khi URL không có muc (giao được → giao)', () => {
    const mot = resolveNavSections(WORKSPACES.sales, ctx([]))[0].items
    expect(mot.find((i) => i.defaultTab)?.href).toBe('/phan-cong-viec?muc=cua-toi')
    const hai = resolveNavSections(WORKSPACES.sales, ctx(['tasks.give']))[0].items
    expect(hai.find((i) => i.defaultTab)?.href).toBe('/phan-cong-viec?muc=giao')
    expect(hai.filter((i) => i.defaultTab)).toHaveLength(1)
  })

  it('"Phân công việc" không còn trong Dùng chung — một đích một dòng', () => {
    expect(SHARED_SECTION.items.some((i) => i.href.startsWith('/phan-cong-viec'))).toBe(
      false,
    )
  })

  it('withNavBadges nhận số kèm ghi chú; 0 thì không gắn gì', () => {
    const s = resolveNavSections(WORKSPACES.planning, ctx(['tasks.give']))
    const out = withNavBadges(s, {
      '/phan-cong-viec?muc=cua-toi': { n: 3, note: '1 trễ' },
      '/phan-cong-viec?muc=giao': { n: 0 },
      '/mua-hang/hop-thu': 34,
    })
    const viec = out[0].items
    expect(viec[0]).toMatchObject({ badge: 3, badgeNote: '1 trễ', urgent: true })
    expect(viec[1].badge).toBeUndefined()
    expect(
      out.flatMap((x) => x.items).find((i) => i.href === '/mua-hang/hop-thu')?.badge,
    ).toBe(34)
  })
})
