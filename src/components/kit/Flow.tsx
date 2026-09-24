'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Btn, Tag } from './Primitives'

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
  onClick,
  href,
  blockedBy,
  why,
}: {
  /** Tên bước, bằng động từ nghiệp vụ ("Gửi Giám đốc duyệt"). Luôn là nút chính (nền đặc). */
  label: string
  /** Việc khi bấm. Bị nuốt khi nút khoá (`blockedBy` hoặc `why`). */
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
  */
  return (
    <div className="flex flex-col items-end gap-1">
      <Btn
        primary
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
