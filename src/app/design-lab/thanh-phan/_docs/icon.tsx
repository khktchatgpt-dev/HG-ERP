'use client'

import { Btn, Chip, Ico, ICO_MEANING, type IcoName } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA ICON (bước icon, 24/09/2026).
 *
 * Bảng từ vựng dựng thẳng từ `ICO_MEANING` của kit — không chép tay — nên trang
 * này không thể lệch khỏi bản đồ thật: thêm khái niệm ở `kit/Icon.tsx` là nó
 * hiện ở đây, quên ghi nghĩa là lỗi biên dịch.
 */
const GROUPS = ['Đối tượng', 'Thời gian', 'Vòng đời', 'Thao tác', 'Di chuyển'] as const

function Vocab() {
  const names = Object.keys(ICO_MEANING) as IcoName[]
  return (
    <div className="grid gap-4">
      {GROUPS.map((g) => (
        <div key={g}>
          <div className="text-k-label mb-1.5 font-bold tracking-[.08em] text-[var(--ink-label)] uppercase">
            {g}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-4 gap-y-1">
            {names
              .filter((n) => ICO_MEANING[n][0] === g)
              .map((n) => (
                <div key={n} className="text-k-sm flex items-center gap-2 py-0.5">
                  <Ico name={n} />
                  <code className="min-w-[72px] text-[var(--ink)]">{n}</code>
                  <span className="text-[var(--ink-2)]">{ICO_MEANING[n][1]}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DocIco() {
  return (
    <CompDoc
      family="icon"
      summary={
        <>
          Icon theo <b>khái niệm nghiệp vụ</b>, không theo tên hình. Chỗ gọi viết{' '}
          <code>duyet</code>, <code>quaHen</code>, <code>ghiSo</code>; hình do kit giữ ở{' '}
          <code>kit/Icon.tsx</code>. Một khái niệm, một hình, cả app — trước 24/09 khái
          niệm “duyệt” mang bốn hình trên bốn màn liền nhau.
        </>
      }
      useWhen={
        <>
          đặt mốc cho mắt quét: nút hành động (qua prop <code>icon</code> của{' '}
          <code>Btn</code>/<code>Chip</code>), tiêu đề khối, loại chứng từ trong hộp thư,
          dòng cảnh báo.
        </>
      }
      avoidWhen={
        <>
          nút huỷ/lùi (<i>Thôi, Để sau, Đóng</i> — để trơn như Fiori, Carbon), chip trạng
          thái vòng đời (chữ và màu đã đủ), và mọi chỗ icon <b>thay</b> chữ trong bảng —
          ERP đọc bằng chữ.
        </>
      }
      variants={[
        {
          name: 'Trong nút — prop icon, đứng TRƯỚC chữ',
          when: 'mọi nút có động từ quen thuộc. Luật lint hg/kit-icon bắt nút thiếu icon.',
          demo: (
            <div className="flex flex-wrap gap-2">
              <Btn primary icon="duyet">
                Phê duyệt
              </Btn>
              <Btn icon="traLai">Trả lại để sửa</Btn>
              <Btn icon="in">In phiếu</Btn>
              <Btn icon="excel">Xuất Excel</Btn>
              <Btn danger icon="xoa">
                Xoá dòng
              </Btn>
            </div>
          ),
        },
        {
          name: 'Trong chip lọc',
          when: 'chip là một KHÁI NIỆM (của tôi, chưa hẹn) — không phải một trạng thái.',
          demo: (
            <div className="flex flex-wrap gap-2">
              <Chip on icon="toi" count={12}>
                Của tôi
              </Chip>
              <Chip icon="hen" count={3}>
                Chưa hẹn giao
              </Chip>
            </div>
          ),
        },
        {
          name: 'Đứng một mình — phải có tên',
          when: 'nút ‹ › trong dãy n/N. Nút mang aria-label; icon trang trí.',
          demo: (
            <div className="flex items-center gap-1">
              <Btn aria-label="Phiếu trước">
                <Ico name="truoc" />
              </Btn>
              <span className="num text-k-sm px-1.5 text-[var(--ink-2)]">3 / 12</span>
              <Btn aria-label="Phiếu sau">
                <Ico name="sau" />
              </Btn>
            </div>
          ),
        },
        {
          name: `Từ vựng — ${Object.keys(ICO_MEANING).length} khái niệm`,
          when: 'tra trước khi thêm. Thiếu thì thêm vào kit/Icon.tsx kèm một dòng lý do.',
          demo: <Vocab />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Nét 1,8; màu currentColor — ăn theo chữ đứng cạnh.',
          behaves: 'Tĩnh. Không nhận focus, không bắt sự kiện.',
        },
        {
          state: 'Trong nút bị khoá',
          looks: 'Xám theo chữ của nút.',
          behaves: 'Không có trạng thái riêng — icon không bao giờ tự báo khoá.',
        },
      ]}
      a11y={{
        role: 'không có (trang trí) · img (khi có label)',
        keys: [{ key: '—', does: 'Icon không nhận phím; nút chứa nó mới nhận.' }],
        reader: (
          <>
            Trang trí thì <b>không</b> chen vào tên nút: nút “In phiếu” được đọc đúng “In
            phiếu”, không phải “hình, In phiếu” — có test canh. Nút chỉ có icon mà không
            có <code>aria-label</code> bị luật lint chặn (lỗi <code>noName</code>).
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              <code>icon=&quot;duyet&quot;</code> ở mọi nút duyệt.
            </>
          ),
          dont: 'Mỗi màn tự import một hình từ lucide-react.',
          source:
            'khu Giám đốc trước 24/09: búa, con dấu, khiên, dấu tích cho cùng một việc',
        },
        {
          do: (
            <>
              Hạn giao dùng <code>hen</code> (lịch có kim).
            </>
          ),
          dont: 'Dùng xe tải cho hạn giao — xe tải là hàng ĐANG VỀ, một việc khác.',
          source: 'Chi tiết duyệt, ô “Hạn giao khách”, sửa 24/09',
        },
        {
          do: 'Icon trước chữ, chữ vẫn nói đủ ý.',
          dont: 'Giữ ký hiệu chữ đã bị icon thay: “+ Soạn đơn” cạnh dấu cộng.',
          source: 'ba nút “+ Soạn đơn mua” trước 24/09',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
