'use client'

import { useRef, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Btn } from './Primitives'

/**
 * ══════════════════════════════════════════════════════════════════════════
 * TẦNG TRONG v4 — hộp thoại, xác nhận, thông báo
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Dựng vì bảng đã theo v4 nhưng bấm vào là rơi về hộp thoại v3.
 *
 * BỐN LỖI CỦA HỘP THOẠI v3, đo trên đơn PO-2026-0068 (09/09/2026):
 *
 * 1. NGHÈO NỘI DUNG. Hộp thoại chiếm 512px giữa màn để nói đúng MỘT dòng
 *    "PO-2026-0068" — không NCC, không giá trị, không số dòng. Nó vừa CHE
 *    MẤT hàng ở bảng rồi không chép lại thứ nó che.
 *
 * 2. KHÔNG NÊU HẬU QUẢ. Đường một-đơn có sẵn câu "Gửi rồi thì hết sửa thoải
 *    mái", đường HÀNG LOẠT thì bỏ trống — trong khi hàng loạt mới là chỗ sai
 *    nhiều đơn cùng lúc.
 *
 * 3. NÚT MẤT THỨ BẬC. "Huỷ" và "Gửi duyệt" cùng cỡ, cùng độ nặng.
 *
 * 4. VIỆC NGUY HIỂM VÀ VIỆC THƯỜNG GIỐNG HỆT NHAU. Duyệt đơn 16.830 USD và
 *    xoá một dòng nháp dùng chung một khung.
 */

/** Bậc hệ quả — quyết định màu, nút, và có buộc dừng lại hay không. */
export type Stakes =
  /** Làm lại được: lưu nháp, đổi bộ lọc. */
  | 'nhe'
  /** Có người khác thấy / trạng thái đổi: gửi duyệt, gửi NCC. */
  | 'vua'
  /** Mất dữ liệu hoặc ràng buộc tiền: xoá, huỷ đơn đã gửi. */
  | 'nang'

/**
 * BẢNG BÊN PHẢI, KHÔNG PHẢI HỘP GIỮA MÀN (đổi 15/09/2026).
 *
 * Bản trước là hộp 480px đặt giữa, nền sau phủ đen .55. Chủ dự án dùng thật rồi
 * báo: "nhấn vào thì mở modal che hết màn hình… rất nguy hiểm". Đúng, và lý do
 * sâu hơn một chuyện thẩm mỹ: hộp thoại ở đây gần như luôn hỏi một câu VỀ CHỨNG
 * TỪ ĐANG MỞ — xác nhận đợt giao, hạ đơn về nháp, huỷ đơn. Che mất chứng từ là
 * bắt người dùng trả lời bằng TRÍ NHỚ. Chính vì thế `Affected` mới phải ra đời
 * hồi 09/09 để chép lại thứ hộp che mất; nay không cần chép nữa vì không che.
 *
 * Bám mép phải thì chứng từ vẫn đọc được bên trái, mà bảng vẫn là một lớp riêng
 * có tiêu điểm và Escape — không mất tính "phải trả lời xong mới đi tiếp".
 *
 * ĐỘ MỜ THEO BẬC HỆ QUẢ. Lần chỉnh 09/09/2026 kéo nền từ .34 lên .55 vì hộp
 * giữa màn nhạt quá trông như "một thẻ rơi giữa bảng". Bảng bám mép không mắc
 * lỗi đó — nó có mép màn, vạch bậc và bóng đổ để tự tách. Nên việc thường để
 * nền nhạt cho đọc được chứng từ; việc KHÔNG LÙI ĐƯỢC vẫn phủ đậm, vì lúc đó
 * cắt đứt mọi thứ khác mới là điều mình muốn.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  stakes = 'vua',
  children,
  footer,
  width = 480,
}: {
  /** Mở hay đóng — luôn điều khiển từ ngoài; Sheet không có nút mở riêng. */
  open: boolean
  /**
   * Gọi khi người dùng muốn đóng: Esc, nút ✕, hoặc bấm ra nền (trừ mức `nang`).
   * Nơi gọi đặt `open` về `false`; tiêu điểm tự về phần tử đã mở hộp.
   */
  onClose: () => void
  /** Câu hỏi của hộp, thành TÊN của hộp với trình đọc màn hình. Nêu mã chứng từ: "Huỷ đơn PO-2608-097". */
  title: string
  /** Một dòng bối cảnh dưới tiêu đề — thành MÔ TẢ của hộp (`aria-describedby`). */
  subtitle?: string
  /**
   * Bậc hệ quả: `nhe` làm lại được (không vạch), `vua` có người khác thấy
   * (vạch màu hành động), `nang` mất dữ liệu / ràng buộc tiền (vạch đỏ, nền phủ
   * đậm, `alertdialog`, bấm ra nền không đóng).
   */
  stakes?: Stakes
  /** Thân hộp — phần DUY NHẤT cuộn; đầu và chân đứng yên. Thường là `Consequence` + `Affected`. */
  children?: ReactNode
  /** Chân hộp, canh phải, không cuộn — thường là `SheetActions`. Bỏ trống thì không có chân. */
  footer?: ReactNode
  /**
   * Bề ngang mong muốn (px). Bị chặn trần 72% bề ngang màn để chứng từ bên trái
   * còn đọc được, và sàn 360px để hộp không co thành một sợi.
   */
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  /*
    Phần tử đang có tiêu điểm LÚC HỘP MỞ — để trả về đúng nó lúc đóng.

    Phải tự giữ, KHÔNG trông vào Radix được: Radix Dialog khi đóng trả tiêu
    điểm về `Dialog.Trigger` của chính nó. `Sheet` lại được điều khiển TỪ NGOÀI
    bằng `open` (nút mở là của màn gọi, không phải của Sheet), nên Radix không
    có trigger nào để trả về — tiêu điểm rơi về `<body>`. Test bánh cóc bắt
    đúng chỗ này ngay lần chạy đầu sau khi đổi ruột (24/09/2026): chỉ tin
    "Radix tự lo" thì lỗi đã lọt.
  */
  const truoc = useRef<HTMLElement | null>(null)

  /*
    ĐỨNG TRÊN RADIX DIALOG TỪ 24/09/2026 (B1, docs/he-thiet-ke-erp-ke-hoach.md).

    Bản tự viết trước đó khai `aria-modal="true"` nhưng KHÔNG giữ focus: bấm Tab
    đủ lần là lọt ra trang phía sau lớp phủ, và đóng hộp thì tiêu điểm rơi về
    `<body>` chứ không về nút đã mở nó. Trình đọc màn hình được báo "đây là hộp
    modal", còn người dùng bàn phím thì đang thao tác trên trang sau lưng mà
    không thấy gì — khai modal mà không giữ focus TỆ HƠN không khai. Hai lỗi đó
    nay có test canh (`kit.a11y.test.tsx`).

    Radix lo: giữ focus trong hộp, trả focus về nút mở, Esc, khoá cuộn nền, và
    đánh dấu phần còn lại của trang là trơ với trình đọc màn hình. Kit giữ HÌNH
    (bảng bám mép phải, vạch mức hệ quả, độ mờ nền) và giữ nguyên API — 14 file
    đang gọi không phải sửa dòng nào.

    Khoá cuộn nền KHÔNG làm mất gì thật: màn kit cuộn trong khung riêng của
    `ScreenFrame`, không cuộn `<body>`, nên bản cũ vốn cũng không lăn được chứng
    từ phía sau khi hộp đang mở.
  */
  const namViec = stakes === 'nang'
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <Dialog.Portal>
        {/*
          Token của kit chỉ khai trong `.kit`, không ở `:root`. Portal đưa hộp ra
          `<body>` — ngoài mọi `.kit` — nên phải đeo lại. `contents` để lớp bọc
          không tạo hộp nào: nó chỉ cho biến CSS kế thừa xuống.
        */}
        <div className="kit contents">
          <Dialog.Overlay
            className={cn(
              'fixed inset-0 z-[var(--z-modal)] transition-[background-color] duration-(--dur-base)',
              namViec ? 'bg-[rgba(17,24,38,.5)]' : 'bg-[rgba(17,24,38,.14)]',
            )}
          />
          <Dialog.Content
            ref={ref}
            /*
              VIỆC NẶNG LÀ `alertdialog`. WAI-ARIA tách hai vai: hộp thoại thường
              (khai báo, sửa) và hộp CẢNH BÁO — ngắt luồng làm việc để hỏi một câu
              quan trọng. Xoá, huỷ đơn đã gửi đúng là loại sau. Đây là lý do KHÔNG
              dựng một `ConfirmSheet` riêng: kit đã có mẫu xác nhận (Sheet +
              Consequence + SheetActions), thêm một bản nữa là thêm một cặp trùng
              tên — đúng lỗi mục 1.4 của kế hoạch hệ thiết kế.
            */
            role={namViec ? 'alertdialog' : 'dialog'}
            // Không có phụ đề thì nói thẳng với Radix là không có mô tả, kẻo nó
            // cảnh báo trong console ở mọi lần mở.
            {...(subtitle ? {} : { 'aria-describedby': undefined })}
            /*
              Tiêu điểm ban đầu vào CHÍNH HỘP, không vào nút đầu tiên. Mặc định
              của Radix là nút đầu tiên — mà ở hộp huỷ đơn, nút đầu tiên có thể
              là nút làm việc không lùi lại được. Một cú Enter lỡ tay là mất. Bấm
              Tab một lần thì vào nút đầu, và từ đó vòng trong hộp.
            */
            onOpenAutoFocus={(e) => {
              // Lúc này tiêu điểm CHƯA rời nút mở — ghi lại trước khi dời đi.
              truoc.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null
              e.preventDefault()
              ref.current?.focus()
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              // Nút mở có thể đã biến mất (vd. vừa xoá chính dòng chứa nó) —
              // khi đó để trình duyệt tự đặt, còn hơn gọi focus() vào hư không.
              if (truoc.current?.isConnected) truoc.current.focus()
            }}
            /*
              Việc nặng không đóng khi bấm ra ngoài: người dùng kéo chọn chữ trong
              bảng rồi nhả tay ra ngoài là mất sạch việc đang khai. Radix bắt theo
              `pointerdown` (không phải lúc nhả tay), nên kéo từ TRONG ra ngoài
              vốn đã không đóng — chặn thêm ở đây là cho cú bấm hẳn ra nền.
            */
            onInteractOutside={(e) => {
              if (namViec) e.preventDefault()
            }}
            className={cn(
              /*
                Chặn 72% bề ngang: mấy bảng có lưới truyền `width` tới 760px, ở màn
                1024 là chứng từ chỉ còn một sợi 264px — tức lại che gần hết, đúng
                thứ vừa đi sửa. Luôn chừa ít nhất hơn một phần tư màn cho chứng từ.
              */
              'k-sheet-in fixed inset-y-0 right-0 z-[var(--z-modal)] flex flex-col',
              // Trần 72% để chứng từ luôn còn chỗ; SÀN 360px để ở màn hẹp bảng
              // không co thành một sợi không khai nổi (min-width thắng max-width).
              'max-w-[min(100%,72vw)] min-w-[min(100%,360px)]',
              'rounded-l-[var(--radius-lg)] border-l border-[var(--line)]',
              /*
                `focus:outline-none`: hộp nhận tiêu điểm khi mở, và luật focus
                toàn cục sẽ vẽ vòng 2px quanh cả hộp — trông y như một ô nhập
                đang được chọn (đo 09/09/2026). Vòng focus dành cho thứ người dùng
                đi tới bằng Tab, không phải cho cả hộp.
              */
              'bg-[var(--surface-card)] outline-none focus:outline-none',
            )}
            style={{ width, boxShadow: 'var(--shadow-modal)' }}
          >
            {/* Vạch trên nói bậc hệ quả TRƯỚC KHI đọc chữ — mắt bắt màu nhanh
                hơn đọc. Việc nhẹ không có vạch: không phải lúc nào cũng cần báo động. */}
            {stakes !== 'nhe' && (
              <div
                className={cn(
                  'h-[3px] shrink-0 rounded-tl-[var(--radius-lg)]',
                  namViec ? 'bg-[var(--stop)]' : 'bg-[var(--act)]',
                )}
              />
            )}
            <div className="flex shrink-0 items-start gap-3 border-b border-[var(--hair)] px-5 pt-4 pb-3">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-k-lg leading-snug font-semibold tracking-[-.01em]">
                  {title}
                </Dialog.Title>
                {subtitle && (
                  <Dialog.Description className="text-k-sm mt-1 leading-relaxed text-[var(--ink-2)]">
                    {subtitle}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Đóng"
                  className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                >
                  ✕
                </button>
              </Dialog.Close>
            </div>
            {/* CHỈ PHẦN THÂN CUỘN. Hộp giữa màn trước đây cuộn cả cụm, nên bảng kê
                dài là nút bấm trôi xuống dưới màn và người dùng phải cuộn đi tìm
                thứ mình vừa định bấm. Bảng dọc thì đầu và chân đứng yên. */}
            {children && (
              <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
            )}
            {footer && (
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * BẢNG KÊ THỨ SẮP BỊ ĐỘNG VÀO — phần v3 thiếu hẳn.
 *
 * Hộp thoại che mất hàng ở bảng thì phải CHÉP LẠI thứ nó che. Người duyệt
 * cần thấy NCC và số tiền ngay trong hộp, không phải nhớ từ giây trước.
 */
export function Affected({
  items,
  max = 6,
}: {
  /**
   * Thứ sắp bị động vào. `code` mã chứng từ (đơn cách, màu hành động),
   * `label` tên NCC / diễn giải — hàng riêng để không bị cắt, `amount` tiền đã
   * định dạng, `note` hậu quả ngắn cho riêng mục đó.
   */
  items: { code: string; label?: string; amount?: string; note?: string }[]
  /** Số mục hiện tối đa; phần dư gom thành dòng "… và N mục nữa". */
  max?: number
}) {
  const hien = items.slice(0, max)
  const con = items.length - hien.length

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
      {hien.map((it, i) => (
        <div
          key={it.code}
          className={cn('text-k-sm px-3 py-2', i > 0 && 'border-t border-[var(--hair)]')}
        >
          {/* HAI HÀNG, không phải một.

              Nhồi mã + tên NCC + ghi chú + tiền vào một hàng 480px thì tên
              NCC — thứ dài nhất và cũng là thứ người duyệt cần đọc — bị cắt
              còn "CÔNG …" (đo 09/09/2026). Tên nhà cung cấp là căn cứ để
              quyết định, không phải chú thích. */}
          <div className="flex items-baseline gap-3">
            <span className="text-k-sm font-[family-name:var(--font-mono)] font-semibold text-[var(--act)]">
              {it.code}
            </span>
            {it.note && (
              <span className="text-k-label text-[var(--ink-3)]">{it.note}</span>
            )}
            <span className="flex-1" />
            {it.amount && <span className="num shrink-0 font-semibold">{it.amount}</span>}
          </div>
          {it.label && (
            <div className="mt-px leading-snug text-[var(--ink-2)]">{it.label}</div>
          )}
        </div>
      ))}
      {con > 0 && (
        <div className="text-k-sm border-t border-[var(--hair)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink-3)]">
          … và {con} mục nữa
        </div>
      )}
    </div>
  )
}

/**
 * HẬU QUẢ — nói thẳng cái gì đổi sau khi bấm.
 *
 * Đặt SÁT nút bấm chứ không nhét lên đầu: người dùng đọc từ trên xuống rồi
 * bấm, câu cảnh báo phải nằm ở chỗ mắt dừng lại cuối cùng.
 */
export function Consequence({
  children,
}: {
  /**
   * Câu hậu quả: cái gì đổi, ai thấy, có lùi được không. Nói việc cụ thể ("Huỷ ở
   * đây không tự báo NCC — phải gọi riêng"), không hỏi "Bạn có chắc không?".
   */
  children: ReactNode
}) {
  return (
    <p className="text-k-sm mt-3 border-l-2 border-[var(--warn)] bg-[var(--warn-wash)] py-2 pr-3 pl-3 leading-relaxed text-[var(--ink-2)]">
      {children}
    </p>
  )
}

/** Cặp nút chuẩn cho hộp thoại: huỷ nhạt, làm đậm, thứ bậc rõ. */
export function SheetActions({
  onCancel,
  onConfirm,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  stakes = 'vua',
  busy = false,
  disabled = false,
}: {
  /** Nút huỷ (nhạt) — thường chính là `onClose` của `Sheet`. */
  onCancel: () => void
  /** Nút làm (đậm). Nơi gọi tự đặt `busy` trong lúc chạy và đóng hộp khi xong. */
  onConfirm: () => void
  /** Nhãn nút làm — ĐỘNG TỪ cụ thể ("Huỷ đơn", "Gửi duyệt"), không để "Xác nhận" chung chung. */
  confirmLabel?: string
  /** Nhãn nút huỷ — "Thôi" / "Để sau" khi "Huỷ" dễ lẫn với việc huỷ đơn. */
  cancelLabel?: string
  /** Theo `stakes` của `Sheet`: `nang` thì nút làm màu dừng (đỏ). */
  stakes?: Stakes
  /**
   * Đang chạy: nút làm khoá MỀM (`aria-busy`, cú bấm thứ hai bị nuốt) và đổi
   * nhãn thành "Đang chạy…" — chặn gửi đôi mà tiêu điểm vẫn ở lại nút, trong hộp.
   */
  busy?: boolean
  /** Chưa đủ điều kiện (thiếu lý do, số sai) — khoá nút nhưng KHÔNG đổi nhãn thành "Đang chạy". */
  disabled?: boolean
}) {
  return (
    <>
      <Btn onClick={onCancel}>{cancelLabel}</Btn>
      {/*
        `busy` đi đường khoá MỀM của `Btn busy`, KHÔNG `disabled` (B7½, 24/09/2026):
        `disabled` thật làm tiêu điểm đang ở nút rơi về `<body>` — tức RA NGOÀI
        hộp giữ focus — đúng lúc người dùng vừa bấm xác nhận. `disabled` (thiếu
        điều kiện) vẫn khoá cứng: lúc đó tiêu điểm chưa từng ở nút.
      */}
      <Btn
        primary
        danger={stakes === 'nang'}
        onClick={onConfirm}
        busy={busy}
        disabled={disabled && !busy}
      >
        {busy ? 'Đang chạy…' : confirmLabel}
      </Btn>
    </>
  )
}
