import { execService } from '@/modules/core/exec/exec.service'
import type { User } from '@/modules/core/users/users.repo'
import type { ApprovalNav } from '../approval-types'

/**
 * BỐI CẢNH ĐI TUYẾN TÍNH cho màn thẩm định một phiếu.
 *
 * Giám đốc mở phiếu ra không phải để xem một tờ giấy — họ đang đi hết một
 * chồng 15 tờ. Màn cũ ký xong đá về danh sách, và người ký phải tìm lại chỗ
 * mình dừng; với 15 phiếu đó là 15 lần quay đầu. Tiêu chí 9 của
 * `docs/tieu-chi-man-chung-tu-erp.md` gọi đúng tên thứ còn thiếu: điều hướng
 * bản ghi ‹n/N›.
 *
 * ĐỌC LẠI `signBox` thay vì truyền danh sách qua URL: hộp phiếu đổi liên tục
 * (người khác ký, Cung ứng rút đơn về nháp), nên thứ tự phải tính từ trạng
 * thái HIỆN TẠI của sổ. Một link cũ trỏ vào phiếu đã ký thì `loadPending*`
 * trả null và trang gọi `notFound()` — đúng, không phải lỗi.
 *
 * Phiếu KHÔNG còn trong hộp (vừa bị ai ký xong) thì trả `index: 0` và hai
 * đường đi đều null: màn vẫn đọc được, chỉ không đi tiếp được.
 */
export async function loadApprovalNav(
  user: User,
  kind: 'lsx' | 'po' | 'quote',
  id: string,
  lsxCode?: string | null,
): Promise<ApprovalNav> {
  const box = await execService.signBox(user)
  const items = box.items
  const at = items.findIndex((i) => i.kind === kind && i.id === id)

  const href = (n: number) => {
    const it = items[n]
    return it ? `/exec/approvals/${it.kind}/${it.id}` : null
  }

  /*
    ĐƠN CÙNG LỆNH cũng đang chờ chữ ký — đếm CẢ phiếu đang xem.

    Câu này trả lời một điều người ký hay hỏi mà màn cũ im lặng: ký tờ này rồi
    thì lệnh đó xong chưa, hay còn hai tờ nữa nằm đâu đó trong chồng. Chỉ đếm
    được khi phiếu thuộc một lệnh; đơn ngoài lệnh thì trả 0.

    SO KHỚP CẢ CHUỖI, không dùng `includes` trên từng ký tự: `exec.service` dựng
    fact là đúng `lệnh <mã>`, mà mã lệnh ở đây có dạng "01/26-27 - MX" nên một
    mã hoàn toàn có thể là tiền tố của mã khác ("1/26-27" nằm trong "11/26-27").
    Đếm dôi ra thì con số này nói dối, và nó nằm ngay cạnh nút ký.
  */
  const sameLsxPending = lsxCode
    ? items.filter((i) => i.kind === 'po' && i.facts.includes(`lệnh ${lsxCode}`)).length
    : 0

  return {
    index: at < 0 ? 0 : at + 1,
    total: items.length,
    prevHref: at > 0 ? href(at - 1) : null,
    nextHref: at >= 0 && at < items.length - 1 ? href(at + 1) : null,
    sameLsxPending,
  }
}
