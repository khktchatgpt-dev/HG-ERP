'use client'

import { useState } from 'react'
import { WorkTile, WorkTiles, type Tone } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — WorkTiles / WorkTile (B7, 24/09/2026).
 *
 * Số trên ô lấy từ khuôn A (`/design-lab/mau-vao-viec`) — số mẫu, không phải
 * số đo. Ví dụ lọc tại chỗ đếm bằng CHÍNH mảng nó lọc, đúng luật lời hứa.
 */
type Don = { ma: string; nhom: 'nhap' | 'tre' | 'cho' }
const DON: Don[] = [
  { ma: 'PO-2609-014', nhom: 'nhap' },
  { ma: 'PO-2609-018', nhom: 'nhap' },
  { ma: 'PO-2608-088', nhom: 'tre' },
  { ma: 'PO-2608-097', nhom: 'tre' },
  { ma: 'PO-2608-101', nhom: 'tre' },
  { ma: 'PO-2609-021', nhom: 'cho' },
]

type O = { label: string; count: number; hint: string; tone?: Tone; strong?: boolean }

const O_LOC: (Omit<O, 'count'> & { nhom: Don['nhom'] })[] = [
  { nhom: 'nhap', strong: true, label: 'Chờ tôi soạn xong', hint: 'Đơn nháp tôi phụ trách, chưa gửi duyệt' }, // prettier-ignore
  { nhom: 'tre', tone: 'stop', label: 'NCC trễ hẹn', hint: 'Đã gửi NCC, quá hạn giao, chưa nhận đủ' }, // prettier-ignore
  { nhom: 'cho', tone: 'warn', label: 'Chờ Giám đốc ký', hint: 'Tôi gửi, đang nằm ở bàn duyệt' }, // prettier-ignore
]

const O_DAN: O[] = [
  { strong: true, label: 'Chờ tôi soạn xong', count: 4, hint: 'Đơn nháp tôi phụ trách, chưa gửi duyệt' }, // prettier-ignore
  { tone: 'stop', label: 'NCC trễ hẹn', count: 3, hint: 'Đã gửi NCC, quá hạn giao, chưa nhận đủ' }, // prettier-ignore
  { tone: 'warn', label: 'Chờ Giám đốc ký', count: 2, hint: 'Tôi gửi, đang nằm ở bàn duyệt' }, // prettier-ignore
  { label: 'Lệnh thiếu vật tư', count: 7, hint: 'LSX đang mở mà còn mã chưa có đơn mua' }, // prettier-ignore
  { tone: 'warn', label: 'Kho chờ tôi xác nhận', count: 1, hint: 'Phiếu nhập lệch so với đơn' }, // prettier-ignore
  { tone: 'stop', label: 'Hàng về hôm nay', count: 0, hint: 'Đợt giao hẹn đúng ngày 10/09' }, // prettier-ignore
]

function LocTaiCho() {
  const [loc, setLoc] = useState<Don['nhom'] | null>(null)
  const hien = loc ? DON.filter((d) => d.nhom === loc) : DON
  return (
    <div className="grid gap-2">
      <WorkTiles>
        {O_LOC.map((o) => (
          <WorkTile
            key={o.nhom}
            {...o}
            count={DON.filter((d) => d.nhom === o.nhom).length}
            onClick={() => setLoc((c) => (c === o.nhom ? null : o.nhom))}
            on={loc === o.nhom}
          />
        ))}
      </WorkTiles>
      <p className="text-k-sm text-[var(--ink-2)]">
        {loc ? 'Đang lọc' : 'Chưa lọc'} — <b className="num">{hien.length}</b> đơn:{' '}
        <span className="num">{hien.map((d) => d.ma).join(' · ')}</span>
      </p>
    </div>
  )
}

export default function DocWorkTiles() {
  return (
    <CompDoc
      family="work-tiles"
      summary={
        <>
          Ô việc của trang “Vào việc” (khuôn A), mẫu Fiori launchpad. Mỗi ô là{' '}
          <b>cửa vào việc</b>, không phải chỉ số: con số là lời hứa — bấm vào phải ra đúng
          chừng ấy dòng. Hết việc thì ô hiện ✓ thay cho số 0.
        </>
      }
      useWhen="trang đầu tiên người dùng mở mỗi sáng, trả lời “hôm nay tôi phải làm gì” bằng vài con số việc, mỗi số dẫn vào đúng danh sách đã lọc."
      avoidWhen={
        <>
          cần bày hiệu suất có mẫu số của một đối tượng (dùng <code>MetricStrip</code> ở
          hồ sơ khuôn E), hoặc lọc trong một bảng đã mở (dùng <code>Chip</code>).
        </>
      }
      variants={[
        {
          name: 'Dẫn đi — href',
          when: 'mỗi ô là một liên kết tới danh sách đã lọc sẵn. Ô của chính người xem để strong; ô hết việc hiện ✓.',
          demo: (
            <WorkTiles>
              {O_DAN.map((o) => (
                <WorkTile key={o.label} {...o} href="#" />
              ))}
            </WorkTiles>
          ),
        },
        {
          name: 'Lọc tại chỗ — onClick + on',
          when: 'bàn làm việc: bấm ô lọc bảng ngay dưới, bấm lại để bỏ lọc. Số trên ô đếm bằng chính phép lọc.',
          demo: <LocTaiCho />,
        },
      ]}
      states={[
        {
          state: 'Có việc',
          looks:
            'Số lớn đơn cách; màu theo tone (stop, warn, done), không tone thì màu mực.',
          behaves: 'href → thẻ <a>; không href → <button> gọi onClick.',
        },
        {
          state: 'Hết việc (count = 0)',
          looks:
            'Dấu ✓ màu done thay cho số; tone bị bỏ qua (ví dụ “Hàng về hôm nay” khai stop vẫn trung tính).',
          behaves: 'Vẫn bấm được như ô thường.',
        },
        {
          state: 'strong',
          looks: 'Viền + nền nhạt màu hành động.',
          behaves: 'Không đổi hành vi — chỉ để ô của chính người xem nổi hơn.',
        },
        {
          state: 'Đang là bộ lọc (on)',
          looks: 'Thêm vòng 1px màu hành động.',
          behaves:
            'aria-pressed = true. Chỉ có nghĩa khi dùng onClick; ô href không mang aria-pressed.',
        },
        {
          state: 'Rê chuột',
          looks: 'Ô thường: viền đậm lên. Ô strong không đổi.',
          behaves: '—',
        },
      ]}
      a11y={{
        role: 'link (có href) · button + aria-pressed (có onClick)',
        keys: [
          { key: 'Tab', does: 'Đi qua từng ô theo thứ tự lưới.' },
          {
            key: 'Enter',
            does: 'Mở liên kết / bật-tắt lọc. Space chỉ chạy trên ô dạng nút.',
          },
        ],
        reader: (
          <>
            Tên ô là nhãn + số + gợi ý đọc liền, ví dụ “Chờ Giám đốc ký 2 Tôi gửi, đang
            nằm ở bàn duyệt”. <b>Ba chỗ chưa tốt, ghi thật:</b> ô hết việc đọc ra ký tự ✓
            — câu “Không còn việc nào” chỉ nằm trong <code>title</code> của thẻ con nên
            không vào tên ô; mức gấp (stop/warn) chỉ nói bằng màu; và nếu truyền cả{' '}
            <code>href</code> lẫn <code>onClick</code> thì <code>onClick</code> bị bỏ im
            lặng.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Đếm số trên ô bằng ĐÚNG hàm trang đích dùng để lọc.',
          dont: 'Ô đếm một đằng, danh sách ra một nẻo — sai một dòng là người dùng quay lại mở từng danh sách tự lọc.',
          source: 'CLAUDE.md — nguyên tắc 3; kit/Shell.tsx chú thích WorkTile',
        },
        {
          do: 'Hết việc thì để kit hiện ✓ và về màu trung tính.',
          dont: 'Tô đỏ “Đơn quá hạn: 0” — tin mừng mà làm người ta hoảng.',
          source: 'kit/Shell.tsx — chú thích WorkTile, đo trên ảnh 09/09/2026',
        },
        {
          do: 'Trên bàn làm việc, cho ô lọc tại chỗ (onClick).',
          dont: 'Cho mọi ô bắn sang trang khác — mất bộ lọc, mất chỗ đứng, bàn làm việc thành bệ phóng.',
          source: 'kit/Shell.tsx — JSDoc href: trước 11/09/2026 href là bắt buộc',
        },
        {
          do: 'Nhãn nói việc phải làm: “Chờ Giám đốc ký”.',
          dont: 'Nhãn là tên trạng thái trong DB: “pending_approval”.',
          source: 'kit/Shell.tsx — chú thích WorkTile, điều 3',
        },
      ]}
      tested={{
        missing:
          'chưa có test riêng. Chỉ được dựng gián tiếp khi kit-docs.test.tsx chạy axe trên trang này — chưa ca nào kiểm aria-pressed hay việc số 0 thành ✓.',
      }}
    />
  )
}
