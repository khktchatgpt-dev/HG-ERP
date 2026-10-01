'use client'

import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Btn, Tag } from './Primitives'
import { Popover } from './Popover'
import { Menu } from './Nav'
import { Ico, type IcoName } from './Icon'
import { HOLD_AGE_DAYS } from './Erp'

/**
 * ══════════════════════════════════════════════════════════════════════════
 * TẦNG LUỒNG v4 — chứng từ đang ở đâu, ai giữ, làm gì tiếp
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ba câu hỏi mà mọi ERP nghiêm túc đều trả lời NGAY TRÊN chứng từ, và là ba
 * câu mà một bộ kit chỉ lo bảng biểu không chạm tới:
 *
 *   1. Chứng từ này đang ở BƯỚC NÀO?            -> StageRail (đã có StageBar)
 *   2. AI đang giữ nó, tôi có phải làm gì không? -> NextAction
 *   3. Đã có chuyện gì xảy ra với nó?            -> Timeline
 *
 * VÌ SAO CẦN: ERP không phải app một người dùng. Một đơn đặt hàng đi qua tay
 * Cung ứng -> Giám đốc -> NCC -> Kho. Người mở nó lên giữa chừng phải đoán
 * xem "giờ đến lượt ai" — và đoán sai thì đơn nằm im vài ngày, không ai biết
 * mình đang là người chặn.
 *
 * ĐO ĐƯỢC TRONG DB (09/09/2026): 65/68 đơn ở trạng thái nháp, 59/68 chưa có
 * hẹn giao. Đó không phải "đang chờ hệ thống" mà là "đang chờ MỘT NGƯỜI" —
 * mà màn hình không nói ra ai.
 */

/** Một mốc trong đời chứng từ. */
export type Mark = {
  /** Khoá React — duy nhất trong một dòng thời gian. */
  key: string
  /** ISO. Không có = mốc CHƯA xảy ra (bày mờ để thấy còn bao nhiêu bước). */
  at: string | null
  /** Việc đã/sẽ xảy ra, bằng lời người ("Giám đốc duyệt"). */
  label: string
  /** Ai làm. Trống = hệ thống. Chỉ hiện khi mốc đã xảy ra. */
  actor?: string | null
  /** Một dòng chi tiết dưới nhãn ("352.000 → 369.600"). Chỉ hiện khi mốc đã xảy ra. */
  detail?: string | null
  /** Màu chấm của mốc đã xảy ra; bỏ trống = màu hành động. Mốc chưa tới luôn xám. */
  tone?: 'act' | 'done' | 'warn' | 'stop'
}

function fmt(at: string) {
  // Mốc chỉ có NGÀY (`yyyy-mm-dd`: hẹn đợt giao, ngày ghi phí, ngày phiếu nhập
  // khai trễ) — in ngày thôi. `new Date` đọc nó là 00:00 UTC nên từng in giờ
  // giả "07:00" như thể có ai làm gì lúc đó.
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return `${at.slice(8, 10)}/${at.slice(5, 7)}`
  const d = new Date(at)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * DÒNG THỜI GIAN của chứng từ.
 *
 * LUẬT QUAN TRỌNG NHẤT: mốc CHƯA xảy ra vẫn hiện, ở dạng mờ. ERP khác chỉ
 * liệt kê việc ĐÃ làm, nên người đọc không biết còn mấy bước nữa mới xong —
 * phải thuộc quy trình mới đọc được. Bày cả phần chưa tới thì tự nó thành
 * bản đồ.
 *
 * Không bao giờ rỗng: một chứng từ tồn tại thì ít nhất đã có người tạo ra
 * nó. "Chưa có mốc nào" là dấu hiệu ai đó quên đưa `created_at` vào, không
 * phải sự thật về chứng từ.
 */
export function Timeline({
  marks,
}: {
  /**
   * Các mốc theo THỨ TỰ HIỆN — kit không tự sắp. Mốc `at: null` là mốc chưa tới:
   * chấm xám, chữ "chưa tới", ẩn `actor` và `detail`. `at` phải là ISO thật —
   * kit in nó ra thành "dd/mm hh:mm".
   */
  marks: Mark[]
}) {
  return (
    <ol className="relative ml-1.5 border-l border-[var(--line)] pl-4">
      {marks.map((m) => {
        const roi = !!m.at
        return (
          <li key={m.key} className="relative py-2">
            <span
              className={cn(
                'absolute top-[13px] -left-[21px] size-[9px] rounded-full border-2 border-[var(--surface-card)]',
                !roi
                  ? 'bg-[var(--ink-empty)]'
                  : m.tone === 'stop'
                    ? 'bg-[var(--stop)]'
                    : m.tone === 'warn'
                      ? 'bg-[var(--warn)]'
                      : m.tone === 'done'
                        ? 'bg-[var(--done)]'
                        : 'bg-[var(--act)]',
              )}
            />
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-k-sm font-semibold',
                  !roi && 'font-normal text-[var(--ink-3)]',
                )}
              >
                {m.label}
              </span>
              {roi ? (
                <span className="num text-k-label text-[var(--ink-3)]">{fmt(m.at!)}</span>
              ) : (
                <span className="text-k-label text-[var(--ink-empty)]">chưa tới</span>
              )}
              {m.actor && roi && (
                <span className="text-k-label text-[var(--ink-2)]">· {m.actor}</span>
              )}
            </div>
            {m.detail && roi && (
              <p className="text-k-sm mt-0.5 leading-snug text-[var(--ink-2)]">
                {m.detail}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * AI ĐANG GIỮ BÓNG + VIỆC TIẾP THEO.
 *
 * Đặt ngay đầu chứng từ, TRƯỚC mọi bảng số liệu. Người mở chứng từ lên hỏi
 * "tôi có phải làm gì không" trước khi hỏi "đơn này bao nhiêu tiền".
 *
 * Phân biệt rạch ròi hai trạng thái mà v3 gộp làm một:
 *   - `mine`  : đến lượt TÔI  -> nút hành động, màu hành động
 *   - !mine   : đang ở người khác -> nói TÊN NGƯỜI/BỘ PHẬN đó, không nút
 *
 * "Đang chờ duyệt" là câu vô dụng: chờ AI duyệt, từ bao giờ, tôi làm gì được
 * — ba thứ đó mới là thông tin.
 */
export function NextAction({
  mine,
  holder,
  what,
  days,
  hint,
  actions,
}: {
  /** Bóng đang ở người đang xem? `true` = khung màu hành động, nhãn "Đến lượt bạn", không hiện `holder`. */
  mine: boolean
  /** Ai/bộ phận nào đang giữ (khi không phải mình). Bắt buộc cả khi `mine` — lúc đó kit không vẽ nó. */
  holder: string
  /** Việc phải làm, viết bằng lời nghiệp vụ. */
  what: string
  /**
   * Số ngày đã nằm ở bước này — TÍNH SẴN Ở NGOÀI bằng `daysHeld(since, now)` của
   * flow-core, không tự lấy Date.now(). (Prop `since` từng khai ở đây mà kit
   * không đọc — gỡ 24/09/2026, B7½: không nơi nào truyền, và một prop kit phớt
   * lờ là lời nói dối trong bảng thuộc tính.)
   *
   * Đọc đồng hồ trong lúc render là hàm không thuần: server dựng HTML lúc
   * 23:59 còn trình duyệt tô lại lúc 00:01 thì ra hai con số khác nhau và
   * React báo lệch. Dùng `daysHeld()` của flow-core ở tầng gọi.
   */
  days?: number | null
  /** Vì sao chưa đi tiếp được / lưu ý. */
  hint?: string
  /** Nút ở bên phải khung. Kit vẽ cả khi `mine` là false — màn tự quyết có truyền hay không. */
  actions?: ReactNode
}) {
  const ngay = days ?? null
  // 3 ngày: một chứng từ nằm im qua cuối tuần là bình thường; sang ngày thứ
  // ba thì nhiều khả năng người giữ nó không biết là mình đang giữ.
  const lau = ngay != null && ngay >= 3

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[var(--radius)] border px-3.5 py-3',
        mine
          ? 'border-[var(--act)] bg-[var(--act-wash)]'
          : lau
            ? 'border-[var(--warn)] bg-[var(--warn-wash)]'
            : 'border-[var(--line)] bg-[var(--surface)]',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-k-label font-semibold tracking-[.08em] text-[var(--ink-3)] uppercase">
            {mine ? 'Đến lượt bạn' : 'Đang chờ'}
          </span>
          {!mine && <Tag tone={lau ? 'warn' : 'neutral'}>{holder}</Tag>}
          {ngay != null && (
            <span
              className={cn(
                'num text-k-label',
                lau ? 'font-semibold text-[var(--warn)]' : 'text-[var(--ink-3)]',
              )}
            >
              {ngay === 0 ? 'từ hôm nay' : `đã ${ngay} ngày`}
            </span>
          )}
        </div>
        <p className="text-k-body mt-1 leading-snug font-semibold">{what}</p>
        {hint && (
          <p className="text-k-sm mt-1 leading-relaxed text-[var(--ink-2)]">{hint}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/**
 * CHUỖI CHỨNG TỪ — đi ngược về thứ đã sinh ra chứng từ này.
 *
 * Câu hỏi thật của người mua: "mua cái này để làm gì, ai đòi?" — và của kế
 * toán: "đơn này thuộc lệnh nào?". Không có đường đi ngược thì họ mở tab
 * khác tra tay, hoặc tệ hơn là mua theo trí nhớ.
 *
 * Mỗi mắt xích là LINK THẬT (thẻ <a>) để Ctrl+click mở tab mới — người dùng
 * ERP đối chiếu hai chứng từ cạnh nhau liên tục.
 */
export function DocChain({
  links,
}: {
  /**
   * Mắt xích từ GỐC tới tờ đang xem, trái → phải. Có `href` và không `muted` →
   * thẻ `<a>` thật (Ctrl+click mở tab mới). Không `href` hoặc `muted` → khung
   * nét đứt, không bấm được — cho chính tờ đang xem, hoặc tờ chưa mở được.
   */
  links: {
    /** Loại chứng từ, in hoa nhỏ ("Lệnh SX"). */
    label: string
    /** Mã chứng từ, chữ đơn cách. */
    code: string
    /** Đường tới tờ đó. */
    href?: string
    /** Ép thành khung nét đứt dù có `href` — thắng `href`. */
    muted?: boolean
  }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {links.map((l, i) => (
        <span key={l.code + i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[var(--ink-empty)]">›</span>}
          {l.href && !l.muted ? (
            <a
              href={l.href}
              className="group rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-1 hover:border-[var(--act)]"
            >
              <span className="text-k-label block font-semibold tracking-[.07em] text-[var(--ink-3)] uppercase">
                {l.label}
              </span>
              <span className="text-k-sm block font-[family-name:var(--font-mono)] font-semibold text-[var(--act)]">
                {l.code}
              </span>
            </a>
          ) : (
            <span className="rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] px-2 py-1">
              <span className="text-k-label block font-semibold tracking-[.07em] text-[var(--ink-3)] uppercase">
                {l.label}
              </span>
              <span className="text-k-sm block font-[family-name:var(--font-mono)] text-[var(--ink-3)]">
                {l.code}
              </span>
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

/**
 * NÚT VIỆC TIẾP THEO — một hành động chính, phần còn lại xuống hàng phụ.
 *
 * ERP hỏng thường bày 8 nút ngang hàng nhau rồi để người dùng tự đoán cái
 * nào là bước kế. Mỗi trạng thái chỉ có ĐÚNG MỘT bước đi tiếp tự nhiên —
 * bày nó to lên, còn lại là ngoại lệ.
 */
export function PrimaryStep({
  label,
  icon,
  busy = false,
  onClick,
  href,
  blockedBy,
  why,
}: {
  /** Tên bước, bằng động từ nghiệp vụ ("Gửi Giám đốc duyệt"). Luôn là nút chính (nền đặc). */
  label: string
  /** Icon đứng trước chữ — cùng luật `Btn`. */
  icon?: IcoName
  /** Việc đang chạy (đang lưu, đang gửi) — khoá mềm, vòng quay thay icon. */
  busy?: boolean
  /** Việc khi bấm. Bị nuốt khi nút khoá (`blockedBy`, `why` hoặc `busy`). */
  onClick?: () => void
  /** Có thì nút là liên kết thật. Bị khoá thì vẫn là nút, không điều hướng. */
  href?: string
  /**
   * Bộ phận giữ quyền — có giá trị là nút khoá MỀM: vẫn Tab tới được, trình đọc
   * nghe "Việc này do … quản lý".
   */
  blockedBy?: string
  /**
   * Vì sao chưa bấm được (thiếu dữ liệu, sai điều kiện). Có giá trị thì câu này
   * in màu cảnh báo dưới nút, nút khoá MỀM (`aria-disabled`: vẫn Tab tới được,
   * bấm bị nuốt, có `href` cũng không điều hướng) và câu gắn vào nút qua
   * `aria-describedby` — trình đọc nghe tên nút kèm lý do.
   */
  why?: string
}) {
  const whyId = useId()
  /*
    KHOÁ MỀM, KHÔNG KHOÁ CỨNG (B7½, 24/09/2026). Bản cũ đặt `disabled` thật:
    nút rơi khỏi thứ tự Tab, nên người dùng bàn phím không bao giờ tới được
    nút để nghe VÌ SAO — mà câu lý do cũng không gắn vào nút. Đúng lỗi luật
    kiểm của sổ cấm: "hành động bị chặn phải nói vướng gì, ngay tại chỗ".

    ẨN HẲN NÚT KHI KHOÁ LÀ CÙNG LỖI (29/09/2026) — chỗ gọi cũ tự ẩn nút này
    khi `why` có giá trị, đúng thứ luật trên cấm. `PrimaryStep` giờ LUÔN vẽ
    nút; chỗ gọi chỉ truyền `why`, không tự quyết có vẽ hay không.
  */
  return (
    <div className="flex flex-col items-end gap-1">
      <Btn
        primary
        icon={icon}
        busy={busy}
        onClick={onClick}
        href={href}
        blockedBy={blockedBy}
        aria-disabled={why ? true : undefined}
        aria-describedby={why ? whyId : undefined}
      >
        {label}
      </Btn>
      {why && (
        <span
          id={whyId}
          className="text-k-label max-w-[220px] text-right leading-snug text-[var(--warn)]"
        >
          {why}
        </span>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   THANH TRẠNG THÁI MỘT DÒNG + CHUYỂN TRẠNG THÁI NGAY TRÊN THANH.

   Thêm 27/09/2026 (canvas "Đơn mua", trang "Thanh trạng thái gọn"). Trước đó
   câu hỏi "đơn đang ở đâu, đi tiếp thế nào" nằm ở BA chỗ: hai dải bước
   (`StatusTrack` trạng thái 7 ô + nhận hàng 3 ô), dải `HolderBar` riêng, và
   nút chuyển bước ở tận thanh hành động. Chủ dự án chốt: CHỈ MỘT trạng thái —
   bỏ dải bước. Vòng đời đầy đủ vẫn còn, gấp vào khung nổi khi bấm chữ trạng
   thái (Salesforce Path / Odoo statusbar gộp lại thành một viên).

   Nút chính (`next`) là việc KẾ TIẾP của bước; mọi chuyển khác (đi tiếp khác,
   quay lại, dừng) gom vào menu "Chuyển trạng thái", mục không làm được vẫn
   hiện kèm LÝ DO (`why` / `blockedBy` của `Menu`).
   ══════════════════════════════════════════════════════════════════════ */
export function DocStatus({
  status,
  icon,
  tone,
  marks,
  holder,
  next,
  moves,
  movesLabel = 'Chuyển trạng thái',
}: {
  /** Tên trạng thái hiện tại, chữ người đọc ("Đã gửi NCC", "Chờ duyệt"). */
  status: string
  /** Icon theo khái niệm của bước (`gui`, `cho`, `duyet`, `nhapKho`…). */
  icon: IcoName
  /**
   * Màu icon theo vòng đời: `done` đã xong trọn, `warn` đang chờ ai đó, `stop`
   * đã huỷ / dừng. Bỏ trống = màu hành động (đang chạy bình thường).
   */
  tone?: 'done' | 'warn' | 'stop'
  /**
   * Vòng đời đầy đủ cho khung nổi mở khi bấm chữ trạng thái — cùng kiểu mốc với
   * `Timeline` (mốc `at: null` = chưa tới). Không có mốc nào thì chữ trạng thái
   * không bấm được.
   */
  marks?: Mark[]
  /**
   * Ai đang giữ chứng từ ở bước này. `days` = số ngày đã nằm ở bước (tính sẵn
   * bằng `daysHeld`), tô màu theo `HOLD_AGE_DAYS`: dưới 3 không tô, 3–6 `warn`,
   * từ 7 `stop`. Chứng từ đã khép thì bỏ trống — đừng bịa người giữ.
   */
  holder?: { who: string; what: string; days?: number | null; mine?: boolean }
  /** Nút chuyển sang bước KẾ TIẾP — thường là `Btn primary`, có thể khoá mềm (`blockedBy`). */
  next?: ReactNode
  /**
   * Các chuyển trạng thái khác, cùng kiểu mục với `Menu` — gom nhóm "Đi tiếp" /
   * "Quay lại" / "Dừng" bằng `group`, mục không làm được giữ lại kèm `why`.
   * Rỗng thì không vẽ nút menu.
   */
  moves?: ComponentProps<typeof Menu>['items']
  /** Chữ trên nút mở menu chuyển trạng thái. */
  movesLabel?: string
}) {
  const days = holder?.days ?? null
  const ageTone =
    days == null
      ? null
      : days >= HOLD_AGE_DAYS.stop
        ? 'stop'
        : days >= HOLD_AGE_DAYS.warn
          ? 'warn'
          : null
  const toneCls =
    tone === 'done'
      ? 'text-[var(--done)]'
      : tone === 'warn'
        ? 'text-[var(--warn)]'
        : tone === 'stop'
          ? 'text-[var(--stop)]'
          : 'text-[var(--act)]'
  const toneWash =
    tone === 'done'
      ? 'bg-[var(--done-wash)] border-[var(--done-line)]'
      : tone === 'warn'
        ? 'bg-[var(--warn-wash)] border-[var(--warn-line)]'
        : tone === 'stop'
          ? 'bg-[var(--stop-wash)] border-[var(--stop-line)]'
          : 'bg-[var(--act-wash)] border-[var(--act-line)]'
  const pill = (
    <button
      type="button"
      disabled={!marks?.length}
      aria-label={`Trạng thái: ${status}${marks?.length ? ' — xem vòng đời' : ''}`}
      className={cn(
        'text-k-body inline-flex h-[var(--ctl-h)] shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border pr-2.5 pl-2 font-semibold',
        toneWash,
        toneCls,
        'outline-none focus-visible:shadow-[0_0_0_2px_var(--act)] enabled:hover:brightness-95 disabled:cursor-default',
      )}
    >
      <span className="inline-flex">
        <Ico name={icon} size={16} />
      </span>
      {status}
      {!!marks?.length && (
        <span aria-hidden="true" className="text-k-label text-[var(--ink-3)]">
          ▾
        </span>
      )}
    </button>
  )
  return (
    <div
      role="group"
      aria-label="Trạng thái và chuyển bước"
      className="flex min-h-11 flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-4 py-2"
    >
      {marks?.length ? (
        <Popover label={`Vòng đời: ${status}`} trigger={pill} width={420}>
          <Timeline marks={marks} />
        </Popover>
      ) : (
        pill
      )}
      {holder && (
        <div
          role="status"
          className="text-k-body flex min-w-0 items-center gap-1.5 text-[var(--ink-2)]"
        >
          <span className="h-5 w-px shrink-0 bg-[var(--line)]" aria-hidden="true" />
          <Ico name="cho" size={14} />
          <span className="min-w-0">
            {/* "Đang giữ: X — việc". Câu việc của chỗ gọi thường tự mở bằng "Chờ …";
                ghép sau "Đang chờ" thì thành "Đang chờ NCC — Chờ NCC xác nhận". */}
            {holder.mine ? (
              <b className="font-semibold text-[var(--act)]">Đến lượt bạn</b>
            ) : (
              <>
                Đang giữ: <b className="font-semibold text-[var(--ink)]">{holder.who}</b>
              </>
            )}{' '}
            — {holder.what}
          </span>
          {days != null && (
            <span
              className={cn(
                'text-k-sm num shrink-0 rounded-[var(--radius-pill)] px-1.5 font-semibold',
                ageTone === 'stop'
                  ? 'bg-[var(--stop-wash)] text-[var(--stop)]'
                  : ageTone === 'warn'
                    ? 'bg-[var(--warn-wash)] text-[var(--warn)]'
                    : // --fill là màu ĐẶC của thanh tiến độ (#5a6577), không phải nền nhạt —
                      // từng làm viên "N ngày" thành viên xám đậm chữ chìm mất (28/09/2026).
                      'bg-[var(--surface)] text-[var(--ink-3)]',
              )}
            >
              {days === 0 ? 'hôm nay' : `${days} ngày`}
            </span>
          )}
        </div>
      )}
      <span className="grow" />
      {(next || !!moves?.length) && (
        <div className="flex shrink-0 items-center gap-2">
          {next}
          {!!moves?.length && <Menu label={`${movesLabel} ▾`} items={moves} />}
        </div>
      )}
    </div>
  )
}
