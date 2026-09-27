'use client'

import { Btn, DocStatus } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `DocStatus` — thanh trạng thái một dòng (27/09/2026).
 *
 * Thay ba thứ trên màn chứng từ: dải bước `StatusTrack`, dải `HolderBar`, và
 * nút chuyển bước ở thanh hành động. Chủ dự án chốt "1 trạng thái là đủ" trên
 * canvas "Đơn mua" — vòng đời đầy đủ gấp vào khung nổi.
 */
const MARKS = [
  {
    key: 'duyet',
    at: '2026-09-23T08:00:00+07:00',
    label: 'Giám đốc duyệt',
    actor: 'Vũ Phương Thảo',
    tone: 'done' as const,
  },
  { key: 'gui', at: '2026-09-23T08:05:00+07:00', label: 'Gửi NCC (trên giấy)' },
  { key: 'xn', at: null, label: 'NCC xác nhận' },
  { key: 'nhan', at: null, label: 'Nhận hàng' },
]

export default function DocDocStatus() {
  return (
    <CompDoc
      family="doc-status"
      summary={
        <>
          Một dòng trả lời <b>chứng từ đang ở đâu</b>, <b>ai đang giữ</b> và{' '}
          <b>đi tiếp thế nào</b>: chữ trạng thái (bấm để xem vòng đời), người giữ kèm số
          ngày, nút bước kế tiếp và menu các chuyển trạng thái khác.
        </>
      }
      useWhen="đầu màn chứng từ có vòng đời (đơn mua, lệnh, phiếu) — ngay dưới dòng tên chứng từ, trên menu nội dung."
      avoidWhen={
        <>
          hồ sơ danh mục (NCC, vật tư) — không có vòng đời thì đừng bịa trạng thái; và màn
          soạn nhiều dòng (khuôn F) — ở đó thanh chốt đáy <code>CommitBar</code> mới là
          chỗ nói vì sao chưa lưu được.
        </>
      }
      variants={[
        {
          name: 'Đang chờ người khác, có bước kế tiếp',
          when: 'đơn đã gửi NCC: nút chính là bước kế, các chuyển khác trong menu — mục không làm được kèm lý do.',
          demo: (
            <DocStatus
              status="Đã gửi NCC"
              icon="gui"
              marks={MARKS}
              holder={{ who: 'Nhà cung cấp', what: 'xác nhận đã nhận đơn', days: 4 }}
              next={
                <Btn primary icon="xong">
                  NCC xác nhận
                </Btn>
              }
              moves={[
                { label: 'Hàng đang trên đường', group: 'Đi tiếp' },
                {
                  label: 'Đã nhận hàng',
                  group: 'Đi tiếp',
                  why: 'Kho ghi phiếu nhập — trạng thái tự đổi khi Kho nhận.',
                },
                { label: 'Mở lại để sửa (phải duyệt lại)', group: 'Quay lại' },
                { label: 'Huỷ đơn…', group: 'Dừng', danger: true },
              ]}
            />
          ),
        },
        {
          name: 'Bước kế tiếp thuộc quyền người khác',
          when: 'người soạn xem đơn chờ duyệt: nút Duyệt khoá mềm, nói ai giữ quyền.',
          demo: (
            <DocStatus
              status="Chờ duyệt"
              icon="cho"
              tone="warn"
              holder={{ who: 'Vũ Phương Thảo (Giám đốc)', what: 'duyệt đơn', days: 1 }}
              next={
                <Btn primary icon="duyet" blockedBy="Giám đốc">
                  Duyệt
                </Btn>
              }
              moves={[{ label: 'Rút về nháp để sửa', group: 'Quay lại' }]}
            />
          ),
        },
        {
          name: 'Đã khép',
          when: 'đơn đã nhận đủ: không người giữ, không nút chính — chỉ còn trạng thái.',
          demo: <DocStatus status="Đã nhận đủ" icon="nhapKho" tone="done" />,
        },
      ]}
      states={[
        {
          state: 'Có mốc vòng đời',
          looks: 'Viên trạng thái có dấu ▾; rê chuột viền đổi màu hành động.',
          behaves:
            'Bấm mở khung nổi (Popover của kit) với Timeline đầy đủ; Esc đóng, tiêu điểm về viên.',
        },
        {
          state: 'Không có mốc',
          looks: 'Viên không dấu ▾, không đổi viền khi rê.',
          behaves: 'Là nút bị tắt — không giả làm thứ bấm được.',
        },
        {
          state: 'Tuổi bước',
          looks:
            'Số ngày trong viên nhỏ: dưới 3 ngày xám, 3–6 vàng (--warn), từ 7 đỏ (--stop).',
          behaves:
            'Cùng ngưỡng HOLD_AGE_DAYS với HolderBar. Chỗ gọi tính sẵn days bằng daysHeld.',
        },
        {
          state: 'Hẹp (dưới ~900px)',
          looks: 'Cụm nút xuống dòng dưới, trạng thái và người giữ vẫn ở dòng đầu.',
          behaves: 'flex-wrap — không cắt chữ người giữ.',
        },
      ]}
      a11y={{
        role: 'group "Trạng thái và chuyển bước"; người giữ là role="status"; khung vòng đời là dialog có tên',
        keys: [
          { key: 'Tab', does: 'Viên trạng thái → nút bước kế → menu chuyển trạng thái.' },
          {
            key: 'Enter / Space',
            does: 'Trên viên: mở khung vòng đời. Trên menu: mở danh sách chuyển.',
          },
          { key: 'Esc', does: 'Đóng khung / menu, tiêu điểm về nút đã mở.' },
        ],
        reader: (
          <>
            Viên đọc “Trạng thái: Đã gửi NCC — xem vòng đời”. Người giữ là vùng{' '}
            <code>status</code> nên đổi người giữ ngay trên màn thì trình đọc báo. Mục
            chuyển không làm được đọc tên là nhãn, lý do là mô tả (luật của{' '}
            <code>Menu</code>). <b>Chưa tốt, ghi thật:</b> màu tuổi bước chỉ là màu — chữ
            “4 ngày” phải tự đủ nghĩa.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Một trạng thái trên đầu màn; vòng đời gấp vào khung khi bấm.',
          dont: 'Hai dải bước chồng nhau (trạng thái + nhận hàng) và một dải người giữ riêng.',
          source:
            'chủ dự án chốt 27/09/2026 trên canvas "Đơn mua" — "1 trạng thái là đủ"',
        },
        {
          do: 'Chuyển không làm được vẫn hiện trong menu, kèm lý do (why).',
          dont: 'Ẩn mục đi — người dùng đi tìm nút "Đã nhận hàng" mãi không thấy.',
          source: 'CLAUDE.md luật cứng 7 — bị chặn thì nói vướng gì và cách gỡ tại chỗ',
        },
        {
          do: 'next là đúng MỘT bước kế tiếp của bước hiện tại.',
          dont: 'Dồn mọi chuyển trạng thái thành một hàng nút.',
          source: 'thanh-nut.ts — thanh hành động một hàng (26/09/2026)',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
