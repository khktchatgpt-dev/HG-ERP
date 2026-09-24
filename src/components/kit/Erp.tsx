'use client'

import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
// Chuông canh lệch cột chân bảng — `Grid` mang đúng rủi ro như `Table`
// (`GridFoot` cũng sticky). Một chỗ định nghĩa, hai chỗ dùng.
import { useColSpanGuard } from './Table'
import { footRuns, SortHead, sortAria, type KitEngine } from './TableEngine'
import { Ico, type IcoName } from './Icon'

/**
 * Ghép class. Dùng HÀM chứ không phải chuỗi mẫu `${cond ? ' x' : ''}`.
 *
 * BẪY ĐÃ DÍNH 09/09/2026: dấu cách đứng đầu chuỗi bên trong template literal
 * bị công cụ định dạng nuốt mất, và lỗi ra hoàn toàn CÂM — class dính thành
 * `k-actk-act-s`, TypeScript không kêu, lint không kêu, chỉ là kiểu dáng
 * biến mất. Viết bằng hàm thì không có dấu cách nào nằm trong chuỗi để mất.
 */
const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT — KHUNG CHỨNG TỪ THEO NGÔN NGỮ ERP
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Mười thành phần dựng nên một màn chứng từ ERP thật. Mỗi cái chép từ một hệ
 * cụ thể và ghi rõ chép của ai — để sau này ai sửa còn biết đang phá vỡ quy
 * ước của ai.
 *
 * Vì sao có file này: bộ kit trước đó tuy đẹp nhưng là từ vựng của ứng dụng
 * WEB — nút chính + menu "⋯", thẻ KPI, tab phẳng. Nó thiếu hẳn những thứ mà
 * mọi ERP đều có và người dùng ERP trông chờ:
 *
 *   · thanh hành động bày SẴN hàng chục nút, chia nhóm có nhãn
 *   · khối thu gọn được mà DÒNG TIÊU ĐỀ vẫn mang số liệu
 *   · khung dữ kiện bên phải
 *   · bảng kiểm chặn gửi duyệt, nói rõ vướng gì
 *   · nhật ký thay đổi trường, tách khỏi trao đổi của người
 *   · thanh trạng thái đáy màn
 *
 * Thiếu chúng thì màn dù đẹp vẫn "không giống ERP" — đúng như chủ dự án nhận
 * xét 09/09/2026.
 *
 * QUY ƯỚC CHUNG: mọi thành phần ở đây chỉ BÀY, không tự nạp dữ liệu và không
 * tự quyết nghiệp vụ. Ai được bấm nút nào là việc của service/permissions;
 * trang truyền xuống cờ `disabled` + `title` nói lý do.
 */

/* ══════════════════════════════════════════════════════════════════════
   1. THANH ĐỊNH VỊ — module › danh sách › chứng từ
   Kèm KHUNG NHÌN LƯU ĐƯỢC ("variant" của SAP, "saved view" của Dynamics) và
   ĐIỀU HƯỚNG BẢN GHI (‹ 14/68 ›) — thứ web hầu như không bao giờ có, nhưng
   người ERP dùng liên tục để duyệt qua cả tập chứng từ mà không quay ra danh
   sách.
   ══════════════════════════════════════════════════════════════════════ */
export function Crumb({
  path,
  view,
  onView,
  position,
  onPrev,
  onNext,
  label = 'Đường dẫn',
}: {
  /**
   * Đường dẫn nghiệp vụ. Phần tử cuối là chứng từ đang mở.
   *
   * MẢNH CÓ `href` THÌ BẤM ĐƯỢC. Tới 14/09/2026 `path` chỉ nhận `string[]`,
   * nên dải này trông y hệt một breadcrumb mà không mảnh nào đi đâu được —
   * chủ dự án báo đúng chỗ: "Đơn mua › PO-2026-0067, phần này không hoạt động
   * để quay lại trang". Nó là thứ GIỐNG đường dẫn nhất trên màn chứng từ và
   * nằm ngay cạnh mã đơn, nên là chỗ đầu tiên người ta bấm để quay ra.
   *
   * Vẫn nhận chuỗi trần để 6 chỗ gọi cũ không phải sửa; mảnh CUỐI (chứng từ
   * đang mở) thì không bao giờ là link — nó là trang hiện tại.
   */
  path: (string | { label: string; href: string })[]
  /** Nhãn khung nhìn đang chọn. Bỏ trống thì không hiện khối này. */
  view?: string
  /** Bấm nút khung nhìn — thường mở menu chọn khung nhìn đã lưu. Chỉ có tác dụng khi có `view`. */
  onView?: () => void
  /** [thứ tự, tổng] — ví dụ [14, 68]. */
  position?: [number, number]
  /**
   * Sang chứng từ TRƯỚC trong cùng tập đang lọc ở danh sách. Bỏ trống thì nút ‹
   * vẫn hiện nhưng bấm không làm gì — ở chứng từ đầu tập, trang tự quyết.
   */
  onPrev?: () => void
  /** Sang chứng từ SAU trong cùng tập. Cùng luật với `onPrev`. */
  onNext?: () => void
  /**
   * Tên mốc `<nav>`. Màn thật có MỘT đường dẫn nên để mặc định; chỉ đổi khi một
   * trang bày nhiều `Crumb` (sách tra) — hai mốc trùng tên thì trình đọc không
   * phân biệt được, axe báo `landmark-unique`.
   */
  label?: string
}) {
  /*
    LANDMARK ĐƯỜNG DẪN (B7½, 24/09/2026). Tới đây dải là một `<div>` trần: trình
    đọc không nhảy tới được bằng phím mốc, dấu › bị đọc thành tiếng giữa các
    mảnh ("Đơn mua, lớn hơn, PO-…"), và mảnh cuối không nói mình là trang đang
    mở — cả ba ghi ở trang tài liệu `crumb` khi viết sách tra B7.
  */
  return (
    <nav className="k-crumb" aria-label={label}>
      {path.map((raw, i) => {
        const p = typeof raw === 'string' ? raw : raw.label
        const href = typeof raw === 'string' ? null : raw.href
        const cuoi = i === path.length - 1
        const noiDung = i === 0 ? (
          <span className="k-crumb-mod">{p}</span>
        ) : cuoi ? (
          <b>{p}</b>
        ) : (
          <span>{p}</span>
        ) // prettier-ignore
        return (
          <span
            key={p + i}
            className="k-crumb-i"
            aria-current={cuoi ? 'page' : undefined}
          >
            {i > 0 && (
              <span className="k-crumb-sep" aria-hidden>
                ›
              </span>
            )}
            {href && !cuoi ? (
              // `next/link`: quay ra danh sách là điều hướng trong app, không
              // phải tải lại tài liệu — giữ được bộ lọc đang đặt ở màn danh sách.
              <Link href={href} className="hover:text-[var(--act)] hover:underline">
                {noiDung}
              </Link>
            ) : (
              noiDung
            )}
          </span>
        )
      })}

      {view && (
        <span className="k-view">
          <span className="k-view-k">Khung nhìn</span>
          <button type="button" className="k-view-b" onClick={onView}>
            {view} ▾
          </button>
        </span>
      )}

      {position && (
        <span className="k-recnav">
          <button
            type="button"
            className="k-recnav-b"
            onClick={onPrev}
            aria-label="Chứng từ trước"
          >
            ‹
          </button>
          <span className="k-recnav-p num">
            {position[0]} / {position[1]}
          </span>
          <button
            type="button"
            className="k-recnav-b"
            onClick={onNext}
            aria-label="Chứng từ sau"
          >
            ›
          </button>
        </span>
      )}
    </nav>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   2. ACTION PANE — Dynamics 365 F&O
   Nút bày SẴN, chia nhóm, mỗi nhóm có NHÃN bên dưới. Không giấu vào menu
   "⋯": người dùng ERP mở màn này vài chục lần mỗi ngày và bấm bằng trí nhớ
   vị trí, nên nút phải đứng yên một chỗ.
   ══════════════════════════════════════════════════════════════════════ */
/**
 * NÚT BỊ KHOÁ NÓI LÝ DO Ở ĐÂU.
 *
 * Trước 16/09/2026 lý do chỉ nằm trong `title` — tức phải RÊ CHUỘT và đợi
 * khoảng một giây mới hiện, không có trên bàn phím, không có trên cảm ứng. Đo
 * trên màn đơn mua: 7/16 nút bị khoá, cả 7 giấu lý do trong tooltip, và nút
 * khoá lại mờ 50% trên nền trắng nên gần như biến mất. Người dùng thấy một
 * thanh công cụ nửa tàng hình, bấm không được, không biết vì sao.
 *
 * Luật kiểm của sổ thiết kế nói thẳng: "Hành động bị chặn phải nói vướng gì và
 * CÁCH GỠ, ngay tại chỗ. Không cho bấm rồi mới báo lỗi." Nên nút khoá nay là
 * `aria-disabled` chứ không phải `disabled`: vẫn bấm được, bấm thì lý do
 * hiện thành một dòng ngay dưới thanh — tại chỗ, đọc được, không cần chuột.
 */
const LockCtx = createContext<((why: string) => void) | null>(null)

export function ActionPane({
  tabs,
  children,
}: {
  /**
   * Hàng tab phân hệ phía trên (Đơn hàng · Nhận hàng · Tài chính). Chỉ đổi NHÓM
   * NÚT đang bày, không đổi trang. Bỏ trống thì không có hàng tab.
   */
  tabs?: ActionTab[]
  /** Các `<ActionGroup>`. Nút khoá bên trong nói lý do tại dòng dưới thanh. */
  children: ReactNode
}) {
  const [why, setWhy] = useState<string | null>(null)
  return (
    <div className="k-pane">
      {tabs && tabs.length > 0 && (
        <div className="k-pane-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={!!t.active}
              className={cx('k-pt', t.active && 'on')}
              disabled={t.disabled}
              title={t.title}
              onClick={t.onClick}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <LockCtx.Provider value={setWhy}>
        <div className="k-pane-groups">{children}</div>
      </LockCtx.Provider>
      {why && (
        <div className="k-pane-why" role="status">
          <span className="k-pane-why-k">Chưa bấm được</span>
          <span>{why}</span>
          <button
            type="button"
            className="k-pane-why-x"
            onClick={() => setWhy(null)}
            aria-label="Đóng lý do"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export type ActionTab = {
  /** Tên phân hệ — cũng là khoá React, nên không trùng trong một thanh. */
  label: string
  /** Tab đang chọn — gạch chân màu hành động, `aria-selected`. */
  active?: boolean
  /** Đổi nhóm nút đang bày. Trang giữ trạng thái tab nào đang mở. */
  onClick?: () => void
  /**
   * Tab chưa có phân hệ. HIỆN MỜ kèm `title` chứ không giấu đi: người dùng
   * cần biết phần mềm SẼ có mảng đó, và biết vì sao giờ chưa bấm được. Giấu
   * thì mỗi lần bật thêm một phân hệ là thanh công cụ lại đổi hình, phá đúng
   * trí nhớ vị trí mà Action Pane nuôi.
   */
  disabled?: boolean
  /** Lý do tab bị tắt — hiện khi rê chuột (tab KHÔNG có khoá mềm như `Action`). */
  title?: string
}

export function ActionGroup({
  label,
  children,
}: {
  /** Nhãn nhóm in hoa nhỏ DƯỚI hàng nút (Duy trì, Luồng phê duyệt, In). Nói nhóm việc, không nói tên nút. */
  label: string
  /** Các `<Action>` của nhóm — đứng một hàng, không xuống dòng trong nhóm. */
  children: ReactNode
}) {
  return (
    <div className="k-grp">
      <div className="k-grp-btns">{children}</div>
      <div className="k-grp-lab">{label}</div>
    </div>
  )
}

export function Action({
  children,
  icon,
  primary,
  strong,
  disabled,
  title,
  onClick,
}: {
  /** Chữ trên nút — một động từ nghiệp vụ (Gửi duyệt, Nhận hàng), không phải "OK". */
  children: ReactNode
  /**
   * Icon ĐỨNG TRƯỚC CHỮ — khái niệm nghiệp vụ ở `kit/Icon.tsx`. Thanh hành
   * động kiểu ribbon (Dynamics) là nơi mắt quét nhiều nút nhất; icon là mốc để
   * tìm lại đúng nút bằng trí nhớ vị trí. Luật lint hg/kit-icon bắt động từ
   * quen thuộc (Sửa, Xoá, In, Duyệt…) thiếu icon.
   */
  icon?: IcoName
  /** Hành động chính của nhóm — nền đặc. Mỗi màn chỉ nên có một. */
  primary?: boolean
  /** Đậm chữ, không đổi nền. Dùng cho hành động hay dùng nhất trong nhóm. */
  strong?: boolean
  /**
   * Chưa làm được việc này. Có `title` và nằm trong `ActionPane` thì là KHOÁ
   * MỀM: `aria-disabled`, vẫn bấm được để hiện lý do dưới thanh. Thiếu một
   * trong hai thì khoá cứng (`disabled` thật).
   */
  disabled?: boolean
  /** Khi `disabled`, LUÔN truyền `title` nói lý do — nút xám câm là lỗi UX. */
  title?: string
  /** Việc của nút. Không được gọi khi `disabled` — bấm lúc đó chỉ hiện lý do. */
  onClick?: () => void
}) {
  const tellWhy = useContext(LockCtx)
  /*
    KHOÁ MỀM khi có chỗ nói lý do. `disabled` thật thì trình duyệt NUỐT luôn
    sự kiện bấm, nên không cách nào trả lời "vì sao không bấm được" — đó là lý
    do cũ khiến lý do phải trốn vào tooltip. `aria-disabled` giữ nguyên nghĩa
    cho trình đọc màn hình và vẫn cho phép bấm để hỏi.

    Không có lý do (hoặc Action dùng ngoài ActionPane) thì khoá cứng như cũ —
    thà một nút chết còn hơn một nút bấm vào im lặng.
  */
  const soft = disabled && !!title && !!tellWhy
  return (
    <button
      type="button"
      className={cx(
        'k-act',
        primary && 'k-act-p',
        strong && 'k-act-s',
        disabled && 'k-act-off',
      )}
      disabled={disabled && !soft}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={() => {
        if (!disabled) return onClick?.()
        if (soft && title) tellWhy(title)
      }}
    >
      {icon && <Ico name={icon} />}
      {children}
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   3. ĐẦU CHỨNG TỪ + BA TRỤC TRẠNG THÁI — Dynamics
   Dynamics tách Purchase order status / Document status / Approval status
   thành BA trường độc lập, và tài liệu của họ nói thẳng lý do: một thanh
   tuyến tính không diễn tả nổi "hàng về một phần mà vẫn đang chờ sửa giá".
   Statusbar bấm được là của Odoo — vừa hiện bước, vừa là nút chuyển bước.
   ══════════════════════════════════════════════════════════════════════ */
export function DocHead({
  kind,
  code,
  sub,
  children,
  compact,
}: {
  /** Loại chứng từ, in hoa nhỏ phía trên số hiệu. */
  kind: string
  /** Số hiệu — danh tính của trang, bậc chữ lớn duy nhất. */
  code: string
  /** Dòng phụ dưới số hiệu: đối tác · ngày soạn · người soạn. Một dòng, không phải đoạn văn. */
  sub?: ReactNode
  /** Các `<StatusTrack>`. */
  children?: ReactNode
  /**
   * GỌN — số hiệu 18px trên MỘT dòng với loại và phụ đề, trục trạng thái
   * cùng hàng bên phải, nhãn trục đứng cùng hàng với các bước (không còn bỏ
   * nhãn — erp.css, 10/09/2026). Cho màn chứng từ thật, nơi lưới dòng
   * phải hiện trong 1/3 màn đầu (tiêu chí 1). Mặc định (không gọn) cho
   * màn mẫu và màn ít dòng.
   */
  compact?: boolean
}) {
  return (
    <div className={cx('k-doc', compact && 'k-doc-compact')}>
      <div>
        <div className="k-doc-kind">{kind}</div>
        <h1 className="k-doc-no">{code}</h1>
        {sub && <div className="k-doc-sub">{sub}</div>}
      </div>
      {children && <div className="k-tracks">{children}</div>}
    </div>
  )
}

/**
 * NGHĨA của bước đang đứng — quyết định MÀU của dải.
 *
 * Tới 16/09/2026 dải chỉ biết hai màu: `act` cho mọi bước đang chạy và `stop`
 * cho đơn huỷ. Bảy trên chín trạng thái PO rơi vào `act`, tức cùng một màu
 * xanh với nút chính — chủ dự án chấm "chỉ có mỗi màu xanh trắng, rất khó
 * phân biệt". Gốc là nguyên tắc 5 của sổ thiết kế bị phá: MỘT màu hành động,
 * BA màu vòng đời, mà ba màu vòng đời thì không chỗ nào dùng.
 *
 *   idle — chưa đi đâu cả (nháp, chưa nhận, chưa trả)   → xám
 *   wait — ĐANG CHỜ AI ĐÓ (chờ duyệt, về một phần)      → `--warn`
 *   run  — đã chốt, đang chạy đúng đường                → `--act`
 *   done — xong                                          → `--done`
 *   stop — đã huỷ / đã dừng                              → `--stop`
 *
 * Mặc định `run` để mọi chỗ gọi cũ giữ nguyên hình. Chỗ nào có nghĩa thật thì
 * khai (xem `poTrackStep` ở `lib/po-status.ts`).
 */
export type TrackTone = 'idle' | 'wait' | 'run' | 'done' | 'stop'

export function StatusTrack({
  label,
  steps,
  at,
  tone = 'run',
  marks,
  terminal,
  onPick,
}: {
  /** Tên TRỤC (Trạng thái đơn, Nhận hàng). Mỗi trục một câu hỏi — đừng dồn hai vòng đời vào một dải. */
  label: string
  /** Các bước theo thứ tự đi, chữ ngắn. Cũng là khoá React nên không trùng tên. */
  steps: string[]
  /**
   * Chỉ số bước hiện tại. Bằng hoặc lớn hơn `steps.length` = ĐÃ QUA HẾT trục,
   * không bước nào đang chạy (đơn đã về / đã huỷ thì trục phát hành xong rồi).
   */
  at: number
  /** Màu bước đang ở. `stop` cho vòng đời dừng giữa chừng (huỷ). */
  tone?: TrackTone
  /**
   * MỐC THỜI GIAN THẬT của từng bước — thứ tự khớp `steps`.
   *
   *   'dd/mm/yyyy' — có mốc, bước này THẬT SỰ đã xảy ra
   *   `null`       — hệ thống CÓ chỗ lưu mốc mà TRỐNG: bước chưa từng chạy
   *   `undefined`  — hệ thống không lưu mốc cho bước này, không kết luận gì
   *
   * VÌ SAO PHẢI CÓ (17/09/2026). Dải bước suy từ `status` cuối, nên đơn nào
   * mang trạng thái "đã nhận" là sáu bước tick xanh hết — kể cả 43 đơn được
   * NẠP thẳng vào ở trạng thái cuối, không có `approved_at`, `ordered_at` hay
   * `confirmed_at` nào. Dải khi đó khẳng định "đã duyệt · đã gửi · NCC xác
   * nhận" cho những việc chưa ai làm.
   *
   * Đó là vi phạm nguyên tắc 6 của sổ thiết kế — số nào không kiểm được thì
   * không ai tin, và một nhãn bịa làm hỏng lòng tin của cả những nhãn đúng.
   */
  marks?: (string | null | undefined)[]
  /**
   * BẬC KẾT THÚC ngoài trục — chứng từ dừng hẳn ở một chỗ không nằm trong dãy
   * bước (đơn huỷ). Đi kèm `at: -1` thì cả trục lùi về nhạt: nó không còn nghĩa
   * nữa, và nói vậy trung thực hơn là tick xanh những bước đơn chưa hề đi qua.
   */
  terminal?: string
  /**
   * Có = mỗi bước là NÚT chuyển bước (kiểu Odoo), nhận chỉ số bước bấm. Không
   * có = dải chỉ-đọc dựng bằng `<span>`. Đừng truyền nếu không thật sự đổi được
   * trạng thái — nút chuyển bước thật nằm ở `ActionPane`.
   */
  onPick?: (i: number) => void
}) {
  const thieuMoc = steps.filter((_, i) => i < at && marks?.[i] === null).length
  return (
    <div>
      {/* Nhãn + dải đi CÙNG MỘT HÀNG ở chế độ gọn; dòng chú thích thiếu mốc
          phải nằm DƯỚI cả hai, nên chúng có khung riêng. */}
      <div className="k-track-main">
        <div className="k-track-lab">{label}</div>
        {/*
        KHÔNG CÓ `onPick` THÌ KHÔNG PHẢI NÚT.

        Tới 14/09/2026 dải này luôn dựng `<button disabled>`, kể cả khi không
        ai truyền `onPick` — tức 9 nút xám câm trông y như một điều khiển đổi
        trạng thái. Người dùng bấm, không có gì xảy ra, và kết luận là "chi
        tiết đơn không cập nhật được tình trạng" (chủ dự án báo đúng vậy) —
        trong khi nút thật (`Gửi Giám đốc duyệt`) nằm ở thanh hành động phía
        trên. Chính kit cũng cấm điều này ở `Action`: nút khoá mà không nói lý
        do là lỗi UX.

        Chỉ-đọc thì render `<span>`: mắt vẫn thấy đang ở bước nào, mà không hứa
        một thao tác không tồn tại.
      */}
        <div
          className={cx('k-steps', `k-steps-${tone}`)}
          role={onPick ? undefined : 'list'}
        >
          {/*
          BA TRẠNG THÁI BƯỚC, KHÔNG PHẢI HAI.

          Tới 15/09/2026 dải chỉ biết "đang ở đây" và "không phải đây" — bước ĐÃ
          QUA và bước CHƯA TỚI tô y hệt nhau (`--surface-raised` + `--ink-3`).
          Nên cả dải đọc ra một mảng xám có đúng một ô xanh, và không nói được
          điều quan trọng nhất: đi tới đâu rồi. Chủ dự án báo đúng vậy — "trạng
          thái 1 màu duy nhất, rất khó nhận biết".

          Bước đã qua mang sắc HOÀN THÀNH nhạt + dấu ✓, KHÔNG mang màu hành
          động: tô hết bằng màu hành động thì cả dải sáng rực và mắt lại không
          tìm ra đang ở đâu (đúng lỗi của v3 trên đơn 8 bậc). Bước chưa tới lùi
          xuống nền thẻ — nhạt hơn bước đã qua, nên hướng đi đọc được ngay cả
          khi không còn bước nào "đang" (đơn đã về đủ).
        */}
          {steps.map((s, i) => {
            const qua = i < at
            const dang = i === at
            /*
            BƯỚC ĐÃ QUA MÀ KHÔNG CÓ MỐC thì KHÔNG được tick.

            Dấu ✓ là một lời khẳng định: "việc này đã xảy ra". Chỉ đặt nó khi
            có bằng chứng — mốc thời gian — hoặc khi hệ thống không theo dõi
            mốc cho bước đó (`undefined`, không kết luận). Mốc `null` là bằng
            chứng NGƯỢC LẠI: có chỗ ghi mà trống, nên bước này chưa từng chạy
            dù trạng thái đơn đã vượt qua nó. Vẽ vạch đứt + chữ mờ, và nói ra
            khi rê chuột.
          */
            const moc = marks?.[i]
            const khongMoc = qua && moc === null
            const cls = cx(
              'k-step',
              !onPick && 'k-step-ro',
              qua && 'past',
              khongMoc && 'k-step-unverified',
              dang && 'on',
            )
            const title = khongMoc
              ? `${s} — không có mốc thời gian. Đơn mang trạng thái đã vượt qua bước này, nhưng hệ thống không ghi được lúc nào nó xảy ra.`
              : moc
                ? `${s} — ${moc}`
                : undefined
            const noi = (
              <>
                {qua && !khongMoc && <span aria-hidden>✓ </span>}
                {s}
                {khongMoc && (
                  <span aria-hidden className="k-step-nomark">
                    {' '}
                    ?
                  </span>
                )}
              </>
            )
            return onPick ? (
              <button
                key={s}
                type="button"
                className={cls}
                title={title}
                onClick={() => onPick(i)}
                aria-current={dang ? 'step' : undefined}
              >
                {noi}
              </button>
            ) : (
              <span
                key={s}
                role="listitem"
                className={cls}
                title={title}
                aria-current={dang ? 'step' : undefined}
              >
                {noi}
              </span>
            )
          })}
          {/*
            Vai `listitem` CHỈ khi dải là list (chỉ-đọc). Dải bấm được thì cha
            không có vai list, và một listitem mồ côi là lỗi `aria-required-parent`
            — B7 ghi ở trang `doc-head`, test canh ở erp.a11y.test.tsx.
          */}
          {terminal && (
            <span
              role={onPick ? undefined : 'listitem'}
              className="k-step k-step-ro on stop"
              aria-current="step"
            >
              {terminal}
            </span>
          )}
        </div>
      </div>
      {/*
        NÓI RA MỘT LẦN DƯỚI DẢI, không bắt người đọc rê chuột từng bước mới
        phát hiện. Một dòng chữ nhỏ là đủ: nó giải thích vì sao mấy bước kia
        không có dấu ✓, và đó thường là dấu hiệu đơn được nạp từ sổ cũ chứ
        không đi qua hệ thống.
      */}
      {thieuMoc > 0 && (
        <div className="text-k-label mt-1 text-[var(--ink-3)]">
          {thieuMoc} bước không có mốc thời gian — đơn không đi qua bước đó trên hệ thống.
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   4. DẢI "AI ĐANG GIỮ" — SAP My Inbox / Dynamics centralized work list
   Không có dòng này thì không ai biết chứng từ đang chờ MÌNH hay chờ người
   khác — nguyên nhân đo được của 65 đơn nằm nháp trung bình 6,5 ngày.
   `age` phải là số ngày ở BƯỚC HIỆN TẠI, không phải tuổi chứng từ: "chờ
   duyệt 1 tiếng" và "chờ duyệt 9 ngày" là hai tình huống khác hẳn nhau.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * NGƯỠNG TUỔI Ở BƯỚC HIỆN TẠI → màu của `HolderBar.age`.
 *
 * Tới 24/09/2026 tuổi LUÔN đỏ, kể cả "1 ngày" — đỏ mất nghĩa đúng như badge
 * đỏ của v3, và trái nguyên tắc 3 của sổ thiết kế ("số 0 không phải lúc nào
 * cũng xấu, đừng tô đỏ"). Không bịa ngưỡng mới: cả hai mốc đã có trong mã.
 *
 *   warn = 3 — "nằm im": `STALE_DAYS` ở `lib/lsx-holder.ts` và `isStale` ở
 *              `flow-core.ts`, cùng gốc `thiet-ke-huong-erp.md` ("cảnh báo đơn
 *              nằm im ≥3 ngày").
 *   stop = 7 — "kẹt": `STUCK_AFTER_DAYS` ở `exec.service.ts` (đơn duyệt rồi nằm
 *              im) và vạch `waiting_days >= 7` của Trung tâm duyệt.
 *
 * Dưới 3 ngày: không tô, chữ đậm thường — vừa chuyển bước thì chưa có gì để báo.
 */
export const HOLD_AGE_DAYS = { warn: 3, stop: 7 } as const

/** Đọc số ngày từ chữ `age` ("8 ngày", "đã 5 ngày · nằm im"). Không có "N ngày" → null. */
function holdAgeTone(age: string): 'warn' | 'stop' | null {
  const m = /(\d+)\s*ngày/.exec(age)
  if (!m) return null
  const d = Number(m[1])
  return d >= HOLD_AGE_DAYS.stop ? 'stop' : d >= HOLD_AGE_DAYS.warn ? 'warn' : null
}

export function HolderBar({
  who,
  what,
  age,
  mine,
  inline,
}: {
  /** Người (hoặc phòng — người) đang cầm chứng từ ở bước này. Tên thật, không phải vai trò chung. */
  who: string
  /** Việc người đó phải làm để chứng từ đi tiếp — một mệnh đề động từ. */
  what: string
  /**
   * Ví dụ "8 ngày". Bỏ trống khi vừa chuyển bước. Kit đọc số đứng trước chữ
   * "ngày" để tô màu theo `HOLD_AGE_DAYS`: dưới 3 ngày không tô, 3–6 `warn`,
   * từ 7 `stop`. Chữ không có "N ngày" ("từ hôm nay", "2 tiếng") thì không tô.
   */
  age?: string
  /** Người đang xem chính là người giữ — đổi giọng sang ngôi thứ hai. */
  mine?: boolean
  /** Dạng viên gọn để đặt cuối hàng nút thông minh (`SmartLinks trailing`). */
  inline?: boolean
}) {
  const tone = age ? holdAgeTone(age) : null
  /*
    `role="status"`: đổi người giữ (gửi duyệt xong, bóng sang Giám đốc) là tin
    người dùng cần nghe mà không phải dò lại cả màn. Dải chỉ một câu ngắn nên
    đọc trọn cả dải (status mặc định atomic) không thành tràng dài.
  */
  return (
    <div
      role="status"
      className={cx('k-hold', mine && 'k-hold-mine', inline && 'k-hold-inline')}
    >
      <span className="k-hold-k">{mine ? 'Đang chờ bạn' : 'Đang chờ'}</span>
      <b className="k-hold-who">{who}</b>
      <span className="k-hold-what">{what}</span>
      {age && (
        <span className={cx('k-hold-age num', tone && `k-hold-age-${tone}`)}>{age}</span>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   5. BẢNG KIỂM TRƯỚC KHI GỬI DUYỆT — Dynamics validation
   Chặn hành động VÀ nói rõ vướng gì, kèm cách gỡ. Web hay làm ngược: cho bấm
   rồi mới báo lỗi. Trong ERP, người soạn cần biết còn thiếu gì TỪ LÚC MỞ MÀN
   để đi xin cho đủ, chứ không phải sau khi bấm nút.
   ══════════════════════════════════════════════════════════════════════ */
export type Check = {
  /** `stop` = CHẶN hành động; `warn` = lưu ý, vẫn làm tiếp được. */
  level: 'stop' | 'warn'
  /** Vướng cái gì — nói bằng lời nghiệp vụ, có chỉ đích danh dòng/ô. */
  what: string
  /** Gỡ bằng cách nào. Đây mới là phần người dùng cần. */
  fix: string
}

export function Checks({
  title,
  items,
  compact,
}: {
  /** Câu nói HẬU QUẢ theo bước kế tiếp: "Chưa gửi duyệt được", "Lưu ý trước khi gửi NCC". */
  title: string
  /**
   * Các vướng, mỗi dòng một `what` + `fix`. `what` là khoá React nên không trùng.
   * Mảng rỗng thì khối KHÔNG hiện gì (trả `null`).
   */
  items: Check[]
  /** Một hàng: tiêu đề và các dòng nối tiếp nhau. Dùng khi chỉ có cảnh báo. */
  compact?: boolean
}) {
  if (items.length === 0) return null
  const stop = items.filter((c) => c.level === 'stop').length
  const warn = items.length - stop
  return (
    <div
      className={cx(
        'k-check',
        stop === 0 && 'k-check-warn',
        compact && 'k-check-compact',
      )}
    >
      {/*
        Vùng `status` chỉ bọc DÒNG TÓM TẮT, không bọc danh sách: gõ xong đơn giá
        là số lỗi chặn đổi, người dùng cần nghe "1 lỗi chặn" chứ không phải cả
        chục dòng vướng + cách gỡ đọc lại mỗi lần gõ.
      */}
      <div className="k-check-h" role="status">
        <span className="k-check-badge num">{stop || warn}</span>
        <b>{title}</b>
        <span className="k-check-sub">
          {stop > 0 && `${stop} lỗi chặn`}
          {stop > 0 && warn > 0 && ' · '}
          {warn > 0 && `${warn} cảnh báo`}
        </span>
      </div>
      <ul className="k-check-l">
        {items.map((c) => (
          <li key={c.what} className={c.level === 'stop' ? 'k-cs' : 'k-cw'}>
            <span className="k-check-lvl">{c.level === 'stop' ? 'CHẶN' : 'LƯU Ý'}</span>
            <span className="k-check-w">{c.what}</span>
            <span className="k-check-f">{c.fix}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   6. FASTTAB — Dynamics
   Khối thu gọn được mà DÒNG TIÊU ĐỀ VẪN MANG SỐ LIỆU. Đây là thứ web không
   có: web thu gọn là mất sạch nội dung, nên người dùng không dám gấp khối
   nào và màn cứ dài mãi. FastTab cho phép gấp 5 khối mà vẫn đọc được số
   quan trọng nhất của cả 5.
   ══════════════════════════════════════════════════════════════════════ */
export function FastTab({
  id: sectionId,
  title,
  summary,
  defaultOpen,
  flush,
  actions,
  children,
}: {
  /** Neo cuộn tới — nút thông minh "trao đổi" nhảy xuống đúng khối. */
  id?: string
  /** Tên khối (Tổng quan, Đợt giao, Điều khoản) — chữ trên nút gấp/mở. */
  title: string
  /** Cặp [nhãn, giá trị] hiện trên dòng tiêu đề — kể cả khi đang gấp. */
  summary?: [string, ReactNode][]
  /** Mở sẵn lúc vào màn. Chỉ đọc MỘT LẦN lúc dựng — đổi về sau không gấp/mở lại khối. */
  defaultOpen?: boolean
  /** Nội dung tự lo padding (bảng chẳng hạn). */
  flush?: boolean
  /**
   * Hàng nút bên phải tiêu đề — nút của lưới ở chế độ xem. Nằm NGOÀI nút
   * gấp/mở (nút không được lồng nút). Đo 10/09/2026: thanh công cụ lưới riêng
   * một hàng ăn 32px trên lưới chỉ để chứa hai nút.
   */
  actions?: ReactNode
  /** Thân khối. KHÔNG dựng khi đang gấp — trạng thái bên trong (ô đang gõ) mất khi gấp lại. */
  children: ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const id = useId()
  const sum = summary && summary.length > 0 ? summary : null
  /*
    TÊN NÚT = TIÊU ĐỀ, SỐ LIỆU = MÔ TẢ (B7½, 24/09/2026). Trước đây cả dòng số
    liệu nằm trong nút nên thành tên nút: trình đọc đọc "Đợt giao Số đợt 3 Đã
    về 1 Còn nợ 12.400.000, đã thu gọn, nút" — mỗi lần Tab qua. Tên ngắn để
    lướt, số liệu vẫn nghe được qua mô tả.

    `aria-controls` chỉ gắn khi thân ĐANG DỰNG: gấp lại là thân bị tháo khỏi
    DOM (cố ý — xem `children`), và một id trỏ vào khoảng không là ARIA sai.
  */
  const head = (
    <button
      type="button"
      className="k-ft-h"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-labelledby={`${id}-t`}
      aria-describedby={sum ? `${id}-s` : undefined}
      onClick={() => setOpen((v) => !v)}
    >
      <span className={cx('k-caret', open && 'o')} aria-hidden>
        ▸
      </span>
      <span className="k-ft-t" id={`${id}-t`}>
        {title}
      </span>
      {sum && (
        <span className="k-ft-sum" id={`${id}-s`}>
          {sum.map(([k, v]) => (
            <span key={k}>
              {k} <b>{v}</b>
            </span>
          ))}
        </span>
      )}
    </button>
  )
  return (
    <section className="k-ft" id={sectionId}>
      {actions ? (
        <div className="k-ft-hd">
          {head}
          <div className="k-ft-act">{actions}</div>
        </div>
      ) : (
        head
      )}
      {open && (
        <div id={id} className={cx('k-ft-b', flush && 'k-ft-flush')}>
          {children}
        </div>
      )}
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   7. LƯỚI NHÃN–GIÁ TRỊ
   Xương sống của mọi màn chứng từ ERP, và là thứ làm màn DÀY mà vẫn ĐỌC
   ĐƯỢC: nhãn luôn rộng cố định, giá trị luôn bắt đầu ở cùng một cột, nên mắt
   quét dọc được thay vì phải đọc từng dòng.
   ══════════════════════════════════════════════════════════════════════ */
export function FieldGrid({
  children,
  note,
}: {
  /** Các `Field`. Lưới chia 1·2·3 cột theo bề rộng CHA (container query) — cha phải là FastTab, FactBox hoặc có lớp `k-cq`, không thì rơi về một cột. */
  children: ReactNode
  /** Một câu chú thích dưới lưới, ngăn bằng vạch tóc — thường để nói ô nền nhạt là giá trị kế thừa, hay khối này đơn mới kế thừa. */
  note?: ReactNode
}) {
  return (
    <>
      <dl className="k-fields">{children}</dl>
      {note && <div className="k-fields-note">{note}</div>}
    </>
  )
}

export function Field({
  label,
  children,
  tone,
  inherited,
}: {
  /** Nhãn nghiệp vụ, thành `<dt>`. Được xuống hai dòng (cố ý không nowrap) — nhãn tiếng Việt dài, ép một dòng thì tràn đè giá trị. */
  label: string
  /** Giá trị, thành `<dd>`. Mã, tiền, ngày bọc `<span className="num">` để ra chữ mono. */
  children: ReactNode
  /** Tô màu CHỮ giá trị theo vòng đời: `stop` quá hạn/hỏng, `warn` cần để ý, `done` đã xong. Chỉ là màu — chữ phải tự nói đủ ý. */
  tone?: 'stop' | 'warn' | 'done'
  /** Giá trị kế thừa từ hồ sơ gốc (NCC, vật tư) — nền nhạt + gạch chấm. */
  inherited?: boolean
}) {
  return (
    <div className="k-f">
      <dt>{label}</dt>
      <dd className={cx(tone && `k-t-${tone}`, inherited && 'k-inherit')}>{children}</dd>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   8. THANH CÔNG CỤ LƯỚI + TRẠNG THÁI DÒNG
   Mọi lưới ERP có thanh riêng: thêm/xoá/sao chép dòng, lọc, chọn cột, và số
   dòng đang chọn. Web thường bỏ hẳn phần này rồi bắt người dùng thao tác
   từng dòng bằng menu chuột phải.
   ══════════════════════════════════════════════════════════════════════ */
export function GridToolbar({
  children,
  count,
}: {
  /** Các `<GridBtn>` và `<GridSep>` — thao tác trên dòng của lưới, đứng bên trái. */
  children: ReactNode
  /** Đếm bên phải ("2 dòng đã chọn", "12 dòng") — chữ mono, luôn hiện kể cả khi 0. */
  count: ReactNode
}) {
  return (
    <div className="k-gbar">
      {children}
      <span className="k-gbar-cnt num">{count}</span>
    </div>
  )
}

export function GridBtn({
  children,
  disabled,
  title,
  onClick,
}: {
  /** Chữ trên nút — thao tác trên dòng (Thêm dòng, Sao chép, Xoá dòng). */
  children: ReactNode
  /** Khoá CỨNG (`disabled` thật) — nền xám đặc + chữ `--ink-3` như nút khoá của `Btn`, không làm mờ. Không có khoá mềm như `Action`. */
  disabled?: boolean
  /** Lý do khi `disabled`, chỉ hiện khi rê chuột. Vẫn nên truyền — nút xám câm là lỗi UX. */
  title?: string
  /** Việc của nút. Trình duyệt không gọi khi `disabled`. */
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="k-gb"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function GridSep() {
  return <span className="k-gb-sep" aria-hidden />
}

/** Trạng thái của MỘT DÒNG chứng từ — khác trạng thái của cả chứng từ. */
export function LineStatus({
  kind,
  children,
}: {
  /** Tình trạng nhận/làm của dòng, quyết định màu viên: `idle` chưa động (xám), `part` một phần (cam), `done` đủ (lục), `short` đóng thiếu (đỏ). */
  kind: 'idle' | 'part' | 'done' | 'short'
  /** Chữ trong viên — phải tự nói đủ nghĩa ("Một phần", "Đóng thiếu"), vì màu không đến được trình đọc màn hình. */
  children: ReactNode
}) {
  return <span className={`k-ls k-ls-${kind}`}>{children}</span>
}

/* ══════════════════════════════════════════════════════════════════════
   9. FACTBOX — Dynamics
   Cột phải chứa DỮ KIỆN LIÊN QUAN, không phải chỗ điều hướng. Người duyệt
   cần biết NCC này giao đúng hẹn mấy lần, giá lần trước bao nhiêu, đang nợ
   bao nhiêu — mà không phải rời chứng từ đang xem.
   ══════════════════════════════════════════════════════════════════════ */
export function FactBox({
  children,
  label = 'Dữ kiện liên quan',
}: {
  /** Các `FactSection`. Vỏ là `<aside>` (landmark complementary) mang tên `label`. */
  children: ReactNode
  /**
   * Tên landmark (`aria-label`) của `<aside>`. Mặc định "Dữ kiện liên quan".
   * Trang có hai FactBox thì đặt tên khác nhau — hai landmark trùng tên là lỗi
   * `landmark-unique`, người dùng phím mốc không phân biệt được.
   */
  label?: string
}) {
  // Tới B7½ (24/09/2026) `<aside>` không tên: phím mốc đọc "bổ sung" trơn, không
  // nói bổ sung cái gì.
  return (
    <aside className="k-fact" aria-label={label}>
      {children}
    </aside>
  )
}

export function FactSection({
  title,
  children,
}: {
  /** Tên khối, chữ hoa nhỏ ("Nhà cung cấp", "Chứng từ liên quan"). Là `<div>`, không phải thẻ tiêu đề. */
  title: string
  /** Nội dung khối — thường là một `FactKv`, có thể kèm một dòng tên đậm hoặc câu dẫn. */
  children: ReactNode
}) {
  return (
    <div className="k-fact-sec">
      <div className="k-fact-h">{title}</div>
      {children}
    </div>
  )
}

/**
 * Nhãn cũng nhận `ReactNode` chứ không chỉ `string`: khối "Chứng từ liên quan"
 * cần mã chứng từ ở vế trái phải là mono (`<span className="num">`), không
 * phải chữ thường. Khoá dùng chỉ số vì nhãn có thể không phải chuỗi.
 */
export function FactKv({
  rows,
}: {
  /** Các cặp `[nhãn, giá trị]`, mỗi cặp một hàng: nhãn trái chữ phụ, giá trị phải chữ đậm. Khoá theo chỉ số, nên đừng đổi thứ tự hàng giữa hai lần vẽ. */
  rows: [ReactNode, ReactNode][]
}) {
  return (
    <dl className="k-fact-kv">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   10. NHẬT KÝ THAY ĐỔI TRƯỜNG — SAP change documents
   TÁCH HẲN khỏi trao đổi: đây là thứ MÁY ghi (ai đổi giá từ 352.000 lên
   369.600 lúc nào), còn trao đổi là thứ NGƯỜI viết ("NCC báo hết hàng").
   Gộp hai thứ vào một dòng thời gian là mất cả hai: nhật ký bị trôi mất
   giữa lời bàn, còn lời bàn bị chìm giữa tiếng máy.
   ══════════════════════════════════════════════════════════════════════ */
export type AuditRow = {
  at: string
  who: string
  field: string
  from: string
  to: string
}

export function AuditTable({
  rows,
}: {
  /** Vết thay đổi do MÁY ghi: lúc nào, ai, trường nào, cũ → mới (chuỗi đã định dạng sẵn). Bày đúng thứ tự truyền vào — kit không tự sắp. Mảng rỗng thì bảng hiện một dòng "chưa có thay đổi". */
  rows: AuditRow[]
}) {
  /*
    KHOÁ HÀNG = `at + field + chỉ số` (B7½, 24/09/2026). Khoá cũ `at + field`
    đụng nhau khi một người sửa cùng trường hai lần trong cùng phút — `at` đã
    định dạng tới phút, và sửa giá xong sửa lại là chuyện thường. Khoá trùng thì
    React có thể vẽ lại nhầm hàng. Chỉ số là vế phân xử: nhật ký chỉ nối thêm ở
    cuối, không chèn giữa, nên chỉ số đủ ổn định.
  */
  return (
    <>
      <div className="k-gridwrap">
        <table className="k-grid k-grid-audit">
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>Người sửa</th>
              <th>Trường</th>
              <th>Giá trị cũ</th>
              <th>Giá trị mới</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.at}|${r.field}|${i}`}>
                <td className="num">{r.at}</td>
                <td>{r.who}</td>
                <td>{r.field}</td>
                <td className="num k-old">{r.from}</td>
                <td className="num k-strong">{r.to}</td>
              </tr>
            ))}
            {/*
              Rỗng: một dòng nói thẳng, không phải `Empty` — chưa sửa gì là
              trạng thái BÌNH THƯỜNG của chứng từ mới, không có việc gì phải làm
              tiếp để mà chỉ đường. Để trơ hàng tiêu đề thì người đọc tưởng lỗi tải.
            */}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="k-audit-empty">
                  Chưa có thay đổi nào được ghi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="k-ft-note">
        Máy ghi, không sửa được. Tách khỏi <b>Trao đổi</b> — chỗ đó là lời người viết.
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   11. BỐ CỤC THÂN + THANH TRẠNG THÁI ĐÁY — SAP GUI
   Thanh đáy nói người dùng là ai, đang ở đơn vị nào, ngày mấy, bản ghi thứ
   mấy. Nghe thừa với người quen web, nhưng ERP chạy nhiều công ty / nhiều
   kho trên cùng một phần mềm, và nhập nhầm đơn vị là hỏng sổ.
   ══════════════════════════════════════════════════════════════════════ */
export function DocBody({
  children,
  aside,
}: {
  /** Cột chính: các `FastTab`, lưới dòng, bảng kiểm. */
  children: ReactNode
  /**
   * Cột phải 268px (thường là `<FactBox>`), chỉ đứng cạnh từ 1100px trở lên;
   * hẹp hơn thì rơi xuống dưới. Bỏ trống thì cột chính chiếm trọn bề ngang.
   */
  aside?: ReactNode
}) {
  return (
    <div className={cx('k-body', !aside && 'k-body-wide')}>
      <div className="k-main">{children}</div>
      {aside}
    </div>
  )
}

export function StatusBar({
  left,
  right,
}: {
  /** Các mẩu bên trái, cách nhau đều: người dùng · phòng, công ty · đơn vị. Nói NGỮ CẢNH, không nói trạng thái chứng từ. */
  left: ReactNode[]
  /** Mẩu bên phải, chữ mono: số hiệu · bản ghi thứ mấy / tổng. */
  right?: ReactNode
}) {
  return (
    <div className="k-sbar">
      {left.map((x, i) => (
        <span key={i}>{x}</span>
      ))}
      {right && <span className="k-sbar-r num">{right}</span>}
    </div>
  )
}

/** Bọc cả màn chứng từ — gắn lớp token và dựng cột dọc. */
export function DocScreen({
  children,
  dense,
}: {
  /** Cả màn theo thứ tự: Crumb → ActionPane → DocHead → HolderBar → Checks → DocBody → StatusBar. */
  children: ReactNode
  /** Mật độ DÀY (`kit-dense`): hàng 25px thay vì 30px, đệm ô dọc 2px. Cho chứng từ nhiều dòng. */
  dense?: boolean
}) {
  // Bố cục luôn PHẲNG (từ 10/09/2026): không thẻ nổi quanh FastTab/FactBox,
  // lưới sát mép, ngăn bằng vạch mảnh — xem chú ở `.k-ft` trong erp.css.
  return <div className={cx('kit k-screen', dense && 'kit-dense')}>{children}</div>
}

/* ══════════════════════════════════════════════════════════════════════
   12. LƯỚI DỮ LIỆU — mảng kit còn thiếu, và là lý do màn thật không dựng
   lại được đúng mẫu.

   Trang mẫu `/design-lab/mau-erp` viết `<table className="k-grid">` thô vì
   `design-lab` được MIỄN luật lint. Màn thật nằm trong `src/app`, nơi
   `hg/no-raw-control` cấm thẻ `<table>` trần — nên không có bộ này thì mọi
   màn nghiệp vụ đều buộc phải quay về `shadcn/table`, tức quay về diện mạo
   cũ. Đây đúng là chỗ hổng chủ dự án chỉ ra 09/09/2026.

   Khác `Table.tsx` của kit: bản kia dựng cho màn TOÀN TRANG (tự cuộn, chiếm
   hết chiều cao còn lại). Bộ này dựng cho lưới NẰM TRONG khối — trong
   FastTab, trong hộp thoại — nên chỉ cuộn ngang và cao theo nội dung.
   ══════════════════════════════════════════════════════════════════════ */

export function Grid<T = unknown>({
  minWidth,
  children,
  engine,
  onRowClick,
  isSelected,
}: {
  /** Bề rộng tối thiểu trước khi cuộn ngang. Khai theo SỐ CỘT của chính màn:
   *  đóng cứng một con số thì lưới 14 cột luôn có cột cuối nằm ngoài tầm. */
  minWidth?: number
  /** Kiểu GHÉP JSX. Bỏ trống khi dùng `engine`. */
  children?: ReactNode
  /**
   * Kiểu MÁY (B5) — CÙNG máy với `Table` (`useKitTable`): sắp xếp, chọn cột,
   * mật độ, chân bảng tự chia cột. KHÔNG ảo hoá: lưới nằm trong khối và cao
   * theo nội dung, không có vùng cuộn dọc riêng để ảo hoá — dòng chứng từ quá
   * 200 dòng là dấu hiệu nên tách chứng từ, không phải nên ảo hoá.
   */
  engine?: KitEngine<T>
  /**
   * Chỉ kiểu máy: bấm vào dòng (thường để chọn dòng cho `LineDetail`). Có hàm
   * này thì mỗi dòng nhận Tab và nghe Enter / Space — xem `GridRow.onClick`.
   */
  onRowClick?: (row: T) => void
  /** Chỉ kiểu máy: dòng nào đang chọn — tô nền nhạt màu hành động. */
  isSelected?: (row: T) => boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useColSpanGuard(ref, 'Grid')
  return (
    <div
      className={cx('k-gridwrap', engine?.density === 'day' && 'kit kit-dense')}
      ref={ref}
    >
      <table className="k-grid" style={minWidth ? { minWidth } : undefined}>
        {engine ? (
          <EngineGrid engine={engine} onRowClick={onRowClick} isSelected={isSelected} />
        ) : (
          children
        )}
      </table>
    </div>
  )
}

function EngineGrid<T>({
  engine,
  onRowClick,
  isSelected,
}: {
  engine: KitEngine<T>
  onRowClick?: (row: T) => void
  isSelected?: (row: T) => boolean
}) {
  const { cols, rows } = engine
  return (
    <>
      <thead>
        <tr>
          {cols.map((c) => {
            const dir = engine.sortOf(c.id)
            return (
              <th
                key={c.id}
                className={cx(c.num && 'k-r')}
                style={c.width ? { width: c.width } : undefined}
                aria-sort={sortAria(dir, !!c.sort)}
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
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <GridRow
            key={engine.keyOf(r)}
            selected={isSelected?.(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
          >
            {cols.map((c) => (
              <Td key={c.id} num={c.num} tone={c.tone?.(r)}>
                {c.cell(r)}
              </Td>
            ))}
          </GridRow>
        ))}
      </tbody>
      {engine.foot && (
        <tfoot>
          <tr>
            {footRuns(cols, engine.foot).map((f, i) => (
              <td
                key={f.key}
                colSpan={f.span > 1 ? f.span : undefined}
                className={cx(
                  f.num && 'k-r num',
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

/** Tự bọc `<tr>` — hàng tiêu đề luôn là một dòng, không có ngoại lệ. */
export function GridHead({
  children,
}: {
  /** Các `<Th>` — một ô mỗi cột. Không bọc `<tr>`, thành phần đã tự bọc. */
  children: ReactNode
}) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  )
}

export function GridBody({
  children,
}: {
  /** Các `<GridRow>`. Trống thì bày `Empty` ngoài lưới, đừng để thân bảng trơ. */
  children: ReactNode
}) {
  return <tbody>{children}</tbody>
}

export function GridFoot({
  children,
}: {
  /**
   * Các `<Td>` của dòng tổng — tổng số cột (kể cả `colSpan`) phải bằng hàng
   * tiêu đề; lệch thì bản dev báo lỗi ở console.
   */
  children: ReactNode
}) {
  return (
    <tfoot>
      <tr>{children}</tr>
    </tfoot>
  )
}

export function GridRow({
  selected,
  onClick,
  children,
}: {
  /** Dòng đang chọn (thường khớp ô tick) — nền nhạt màu hành động, như khi rê chuột. */
  selected?: boolean
  /**
   * Bấm vào dòng. Có hàm này thì dòng nhận Tab (`tabIndex=0`), Enter hoặc Space
   * gọi nó, và có vòng focus. Phím gõ bên trong ô nhập của dòng KHÔNG kích hoạt
   * dòng. Trình đọc vẫn không nghe được dòng "bấm được" (bảng thường không có
   * vai cho điều đó) — việc quan trọng nên có thêm một nút/ô tick trong dòng.
   */
  onClick?: () => void
  /** Các `<Td>` / `<GridCheck>` của dòng, đúng thứ tự cột. */
  children: ReactNode
}) {
  /*
    DÒNG BẤM ĐƯỢC PHẢI TỚI ĐƯỢC BẰNG PHÍM (B7½, 24/09/2026). Tới đây `onClick`
    gắn trần lên `<tr>`: chọn dòng để mở `LineDetail` chỉ làm được bằng chuột,
    trong khi người dùng ERP đi bằng Tab hàng chục ô mỗi phút.

    Chỉ nghe phím khi tiêu điểm ĐANG Ở CHÍNH DÒNG (`target === currentTarget`):
    dòng chứa ô nhập, gõ dấu cách vào ô ghi chú mà lại bấm dòng là phá cả lưới.
    Space phải `preventDefault`, không thì trang cuộn xuống một màn.
  */
  return (
    <tr
      className={cx(selected && 'k-on', onClick && 'k-row-act')}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </tr>
  )
}

export function Th({
  num,
  width,
  children,
}: {
  /** Cột số: căn phải, để tiêu đề thẳng hàng với con số bên dưới. */
  num?: boolean
  /** Bề rộng cố định (px) cho cột hẹp: ô tick, STT, ĐVT. Cột chữ để trống cho tự giãn. */
  width?: number
  /** Tên cột. Cột ô tick không có chữ thì vẫn nên có tên ẩn (`sr-only`) — tiêu đề rỗng là cột câm. */
  children?: ReactNode
}) {
  return (
    <th className={cx(num && 'k-r')} style={width ? { width } : undefined}>
      {children}
    </th>
  )
}

export function Td({
  num,
  tone,
  colSpan,
  children,
}: {
  /** Ô số / tiền / ngày: căn phải + chữ mono tabular, để cột số thẳng hàng theo chiều dọc. */
  num?: boolean
  /** Nhấn theo vòng đời dữ liệu — KHÔNG dùng cho trạng thái điều khiển. */
  tone?: 'stop' | 'warn' | 'done'
  /** Gộp cột — chủ yếu cho nhãn ở chân bảng ("Cộng 2 dòng"). Tính vào tổng cột của hàng. */
  colSpan?: number
  /** Nội dung ô. Ô trống thật thì ghi "—" để người đọc biết không phải lỗi tải. */
  children?: ReactNode
}) {
  return (
    <td
      className={cx(num && 'k-r', num && 'num', tone && `k-t-${tone}`)}
      colSpan={colSpan}
    >
      {children}
    </td>
  )
}

/**
 * DÒNG GỢI Ý DƯỚI Ô LƯỚI — "dùng 1.400 ↩", "≈ 27,2 bì", "⚠ vượt trần".
 *
 * Chỗ duy nhất trong ERP mà một con số MÁY TÍNH RA được phép nằm cạnh ô người
 * gõ: nó không tự điền, chỉ mời bấm. Bản cũ có ba dòng này dưới ô SL đặt và là
 * thứ người soạn dùng nhiều nhất (đỡ bấm máy tính); kit mới thiếu nên màn mới
 * bắt gõ tay lại từ đầu.
 */
export function CellHint({
  tone = 'neutral',
  title,
  onClick,
  children,
}: {
  /** `warn` = gợi ý là một CẢNH BÁO (vượt trần, lệch định mức) — chữ màu `--warn`. */
  tone?: 'neutral' | 'warn'
  /** Nói RÕ số này từ đâu ra — số không kiểm được thì không ai bấm. */
  title?: string
  /** Có = bấm để dùng số đó. */
  onClick?: () => void
  /** Câu gợi ý rất ngắn, một dòng không xuống hàng: "dùng 1.400 ↩", "≈ 27,2 bì". */
  children: ReactNode
}) {
  const cls = cx('k-cellhint', tone === 'warn' && 'k-cellhint-w')
  return onClick ? (
    <button
      type="button"
      className={cx(cls, 'k-cellhint-b')}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  ) : (
    <div className={cls} title={title}>
      {children}
    </div>
  )
}

/**
 * Ô tick chọn dòng.
 *
 * `aria-label` BẮT BUỘC chứ không tuỳ chọn: một cột toàn ô tick không nhãn là
 * cột câm với trình đọc màn hình, và người dùng ERP đi bằng bàn phím rất
 * nhiều. Nhãn phải nói chọn DÒNG NÀO, không phải "chọn".
 */
export function GridCheck({
  checked,
  onChange,
  label,
}: {
  /** Dòng đang được tick. Ô có kiểm soát — trang giữ tập dòng đã chọn. */
  checked: boolean
  /** Đảo trạng thái tick. Không nhận giá trị: trang tự lật `checked` của dòng đó. */
  onChange: () => void
  /** Tên cho trình đọc màn hình, nói chọn DÒNG NÀO: "Chọn dòng CN1527", không phải "Chọn". */
  label: string
}) {
  return (
    <td className="k-c-k">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
    </td>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   13. HỒ SƠ DANH MỤC — mảng kit thiếu, lộ ra khi dựng màn nhà cung cấp
   (Khuôn E) ngày 10/09/2026.

   Chứng từ và hồ sơ danh mục KHÔNG dùng chung bộ đầu trang:

     · chứng từ có vòng đời duyệt  → `StatusTrack` (đang ở bước nào);
     · hồ sơ danh mục KHÔNG có     → `MetricStrip` (làm ăn ra sao).

   Nhét hồ sơ vào khuôn chứng từ thì phải bịa ra một vòng đời cho nó, và
   người dùng đi tìm nút "gửi duyệt" trên một thứ không ai duyệt bao giờ.
   ══════════════════════════════════════════════════════════════════════ */

export function MetricStrip({
  children,
}: {
  /** Các `Metric`. Lưới tự xếp, mỗi ô tối thiểu 148px; vạch ngăn vẽ bằng bóng đổ nên hàng thiếu ô không lộ nền xám. */
  children: ReactNode
}) {
  return <div className="k-metrics">{children}</div>
}

/**
 * MỘT Ô ĐO trên hồ sơ danh mục.
 *
 * `basis` BẮT BUỘC, không phải optional — cùng thủ pháp với `reason`/`next`
 * của `Empty`. Lý do: một tỉ lệ không kèm mẫu số là con số KHÔNG KIỂM ĐƯỢC.
 * "Giao đúng hẹn 89%" tính trên 9 đơn và trên 900 đơn là hai mức tin cậy
 * khác hẳn nhau, mà hai cái ô thì trông y hệt. Người duyệt chi vài trăm
 * triệu dựa vào ô đó, nên mẫu số phải nằm ngay dưới con số.
 *
 * `value = null` nghĩa là CHƯA ĐO ĐƯỢC, khác hẳn 0. Hiện "chưa đo được" chứ
 * không hiện 0% — 0% đọc thành "làm ăn tệ" trong khi sự thật là "chưa có gì
 * để chấm", và đó là hai kết luận trái ngược về cùng một nhà cung cấp.
 */
export function Metric({
  label,
  value,
  basis,
  tone,
}: {
  /** Tên chỉ số, chữ hoa nhỏ ("Giao đúng hẹn", "QC loại"). */
  label: string
  /** Con số đã định dạng ("89%", "1,2 ngày"). null = chưa đủ dữ liệu để tính — ô hiện chữ "chưa đo được". KHÔNG được thay bằng 0. */
  value: string | null
  /** Mẫu số / cỡ mẫu, in ngay dưới con số ("8 / 9 đơn có hẹn ngày"). Bắt buộc: tỉ lệ không kèm mẫu số là con số không kiểm được. */
  basis: string
  /** Màu CON SỐ theo đánh giá: `done` tốt, `warn` cần để ý, `stop` xấu. Bỏ trống = trung tính. Bị bỏ qua khi `value` là null. */
  tone?: 'stop' | 'warn' | 'done'
}) {
  return (
    <div
      className={cx(
        'k-metric',
        value == null ? 'k-metric-none' : tone && `k-metric-${tone}`,
      )}
    >
      <div className="k-metric-l">{label}</div>
      <div className="k-metric-v">{value ?? 'chưa đo được'}</div>
      <div className="k-metric-b">{basis}</div>
    </div>
  )
}

/**
 * Dải cảnh báo "đây là BẢN GHI GỐC".
 *
 * Sửa một dòng trên chứng từ chỉ đổi tờ đó; sửa hồ sơ danh mục đổi cho MỌI
 * chứng từ lập từ đây về sau. Người dùng không tự suy ra — họ mở hồ sơ với
 * đúng tâm thế đang sửa một tờ giấy.
 *
 * `used` nói NƠI đang dùng, để người sửa ước lượng được sức công phá trước
 * khi gõ, chứ không phải sau khi bấm Lưu.
 */
export function MasterWarn({
  used,
}: {
  /** NƠI bản ghi đang được dùng, đếm cụ thể ("2 đơn đang mở, 14 mã vật tư") — nối sau câu cố định "Đang dùng ở:". Để người sửa ước sức công phá trước khi gõ. */
  used: ReactNode
}) {
  return (
    <div className="k-master-warn">
      <b>Bản ghi gốc</b>
      <span>
        Sửa ở đây đổi cho <b>mọi chứng từ lập từ nay về sau</b>, không đổi chứng từ đã
        lập. Đang dùng ở: {used}
      </span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   14. BẢNG NHẬP LIỆU — mảng kit thiếu, lộ ra khi dựng màn soạn đơn
   (Khuôn F) ngày 10/09/2026.

   Khuôn D và Khuôn F đều có một lưới, nhưng vai của lưới ngược nhau:

     · Khuôn D — người dùng ĐỌC một tờ. Lưới là một khối trong đó, đầu
       chứng từ được phép chiếm 15 dòng lưới nhãn–giá trị;
     · Khuôn F — người dùng GÕ 40 dòng. Mỗi hàng đầu trang là một hàng lưới
       bị lấy mất, nên đầu đơn co thành dải chip và lưới chiếm phần còn lại.

   Đo trên màn thật `/planning/pos/new`: đầu đơn thật đúng là một dải chip
   (Mẫu · LSX · NCC · Hẹn giao · Khác), không phải lưới nhãn–giá trị. Bộ này
   chỉ đặt tên cho thứ màn đó đã tự chế.
   ══════════════════════════════════════════════════════════════════════ */

export function HeadChips({
  children,
}: {
  /** Các `HeadChip` / `HeadField`, xếp một hàng và tự xuống dòng. Muốn đẩy một thứ sát phải thì bọc nó trong phần tử có `margin-left: auto`. */
  children: ReactNode
}) {
  return <div className="k-headchips">{children}</div>
}

/**
 * MỘT Ô ĐẦU ĐƠN, thu về cỡ một chip.
 *
 * `value = null` nghĩa là CHƯA KHAI. Chip bắt buộc (`need`) tự đeo viền đỏ
 * ngay lúc đó, không đợi bấm Lưu mới báo — người dùng đã gõ xong 40 dòng rồi
 * mới biết thiếu nhà cung cấp là mất công vô ích, và đó là lỗi web kinh điển:
 * cho làm rồi mới kiểm.
 */
export function HeadChip({
  label,
  value,
  need = false,
  muted = false,
  onClick,
  id,
}: {
  /** Tên ô đầu đơn, chữ hoa nhỏ ("NCC", "Hẹn giao"). Cũng ghép vào tooltip "Chưa khai … — bắt buộc". */
  label: string
  /** Giá trị đang có. null hoặc chuỗi rỗng = chưa khai: chip hiện "chưa chọn" nếu `need`, "—" nếu không. */
  value: ReactNode | null
  /** Bắt buộc phải có trước khi lưu — trống thì viền đỏ + nền đỏ nhạt NGAY, không đợi bấm Lưu. */
  need?: boolean
  /** Làm nhạt giá trị (chữ phụ, nét thường) cho ô ít đổi, như tiền tệ theo NCC. Chỉ có tác dụng khi đã có giá trị. */
  muted?: boolean
  /** Bấm chip — mở chỗ sửa hoặc đi tới chứng từ cha. Bỏ trống thì chip là phần tử TĨNH (không nhận Tab, không phải nút) — chỉ bày giá trị. */
  onClick?: () => void
  /** Id của phần tử chip — để `CommitBar.onGoBlocked` tìm và đưa tiêu điểm tới chip bắt buộc còn trống. */
  id?: string
}) {
  const trong = value == null || value === ''
  const cls = cx(
    'k-headchip',
    trong && need && 'k-headchip-need',
    muted && !trong && 'k-headchip-muted',
    !onClick && 'k-headchip-ro',
  )
  const title = trong && need ? `Chưa khai ${label} — bắt buộc` : undefined
  const noiDung = (
    <>
      <span>{label}</span>
      <span>{trong ? (need ? 'chưa chọn' : '—') : value}</span>
    </>
  )
  /*
    KHÔNG `onClick` THÌ KHÔNG PHẢI NÚT (B7½, 24/09/2026) — cùng luật `StatusTrack`
    đã chốt 14/09: một nút nhận Tab mà bấm không làm gì là hứa một thao tác không
    tồn tại. Màn nhập hoá đơn NCC có ba chip kế thừa (NCC, Đơn mua, Tiền tệ)
    không `onClick` — ba điểm dừng Tab câm đứng trước ô người ta phải gõ.
  */
  return onClick ? (
    <button type="button" id={id} onClick={onClick} className={cls} title={title}>
      {noiDung}
    </button>
  ) : (
    <span id={id} className={cls} title={title}>
      {noiDung}
    </span>
  )
}

/**
 * Ô ĐẦU ĐƠN GÕ THẲNG — cùng hình dạng `HeadChip`, nhưng chứa ô nhập thật.
 *
 * VÌ SAO PHẢI CÓ CÁI THỨ HAI: `HeadChip` là một `<button>` — nó BÀY một giá trị
 * và mở chỗ sửa khi bấm. Nhét ô nhập vào trong nó là **nút lồng nút**: HTML
 * không hợp lệ và React hỏng hydration. Vấp thật 11/09/2026 khi dựng màn nhập
 * hoá đơn NCC — `DateInput` có nút mở lịch bên trong, cả trang đổ.
 *
 * Dùng `HeadChip` cho giá trị KẾ THỪA (nhà cung cấp, đơn mua, tiền tệ — lấy từ
 * chứng từ cha, bấm để đi tới). Dùng `HeadField` cho thứ người ta **gõ tại chỗ**
 * (số hoá đơn, ngày, thuế suất). Là `<label>` nên bấm vào nhãn là con trỏ nhảy
 * vào ô — thứ `HeadChip` không làm được.
 */
export function HeadField({
  label,
  children,
  need = false,
  empty = false,
  width,
}: {
  /** Nhãn chữ hoa nhỏ đứng trước ô nhập. Là phần của `<label>` bọc ngoài, nên bấm vào nhãn thì con trỏ nhảy vào ô. */
  label: string
  /** Ô nhập thật (`TextInput`, `DateInput`, `NumInput`). Vẫn truyền `label`/`aria-label` riêng cho ô — tên đó mới là tên trình đọc màn hình đọc. */
  children: ReactNode
  /**
   * Bắt buộc trước khi lưu — trống thì đeo viền đỏ NGAY, không đợi bấm Lưu.
   * Kèm chữ ẩn "(bắt buộc)" trong nhãn cho trình đọc màn hình.
   */
  need?: boolean
  /** Ô đang trống. Người gọi tự quyết vì "trống" của mỗi kiểu ô mỗi khác. */
  empty?: boolean
  /** Bề rộng (px) của phần chứa ô nhập. Bỏ trống thì ô tự co theo nội dung. */
  width?: number
}) {
  /*
    "BẮT BUỘC" PHẢI TỚI ĐƯỢC TRÌNH ĐỌC (B7½, 24/09/2026). Tới đây nó chỉ là
    viền đỏ — màu thì không đến tai ai. Chọn chữ ẩn trong nhãn chứ không
    `aria-required`: vỏ là `<label>`, mà `aria-required` trên label là thuộc
    tính không hợp lệ (label không có vai nhận nó); còn gắn lên ô bên trong thì
    kit không với tới — ô do người gọi truyền vào.

    Giới hạn, ghi thật: ô có `aria-label` riêng thì tên đó THẮNG nhãn bọc
    ngoài, nên chữ ẩn chỉ nghe được khi đọc tuần tự, không nghe khi Tab vào ô.
  */
  return (
    <label
      className={cx('k-headchip', 'k-headfield', need && empty && 'k-headchip-need')}
    >
      <span>
        {label}
        {need && <span className="sr-only"> (bắt buộc)</span>}
      </span>
      <span style={width ? { width } : undefined}>{children}</span>
    </label>
  )
}

/**
 * THANH CHỐT — dính đáy màn nhập liệu.
 *
 * KHÁC `StatusBar`: thanh kia là vỏ chương trình (người dùng là ai, đơn vị
 * nào, bản ghi thứ mấy). Thanh này là DỮ LIỆU của chứng từ cộng hành động
 * chính, nên nó ở tầng giấy.
 *
 * `blocked` là câu nói VÌ SAO chưa lưu được và nó BẤM ĐƯỢC — nhảy tới đúng ô
 * phải sửa. Một câu chặn không dẫn đi đâu thì người dùng phải tự dò 40 dòng
 * tìm chỗ hỏng, và với bảng cuộn ngang thì chỗ hỏng còn đang nằm ngoài màn.
 */
export function CommitBar({
  totals,
  grand,
  blocked,
  onGoBlocked,
  actions,
}: {
  /** Các tổng phụ bên trái ("Tiền hàng", "VAT 8%"), số mono cỡ vừa. Khoá theo `label` nên nhãn không được trùng. */
  totals: { label: string; value: ReactNode }[]
  /** Tổng chính, đẩy sát phải, số lớn đậm — con số người dùng cần thấy khi đang gõ dòng thứ 38. */
  grand: { label: string; value: ReactNode }
  /** Câu nói vì sao chưa lưu được. Bỏ trống = lưu được. */
  blocked?: string
  /**
   * Nhảy tới đúng ô phải sửa khi bấm câu chặn — có hàm này thì câu chặn là NÚT
   * (kèm mũi tên →). Không có thì câu chặn chỉ là CHỮ: vẫn nói vì sao, không
   * giả làm nút. Nên truyền mỗi khi màn chỉ ra được ô hỏng.
   */
  onGoBlocked?: () => void
  /** Nút cuối thanh (Xem trước phiếu in, Lưu nháp). Nút lưu tự khoá theo `blocked` — kit không tự khoá hộ. */
  actions?: ReactNode
}) {
  /*
    CÂU CHẶN LƯU (B7½, 24/09/2026) — hai lỗi B7 ghi ở trang `commit-bar`:

    1. Không `onGoBlocked` mà vẫn dựng `<button>`: nút bấm không làm gì, dính
       thật ở 3 màn (nhập hoá đơn NCC, hai màn mẫu Khuôn F). Nay thiếu hàm thì
       chỉ là chữ.
    2. Câu đổi mà trình đọc không báo: sửa xong ô NCC, câu chuyển sang "dòng 3
       thiếu đơn giá" trong im lặng. Nay câu nằm trong vùng `status`. Vùng đó
       LUÔN có mặt, kể cả khi lưu được — vùng live sinh ra cùng lúc với nội dung
       thì phần lớn trình đọc không đọc.

    Mũi tên → là trang trí, `aria-hidden` để tên nút là đúng câu chặn.
  */
  return (
    <div className="k-commit">
      {totals.map((t) => (
        <span key={t.label} className="k-commit-t">
          {t.label} <b>{t.value}</b>
        </span>
      ))}
      <span role="status" className="k-commit-live">
        {blocked &&
          (onGoBlocked ? (
            <button type="button" className="k-commit-block" onClick={onGoBlocked}>
              Chưa lưu được: {blocked} <span aria-hidden>→</span>
            </button>
          ) : (
            <span className="k-commit-block">Chưa lưu được: {blocked}</span>
          ))}
      </span>
      <span className="k-commit-g">
        <span>{grand.label}</span>
        <b>{grand.value}</b>
      </span>
      {actions}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   15. NHÓM TRƯỜNG, NÚT THÔNG MINH, CHI TIẾT DÒNG — ba mảng lộ ra ngày
   10/09/2026 khi chấm màn Đơn mua theo bảng tiêu chí
   `docs/tieu-chi-man-chung-tu-erp.md`. Cả ba đều là thứ Dynamics/Odoo có mà
   màn mẫu không có: màn mẫu trưng thành phần, còn màn thật phải dồn diện tích
   cho lưới và chi tiết dòng.
   ══════════════════════════════════════════════════════════════════════ */

/** Nhóm trường có tên — Dynamics FastTab General / Delivery / Price. ≤ 8 trường mỗi nhóm. */
export function FieldGroup({
  title,
  children,
  level = 4,
}: {
  /** Tên nhóm theo chữ nghiệp vụ người dùng đi tìm ("Điều khoản — in lên phiếu gửi NCC"). Vẽ thành thẻ tiêu đề cấp `level`. */
  title: string
  /** Các `Field` của nhóm, ≤ 8. Nhóm tự là container nên chia 1·2·3 cột theo bề rộng của chính nó. */
  children: ReactNode
  /**
   * Cấp thẻ tiêu đề (mặc định 4 → `<h4>`). Đặt theo tiêu đề gần nhất phía trên:
   * dưới một `<h2>` thì truyền 3. Chỉ đổi THẺ, không đổi hình — cỡ chữ do lớp
   * `k-fgrp-h` quyết.
   */
  level?: 2 | 3 | 4 | 5 | 6
}) {
  // Tới B7½ (24/09/2026) luôn là `<h4>`: dưới `<h1>` số hiệu mà không có h2/h3
  // thì cây tiêu đề nhảy bậc, người đi bằng phím tiêu đề mất mạch.
  const H = `h${level}` as 'h4'
  return (
    <div className="k-fgrp">
      <H className="k-fgrp-h">{title}</H>
      <dl className="k-fields">{children}</dl>
    </div>
  )
}

/**
 * Dải nút thông minh — chép Odoo: chứng từ liên quan hiện thành SỐ ĐẾM bấm
 * được ngay dưới số hiệu. `count` null = không đếm được (chỉ là lối đi).
 */
export function SmartLinks({
  items,
  trailing,
}: {
  /** Mỗi nút: `label` chữ thường, `count` số đếm (null = chỉ là lối đi, không đếm), `onClick`, `disabled`, `title`. Nút `disabled` là KHOÁ MỀM: vẫn nhận Tab, bấm bị nuốt, `title` thành lời giải thích đọc được (`aria-describedby`). Số đếm phải ra đúng chừng ấy dòng khi bấm. Khoá theo `label`. */
  items: { label: string; count: number | null; onClick?: () => void; disabled?: boolean; title?: string }[] // prettier-ignore
  /** Đuôi hàng, đẩy sát phải — chỗ của `<HolderBar inline>`. */
  trailing?: ReactNode
}) {
  const base = useId()
  /*
    KHOÁ MỀM, cùng thủ pháp `blockedBy` của `Btn` (B7½, 24/09/2026). Tới đây nút
    khoá là `disabled` thật + `opacity`: rơi khỏi thứ tự Tab, và lý do chỉ nằm
    trong `title` — bàn phím và cảm ứng không bao giờ tới. Nay nút vẫn nhận
    tiêu điểm, đọc được "mờ" + lý do, cú bấm bị nuốt.
  */
  return (
    <div className="k-smart">
      {items.map((it, i) => {
        const whyId = `${base}-${i}`
        const why = it.disabled && it.title ? it.title : undefined
        return (
          <button
            key={it.label}
            type="button"
            className="k-smart-b"
            aria-disabled={it.disabled || undefined}
            aria-describedby={why ? whyId : undefined}
            onClick={it.disabled ? undefined : it.onClick}
            title={it.title}
          >
            {it.count != null && <span className="k-smart-n">{it.count}</span>}
            {it.label}
            {why && (
              <span id={whyId} hidden>
                {why}
              </span>
            )}
          </button>
        )
      })}
      {trailing && <span className="k-smart-trail">{trailing}</span>}
    </div>
  )
}

/** Khối "Chi tiết dòng" dưới lưới — Dynamics Line details. */
export function LineDetail({
  index,
  code,
  summary,
  open = true,
  onToggle,
  children,
}: {
  /** Số thứ tự dòng đang chọn, đếm từ 1 như người dùng thấy trên lưới — in thành "Chi tiết dòng 3". */
  index: number
  /** Mã của dòng (mã vật tư, hoặc tên nếu dòng tự do), chữ mono màu hành động ngay sau số dòng. */
  code: string
  /** Một dòng nói trong khay có gì, để lúc gấp vẫn biết có nên mở không. */
  summary?: ReactNode
  /**
   * Khay đang mở hay gấp (mặc định mở). Gấp thì chỉ còn vạch tiêu đề — nên luôn đi cùng `onToggle`, không thì không ai mở lại được. Thêm 14/09/2026.
   *
   * Khay này luôn mở vì lúc nào cũng có một dòng đang chọn. Đo trên đơn 17
   * dòng, khung 694px: khay chiếm **459px = 66% màn hình** cho 4 ô nhập, nằm
   * DƯỚI lưới nên nó đẩy mọi thứ xuống và phải cuộn qua nó mới tới phần còn
   * lại của chứng từ. Chủ dự án báo: "mở nhiều dòng nhìn rất rối, chi tiết
   * dòng chiếm quá nhiều".
   *
   * Gấp lại còn một vạch 24px. Trạng thái là của NGƯỜI DÙNG, không của dòng:
   * mở một lần thì đổi dòng vẫn mở, không phải bấm lại mỗi lần chọn dòng.
   */
  open?: boolean
  /** Có hàm này thì tiêu đề thành nút gấp/mở (kèm mũi tên và `aria-expanded`); không có thì tiêu đề là chữ tĩnh. Trạng thái do người gọi giữ. */
  onToggle?: () => void
  /** Ruột khay — thường là vài `FieldGroup` cho cột hiếm dùng của lưới (thông số theo mẫu, số lượng & giá, ghi chú dòng). */
  children: ReactNode
}) {
  const bodyId = useId()
  /*
    Mũi tên ▾/▸ là hình, không phải chữ: không `aria-hidden` thì nó lọt vào
    tên nút và trình đọc đọc "tam giác chỉ xuống, Chi tiết dòng 3" — trạng thái
    gấp/mở đã có `aria-expanded` nói rồi. `aria-controls` chỉ gắn khi khay đang
    dựng, cùng lý do với `FastTab` (B7½, 24/09/2026).
  */
  const head = (
    <>
      {onToggle && (
        <span className="k-linedet-c" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      )}
      Chi tiết dòng {index} <b>{code}</b>
      {summary && <span className="k-linedet-s">{summary}</span>}
    </>
  )
  return (
    <div className="k-linedet">
      {onToggle ? (
        <button
          type="button"
          className="k-linedet-h k-linedet-b"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={onToggle}
        >
          {head}
        </button>
      ) : (
        <div className="k-linedet-h">{head}</div>
      )}
      {open && <div id={bodyId}>{children}</div>}
    </div>
  )
}
