'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Ico, type IcoName } from './Icon'
import { footRuns, SortHead, sortAria, type KitEngine } from './TableEngine'
import { cn } from '@/lib/utils'

/**
 * CANH SỐ CỘT giữa `thead` và `tfoot` — CHỈ CHẠY Ở DEV.
 *
 * VÌ SAO CẦN MỘT CÁI CHUÔNG RIÊNG. Lệch cột chân bảng là lỗi trình duyệt
 * KHÔNG hề báo: nó lặng lẽ bóp ô cuối cho chữ xếp gần như DỌC, ô cao vài
 * trăm px, mà ô chân bảng `sticky bottom-0` nên nó ĐÈ LÊN thân bảng. Người
 * dùng thấy "bảng 14 dòng sao chỉ có 3" và không ai đoán ra vì sao.
 *
 * Rà tay 23/09/2026 tìm được **4 màn** đang dính (Lệnh sản xuất, Vật tư theo
 * lệnh, Hồ sơ NCC ×2, Trung tâm duyệt) và một trang MẪU ở design-lab. Tất cả
 * cùng một kiểu: tác giả tính `label colSpan` + ô số cho vừa `THead`, rồi
 * thêm `caveat` mà quên nó chiếm 2 cột mặc định. Script đếm tĩnh KHÔNG bắt
 * được vì `colSpan={more ? 4 : 1}` là biểu thức — phải đo trên DOM thật.
 *
 * Đo `colSpan` của DOM đã dựng nên nó đúng cả với cột bật/tắt theo dữ liệu.
 * `console.error` chứ không `throw`: lệch cột làm màn khó đọc, không làm hỏng
 * dữ liệu — chặn cả trang vì nó là phản ứng quá tay.
 */
export function useColSpanGuard(ref: RefObject<HTMLElement | null>, ten: string) {
  const daBao = useRef('')
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const el = ref.current?.querySelector('table')
    if (!el) return
    const dem = (q: string) =>
      [...el.querySelectorAll(q)].reduce(
        (a, c) => a + ((c as HTMLTableCellElement).colSpan || 1),
        0,
      )
    /*
      Chỉ đếm HÀNG ĐẦU của mỗi khối. Bảng tiêu đề hai tầng (`MatrixTable`) có
      hàng đầu trải hết bề ngang nhờ `rowSpan`/`colSpan`; cộng cả hàng hai là
      đếm cột con hai lần — chuông từng báo oan "thead=25, tfoot=14" cho một
      bảng chéo 14 cột hoàn toàn đúng (24/09/2026).
    */
    const head = dem('thead > tr:first-child > th, thead > tr:first-child > td')
    const foot = dem('tfoot > tr:first-child > th, tfoot > tr:first-child > td')
    if (head === 0 || foot === 0 || head === foot) return
    // Cùng một cặp số thì chỉ kêu một lần, kẻo mỗi lần vẽ lại là một dòng log.
    const khoa = `${head}|${foot}`
    if (daBao.current === khoa) return
    daBao.current = khoa
    console.error(
      `[kit/${ten}] LỆCH CỘT CHÂN BẢNG: thead=${head}, tfoot=${foot}. ` +
        `Ô chân bảng sẽ bị bóp và ĐÈ LÊN thân bảng (nó sticky bottom-0). ` +
        `Nhớ trừ cả ô caveat — mặc định nó chiếm 2 cột.`,
    )
  })
}

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

export function Table<T = unknown>({
  children,
  inline = false,
  onScroll,
  engine,
  onRowClick,
  isSelected,
  rowAnchor,
  label,
}: {
  /** Kiểu GHÉP JSX (`THead` + `<tbody>` + `Row`/`Cell` + `TFoot`). Bỏ trống khi dùng `engine`. */
  children?: ReactNode
  /**
   * TÊN BẢNG cho trình đọc màn hình (`aria-label` của `<table>`), vd. "Danh sách
   * nhà cung cấp". Người đi bằng phím nhảy giữa các bảng theo tên; bảng không tên
   * chỉ được đọc là "bảng", và màn có hai bảng thì không phân biệt được. Không hiện
   * ra mắt — tiêu đề khối trên bảng đã nói điều đó.
   */
  label?: string
  /**
   * Kiểu MÁY (B5): bảng tự vẽ tiêu đề sắp xếp được, dòng, chân bảng tự chia
   * cột, và ẢO HOÁ khi quá `VIRTUAL_FROM` dòng. Tạo bằng `useKitTable`.
   */
  engine?: KitEngine<T>
  /**
   * Chỉ ở kiểu máy: bấm vào dòng thì gọi hàm này (mở khung soi, chọn dòng). Có
   * hàm này thì dòng nhận Tab, Enter/Space bấm như chuột — xem `Row onClick`.
   */
  onRowClick?: (row: T) => void
  /** Chỉ ở kiểu máy: dòng nào đang được chọn — tô nền màu hành động, vạch trái. */
  isSelected?: (row: T) => boolean
  /** Chỉ ở kiểu máy: neo `data-anchor` của từng dòng, để cuộn tới đúng dòng khi mở bằng link. */
  rowAnchor?: (row: T) => string
  /**
   * Bắt sự kiện cuộn của chính vùng cuộn bảng.
   *
   * Cần vì bảng chính cuộn TRONG `ScreenFrame` chứ không cuộn theo trang —
   * `window.scroll` không bao giờ bắn, nên màn muốn co đầu trang khi người
   * dùng cuộn xuống (mẫu Dynamic Page của Fiori) phải nghe ở đây.
   */
  onScroll?: React.UIEventHandler<HTMLDivElement>
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
  const ref = useRef<HTMLDivElement>(null)
  /*
    Vùng cuộn đưa cho máy ảo hoá qua STATE, không qua `ref`. React gắn `ref`
    của thẻ CHA sau khi chạy layout effect của CON, nên lúc `EngineTable` (con)
    khởi động bộ ảo hoá thì `ref.current` còn null — và không có lượt vẽ nào
    sau đó cho nó bắt lại: bảng không bao giờ nghe sự kiện cuộn, cuộn tới giữa
    thì thân bảng TRẮNG. Test bắt được 24/09/2026. Callback ref ghi state → có
    lượt vẽ thứ hai mang phần tử thật xuống.
  */
  const [cuon, setCuon] = useState<HTMLDivElement | null>(null)
  const ganRef = useCallback((el: HTMLDivElement | null) => {
    ref.current = el
    setCuon(el)
  }, [])
  useColSpanGuard(ref, 'Table')
  useStickyPadding(ref)
  const n = engine?.rows.length ?? 0
  return (
    <div
      ref={ganRef}
      onScroll={onScroll}
      className={cn(
        // `k-tscroll`: đệm cuộn cho tiêu đề/chân/cột ghim — xem erp.css (T6).
        'k-tscroll min-w-0 overflow-auto bg-[var(--surface-card)]',
        inline ? 'max-h-[var(--table-inline-max,240px)] shrink-0' : 'flex-1',
        // Mật độ theo lựa chọn người xem: token dày khai ở `.kit.kit-dense`,
        // nên phải có CẢ HAI lớp trên cùng thẻ.
        engine?.density === 'day' && 'kit kit-dense',
      )}
    >
      <table
        className="text-k-sm w-full min-w-[var(--table-min,680px)] border-separate border-spacing-0"
        aria-label={label}
        // Bảng ảo hoá chỉ có vài chục dòng trong DOM: báo cho trình đọc màn
        // hình tổng số thật (+1 hàng tiêu đề), để nó không đọc "bảng 40 dòng".
        aria-rowcount={engine && n > VIRTUAL_FROM ? n + 1 : undefined}
      >
        {engine ? (
          <EngineTable
            engine={engine}
            scrollEl={cuon}
            onRowClick={onRowClick}
            isSelected={isSelected}
            rowAnchor={rowAnchor}
          />
        ) : (
          children
        )}
      </table>
    </div>
  )
}

/** Từ bao nhiêu dòng thì ảo hoá. Dưới mức này vẽ hết: đơn giản và Ctrl+F được. */
export const VIRTUAL_FROM = 200

/*
  T6 — KHÔNG GÌ CHE Ô ĐANG FOCUS (WCAG 2.4.11, mới ở 2.2).

  Tiêu đề và chân bảng DÍNH, cột định danh GHIM trái. Người đi bằng Tab qua các
  link/nút trong bảng thì trình duyệt cuộn ô đó "vào vùng nhìn" — nhưng vùng
  nhìn tính cả phần đang bị ba lớp dính đè lên, nên ô focus nằm ngay DƯỚI tiêu
  đề hoặc SAU cột ghim: có focus mà không ai thấy. `scroll-padding` bảo trình
  duyệt chừa đúng chỗ đó. Bề rộng cột ghim đổi theo dữ liệu nên phải đo.
*/
export function useStickyPadding(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    /*
      ĐO cả ba dải, không đoán. Bản đầu chừa cố định 44px cho chân bảng; đo trên
      màn Nhà cung cấp thì chân cao 65px (câu "tổng không gồm gì" xuống dòng) —
      vẫn 16/172 lần Tab xuôi ô focus lọt dưới chân. Chiều cao đổi theo dữ liệu
      và bề ngang cửa sổ nên phải theo dõi liên tục.
    */
    const head = el.querySelector<HTMLElement>('thead')
    const foot = el.querySelector<HTMLElement>('tfoot')
    // Bảng chéo (`MatrixTable`) ghim NHIỀU cột: chừa tới mép phải cột ghim CUỐI.
    const pin = el.querySelector<HTMLElement>(
      'thead.k-pin1 th:first-child, thead th[data-pin-last]',
    )
    const ro = new ResizeObserver(() => {
      if (head) el.style.setProperty('--k-head-h', `${head.offsetHeight}px`)
      el.style.setProperty('--k-foot-h', `${foot?.offsetHeight ?? 0}px`)
      el.style.setProperty('--k-pin-w', `${pin ? pin.offsetLeft + pin.offsetWidth : 0}px`)
    })
    for (const x of [head, foot, pin]) if (x) ro.observe(x)
    return () => ro.disconnect()
  })
}

function EngineTable<T>({
  engine,
  scrollEl,
  onRowClick,
  isSelected,
  rowAnchor,
}: {
  engine: KitEngine<T>
  scrollEl: HTMLDivElement | null
  onRowClick?: (row: T) => void
  isSelected?: (row: T) => boolean
  rowAnchor?: (row: T) => string
}) {
  const { rows, cols } = engine
  const ao = rows.length > VIRTUAL_FROM
  const rowH = engine.density === 'day' ? 26 : 31
  const v = useVirtualizer({
    count: ao ? rows.length : 0,
    getScrollElement: () => scrollEl,
    estimateSize: () => rowH,
    getItemKey: (i) => engine.keyOf(rows[i]),
    overscan: 12,
    /*
      Khung ƯỚC LƯỢNG cho lượt vẽ đầu. Thiếu nó thì trước khi đo được vùng cuộn
      (và trong HTML dựng ở server) bộ ảo hoá tính ra 0 dòng — bảng nháy TRỐNG
      rồi mới hiện. Test bắt được đúng lỗi này (24/09/2026).
    */
    initialRect: { width: 0, height: 800 },
  })
  const items = ao ? v.getVirtualItems() : []
  /*
    ẢO HOÁ BẰNG DÒNG ĐỆM, không bằng `display: grid` như ví dụ của TanStack:
    đổi `<tbody>` sang grid là mỗi dòng tự chia cột riêng, cột lệch nhau, và
    tiêu đề/chân DÍNH của kit (sticky trong `<table>`) hết dính. Hai `<tr>` đệm
    trên/dưới giữ nguyên bảng thật — cột thẳng, sticky còn, `colSpan` đúng.
  */
  const padTop = items[0]?.start ?? 0
  const padBot = ao ? v.getTotalSize() - (items[items.length - 1]?.end ?? 0) : 0
  const ve = ao ? items.map((it) => [it.index, rows[it.index]] as const) : rows.map((r, i) => [i, r] as const) // prettier-ignore
  const pinFirst = !!cols[0]?.pin

  return (
    <>
      <THead pinFirst={pinFirst}>
        {cols.map((c) => {
          const dir = engine.sortOf(c.id)
          return (
            <th
              key={c.id}
              aria-sort={sortAria(dir, !!c.sort)}
              style={c.num ? { textAlign: 'right' } : undefined}
            >
              <SortHead
                dir={dir}
                align={c.num ? 'right' : undefined}
                onSort={c.sort ? () => engine.toggleSort(c.id) : undefined}
              >
                {c.header}
              </SortHead>
            </th>
          )
        })}
      </THead>
      <tbody>
        {padTop > 0 && (
          <tr aria-hidden style={{ height: padTop }}>
            <td colSpan={cols.length} className="p-0" />
          </tr>
        )}
        {ve.map(([i, r]) => (
          <Row
            key={engine.keyOf(r)}
            selected={isSelected?.(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            anchor={rowAnchor?.(r)}
            aria-rowindex={ao ? i + 2 : undefined}
          >
            {cols.map((c) => (
              <Cell
                key={c.id}
                num={c.num}
                grow={c.grow}
                muted={c.muted}
                pin={c.pin && c === cols[0]}
                rowHeader={c.rowHeader}
                title={c.title?.(r)}
              >
                {c.cell(r)}
              </Cell>
            ))}
          </Row>
        ))}
        {padBot > 0 && (
          <tr aria-hidden style={{ height: padBot }}>
            <td colSpan={cols.length} className="p-0" />
          </tr>
        )}
      </tbody>
      {engine.foot && (
        <tfoot className={TFOOT_CLS}>
          <tr>
            {footRuns(cols, engine.foot).map((f, i) => (
              <td
                key={f.key}
                colSpan={f.span > 1 ? f.span : undefined}
                className={cn(
                  f.num && 'num',
                  // Dải lưu ý (không phải ô nhãn) chữ thường, nhạt — như `caveat`.
                  !f.own && i > 0 && 'text-k-sm font-normal text-[var(--ink-3)]',
                )}
              >
                {f.node}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </>
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
  /** Các ô `<th>` của hàng tiêu đề — kit tự bọc một `<tr>`. Tiêu đề cột số phải tự căn phải (`textAlign: 'right'`). */
  children: ReactNode
  /** Ghim ô tiêu đề ĐẦU TIÊN cả hai chiều — đi kèm `<Cell pin>` ở thân bảng. */
  pinFirst?: boolean
}) {
  return (
    <thead
      className={cn(
        '[&_th]:text-k-label [&_th]:sticky [&_th]:top-0 [&_th]:z-[var(--z-sticky)] [&_th]:border-b [&_th]:border-[var(--line)] [&_th]:bg-[var(--surface-raised)] [&_th]:px-[var(--pad-x)] [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:tracking-[.04em] [&_th]:whitespace-nowrap [&_th]:text-[var(--ink-2)] [&_th]:uppercase',
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
 *
 * Mỗi khối nên là một `<tbody>` riêng (dòng khối đứng đầu): ô tên khối là
 * `<th scope="rowgroup">`, và `rowgroup` chính là `<tbody>` chứa nó.
 */
export function GroupRow({
  step,
  name,
  meta,
  cols,
}: {
  /** Số thứ tự công đoạn (khung → gỗ → … → bao bì), in trong ô vuông trước tên. Bỏ trống thì không có ô. */
  step?: number | string
  /** Tên khối — bám mép trái khi bảng kéo ngang, để dòng bên dưới không mất chủ. */
  name: string
  /** Tóm tắt khối ở bên phải (số dòng, số tiền còn nợ…) — chữ đọc một lần, trôi theo khi kéo ngang. */
  meta?: ReactNode
  /**
   * Số cột của bảng — PHẢI bằng số cột của `THead`. Chuông canh lệch cột chỉ so
   * tiêu đề với chân, không so dòng này: đặt sai thì dòng khối hụt ô mà không ai báo.
   */
  cols: number
}) {
  return (
    <tr>
      {/*
        TIÊU ĐỀ NHÓM DÒNG, không phải một ô trải ngang (B7½, 24/09/2026).

        Là `<td>` thì trình đọc màn hình đọc "Khung" như một ô dữ liệu rồi đi
        tiếp, và các dòng bên dưới không biết mình thuộc khối nào. `<th
        scope="rowgroup">` nói đúng quan hệ đó. Nó ĐÚNG NGHĨA khi mỗi khối nằm
        trong một `<tbody>` riêng — `rowgroup` chính là `<tbody>`; dồn mọi khối
        vào một `<tbody>` thì tiêu đề nhận cả những dòng của khối sau.

        Giữ nguyên hình: `th` mặc định căn giữa → `text-left`; luật chung của
        kit cho `tbody td` (đệm dọc, vạch dưới mảnh, căn trên) không phủ tới
        `th` nên chép lại, chỉ trong phạm vi `.kit`. Riêng nền thì CỐ Ý không
        chép luật sọc chẵn + rê chuột: dòng khối không bấm được, và nền ô đổi
        màu dưới cái tên đang giữ nền nâng (xem `span` dưới) là hai mảng nền
        lệch nhau — vết cũ của bản `td`.
      */}
      <th
        scope="rowgroup"
        colSpan={cols}
        className="text-k-label h-[29px] border-y border-[var(--line)] bg-[var(--surface-raised)] px-[var(--pad-x)] text-left font-bold tracking-[.07em] text-[var(--ink-2)] uppercase in-[.kit]:border-b-[var(--hair)] in-[.kit]:py-[var(--pad-y)] in-[.kit]:align-top"
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
            <span className="text-k-label mr-2 inline-block h-[17px] w-[17px] rounded-[3px] border border-[var(--act-line)] bg-[var(--act-wash)] text-center font-[family-name:var(--font-mono)] leading-[15px] font-bold text-[var(--act)]">
              {step}
            </span>
          )}
          {name}
        </span>
        {meta && (
          <span className="text-k-sm float-right font-medium tracking-[.03em] text-[var(--ink-3)] normal-case">
            {meta}
          </span>
        )}
      </th>
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
  onKeyDown,
  ...rest
}: Omit<React.HTMLAttributes<HTMLTableRowElement>, 'onClick'> & {
  /** Dòng đang được chọn (đang soi ở khung bên) — nền màu hành động + vạch trái, không dùng màu vòng đời. */
  selected?: boolean
  /**
   * Bấm vào dòng. Có thì con trỏ thành bàn tay, dòng nhận Tab (có vòng focus), và
   * Enter/Space trên chính dòng gọi hàm này như chuột. Ô định danh VẪN nên là
   * link/nút: đó là thứ trình đọc màn hình gọi được tên, còn dòng chỉ là lối tắt.
   */
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
  /** Các ô `Cell` của dòng — số ô phải bằng số cột của `THead`. */
  children: ReactNode
}) {
  /*
    DÒNG BẤM ĐƯỢC PHẢI TỚI ĐƯỢC BẰNG PHÍM (B7½, 24/09/2026 — WCAG 2.1.1).
    Bản trước chỉ gắn `onClick`: người đi bằng Tab lướt qua mà không mở được
    khung soi, trừ khi màn nhớ đặt một nút trong ô.

    Chỉ nhận phím khi CHÍNH DÒNG đang có focus (`target === currentTarget`):
    Enter trên link trong ô đã tự sinh một cú click nổi bọt lên dòng — bắt thêm
    ở đây là bấm hai lần; Space trong một ô nhập trong dòng là gõ dấu cách.
    Space phải `preventDefault`, không thì vùng cuộn của bảng nhảy xuống một trang.
  */
  const phim = onClick
    ? (e: React.KeyboardEvent<HTMLTableRowElement>) => {
        onKeyDown?.(e)
        if (e.defaultPrevented || e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }
    : onKeyDown
  return (
    <tr
      {...rest}
      data-anchor={anchor}
      onClick={onClick}
      onKeyDown={phim}
      tabIndex={onClick ? (rest.tabIndex ?? 0) : rest.tabIndex}
      className={cn(
        'group',
        /*
          Vòng focus cho dòng. Trong `.kit`, luật focus chung ở tokens.css (không
          nằm trong layer nên thắng lớp tiện ích) vẽ vòng 2px `--act` lệch RA
          1px — vẫn thấy rõ, và `scroll-padding` của T6 chừa chỗ cho nó. Các lớp
          dưới đây là đường lùi khi bảng đứng ngoài `.kit`: kẻ LÕM vào dòng để
          tiêu đề/chân dính không che mép.
        */
        onClick &&
          'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--act)]',
        selected
          ? 'k-on [&>:first-child]:shadow-[inset_2px_0_0_var(--act)]'
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
  rowHeader = false,
  title,
  className,
}: {
  /**
   * Ô này là TIÊU ĐỀ DÒNG — thẻ `<th scope="row">`, hình không đổi. Đặt cho ô định
   * danh (mã, tên NCC): đi dọc một cột số, trình đọc màn hình đọc kèm tên dòng
   * ("An Phát, Đã đặt, 12") thay vì một con số không chủ. Mỗi dòng một ô.
   */
  rowHeader?: boolean
  /** Nội dung ô. Chữ dài bị cắt bằng dấu ba chấm — kèm `title` để đọc lại nguyên văn. */
  children: ReactNode
  /** Cột SỐ/TIỀN/NGÀY: chữ đơn cách, chữ số đều bề ngang, căn phải — so được theo chiều dọc. */
  num?: boolean
  /**
   * Cột CO GIÃN (tên vật tư, tên NCC): xin toàn bộ bề rộng dư, có sàn đọc được
   * (`--col-grow`, mặc định 200px). Mỗi bảng thường đúng một cột như vậy.
   */
  grow?: boolean
  /** Chữ phụ, nhỏ và nhạt — cột tra cứu (người phụ trách, nhóm), không phải cột người ta đến để đọc. */
  muted?: boolean
  /** Ghim ô vào mép trái khi bảng cuộn ngang — cột ĐỊNH DANH. Đi cùng `<THead pinFirst>`. */
  pin?: boolean
  /**
   * Chữ đầy đủ hiện khi rê chuột. Ô nào bị chặn bề rộng thì PHẢI có: cắt chữ
   * mà không có đường đọc lại nguyên văn là giấu dữ liệu, không phải rút gọn.
   */
  title?: string
  /** Lớp thêm cho ô — chỉ dùng token (vd. chữ màu `--stop` cho hạn đã trễ), không dùng màu cứng. */
  className?: string
}) {
  /*
    TIÊU ĐỀ DÒNG MANG HÌNH Ô THƯỜNG (B7½, 24/09/2026).

    `th` khác `td` ở hai chỗ phải gỡ: chữ đậm + căn giữa mặc định của trình
    duyệt, và luật chung của kit trong erp.css chỉ khai cho `tbody td` (đệm
    dọc, vạch phải, căn trên, sọc chẵn, rê chuột, dòng đang chọn) nên không phủ
    tới `th`. Chép lại đúng các luật đó, trong phạm vi `.kit` như bản gốc. Không
    sửa erp.css để khỏi đụng mọi bảng khác; `.kit .num` (căn phải) vẫn phủ vì nó
    không kén thẻ.

    Thứ tự nền: sọc chẵn < rê chuột < đang chọn — y như thứ tự khai trong
    erp.css. Ô ghim bỏ lớp rê chuột riêng của nó ở đây: hai lớp rê chuột cùng
    tranh một thuộc tính thì thắng thua theo thứ tự Tailwind sinh ra, không theo
    ý người viết.
  */
  const O = rowHeader ? 'th' : 'td'
  return (
    <O
      scope={rowHeader ? 'row' : undefined}
      title={title}
      className={cn(
        'h-[var(--row-h)] overflow-hidden border-b border-[var(--hair)] px-[var(--pad-x)] text-ellipsis whitespace-nowrap',
        num && 'num',
        grow && 'w-full max-w-0 min-w-[var(--col-grow,200px)]',
        muted && 'text-k-sm text-[var(--ink-3)]',
        // Nền đặc bắt buộc: trong suốt thì nội dung cuộn qua hiện chồng lên.
        pin && 'sticky left-0 z-[2] bg-[var(--surface-card)]',
        pin && !rowHeader && 'group-hover:bg-[var(--surface-hover)]',
        rowHeader && [
          'font-normal',
          !num && 'text-left',
          'in-[.kit]:border-r in-[.kit]:py-[var(--pad-y)] in-[.kit]:align-top in-[.kit]:last:border-r-0',
          'in-[.kit]:group-even:bg-[color-mix(in_srgb,var(--surface-raised)_45%,var(--surface-card))]',
          'in-[.kit]:group-hover:bg-[var(--act-wash)] in-[.kit]:group-[.k-on]:bg-[var(--act-wash)]',
        ],
        className,
      )}
    >
      {children}
    </O>
  )
}

/**
 * CHÂN BẢNG DÍNH — tổng luôn nhìn thấy.
 *
 * `caveat` là chỗ nói phần tổng KHÔNG bao gồm cái gì. Con số tổng che giấu
 * điều kiện là con số nguy hiểm: "5.482.000" mà 14/16 mã chưa có giá thì
 * người ký tưởng đó là toàn bộ tiền phải chi.
 */
const TFOOT_CLS =
  '[&_td]:sticky [&_td]:bottom-0 [&_td]:z-[calc(var(--z-sticky)_+_2)] [&_td]:h-9 [&_td]:border-t [&_td]:border-[var(--line)] [&_td]:bg-[var(--surface-raised)] [&_td]:px-[var(--pad-x)] [&_td]:font-semibold'

export function TFoot({
  label,
  cells,
  caveat,
  caveatSpan = 2,
}: {
  /**
   * Ô NHÃN — phải là chính thẻ `<td colSpan={n}>` (vd. "Cộng 12 đơn đang hiện"),
   * không phải chữ trơn. `colSpan` của nó cộng `cells` cộng `caveatSpan` phải bằng số cột `THead`.
   */
  label: ReactNode
  /** Các ô tổng — mỗi ô một thẻ `<td className="num">`, đứng đúng dưới cột của nó. */
  cells: ReactNode
  /**
   * Câu nói tổng KHÔNG gồm gì ("Chưa gồm 3 đơn chưa có giá"). Con số tổng che
   * điều kiện là con số nguy hiểm. Chiếm `caveatSpan` cột.
   */
  caveat?: ReactNode
  /**
   * Số cột ô caveat chiếm. Mặc định 2 — hợp với phần lớn bảng, và giữ nguyên
   * cho 10 màn đã dựng trước 21/09/2026.
   *
   * VÌ SAO PHẢI MỞ RA CHO CALLER CHỈNH: tổng cột của chân bảng =
   * nhãn + `cells` + caveat, và nó PHẢI bằng số cột của `THead`. Lệch thì
   * trình duyệt không ném lỗi nào — nó bóp cột cuối lại và chữ caveat xếp
   * DỌC một ký tự mỗi dòng, ăn hết chiều cao bảng. Đã dính đúng vậy ở màn ghi
   * sản lượng (8 cột, nhưng chân bảng cộng ra 9).
   */
  caveatSpan?: number
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
    <tfoot className={TFOOT_CLS}>
      <tr>
        {label}
        {cells}
        {caveat && (
          <td className="text-k-sm font-normal text-[var(--ink-3)]" colSpan={caveatSpan}>
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
export function FilterBar({
  children,
}: {
  /** Ô tìm, các chip lọc, và nút `TableSettings` (đẩy sang phải bằng một khối `ml-auto`). Hết chỗ thì tự xuống dòng. */
  children: ReactNode
}) {
  return (
    /*
      `flex-wrap`: thanh lọc XUỐNG DÒNG khi hết chỗ thay vì bóp nát chip. Nó chỉ
      thêm một hàng ở màn hẹp, còn ở màn rộng vẫn đúng một hàng như cũ — đắt hơn
      hẳn phương án cuộn ngang, vì chip bị đẩy ra ngoài tầm nhìn là chip không ai
      bấm, mà mỗi chip là một câu hỏi nghiệp vụ.
    */
    <div className="z-[var(--z-bar)] flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
      {children}
    </div>
  )
}

/** Chip lọc bật/tắt. Số đếm luôn đi kèm — lọc mà không biết còn bao nhiêu là lọc mù. */
export function Chip({
  on = false,
  count,
  icon,
  onClick,
  children,
}: {
  /** Chip đang bật — nền nhạt màu hành động, chữ đậm; báo cho trình đọc qua `aria-pressed`. */
  on?: boolean
  /**
   * Số dòng chip này sẽ để lại — đếm bằng ĐÚNG hàm lọc của bảng (nguyên tắc 3).
   * In nhóm nghìn kiểu Việt; 0 vẫn in "0" vì "rổ này trống" cũng là câu trả lời.
   */
  count?: number
  /** Khái niệm nghiệp vụ, đứng trước chữ — xem từ vựng ở `kit/Icon.tsx`. */
  icon?: IcoName
  /** Bấm chip. Chip không tự giữ trạng thái — màn đổi `on` trong hàm này. */
  onClick?: () => void
  /** Nhãn chip — một câu hỏi nghiệp vụ ngắn ("Chờ tôi duyệt", "Quá hẹn"), không phải tên trạng thái kỹ thuật. */
  children: ReactNode
}) {
  return (
    <button
      // Nút mặc định của HTML là `submit`: chip nằm trong một <form> thì bấm lọc
      // là nộp form (B7½).
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        // `shrink-0 whitespace-nowrap`: chip là con của một hàng flex, mà flex
        // MẶC ĐỊNH co con xuống dưới bề rộng nội dung. Thiếu hai lớp này thì ở
        // màn hẹp chữ trong chip gãy đôi và TRÀN RA NGOÀI viền bo — chiều cao
        // đã đóng cứng 26px nên không có chỗ cho dòng thứ hai (đo 13/09/2026 ở
        // pane 705px: cả năm chip đều vỡ). Không co thì hàng tự xuống dòng, xem
        // `flex-wrap` ở FilterBar.
        'text-k-sm inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-[13px] border px-2.5 whitespace-nowrap',
        on
          ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] text-[var(--ink-2)] hover:border-[var(--ink-3)] hover:text-[var(--ink)]',
      )}
    >
      {icon && <Ico name={icon} size={14} />}
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
        <span className="num text-k-label opacity-80">
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
  label,
}: {
  /** Từ khoá hiện tại — ô là ô ĐIỀU KHIỂN, màn giữ giá trị. */
  value: string
  /** Gọi ở MỖI phím gõ (không trễ) và khi bấm ✕ (với chuỗi rỗng). Lọc ở server thì màn tự giãn nhịp. */
  onChange: (v: string) => void
  /**
   * Gợi ý tìm được theo gì ("Tìm tên, mã, mã số thuế…"). Mất đi ngay khi gõ chữ đầu
   * tiên — nên nó KHÔNG phải tên ô; tên ô là `label`.
   */
  placeholder?: string
  /** Bề rộng ô, tính bằng px. */
  width?: number
  /**
   * TÊN Ô cho trình đọc màn hình (`aria-label`), vd. "Tìm nhà cung cấp". Không hiện
   * ra mắt — ⌕ và gợi ý đã nói với người nhìn. Bỏ trống thì dùng `placeholder`,
   * placeholder rỗng thì "Tìm": ô không bao giờ câm.
   */
  label?: string
}) {
  /*
    TÊN RIÊNG CHO Ô (B7½, 24/09/2026). Bản trước để `placeholder` làm tên duy
    nhất: một số trình đọc không đọc placeholder, và công cụ kiểm tra coi đó là
    ô không nhãn. `aria-label` chắc chắn được đọc, và mặc định lấy chính gợi ý
    nên 24 chỗ gọi cũ (20 file) tự có tên mà không phải sửa.
  */
  const ten = label || placeholder || 'Tìm'
  return (
    <div
      className="flex h-7 items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 focus-within:border-[var(--act)]"
      style={{ width }}
    >
      {/* Ký hiệu trang trí — không ẩn thì trình đọc có thể đọc tên ký tự Unicode. */}
      <span aria-hidden className="text-[var(--ink-3)]">
        ⌕
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ten}
        className="text-k-sm w-full border-0 bg-transparent outline-0 placeholder:text-[var(--ink-3)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          // Tên nói nút xoá cái gì; ký hiệu ✕ đứng một mình không có nghĩa.
          aria-label="Xoá ô tìm"
          className="shrink-0 text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      )}
    </div>
  )
}
