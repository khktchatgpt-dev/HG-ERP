import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { balanceRepo, type BalanceQuery } from './balance.repo'
import { bucketBalance, summarise, type BalanceBuckets } from './balance.calc'
import { isSupplyStaff } from './suppliers.service'

/**
 * SỔ CÂN ĐỐI VẬT TƯ — nghiệp vụ + quyền.
 *
 * Câu hỏi màn này trả lời: **hôm nay phải mua gì, cho lệnh nào, trước ngày
 * nào.** Đây là màn đầu tiên trong hệ thống trả lời một câu hỏi thay vì bày
 * một bảng dữ liệu (docs/cung-ung-redesign.md, đợt 0 và 3).
 *
 * QUYỀN XEM RỘNG có chủ ý: Cung ứng, Giám đốc, quản lý và admin đều đọc được.
 * Con số "còn thiếu bao nhiêu" là thứ Giám đốc cần khi duyệt chi và Kế hoạch
 * cần khi xếp lệnh — khoá riêng cho Cung ứng thì họ lại đi hỏi miệng, đúng cái
 * đang muốn bỏ.
 */

export type BalanceView = {
  buckets: BalanceBuckets
  summary: ReturnType<typeof summarise>
  total: number
  /** Ngày tính, đã chốt Ở SERVER — xem ghi chú bên dưới. */
  today: string
}

async function assertCanRead(user: User) {
  const ok =
    user.role === 'admin' || user.role === 'manager' || (await isSupplyStaff(user))
  if (!ok) throw Forbidden('Bạn không có quyền xem sổ cân đối vật tư')
}

export const balanceService = {
  /**
   * Sổ cân đối đã chia rổ theo mức gấp.
   *
   * `today` chốt ở SERVER và truyền xuống client, không để mỗi bên tự đọc đồng
   * hồ: quanh nửa đêm server và trình duyệt lệch ngày thì một dòng sẽ nhảy
   * giữa rổ "trễ" và rổ "hôm nay" tuỳ chỗ render — và người dùng không hiểu
   * vì sao làm mới trang lại ra khác.
   */
  async view(user: User, q: BalanceQuery = {}): Promise<BalanceView> {
    await assertCanRead(user)
    const today = new Date().toISOString().slice(0, 10)
    const { rows, total } = await balanceRepo.list(q)
    return {
      buckets: bucketBalance(rows, today),
      summary: summarise(rows, today),
      total,
      today,
    }
  },

  /** Nhu cầu của một mã, tách theo lệnh — dữ liệu cho hộp thoại đề nghị mua. */
  async demand(user: User, materialCode: string) {
    await assertCanRead(user)
    return balanceRepo.demandByMaterial(materialCode)
  },

  /**
   * Số mã đang thiếu — cho badge trên nav.
   *
   * Đếm bằng ĐÚNG hàm mà màn dùng (`summarise`), không đếm riêng một đường:
   * badge nói 5 mà mở ra thấy 7 là hỏng niềm tin vào cả sidebar. Nguyên tắc
   * này đã ghi ở `nav-badges.ts` và giữ nguyên ở đây.
   */
  async countShort(user: User): Promise<number> {
    await assertCanRead(user)
    const { rows } = await balanceRepo.list({ short_only: true, page_size: 1000 })
    return summarise(rows, new Date().toISOString().slice(0, 10)).total
  },
}
