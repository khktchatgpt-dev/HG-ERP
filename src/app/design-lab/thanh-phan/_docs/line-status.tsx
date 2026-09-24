'use client'

import { LineStatus } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — trạng thái MỘT DÒNG chứng từ (B7, 24/09/2026).
 *
 * Ví dụ thứ hai lấy nguyên bảng ánh xạ của màn đối chiếu hoá đơn NCC
 * (`DoiChieuTable.tsx`): năm kết luận dồn vào bốn `kind`, nên hai kết luận khác
 * nhau mang cùng một màu — chữ mới là thứ phân biệt.
 */
export default function DocLineStatus() {
  return (
    <CompDoc
      family="line-status"
      summary={
        <>
          Viên trạng thái của <b>một dòng</b> chứng từ — khác trạng thái của cả chứng từ.
          Bốn <code>kind</code> là bốn màu; chữ bên trong do chỗ gọi viết và phải tự đủ
          nghĩa.
        </>
      }
      useWhen="cột cuối lưới dòng cần nói dòng đó đang ở đâu: chưa nhận, một phần, đủ, đóng thiếu — hay khớp/lệch khi đối chiếu."
      avoidWhen={
        <>
          trạng thái của cả chứng từ (dùng <code>StatusTrack</code> / <code>Tag</code> ở
          đầu trang), hoặc khi cần bấm — viên này không phải nút.
        </>
      }
      variants={[
        {
          name: 'Bốn tình trạng nhận hàng',
          when: 'dòng đơn mua trên màn chứng từ. Chưa nhận là xám, không phải đỏ — chưa tới hẹn thì chưa có gì xấu.',
          demo: (
            <div className="flex flex-wrap gap-2">
              <LineStatus kind="idle">Chưa nhận</LineStatus>
              <LineStatus kind="part">Một phần</LineStatus>
              <LineStatus kind="done">Đủ</LineStatus>
              <LineStatus kind="short">Đóng thiếu</LineStatus>
            </div>
          ),
        },
        {
          name: 'Đối chiếu ba chiều — nhiều kết luận, bốn màu',
          when: '"NCC đòi trước" và "Lệch giá" cùng kind short. Màu chỉ xếp nhóm; chữ nói chuyện gì.',
          demo: (
            <div className="flex flex-wrap gap-2">
              <LineStatus kind="done">Khớp</LineStatus>
              <LineStatus kind="part">Chờ hoá đơn</LineStatus>
              <LineStatus kind="short">NCC đòi trước</LineStatus>
              <LineStatus kind="short">Lệch giá</LineStatus>
              <LineStatus kind="idle">Chưa phát sinh</LineStatus>
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'idle',
          looks: 'Viên bo tròn, nền xám nhạt, chữ phụ.',
          behaves: 'Tĩnh.',
        },
        {
          state: 'part',
          looks: 'Nền cam nhạt, chữ cam (--warn).',
          behaves: 'Tĩnh.',
        },
        {
          state: 'done',
          looks: 'Nền lục nhạt, chữ lục (--done).',
          behaves: 'Tĩnh.',
        },
        {
          state: 'short',
          looks: 'Nền đỏ nhạt, chữ đỏ (--stop).',
          behaves: 'Tĩnh. Chữ không bao giờ xuống dòng (nowrap) — chữ dài thì nới cột.',
        },
      ]}
      a11y={{
        role: '(không có — span chữ thường)',
        keys: [{ key: '—', does: 'Không nhận tiêu điểm, không nhận phím.' }],
        reader: (
          <>
            Đọc đúng chữ bên trong, như chữ thường trong ô bảng. Màu không đến tai người
            nghe, nên <code>kind</code> không được mang nghĩa mà chữ không nói: viết
            &quot;Đóng thiếu&quot;, đừng viết &quot;Trạng thái&quot; rồi để màu đỏ tự nói.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Chưa tới lượt thì để idle (xám): "Chưa nhận", "Chưa phát sinh".',
          dont: 'Tô đỏ một dòng chỉ vì số đã nhận còn là 0.',
          source:
            'CLAUDE.md, nguyên tắc 3 — "Số 0 không phải lúc nào cũng xấu, đừng tô đỏ"',
        },
        {
          do: 'Viết chữ riêng cho từng kết luận, kể cả khi hai kết luận chung một kind.',
          dont: 'Viết chữ theo kind ("Lỗi") — người đọc mất cách phân biệt đòi trước với lệch giá.',
          source: 'DoiChieuTable.tsx, bảng VERDICT_KIND: năm kết luận vào bốn kind',
        },
        {
          do: 'Viên chỉ mã hoá vòng đời của DÒNG; việc bấm để ở nút riêng trong ô kế bên.',
          dont: 'Biến viên màu vòng đời thành nút bấm.',
          source:
            'CLAUDE.md, nguyên tắc 5 — --stop --warn --done không bao giờ lên nút; NhanHangPanel.tsx đặt nút chốt thiếu ở cột riêng',
        },
      ]}
      tested={{
        missing:
          'chưa có test riêng; lớp axe duy nhất là kit-docs.test.tsx chạy trên chính các ví dụ của trang này.',
      }}
    />
  )
}
