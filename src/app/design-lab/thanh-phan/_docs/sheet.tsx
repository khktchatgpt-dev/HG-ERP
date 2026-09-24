'use client'

import { useState } from 'react'
import {
  Affected,
  Btn,
  Consequence,
  Sheet,
  SheetActions,
  TextArea,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `Sheet` + ba mảnh đi kèm (B7, 24/09/2026).
 *
 * Mọi hộp ĐÓNG lúc dựng trang: hộp mở thì Radix đánh `aria-hidden` cho phần
 * còn lại của trang và khoá cuộn — để mở sẵn là che mất cả sổ.
 */

/** Mức nặng: huỷ đơn đã gửi — đủ bộ Consequence + Affected + SheetActions. */
function HuyDon() {
  const [open, setOpen] = useState(false)
  const dong = () => setOpen(false)
  return (
    <>
      <Btn danger icon="huy" onClick={() => setOpen(true)}>
        Huỷ đơn PO-2608-097
      </Btn>
      <Sheet
        open={open}
        onClose={dong}
        title="Huỷ đơn PO-2608-097"
        subtitle="Đã gửi CÔNG TY NHỰA SƠN TÍN PHÁT ngày 22/08/2026"
        stakes="nang"
        footer={
          <SheetActions
            stakes="nang"
            onCancel={dong}
            onConfirm={dong}
            cancelLabel="Thôi"
            confirmLabel="Huỷ đơn"
          />
        }
      >
        <Affected
          items={[
            { code: 'LSX 06/26-27 - MX', label: 'Lệnh sản xuất', note: 'mất nguồn 9 mã vật tư' }, // prettier-ignore
            { code: 'ĐH-2608-31', label: 'Đơn khách MERXX', note: 'hạn giao 30/09 có thể trượt' }, // prettier-ignore
            { code: 'PN-2609-012', label: 'Phiếu nhập đã ghi', amount: '112.400.000 ₫' }, // prettier-ignore
          ]}
        />
        <Consequence>
          Nhà cung cấp đã nhận đơn và có thể đã vào sản xuất. Huỷ ở đây KHÔNG tự báo cho
          họ — phải gọi báo riêng.
        </Consequence>
      </Sheet>
    </>
  )
}

/** Mức vừa: gửi duyệt hàng loạt — đang chạy thì nút khoá MỀM, nhãn đổi. */
function GuiDuyet() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const dong = () => {
    setBusy(false)
    setOpen(false)
  }
  return (
    <>
      <Btn primary icon="gui" onClick={() => setOpen(true)}>
        Gửi duyệt 8 đơn
      </Btn>
      <Sheet
        open={open}
        onClose={dong}
        title="Gửi duyệt 8 đơn mua"
        subtitle="Tổng 486.200.000 ₫ · người duyệt: Giám đốc"
        footer={
          <SheetActions
            onCancel={dong}
            onConfirm={() => {
              setBusy(true)
              setTimeout(dong, 1500)
            }}
            busy={busy}
            confirmLabel="Gửi duyệt"
          />
        }
      >
        <Affected
          max={3}
          items={[
            { code: 'PO-2609-101', label: 'CƠ KHÍ THÀNH ĐẠT', amount: '82.500.000 ₫' },
            { code: 'PO-2609-102', label: 'CÔNG TY TNHH SX TM MINH ĐẠT', amount: '64.000.000 ₫' }, // prettier-ignore
            { code: 'PO-2609-103', label: 'CÔNG TY NHỰA SƠN TÍN PHÁT', amount: '41.300.000 ₫' }, // prettier-ignore
            { code: 'PO-2609-104', label: 'CƠ KHÍ THÀNH ĐẠT', amount: '120.000.000 ₫' },
            { code: 'PO-2609-105', label: 'CÔNG TY TNHH SX TM MINH ĐẠT', amount: '58.400.000 ₫' }, // prettier-ignore
            { code: 'PO-2609-106', label: 'CÔNG TY NHỰA SƠN TÍN PHÁT', amount: '30.000.000 ₫' }, // prettier-ignore
            { code: 'PO-2609-107', label: 'CƠ KHÍ THÀNH ĐẠT', amount: '52.000.000 ₫' },
            { code: 'PO-2609-108', label: 'CÔNG TY TNHH SX TM MINH ĐẠT', amount: '38.000.000 ₫' }, // prettier-ignore
          ]}
        />
        <Consequence>
          Gửi rồi thì đơn khoá sửa cho tới khi Giám đốc duyệt hoặc trả lại.
        </Consequence>
      </Sheet>
    </>
  )
}

/** Mức nhẹ + chưa đủ điều kiện: nút làm khoá cho tới khi có lý do. */
function TraLai() {
  const [open, setOpen] = useState(false)
  const [lyDo, setLyDo] = useState('')
  const dong = () => {
    setLyDo('')
    setOpen(false)
  }
  return (
    <>
      <Btn icon="traLai" onClick={() => setOpen(true)}>
        Trả lại phiếu PBS-0042
      </Btn>
      <Sheet
        open={open}
        onClose={dong}
        title="Trả lại phiếu PBS-0042 để sửa"
        stakes="nhe"
        footer={
          <SheetActions
            stakes="nhe"
            onCancel={dong}
            onConfirm={dong}
            disabled={!lyDo.trim()}
            confirmLabel="Trả lại"
          />
        }
      >
        {/* TextArea không nhận `label` — bọc `<label>` để ô có tên. */}
        <label className="text-k-sm grid gap-1 font-semibold">
          Lý do trả lại (bắt buộc)
          <TextArea value={lyDo} onChange={setLyDo} rows={3} />
        </label>
        <p className="text-k-sm mt-2 text-[var(--ink-2)]">
          Nút “Trả lại” mở khi đã có lý do — người lập phiếu cần biết phải sửa gì.
        </p>
      </Sheet>
    </>
  )
}

export default function DocSheet() {
  return (
    <CompDoc
      family="sheet"
      summary={
        <>
          Hộp xác nhận dạng BẢNG BÁM MÉP PHẢI — chứng từ bên trái vẫn đọc được trong lúc
          trả lời. Ba mức hệ quả (<code>stakes</code>) đổi vạch màu, độ phủ nền và vai trò
          ARIA. Ba mảnh đi kèm: <code>Consequence</code> nói cái gì đổi,{' '}
          <code>Affected</code> kê thứ bị kéo theo, <code>SheetActions</code> là cặp nút
          có thứ bậc.
        </>
      }
      useWhen={
        <>
          một câu phải trả lời xong mới đi tiếp: gửi duyệt, huỷ đơn, xác nhận đợt giao,
          hoặc khai vài ô trước một thao tác (lý do trả lại).
        </>
      }
      avoidWhen={
        <>
          bày thêm lựa chọn cho một nút mà bỏ ngang cũng không sao — dùng{' '}
          <code>Popover</code>; báo kết quả SAU khi đã làm — dùng <code>useToast</code>;
          sửa cả một chứng từ — mở trang của nó, đừng nhồi vào bảng 480px.
        </>
      }
      variants={[
        {
          name: 'Mức nặng — mất dữ liệu / ràng buộc tiền',
          when: 'xoá, huỷ đơn đã gửi. Vạch đỏ, nền phủ đậm, alertdialog; bấm ra nền không đóng.',
          demo: <HuyDon />,
        },
        {
          name: 'Mức vừa (mặc định) — có người khác thấy',
          when: 'gửi duyệt, gửi NCC. Bấm “Gửi duyệt” để thấy trạng thái đang chạy; Affected gom phần dư.',
          demo: <GuiDuyet />,
        },
        {
          name: 'Mức nhẹ — làm lại được, và nút chờ đủ điều kiện',
          when: 'không vạch, nền phủ nhạt. SheetActions disabled cho tới khi khai lý do.',
          demo: <TraLai />,
        },
      ]}
      states={[
        {
          state: 'Đóng',
          looks: 'Không có gì trong DOM.',
          behaves: 'Sheet luôn điều khiển từ ngoài bằng open.',
        },
        {
          state: 'Mở — nhe',
          looks: 'Không vạch trên; nền phủ .14.',
          behaves: 'role="dialog"; Esc, ✕, bấm ra nền đều gọi onClose.',
        },
        {
          state: 'Mở — vua',
          looks: 'Vạch 3px màu hành động; nền phủ .14.',
          behaves: 'Như nhe.',
        },
        {
          state: 'Mở — nang',
          looks:
            'Vạch 3px màu dừng; nền phủ .5; nút làm màu đỏ (SheetActions stakes="nang").',
          behaves: 'role="alertdialog"; bấm ra nền KHÔNG đóng — chỉ Esc và ✕.',
        },
        {
          state: 'Tiêu điểm khi mở',
          looks: 'Không vẽ vòng focus quanh cả hộp.',
          behaves:
            'Tiêu điểm vào CHÍNH HỘP, không vào nút đầu — Tab một lần mới tới nút. Đóng thì về phần tử đã mở hộp.',
        },
        {
          state: 'SheetActions busy',
          looks: 'Nút làm khoá, vòng quay thay icon, nhãn thành “Đang chạy…”.',
          behaves:
            'Khoá MỀM qua Btn busy: aria-busy, tiêu điểm Ở LẠI nút (vẫn trong hộp), cú bấm thứ hai bị nuốt — không gửi đôi.',
        },
        {
          state: 'SheetActions disabled',
          looks: 'Nút làm khoá, nhãn giữ nguyên.',
          behaves:
            'Khoá CỨNG (disabled thật) — rời thứ tự Tab. Không nói lý do: nơi gọi phải nói trong thân hộp vì sao chưa bấm được.',
        },
        {
          state: 'Affected quá max',
          looks: 'Dòng cuối “… và N mục nữa” nền nhạt.',
          behaves: 'Tĩnh — không mở rộng được tại chỗ.',
        },
      ]}
      a11y={{
        role: 'dialog · alertdialog (stakes="nang")',
        keys: [
          {
            key: 'Tab / Shift+Tab',
            does: 'Vòng trong hộp — không lọt ra trang phía sau.',
          },
          { key: 'Esc', does: 'Gọi onClose ở cả ba mức.' },
          {
            key: 'Enter / Space',
            does: 'Trên nút đang có tiêu điểm. Mở hộp thì chưa nút nào có tiêu điểm, nên Enter lỡ tay không làm gì.',
          },
        ],
        reader: (
          <>
            Đọc tiêu đề làm tên hộp, <code>subtitle</code> làm mô tả; phần còn lại của
            trang bị <code>aria-hidden</code> nên trình đọc chỉ thấy hộp. Không có{' '}
            <code>subtitle</code> thì hộp không có mô tả — thân hộp (Consequence,
            Affected) không được đọc tự động, người nghe phải đi tới.{' '}
            <code>SheetActions busy</code> đọc nút là “Đang chạy…, bận” và tiêu điểm ở
            nguyên trên nút. Đã sửa 24/09/2026 (B7½): trước đó <code>busy</code> khoá bằng{' '}
            <code>disabled</code> thật — tiêu điểm đang ở nút “Gửi duyệt” rơi về{' '}
            <code>&lt;body&gt;</code>, tức RA NGOÀI hộp giữ focus, đúng lúc vừa bấm xác
            nhận. <b>Chỗ yếu, ghi thật:</b> nút ✕ và vùng thân không có tên riêng ngoài
            “Đóng”. Test ở <code>kit.a11y.test.tsx</code> phủ <code>Sheet</code> và{' '}
            <code>SheetActions</code> (busy + disabled); <code>Affected</code>,{' '}
            <code>Consequence</code> chưa có test riêng.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Dùng Sheet (Radix Dialog) — Tab vòng trong hộp, đóng thì tiêu điểm về nút mở.',
          dont: (
            <>
              Khai <code>aria-modal</code> mà không giữ focus: trình đọc nghe “hộp modal”
              trong khi người dùng bàn phím đang thao tác trên trang phía sau.
            </>
          ),
          source:
            'Sheet tự viết trước B1 — docs/he-thiet-ke-erp-ke-hoach.md §9.2; test [B1] trong kit.a11y.test.tsx',
        },
        {
          do: 'Bám mép phải, để chứng từ đang hỏi về vẫn đọc được.',
          dont: 'Hộp giữa màn phủ đen — bắt người dùng trả lời bằng trí nhớ.',
          source:
            'chủ dự án báo 15/09/2026 “che hết màn hình… rất nguy hiểm” — commit b16248d',
        },
        {
          do: (
            <>
              Việc nặng có <code>Consequence</code> nói cái gì đổi và{' '}
              <code>Affected</code> kê thứ bị kéo theo (NCC, số tiền).
            </>
          ),
          dont: (
            <>
              Hộp 512px chỉ nói “PO-2026-0068” rồi hỏi “Bạn có chắc không?”; đường hàng
              loạt bỏ trống câu hậu quả.
            </>
          ),
          source:
            'bốn lỗi hộp thoại v3, đo trên PO-2026-0068 ngày 09/09/2026 — đầu kit/Sheet.tsx',
        },
        {
          do: (
            <>
              Xác nhận nguy hiểm = <code>Sheet stakes=&quot;nang&quot;</code>.
            </>
          ),
          dont: (
            <>
              Dựng thêm một <code>ConfirmSheet</code> riêng — thêm một cặp trùng tên cho
              cùng một việc.
            </>
          ),
          source: 'docs/he-thiet-ke-erp-ke-hoach.md §5.1, mục 1.4',
        },
        {
          do: 'Nhãn nút làm là động từ cụ thể: “Huỷ đơn”, “Gửi duyệt”.',
          dont: '“Huỷ” và “Xác nhận” cùng cỡ, cùng độ nặng — nút mất thứ bậc.',
          source: 'lỗi 3 của hộp thoại v3 — đầu kit/Sheet.tsx',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
