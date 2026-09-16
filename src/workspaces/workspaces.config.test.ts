import { describe, expect, it } from 'vitest'
import { SHARED_SECTION, WORKSPACES } from './workspaces.config'

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
  { cu: '/planning/hang-sap-ve', nhan: 'Hàng sắp về', moi: '/mua-hang/nhan-hang', vi_sao: 'Nhận hàng — trục là thời gian' }, // prettier-ignore
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

  it('còn lối về khu cũ trong lúc chuyển', () => {
    expect(supplyHrefs).toContain('/planning')
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
