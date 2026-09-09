'use client'

import { useId, useState, type ReactNode } from 'react'

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
}: {
  /** Đường dẫn nghiệp vụ. Phần tử cuối là chứng từ đang mở. */
  path: string[]
  /** Nhãn khung nhìn đang chọn. Bỏ trống thì không hiện khối này. */
  view?: string
  onView?: () => void
  /** [thứ tự, tổng] — ví dụ [14, 68]. */
  position?: [number, number]
  onPrev?: () => void
  onNext?: () => void
}) {
  return (
    <div className="k-crumb">
      {path.map((p, i) => (
        <span key={p + i} className="k-crumb-i">
          {i > 0 && <span className="k-crumb-sep">›</span>}
          {i === 0 ? (
            <span className="k-crumb-mod">{p}</span>
          ) : i === path.length - 1 ? (
            <b>{p}</b>
          ) : (
            <span>{p}</span>
          )}
        </span>
      ))}

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
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   2. ACTION PANE — Dynamics 365 F&O
   Nút bày SẴN, chia nhóm, mỗi nhóm có NHÃN bên dưới. Không giấu vào menu
   "⋯": người dùng ERP mở màn này vài chục lần mỗi ngày và bấm bằng trí nhớ
   vị trí, nên nút phải đứng yên một chỗ.
   ══════════════════════════════════════════════════════════════════════ */
export function ActionPane({
  tabs,
  children,
}: {
  tabs?: ActionTab[]
  children: ReactNode
}) {
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
              onClick={t.onClick}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="k-pane-groups">{children}</div>
    </div>
  )
}

export type ActionTab = { label: string; active?: boolean; onClick?: () => void }

export function ActionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="k-grp">
      <div className="k-grp-btns">{children}</div>
      <div className="k-grp-lab">{label}</div>
    </div>
  )
}

export function Action({
  children,
  primary,
  strong,
  disabled,
  title,
  onClick,
}: {
  children: ReactNode
  /** Hành động chính của nhóm — nền đặc. Mỗi màn chỉ nên có một. */
  primary?: boolean
  /** Đậm chữ, không đổi nền. Dùng cho hành động hay dùng nhất trong nhóm. */
  strong?: boolean
  disabled?: boolean
  /** Khi `disabled`, LUÔN truyền `title` nói lý do — nút xám câm là lỗi UX. */
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={cx('k-act', primary && 'k-act-p', strong && 'k-act-s')}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
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
}: {
  /** Loại chứng từ, in hoa nhỏ phía trên số hiệu. */
  kind: string
  /** Số hiệu — danh tính của trang, bậc chữ lớn duy nhất. */
  code: string
  sub?: ReactNode
  /** Các `<StatusTrack>`. */
  children?: ReactNode
}) {
  return (
    <div className="k-doc">
      <div>
        <div className="k-doc-kind">{kind}</div>
        <h1 className="k-doc-no">{code}</h1>
        {sub && <div className="k-doc-sub">{sub}</div>}
      </div>
      {children && <div className="k-tracks">{children}</div>}
    </div>
  )
}

export function StatusTrack({
  label,
  steps,
  at,
  onPick,
}: {
  label: string
  steps: string[]
  /** Chỉ số bước hiện tại. */
  at: number
  onPick?: (i: number) => void
}) {
  return (
    <div>
      <div className="k-track-lab">{label}</div>
      <div className="k-steps">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            className={cx('k-step', i === at && 'on')}
            onClick={onPick ? () => onPick(i) : undefined}
            disabled={!onPick}
            aria-current={i === at ? 'step' : undefined}
          >
            {s}
          </button>
        ))}
      </div>
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
export function HolderBar({
  who,
  what,
  age,
  mine,
}: {
  who: string
  what: string
  /** Ví dụ "8 ngày". Bỏ trống khi vừa chuyển bước. */
  age?: string
  /** Người đang xem chính là người giữ — đổi giọng sang ngôi thứ hai. */
  mine?: boolean
}) {
  return (
    <div className={cx('k-hold', mine && 'k-hold-mine')}>
      <span className="k-hold-k">{mine ? 'Đang chờ bạn' : 'Đang chờ'}</span>
      <b className="k-hold-who">{who}</b>
      <span className="k-hold-what">{what}</span>
      {age && <span className="k-hold-age num">{age}</span>}
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
  level: 'stop' | 'warn'
  /** Vướng cái gì — nói bằng lời nghiệp vụ, có chỉ đích danh dòng/ô. */
  what: string
  /** Gỡ bằng cách nào. Đây mới là phần người dùng cần. */
  fix: string
}

export function Checks({ title, items }: { title: string; items: Check[] }) {
  if (items.length === 0) return null
  const stop = items.filter((c) => c.level === 'stop').length
  const warn = items.length - stop
  return (
    <div className={cx('k-check', stop === 0 && 'k-check-warn')}>
      <div className="k-check-h">
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
  title,
  summary,
  defaultOpen,
  flush,
  children,
}: {
  title: string
  /** Cặp [nhãn, giá trị] hiện trên dòng tiêu đề — kể cả khi đang gấp. */
  summary?: [string, ReactNode][]
  defaultOpen?: boolean
  /** Nội dung tự lo padding (bảng chẳng hạn). */
  flush?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const id = useId()
  return (
    <section className="k-ft">
      <button
        type="button"
        className="k-ft-h"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cx('k-caret', open && 'o')} aria-hidden>
          ▸
        </span>
        <span className="k-ft-t">{title}</span>
        {summary && summary.length > 0 && (
          <span className="k-ft-sum">
            {summary.map(([k, v]) => (
              <span key={k}>
                {k} <b>{v}</b>
              </span>
            ))}
          </span>
        )}
      </button>
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
export function FieldGrid({ children, note }: { children: ReactNode; note?: ReactNode }) {
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
  label: string
  children: ReactNode
  tone?: 'stop' | 'warn' | 'done'
  /** Giá trị kế thừa từ hồ sơ gốc (NCC, vật tư) — nền nhạt + gạch chấm. */
  inherited?: boolean
}) {
  return (
    <div className="k-f">
      <dt>{label}</dt>
      <dd className={cx(tone && `k-t-${tone}`, inherited && 'k-inherit')}>
        {children}
      </dd>
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
  children: ReactNode
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
  children: ReactNode
  disabled?: boolean
  title?: string
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
  kind: 'idle' | 'part' | 'done' | 'short'
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
export function FactBox({ children }: { children: ReactNode }) {
  return <aside className="k-fact">{children}</aside>
}

export function FactSection({ title, children }: { title: string; children: ReactNode }) {
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
export function FactKv({ rows }: { rows: [ReactNode, ReactNode][] }) {
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

export function AuditTable({ rows }: { rows: AuditRow[] }) {
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
            {rows.map((r) => (
              <tr key={r.at + r.field}>
                <td className="num">{r.at}</td>
                <td>{r.who}</td>
                <td>{r.field}</td>
                <td className="num k-old">{r.from}</td>
                <td className="num k-strong">{r.to}</td>
              </tr>
            ))}
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
export function DocBody({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={cx('k-body', !aside && 'k-body-wide')}>
      <div className="k-main">{children}</div>
      {aside}
    </div>
  )
}

export function StatusBar({ left, right }: { left: ReactNode[]; right?: ReactNode }) {
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
export function DocScreen({ children }: { children: ReactNode }) {
  return <div className="kit k-screen">{children}</div>
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

export function Grid({
  minWidth,
  children,
}: {
  /** Bề rộng tối thiểu trước khi cuộn ngang. Khai theo SỐ CỘT của chính màn:
   *  đóng cứng một con số thì lưới 14 cột luôn có cột cuối nằm ngoài tầm. */
  minWidth?: number
  children: ReactNode
}) {
  return (
    <div className="k-gridwrap">
      <table className="k-grid" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  )
}

/** Tự bọc `<tr>` — hàng tiêu đề luôn là một dòng, không có ngoại lệ. */
export function GridHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  )
}

export function GridBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function GridFoot({ children }: { children: ReactNode }) {
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
  selected?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <tr className={cx(selected && 'k-on')} onClick={onClick}>
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
  width?: number
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
  num?: boolean
  /** Nhấn theo vòng đời dữ liệu — KHÔNG dùng cho trạng thái điều khiển. */
  tone?: 'stop' | 'warn' | 'done'
  colSpan?: number
  children?: ReactNode
}) {
  return (
    <td className={cx(num && 'k-r', num && 'num', tone && `k-t-${tone}`)} colSpan={colSpan}>
      {children}
    </td>
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
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <td className="k-c-k">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
    </td>
  )
}
