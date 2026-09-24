'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Command, useCommandState } from 'cmdk'
import { Popover as P } from 'radix-ui'
import { normalizeSearch, searchTokens } from '@/lib/search-text'
import { cn } from '@/lib/utils'

/**
 * Ô TÌM-RỒI-CHỌN — một thành phần, hai nguồn dữ liệu.
 *
 * Thay `PickFind` + `Lookup` (B4, 24/09/2026 — docs/he-thiet-ke-erp-ke-hoach.md
 * §1.4). Hai bản cũ khác nhau ở NGUỒN (lọc tại chỗ / hỏi server) nhưng giống
 * hệt nhau ở VỎ: ô nhập, danh sách thả, mũi tên, Enter, Esc — và cùng mang
 * một lỗi: danh sách nằm `absolute` trong DOM nơi gọi, nên đặt trong bảng cuộn
 * hay hộp thoại là bị CẮT. Sửa phải sửa hai lần. Nay vỏ là một:
 *
 *   · `cmdk` lo bàn phím (↑ ↓ Home End Enter), `listbox`/`option`,
 *     `aria-activedescendant` — đúng mẫu combobox của WAI-ARIA;
 *   · Radix Popover lo portal (hết bị cắt), tự lật khi chạm mép màn, Esc đóng,
 *     và xếp lớp đúng khi ô nằm trong `Sheet`.
 *
 * Nguồn dữ liệu thì KHÔNG gộp — cảnh báo của bản cũ vẫn đúng: danh mục 13k vật
 * tư không tải về trình duyệt được, còn 168 NCC đã nằm sẵn trong trang thì
 * không nên mở API. Nên có hai kiểu gọi, phân biệt bằng prop:
 *
 *   `options` + `value` + `onChange` — CHỌN một giá trị, lọc tại chỗ. Ô giữ và
 *        hiện tên đã chọn (thay `PickFind`).
 *   `search` + `onPick` + `render` + `keyOf` — TRA ở server rồi LẤY một dòng.
 *        Ô trống lại sau khi lấy, con trỏ ở lại — thêm dòng thứ hai không phải
 *        chạm chuột (thay `Lookup`).
 *
 * Lọc tại chỗ BỎ DẤU và AND từng từ (`searchTokens`): gõ "son tin" ra "CÔNG TY
 * NHỰA SƠN TÍN PHÁT". Vì vậy `shouldFilter={false}` — bộ lọc của cmdk chấm
 * điểm theo ký tự, không hiểu tiếng Việt không dấu.
 */
export type ComboOption = {
  /** Khoá lưu (id NCC, mã vật tư). */
  value: string
  /** Chữ hiện trong ô và trong danh sách — cũng là chữ được lọc. */
  label: string
  /** Dòng phụ nhạt dưới tên (mã, SĐT). Cũng được lọc: gõ mã NCC vẫn ra. */
  hint?: string
}

type Common = {
  /** Tên ô — BẮT BUỘC: ô không tên đi bằng bàn phím là ô câm. */
  label: string
  /** Gợi ý trong ô khi trống. Mặc định "Gõ để tìm…" (kiểu chọn) / "Gõ mã hoặc tên…" (kiểu tra). */
  placeholder?: string
  /** Khoá ô — mờ 45%, rơi khỏi thứ tự Tab, không mở danh sách. */
  disabled?: boolean
  /** Bề ngang ô, px. Danh sách thả vẫn rộng tối thiểu 300px (chọn) / 560px (tra) dù ô hẹp hơn. */
  width?: number
}

export type ComboChonProps = Common & {
  /** Kiểu CHỌN: toàn bộ lựa chọn đã có sẵn trong trang (vd. 168 NCC). Lọc tại chỗ, bỏ dấu, AND từng từ. */
  options: ComboOption[]
  /** `value` đang chọn, '' = chưa chọn. Ô hiện `label` của dòng khớp. */
  value: string
  /** Nhận `value` vừa chọn; '' khi người dùng chọn dòng bỏ chọn đầu danh sách. */
  onChange: (v: string) => void
  /** Chữ khi chưa chọn gì — cũng là dòng đầu danh sách để BỎ chọn. */
  emptyLabel?: string
}

export type ComboTraProps<T> = Common & {
  /**
   * Kiểu TRA: hỏi server sau 180ms ngừng gõ. Kết quả về muộn của từ khoá cũ bị bỏ.
   * Lỗi (promise bị từ chối) CHƯA được bắt — chỗ gọi tự bắt và trả [] nếu cần.
   */
  search: (q: string) => Promise<T[]>
  /** Nhận dòng vừa lấy. Sau đó ô trống lại và con trỏ ở lại ô, để lấy dòng tiếp. */
  onPick: (item: T) => void
  /** Vẽ một dòng kết quả — nên có mã + tên + quy cách + ĐVT để phân biệt hai mã gần giống. */
  render: (item: T) => ReactNode
  /** Khoá DUY NHẤT của một dòng (mã vật tư) — vừa là khoá React vừa là giá trị dòng mà cmdk dùng để biết dòng nào đang sáng. */
  keyOf: (item: T) => string
}

export function Combobox<T>(props: ComboChonProps | ComboTraProps<T>) {
  return 'options' in props ? (
    <Chon {...props} />
  ) : (
    <Tra {...(props as ComboTraProps<T>)} />
  )
}

/* ── Kiểu CHỌN: lọc tại chỗ, ô giữ giá trị ─────────────────────────────── */

function Chon({
  options,
  value,
  onChange,
  emptyLabel = '— chưa chọn —',
  placeholder = 'Gõ để tìm…',
  ...common
}: ComboChonProps) {
  const [q, setQ] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const chosen = options.find((o) => o.value === value) ?? null

  const tokens = searchTokens(q ?? '')
  const hits =
    tokens.length === 0
      ? options
      : options.filter((o) => {
          const hay = normalizeSearch(`${o.label} ${o.hint ?? ''}`)
          return tokens.every((t) => hay.includes(t))
        })

  const close = () => {
    setQ(null)
    setOpen(false)
  }
  const pick = (v: string) => {
    onChange(v)
    close()
  }

  return (
    <Shell
      {...common}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={close}
      // Đang gõ thì hiện chữ đang gõ; không thì hiện tên đã chọn. Một ô, hai vai.
      text={q ?? chosen?.label ?? ''}
      onText={(t) => {
        setQ(t)
        setOpen(true)
      }}
      placeholder={chosen ? undefined : placeholder}
      selectOnFocus
      caret
      listMin={300}
      empty={q ? `Không có dòng nào khớp “${q}”.` : 'Danh sách trống.'}
      rows={[
        { key: '__none', node: emptyLabel, muted: true, onSelect: () => pick('') },
        ...hits.map((o) => ({
          key: `v:${o.value}`,
          chosen: o.value === value,
          onSelect: () => pick(o.value),
          node: (
            <>
              <span className="block truncate">{o.label}</span>
              {o.hint && (
                <span className="text-k-label block truncate text-[var(--ink-3)]">
                  {o.hint}
                </span>
              )}
            </>
          ),
        })),
      ]}
      hitCount={hits.length}
      // Đang gõ: sáng dòng KHỚP ĐẦU TIÊN. Bản cũ để sáng dòng "chưa chọn", nên
      // gõ "son tin" rồi Enter là XOÁ lựa chọn thay vì chọn Sơn Tín Phát.
      // Chưa gõ: sáng dòng đang được chọn, để ↓ đi tiếp từ đúng chỗ đó.
      startKey={
        q && hits[0] ? `v:${hits[0].value}` : chosen ? `v:${chosen.value}` : undefined
      }
    />
  )
}

/* ── Kiểu TRA: hỏi server, lấy một dòng, ô trống lại ───────────────────── */

const EMPTY_TRA = 'Không thấy mã nào khớp.'

function Tra<T>({
  search,
  onPick,
  render,
  keyOf,
  placeholder = 'Gõ mã hoặc tên…',
  ...common
}: ComboTraProps<T>) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Câu cho trình đọc màn hình — chỉ đổi SAU khi kết quả về, không đổi mỗi phím
  // gõ (đổi mỗi phím là trình đọc lải nhải "đang tìm" suốt lúc người ta gõ).
  const [said, setSaid] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  // Tìm sau 180ms ngừng gõ, KHÔNG tìm mỗi phím — danh mục 13k dòng.
  const run = (text: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (!text.trim()) {
      seq.current++
      setItems([])
      setErr(null)
      setOpen(false)
      setBusy(false)
      return
    }
    timer.current = setTimeout(async () => {
      const my = ++seq.current
      setBusy(true)
      try {
        const r = await search(text.trim())
        // Kết quả về muộn của từ khoá cũ thì bỏ — không để danh sách nhảy ngược.
        if (my === seq.current) {
          setItems(r)
          setErr(null)
          setSaid(r.length ? `${r.length} kết quả` : EMPTY_TRA)
          setOpen(true)
        }
      } catch (e) {
        /*
          SEARCH HỎNG THÌ PHẢI NÓI (B7½, 24/09/2026). Trước đây lời hứa bị từ
          chối không ai bắt: người dùng gõ xong thấy… không gì cả, và lỗi nổi
          lên thành "unhandled rejection" trong console. Nay câu lỗi nằm NGAY
          trong danh sách, chỗ mắt đang nhìn; gõ tiếp là tra lại.
        */
        if (my === seq.current) {
          const why = e instanceof Error ? e.message : String(e)
          setItems([])
          setErr(`Không tra được: ${why}`)
          // Vùng thông báo đọc câu NGẮN khác chữ, không lặp nguyên văn dòng lỗi
          // trong danh sách — lặp thì người dùng trình đọc nghe hai lần.
          setSaid(`Lỗi tra cứu — ${why}`)
          setOpen(true)
        }
      } finally {
        if (my === seq.current) setBusy(false)
      }
    }, 180)
  }

  const close = () => setOpen(false)
  const pick = (it: T) => {
    onPick(it)
    setQ('')
    setItems([])
    setOpen(false)
  }

  return (
    <Shell
      {...common}
      open={open}
      onOpen={() => items.length > 0 && setOpen(true)}
      onClose={close}
      text={q}
      onText={(t) => {
        setQ(t)
        run(t)
      }}
      placeholder={placeholder}
      busy={busy}
      // Dòng kết quả mang mã + tên + quy cách + ĐVT + nhóm. Ép bằng bề ngang ô
      // là tên vật tư bị cắt đúng chỗ phân biệt hai mã gần giống nhau.
      listMin={560}
      empty={err ?? EMPTY_TRA}
      status={said}
      rows={items.map((it) => ({
        key: `k:${keyOf(it)}`,
        onSelect: () => pick(it),
        node: render(it),
        ruled: true,
      }))}
      hitCount={items.length}
    />
  )
}

/* ── Ô nhập ────────────────────────────────────────────────────────────── */

/*
  VÌ SAO KHÔNG DÙNG `Command.Input` CỦA cmdk. Hai lỗi, đều đo được bằng test:

   1. Mỗi lần chữ gõ đổi, cmdk TỰ đặt dòng sáng về dòng ĐẦU danh sách — không
      có cờ nào tắt. Ở kiểu CHỌN dòng đầu là "— chưa chọn —", nên gõ "son tin"
      rồi Enter là XOÁ lựa chọn thay vì chọn Sơn Tín Phát.
   2. Nó gắn cứng `aria-expanded="true"` kể cả khi danh sách đang đóng — sai
      mẫu combobox của WAI-ARIA.

  Lọc vốn do mình làm (`shouldFilter={false}`), nên cmdk không cần biết chữ gõ.
  Ô nhập thường + tự gắn bốn thuộc tính ARIA; phím ↑ ↓ Enter vẫn nổi bọt lên
  gốc `Command` và cmdk vẫn lo phần di dòng.
*/
function ComboInput({
  ref,
  listId,
  label,
  open,
  onText,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  ref: React.Ref<HTMLInputElement>
  /** Id listbox cmdk tự sinh — Shell báo lên qua callback ref của danh sách. */
  listId: string | undefined
  label: string
  open: boolean
  onText: (t: string) => void
}) {
  const active = useCommandState((s) => s.selectedItemId)
  return (
    <input
      ref={ref}
      type="text"
      role="combobox"
      aria-label={label}
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open ? active : undefined}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => onText(e.target.value)}
      {...rest}
    />
  )
}

/* ── Vỏ chung ──────────────────────────────────────────────────────────── */

type Row = {
  key: string
  node: ReactNode
  onSelect: () => void
  /** Dòng "bỏ chọn" — chữ nhạt. */
  muted?: boolean
  /** Dòng đang được chọn — chữ đậm. */
  chosen?: boolean
  /** Kẻ vạch giữa các dòng — cho dòng nhiều thông tin (kiểu TRA). */
  ruled?: boolean
}

function Shell({
  label,
  placeholder,
  disabled,
  width,
  open,
  onOpen,
  onClose,
  text,
  onText,
  rows,
  hitCount,
  empty,
  busy,
  caret,
  selectOnFocus,
  listMin,
  startKey,
  status,
}: Common & {
  /**
   * Câu cho vùng thông báo lịch sự (số kết quả / rỗng / lỗi). Có giá trị — kể
   * cả chuỗi rỗng — là vẽ ĐÚNG MỘT vùng `status`, nằm NGOÀI lớp nổi để nó có
   * mặt trong trang trước khi câu đầu tiên tới (vùng sinh ra cùng lúc với câu
   * thì trình đọc hay bỏ qua). Không có = không vẽ vùng (kiểu CHỌN lọc tại
   * chỗ, danh sách hiện ngay dưới tay — không cần báo).
   */
  status?: string
  open: boolean
  onOpen: () => void
  onClose: () => void
  text: string
  onText: (t: string) => void
  rows: Row[]
  hitCount: number
  empty: string
  busy?: boolean
  caret?: boolean
  selectOnFocus?: boolean
  listMin: number
  /** Dòng sáng khi tập dòng đổi. Không có = dòng đầu. */
  startKey?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  /*
    Id của listbox để gắn `aria-controls`. CALLBACK ref chứ không đọc ref trong
    hiệu ứng: Radix vẽ phần nổi ở một nhịp SAU, nên hiệu ứng của ô nhập chạy khi
    danh sách chưa có — đo trên app thật 24/09, `aria-controls` trống.
  */
  const [listId, setListId] = useState<string>()
  // Dòng đang sáng. Tự đặt về dòng ĐẦU mỗi khi tập dòng đổi — để cmdk tự quyết
  // thì kết quả server về muộn (tập dòng đổi mà chữ gõ không đổi) không có dòng
  // nào sáng, và Enter không làm gì.
  const firstKey = startKey ?? rows[0]?.key ?? ''
  const rowsSig = rows.map((r) => r.key).join('|')
  const [hl, setHl] = useState(firstKey)
  const [seenSig, setSeenSig] = useState(rowsSig)
  if (seenSig !== rowsSig) {
    setSeenSig(rowsSig)
    setHl(firstKey)
  }

  return (
    <Command
      shouldFilter={false}
      loop
      value={hl}
      onValueChange={setHl}
      className="relative"
      style={width ? { width } : undefined}
    >
      <P.Root open={open} onOpenChange={(o) => (o ? onOpen() : onClose())}>
        <P.Anchor asChild>
          <div ref={anchor} className="relative">
            <ComboInput
              ref={input}
              listId={listId}
              label={label}
              open={open}
              value={text}
              onText={onText}
              placeholder={placeholder}
              disabled={disabled}
              onFocus={(e) => {
                if (selectOnFocus) {
                  e.currentTarget.select()
                  onOpen()
                }
              }}
              onKeyDown={(e) => {
                // Mũi tên xuống khi danh sách đóng = mở nó (mẫu combobox APG).
                if (e.key === 'ArrowDown' && !open) {
                  e.preventDefault()
                  onOpen()
                }
                // Enter khi đóng: không đưa cho cmdk (không có dòng nào để chọn).
                if (e.key === 'Enter' && !open) e.stopPropagation()
              }}
              // Rời ô = bỏ dở, không phải xoá: kiểu CHỌN trả về tên đang giữ.
              onBlur={onClose}
              className={cn(
                'text-k-sm h-[var(--ctl-h)] w-full rounded-[var(--radius)] border border-[var(--line)]',
                'bg-[var(--surface-card)] px-2 text-[var(--ink)]',
                (caret || busy) && 'pr-7',
                'placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)]',
                'focus:border-[var(--act)] disabled:opacity-45',
              )}
            />
            {(caret || busy) && (
              <span
                aria-hidden
                className="text-k-label pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[var(--ink-3)]"
              >
                {busy ? '…' : '▾'}
              </span>
            )}
          </div>
        </P.Anchor>
        {status !== undefined && (
          <span role="status" aria-live="polite" className="sr-only">
            {status}
          </span>
        )}
        <P.Portal>
          <div className="kit contents">
            <P.Content
              side="bottom"
              align="start"
              sideOffset={3}
              collisionPadding={8}
              // Tiêu điểm ở LẠI ô nhập: cmdk điều khiển danh sách bằng
              // `aria-activedescendant`, không di tiêu điểm vào dòng.
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => {
                if (anchor.current?.contains(e.target as Node)) e.preventDefault()
              }}
              // Bấm chuột vào dòng KHÔNG được lấy mất tiêu điểm của ô — mất là
              // ô nhận `blur`, danh sách đóng trước khi cú bấm kịp chọn.
              onMouseDown={(e) => e.preventDefault()}
              style={{
                width: `max(var(--radix-popover-trigger-width), ${listMin}px)`,
              }}
              className={cn(
                'z-[var(--z-pop)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius)]',
                'border border-[var(--line)] bg-[var(--surface-card)] shadow-[var(--shadow-drop)]',
              )}
            >
              <Command.List
                ref={(el) => setListId(el?.id)}
                label={label}
                className="max-h-[320px] overflow-auto py-1"
              >
                {hitCount === 0 && (
                  <div className="text-k-sm px-3 py-2 text-[var(--ink-3)]">{empty}</div>
                )}
                {rows.map((r) => (
                  <Command.Item
                    key={r.key}
                    value={r.key}
                    onSelect={r.onSelect}
                    className={cn(
                      'text-k-sm block cursor-pointer px-3 py-1 text-left',
                      r.ruled &&
                        'border-b border-[var(--hair)] py-1.5 leading-[1.45] last:border-b-0',
                      'data-[selected=true]:bg-[var(--act-wash)] data-[selected=true]:text-[var(--act-text)]',
                      r.muted ? 'text-[var(--ink-3)]' : 'text-[var(--ink)]',
                      r.chosen && 'font-semibold',
                    )}
                  >
                    {r.node}
                  </Command.Item>
                ))}
              </Command.List>
            </P.Content>
          </div>
        </P.Portal>
      </P.Root>
    </Command>
  )
}
