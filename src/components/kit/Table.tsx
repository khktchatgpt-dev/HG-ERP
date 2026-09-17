'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT v4 — BẢNG
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bảng chiếm phần lớn thời gian nhìn của người dùng ERP, nên mấy thứ dưới
 * đây KHÔNG phải tuỳ chọn mà là mặc định không tắt được:
 *
 *  · tiêu đề cột dính khi cuộn — bảng luôn dài hơn màn hình;
 *  · chân bảng dính — kế toán luôn cần tổng, và cuộn xuống đáy để xem tổng
 *    rồi cuộn ngược lên là thao tác thừa lặp lại cả ngày;
 *  · cột số mono + căn phải + tabular — xem `.num` ở tokens.css;
 *  · dòng tiêu đề KHỐI thay cho việc lặp tên nhóm ở mọi dòng.
 *
 * KHÁC `DataTable` của v3 (373 dòng): bản này không nhận `columns[]` cấu
 * hình. Đo thực tế: mọi bảng ERP đều cần một cột đặc biệt nào đó (thanh phủ,
 * hai dòng trong một ô, nút inline) và API cấu hình luôn phải mở thêm lỗ
 * thoát, cuối cùng vừa cứng vừa phức tạp. Ở đây trả lại JSX thẳng — dài hơn
 * vài dòng ở nơi dùng, nhưng không có tầng trung gian phải đọc ngược.
 */

export function Table({
  children,
  inline = false,
}: {
  children: ReactNode
  /**
   * BẢNG PHỤ NẰM TRONG MỘT KHỐI — không phải bảng chính của màn.
   *
   * Bảng chính lấy `flex-1`, tức nuốt hết chỗ còn lại của `ScreenFrame`.
   * Hai bảng cùng `flex-1` thì chúng chia đôi màn, và bảng chính — thứ người
   * dùng vào trang để đọc — co lại còn nửa. Bảng phụ vì thế cao theo nội
   * dung, có TRẦN (`--table-inline-max`, mặc định 240px) rồi tự cuộn.
   */
  inline?: boolean
}) {
  /*
    `min-w-0` trên vùng cuộn là BẮT BUỘC trong flex row: thiếu nó thì bảng
    lấy chiều rộng nội dung làm chiều rộng tối thiểu, đẩy khay kiểm tra bị
    bóp và cắt chữ. Có nó thì bảng nhận đúng phần còn lại và tự cuộn ngang.

    Bề rộng tối thiểu đặt qua biến `--table-min` để MÀN tự khai theo số cột
    của mình. Đóng cứng một con số (đo 08/09/2026: 900px) thì ở 1280px mở
    khay 316px, cột CUỐI luôn nằm ngoài vùng nhìn — người dùng không biết có
    cột đó mà kéo. Mặc định 680px vừa đủ cho bảng 4-5 cột.
  */
  return (
    <div
      className={cn(
        'min-w-0 overflow-auto bg-[var(--surface-card)]',
        inline ? 'max-h-[var(--table-inline-max,240px)] shrink-0' : 'flex-1',
      )}
    >
      <table className="w-full min-w-[var(--table-min,680px)] border-separate border-spacing-0 text-[12.5px]">
        {children}
      </table>
    </div>
  )
}

/**
 * Tiêu đề cột — dính lên đỉnh VÙNG CUỘN CỦA BẢNG.
 *
 * BẪY đã dính 08/09/2026: để thanh lọc và bảng chung một vùng cuộn thì hai
 * lớp sticky tính toạ độ theo cùng một gốc và ĐÈ LÊN NHAU — tiêu đề cột phủ
 * mất dòng tiêu đề khối đầu tiên. Cách chắc chắn: thanh lọc đứng NGOÀI vùng
 * cuộn (nó không cần cuộn), bảng tự cuộn riêng, tiêu đề cột dính top:0.
 * Không dùng offset thủ công — đổi chiều cao thanh lọc là lệch lại.
 */
export function THead({
  children,
  pinFirst = false,
}: {
  children: ReactNode
  /** Ghim ô tiêu đề ĐẦU TIÊN cả hai chiều — đi kèm `<Cell pin>` ở thân bảng. */
  pinFirst?: boolean
}) {
  return (
    <thead
      className={cn(
        '[&_th]:sticky [&_th]:top-0 [&_th]:z-[var(--z-sticky)] [&_th]:border-b [&_th]:border-[var(--line)] [&_th]:bg-[var(--surface-raised)] [&_th]:px-[var(--pad-x)] [&_th]:py-[7px] [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-[.04em] [&_th]:whitespace-nowrap [&_th]:text-[var(--ink-2)] [&_th]:uppercase',
        /*
        Ô TIÊU ĐỀ GHIM nằm TRÊN các ô tiêu đề khác — nhưng luật đó KHÔNG đặt
        được ở đây.

        BẪY ĐÃ DÍNH (vá 17/09/2026, chủ dự án: "có lỗi khi kéo bảng"): lớp
        `[&_th:first-child]:z-…` sinh ra chọn tử `.x th:first-child` = độ ưu
        tiên (0,2,1), trong khi `erp.css` đã khai `z-index` cho
        `.kit table:not(.k-grid) thead th` = (0,2,3). Lớp tiện ích THUA, ô "Đơn"
        giữ z=5 ngang với ô bên cạnh, và ô sau trong DOM vẽ đè lên nó: kéo bảng
        sang phải thì tiêu đề "Đơn" biến mất dưới "Nhà cung cấp" trong khi thân
        bảng vẫn ghim — đọc ra như bảng vỡ.

        Nên luật nâng z nằm CÙNG CHỖ với luật đã khai z: `erp.css`, chọn tử
        `thead.k-pin1 th:first-child` (0,3,3). Lớp `left-0` dưới đây vô hại vì
        không ai tranh nó.
      */
        pinFirst && 'k-pin1 [&_th:first-child]:left-0',
      )}
    >
      <tr>{children}</tr>
    </thead>
  )
}

/**
 * DÒNG TIÊU ĐỀ KHỐI — thay cho hai cột "Loại" + "Nhóm" lặp ở mọi dòng.
 *
 * Chép "Bu lông - vít - đinh - liên kết" xuống 100 dòng làm tờ giấy đọc như
 * một bức tường chữ (user chê 07/09/2026); sổ tay của phòng dùng dòng tiêu
 * đề khối cho danh sách dài.
 *
 * `step` là số thứ tự CÔNG ĐOẠN sản xuất nội thất — khung → gỗ → ngũ kim →
 * nệm/vải → sơn → bao bì. Đây là trục xưởng đi theo; nhóm kho là trục xếp
 * kệ, quá thô để chia bảng kê (một lệnh 107 mã thì 66 mã dồn vào một nhóm).
 */
export function GroupRow({
  step,
  name,
  meta,
  cols,
}: {
  step?: number | string
  name: string
  meta?: ReactNode
  cols: number
}) {
  return (
    <tr>
      <td
        colSpan={cols}
        className="h-[29px] border-y border-[var(--line)] bg-[var(--surface-raised)] px-[var(--pad-x)] text-[11px] font-bold tracking-[.07em] text-[var(--ink-2)] uppercase"
      >
        {/*
          TÊN NHÓM BÁM MÉP TRÁI khi kéo ngang (17/09/2026).

          Dòng tiêu đề khối trải hết bề ngang bảng, nên kéo sang phải là tên
          nhóm trôi ra khỏi vùng nhìn trong khi cột định danh vẫn ghim — người
          đọc nhìn một dãy dòng mà không biết chúng thuộc lệnh nào. Bám mép
          trái thì tên đi theo mắt, còn phần tóm tắt bên phải vẫn trôi (nó là
          chữ đọc một lần, không phải mốc định vị).
        */}
        {/* Nền ĐẶC + chừa lề phải: phần tóm tắt bên phải trôi qua dưới tên
            nhóm, nền trong suốt là hai dòng chữ chồng nhau. */}
        <span className="sticky left-0 inline-block bg-[var(--surface-raised)] pr-3">
          {step != null && (
            <span className="mr-[9px] inline-block h-[17px] w-[17px] rounded-[3px] border border-[var(--act-line)] bg-[var(--act-wash)] text-center font-[family-name:var(--font-mono)] text-[10px] leading-[15px] font-bold text-[var(--act)]">
              {step}
            </span>
          )}
          {name}
        </span>
        {meta && (
          <span className="float-right text-[11.5px] font-medium tracking-[.03em] text-[var(--ink-3)] normal-case">
            {meta}
          </span>
        )}
      </td>
    </tr>
  )
}

/**
 * DÒNG DỮ LIỆU.
 *
 * `selected` dùng màu HÀNH ĐỘNG (act), không dùng màu vòng đời — trạng thái
 * điều khiển và trạng thái dữ liệu không được mượn màu của nhau, nếu không
 * thì "đang chọn" trông như "đang lỗi".
 */
export function Row({
  selected = false,
  onClick,
  anchor,
  children,
}: {
  selected?: boolean
  onClick?: () => void
  /**
   * NEO DOM để cuộn tới đúng dòng khi mở bằng link (`?mo=`).
   *
   * Là `data-anchor`, KHÔNG phải `id` (đổi 17/09/2026, chủ dự án: "đôi lúc sẽ
   * có 1 đơn đặt cho nhiều lsx"). Một bản ghi có thể hiện ở NHIỀU nhóm — đơn
   * mua chung nằm dưới cả hai lệnh nó mua hộ — và hai dòng cùng một `id` là
   * DOM không hợp lệ: `getElementById` chỉ thấy cái đầu, còn công cụ kiểm tra
   * và trình đọc màn hình thì báo lỗi. Thuộc tính `data-` trùng nhau là hợp
   * lệ, và `querySelector` vẫn trả về dòng đầu tiên — đúng thứ cần để cuộn.
   */
  anchor?: string
  children: ReactNode
}) {
  return (
    <tr
      data-anchor={anchor}
      onClick={onClick}
      className={cn(
        'group',
        onClick && 'cursor-pointer',
        selected
          ? 'k-on [&>td:first-child]:shadow-[inset_2px_0_0_var(--act)]'
          : 'hover:[&>td]:bg-[var(--surface-hover)]',
      )}
    >
      {children}
    </tr>
  )
}

/**
 * Ô. `grow` cho cột CO GIÃN — tên vật tư, tên nhà cung cấp.
 *
 * CỘT TÊN ĐƯỢC ƯU TIÊN CHIỀU RỘNG, KHÔNG PHẢI CỘT SỐ (sửa 17/09/2026).
 *
 * Bản trước viết `w-1/3`, và trong bảng `table-layout: auto` thì đó chỉ là một
 * lời ĐỀ NGHỊ: trình duyệt chia cột theo bề rộng nội dung, mà nội dung cột tên
 * có `overflow-hidden` + ellipsis nên co được về 0, còn cột ngày/tiền/mã thì
 * `whitespace-nowrap` nên không co. Kết quả đo trên màn Nhà cung cấp ở khung
 * 693px: cột "Nhà cung cấp" được **110px** (đọc ra "BAO BÌ ĐẠI THẮN") trong
 * khi "Đơn gần nhất" chiếm **205px**. Bảng còn chưa tràn khung — chỗ thì đủ,
 * chỉ là chia ngược. Cùng lỗi ở Vật tư, Bảng giá, Nhận hàng, Đơn mua.
 *
 * `w-full` đảo thứ tự ưu tiên đó: cột tên xin toàn bộ phần dư, các cột khác
 * lấy đúng bề rộng nội dung. `min-w` là SÀN đọc được — hết chỗ thì bảng cuộn
 * ngang chứ không bóp tên còn ba chữ. Màn có tên dài (vật tư) nới sàn bằng
 * `--col-grow`. `max-w-0` giữ nguyên vì ellipsis cần nó.
 *
 * `pin` ghim cột vào mép trái khi bảng cuộn ngang. Dùng cho cột ĐỊNH DANH
 * (mã đơn, mã vật tư): đo ở 1280px thì bảng 900px+ phải cuộn ngang và cột
 * đầu trôi mất, người đọc nhìn một dòng số mà không biết nó của mã nào —
 * cùng hạng lỗi với mất tiêu đề cột khi cuộn dọc.
 */
export function Cell({
  children,
  num = false,
  grow = false,
  muted = false,
  pin = false,
  title,
  className,
}: {
  children: ReactNode
  num?: boolean
  grow?: boolean
  muted?: boolean
  pin?: boolean
  /**
   * Chữ đầy đủ hiện khi rê chuột. Ô nào bị chặn bề rộng thì PHẢI có: cắt chữ
   * mà không có đường đọc lại nguyên văn là giấu dữ liệu, không phải rút gọn.
   */
  title?: string
  className?: string
}) {
  return (
    <td
      title={title}
      className={cn(
        'h-[var(--row-h)] overflow-hidden border-b border-[var(--hair)] px-[var(--pad-x)] text-ellipsis whitespace-nowrap',
        num && 'num',
        grow && 'w-full max-w-0 min-w-[var(--col-grow,200px)]',
        muted && 'text-[11.5px] text-[var(--ink-3)]',
        // Nền đặc bắt buộc: trong suốt thì nội dung cuộn qua hiện chồng lên.
        pin &&
          'sticky left-0 z-[2] bg-[var(--surface-card)] group-hover:bg-[var(--surface-hover)]',
        className,
      )}
    >
      {children}
    </td>
  )
}

/**
 * CHÂN BẢNG DÍNH — tổng luôn nhìn thấy.
 *
 * `caveat` là chỗ nói phần tổng KHÔNG bao gồm cái gì. Con số tổng che giấu
 * điều kiện là con số nguy hiểm: "5.482.000" mà 14/16 mã chưa có giá thì
 * người ký tưởng đó là toàn bộ tiền phải chi.
 */
export function TFoot({
  label,
  cells,
  caveat,
}: {
  label: ReactNode
  cells: ReactNode
  caveat?: ReactNode
}) {
  /*
    z-index của chân bảng phải CAO HƠN cột ghim trái.

    `Cell pin` dán z-[2] lên ô đầu mỗi dòng để nó không bị nội dung cuộn ngang
    đè. Chân bảng trước đây sticky mà KHÔNG khai z, nên ở bảng dài ô ghim của
    dòng cuối vẽ chồng lên chữ trong chân bảng — đọc ra "Cá nhân — Mận ung cấp
    đang hiện" (đo 14/09/2026 trên màn Nhà cung cấp 164 dòng). Cùng hạng lỗi
    với bẫy hai lớp sticky ở `THead`, chỉ khác trục. Chân bảng thắng cả hai lớp
    kia; chúng không bao giờ chồng chỗ nhau nên không sinh xung đột mới.
  */
  return (
    <tfoot className="[&_td]:sticky [&_td]:bottom-0 [&_td]:z-[calc(var(--z-sticky)_+_2)] [&_td]:h-9 [&_td]:border-t [&_td]:border-[var(--line)] [&_td]:bg-[var(--surface-raised)] [&_td]:px-[var(--pad-x)] [&_td]:font-semibold">
      <tr>
        {label}
        {cells}
        {caveat && (
          <td className="text-[11.5px] font-normal text-[var(--ink-3)]" colSpan={2}>
            {caveat}
          </td>
        )}
      </tr>
    </tfoot>
  )
}

/**
 * THANH LỌC — đứng NGOÀI vùng cuộn của bảng, không sticky.
 *
 * Nó không cần cuộn cùng dữ liệu, và để chung vùng cuộn với bảng thì hai lớp
 * sticky đè nhau (xem bẫy ở THead).
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    /*
      `flex-wrap`: thanh lọc XUỐNG DÒNG khi hết chỗ thay vì bóp nát chip. Nó chỉ
      thêm một hàng ở màn hẹp, còn ở màn rộng vẫn đúng một hàng như cũ — đắt hơn
      hẳn phương án cuộn ngang, vì chip bị đẩy ra ngoài tầm nhìn là chip không ai
      bấm, mà mỗi chip là một câu hỏi nghiệp vụ.
    */
    <div className="z-[var(--z-bar)] flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]">
      {children}
    </div>
  )
}

/** Chip lọc bật/tắt. Số đếm luôn đi kèm — lọc mà không biết còn bao nhiêu là lọc mù. */
export function Chip({
  on = false,
  count,
  onClick,
  children,
}: {
  on?: boolean
  count?: number
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        // `shrink-0 whitespace-nowrap`: chip là con của một hàng flex, mà flex
        // MẶC ĐỊNH co con xuống dưới bề rộng nội dung. Thiếu hai lớp này thì ở
        // màn hẹp chữ trong chip gãy đôi và TRÀN RA NGOÀI viền bo — chiều cao
        // đã đóng cứng 26px nên không có chỗ cho dòng thứ hai (đo 13/09/2026 ở
        // pane 705px: cả năm chip đều vỡ). Không co thì hàng tự xuống dòng, xem
        // `flex-wrap` ở FilterBar.
        'inline-flex h-[26px] shrink-0 items-center gap-[6px] rounded-[13px] border px-[10px] whitespace-nowrap text-[var(--fs-sm)]',
        on
          ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] text-[var(--ink-2)] hover:border-[var(--ink-3)] hover:text-[var(--ink)]',
      )}
    >
      {children}
      {/*
        NHÓM NGHÌN CHO SỐ ĐẾM (15/09/2026). Lộ ra ở màn mẫu Tồn kho của phân
        hệ Kho: rổ "Cả danh mục" đếm 13.229 mã và chip in ra `13229` — chuỗi
        năm chữ số liền không đọc được bằng mắt lướt, đúng thứ chip sinh ra để
        làm. Chip khác trong hệ đang đếm 1–68 nên lỗi này ẩn cho tới lúc có
        một rổ lớn. Không dùng `showNum` vì nó trả chuỗi rỗng cho 0, mà chip
        đếm 0 phải hiện số 0 — "rổ này trống" cũng là một câu trả lời.
      */}
      {count != null && (
        <span className="num text-[11px] opacity-80">
          {count.toLocaleString('vi-VN')}
        </span>
      )}
    </button>
  )
}

/**
 * Ô TÌM trên thanh lọc.
 *
 * Có mặt trong kit vì mọi màn danh sách đều cần, và vì thiếu nó thì nơi dùng
 * buộc phải viết <input> thô — đúng thứ cổng ESLint chặn.
 *
 * Nút xoá hiện NGAY TRONG ô khi có chữ: đặt thành chip riêng bên cạnh thì
 * người dùng phải tìm, mà xoá từ khoá là thao tác lặp nhiều nhất sau khi gõ.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm…',
  width = 260,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number
}) {
  return (
    <div
      className="flex h-7 items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-[10px] focus-within:border-[var(--act)]"
      style={{ width }}
    >
      <span className="text-[var(--ink-3)]">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-0 bg-transparent text-[12.5px] outline-0 placeholder:text-[var(--ink-3)]"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Xoá từ khoá"
          className="shrink-0 text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      )}
    </div>
  )
}
