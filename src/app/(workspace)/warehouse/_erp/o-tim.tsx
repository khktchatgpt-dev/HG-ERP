'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Ô TÌM CÓ DANH SÁCH GỢI Ý của khu Kho (lối ERP, không kit — B3, 14/10/2026).
 * Ba cách nạp gợi ý:
 *  · `items` + `khop` — danh sách có sẵn, lọc tại chỗ (chọn lệnh, bộ phận);
 *  · `search` — hỏi server theo chữ gõ, chờ 250ms (thêm dòng vật tư, 13 nghìn mã);
 *  · `loc` (+ `search` làm đường lùi) — lọc tại máy, tự xếp; chỉ khi `loc` không
 *    ra gì mới hỏi server (màn Xuất hàng: nạp sẵn mã còn tồn, 27/10/2026).
 *
 * Bàn phím theo mẫu combobox của WAI-ARIA: ↓/↑ đi trong danh sách, Enter chọn,
 * Esc đóng; có `onLat` thì Shift+Enter tích nhiều. `giuChu=false` (mặc định) = chọn xong ô trống lại để gõ mã kế tiếp;
 * `giuChu` = ô hiện tên mục đã chọn (ô chọn một giá trị).
 *
 * Danh sách gợi ý đặt `position: fixed` theo vị trí ô (đo lại khi cuộn / đổi cỡ):
 * nằm trong lưới cuộn hay hộp thoại cuộn thì gợi ý cũng không bị cắt.
 */
export function OTim<T>({
  id,
  items,
  khop,
  search,
  loc: locTaiMay,
  cuoi,
  onLat,
  dangTich = false,
  onXongTich,
  keyOf,
  render,
  textOf,
  onPick,
  placeholder,
  label,
  disabled,
  giuChu = false,
  value = null,
  tone,
  width,
  rong,
}: {
  id?: string
  items?: readonly T[]
  /** Lọc `items` theo chữ gõ. */
  khop?: (item: T, q: string) => boolean
  search?: (q: string) => Promise<T[]>
  /**
   * Gợi ý TẠI MÁY theo chữ gõ, đã lọc + xếp. Có kết quả thì không hỏi server;
   * rỗng thì mới gọi `search` (nếu có).
   */
  loc?: (q: string) => T[]
  /** Dòng chú cuối danh sách (không chọn được); `tuServer` = đang bày kết quả của `search`. */
  cuoi?: (tuServer: boolean) => ReactNode
  /**
   * TÍCH NHIỀU: Shift+Enter tích/bỏ mục đang trỏ, danh sách vẫn mở, con trỏ
   * xuống mục dưới. Đang có mục tích (`dangTich`) thì bấm cả dòng cũng là tích,
   * và Enter gọi `onXongTich` (thêm cả loạt) thay cho `onPick`.
   */
  onLat?: (item: T) => void
  dangTich?: boolean
  onXongTich?: () => void
  keyOf: (item: T) => string
  render: (item: T) => ReactNode
  /** Chữ hiện trong ô khi đã chọn (ô `giuChu`). */
  textOf?: (item: T) => string
  onPick: (item: T) => void
  placeholder?: string
  label: string
  disabled?: boolean
  giuChu?: boolean
  /** Mục đang chọn (ô `giuChu`). */
  value?: T | null
  tone?: 'need'
  width?: number | string
  /** Câu khi không có gợi ý nào. */
  rong?: string
}) {
  const listId = useId()
  const [q, setQ] = useState(giuChu && value && textOf ? textOf(value) : '')
  const [seen, setSeen] = useState(value)
  if (giuChu && seen !== value) {
    setSeen(value)
    setQ(value && textOf ? textOf(value) : '')
  }
  const [mo, setMo] = useState(false)
  const [at, setAt] = useState(0)
  const [ketQua, setKetQua] = useState<T[]>([])
  /** Chữ gõ ứng với `ketQua` — đường `loc` không bày kết quả của câu gõ trước. */
  const [ketQuaQ, setKetQuaQ] = useState('')
  const [dangTim, setDangTim] = useState(false)
  const goc = useRef<HTMLDivElement>(null)
  // search thường là hàm viết tại chỗ — giữ bản mới nhất, effect chỉ chạy theo chữ gõ.
  const timRef = useRef(search)
  useEffect(() => {
    timRef.current = search
  })

  const dangSua = giuChu && value && textOf ? q !== textOf(value) : true
  const coLoc = !!locTaiMay
  const taiMay = locTaiMay ? locTaiMay(q) : null
  // Đường `loc`: tại máy không ra gì thì mới bày kết quả server (của ĐÚNG chữ đang gõ).
  const tuServer = !!taiMay && taiMay.length === 0
  const choServer = tuServer && !!search && ketQuaQ !== q.trim()
  const loc = items
    ? (dangSua && q.trim() ? items.filter((i) => (khop ? khop(i, q) : true)) : items).slice(0, 50) // prettier-ignore
    : taiMay && !tuServer
      ? taiMay
      : tuServer && choServer
        ? []
        : ketQua

  // Hỏi server theo chữ gõ — chờ người dừng tay 250ms. Đường `loc` chỉ hỏi khi tại máy rỗng.
  useEffect(() => {
    if (!timRef.current || !mo) return
    if (coLoc && !tuServer) return
    const s = q.trim()
    if (s.length < 1) return
    let huy = false
    const t = setTimeout(() => {
      setDangTim(true)
      timRef.current!(s)
        .then((r) => {
          if (!huy) {
            setKetQua(r)
            setKetQuaQ(s)
            setAt(0)
          }
        })
        .catch(() => !huy && setKetQua([]))
        .finally(() => !huy && setDangTim(false))
    }, 250)
    return () => {
      huy = true
      clearTimeout(t)
    }
  }, [q, mo, coLoc, tuServer])

  // Bấm ra ngoài thì đóng.
  useEffect(() => {
    if (!mo) return
    const ngoai = (e: MouseEvent) => {
      if (!goc.current?.contains(e.target as Node)) {
        setMo(false)
        if (giuChu) setQ(value && textOf ? textOf(value) : '')
      }
    }
    document.addEventListener('mousedown', ngoai)
    return () => document.removeEventListener('mousedown', ngoai)
  }, [mo, giuChu, value, textOf])

  const chon = (item: T) => {
    onPick(item)
    setMo(false)
    setKetQua([])
    setQ(giuChu && textOf ? textOf(item) : '')
  }
  const hienDs = mo && (items ? true : q.trim().length > 0)
  const oNhap = useRef<HTMLInputElement>(null)
  const [viTri, setViTri] = useState<{ top: number; left: number; w: number } | null>(
    null,
  )
  useLayoutEffect(() => {
    if (!hienDs) return
    const do_ = () => {
      const b = oNhap.current?.getBoundingClientRect()
      if (b) setViTri({ top: b.bottom + 2, left: b.left, w: b.width })
    }
    do_()
    window.addEventListener('scroll', do_, true)
    window.addEventListener('resize', do_)
    return () => {
      window.removeEventListener('scroll', do_, true)
      window.removeEventListener('resize', do_)
    }
  }, [hienDs])

  return (
    <div ref={goc} className="kh-tim" style={{ width }}>
      <input
        ref={oNhap}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={hienDs}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={hienDs && loc[at] ? `${listId}-${at}` : undefined}
        aria-label={label}
        autoComplete="off"
        className={['kh-o', tone].filter(Boolean).join(' ')}
        value={q}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={(e) => {
          setMo(true)
          if (giuChu) e.currentTarget.select()
        }}
        onChange={(e) => {
          setQ(e.target.value)
          setMo(true)
          setAt(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setMo(true)
            setAt((a) => Math.min(a + 1, Math.max(0, loc.length - 1)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAt((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter' && e.shiftKey && onLat && hienDs && loc[at]) {
            // Tích nhiều: danh sách vẫn mở, xuống mục dưới để tích tiếp.
            e.preventDefault()
            onLat(loc[at])
            setAt((a) => Math.min(a + 1, Math.max(0, loc.length - 1)))
          } else if (
            e.key === 'Enter' &&
            dangTich &&
            onXongTich &&
            !e.ctrlKey &&
            !e.metaKey
          ) {
            // Đang có mục tích: Enter thêm CẢ LOẠT đã tích (không thêm mục đang trỏ).
            e.preventDefault()
            onXongTich()
            setMo(false)
            setKetQua([])
            setQ('')
          } else if (e.key === 'Enter' && hienDs && loc[at] && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            chon(loc[at])
          } else if (e.key === 'Escape') {
            setMo(false)
          }
        }}
      />
      {hienDs && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="kh-tim-ds"
          style={
            viTri ? { top: viTri.top, left: viTri.left, minWidth: viTri.w } : undefined
          }
        >
          {(dangTim || choServer) && loc.length === 0 ? (
            <li className="rong">Đang tìm…</li>
          ) : loc.length === 0 ? (
            <li className="rong">{rong ?? 'Không có gợi ý nào khớp'}</li>
          ) : (
            loc.map((item, i) => (
              <li
                key={keyOf(item)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === at}
                className={i === at ? 'on' : undefined}
                onMouseEnter={() => setAt(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (dangTich && onLat) onLat(item)
                  else chon(item)
                }}
              >
                {render(item)}
              </li>
            ))
          )}
          {cuoi && !((dangTim || choServer) && loc.length === 0) && (
            <li className="rong cuoi" role="none">
              {cuoi(tuServer)}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** Dải nút chọn một (radio) — "Xuất cho", "Tổ lấy". Ô đang chọn nền nhạt + chữ xanh. */
export function ChonMot<V extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  need = false,
}: {
  value: V | ''
  options: { value: V; label: string }[]
  onChange: (v: V) => void
  label: string
  disabled?: boolean
  need?: boolean
}) {
  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={need ? 'kh-seg need' : 'kh-seg'}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}
