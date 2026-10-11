'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

/** Một dòng chọn được. */
export type DongChon = {
  value: string
  label: string
  /** Dòng phụ nhạt dưới tên. */
  hint?: string
  /** Chữ nhỏ mono bên phải (số đơn, tiền). */
  right?: string
  /** Dòng hành động ("+ Tạo …") — chữ màu hành động. */
  act?: boolean
}

/** Một nhóm có tiêu đề. `con` = dòng chữ nhạt không chọn được ở cuối nhóm ("… 16 lệnh nữa"). */
export type NhomChon = { title: string; rows: DongChon[]; con?: string }

/**
 * Ô CHỌN CÓ NHÓM — viết tay, không qua kit (12/10/2026, bản vẽ Đầu đơn mua).
 *
 * Kit chỉ có một danh sách phẳng; bản vẽ cần TIÊU ĐỀ NHÓM ("Lệnh sản xuất đang
 * chạy" / "Hạng mục ngoài sản xuất · đang mở", "Đơn trước của NCC này" / "Kiểu
 * khác") và dòng "còn N … nữa — gõ để tìm" — để nhóm sau không bị đẩy khỏi khung.
 *
 * Người gọi tự lọc: `nhom(q)` trả các nhóm cho chữ đang gõ. Gõ thì dòng sáng là
 * dòng khớp ĐẦU TIÊN (Enter chọn nó); chưa gõ thì sáng dòng đang chọn. ↑↓ đi
 * dòng, Enter chọn, Esc đóng — Esc KHÔNG lọt ra trang (màn soạn đơn dùng Esc làm
 * phím Huỷ).
 */
export function ChonNhom({
  label,
  value,
  text,
  nhom,
  onPick,
  placeholder,
  width,
  listWidth = 460,
  prefix,
}: {
  /** Tên ô (aria-label) — bắt buộc. */
  label: string
  /** Giá trị đang chọn ('' = chưa chọn). */
  value: string
  /** Chữ hiện trong ô khi không gõ (tên của dòng đang chọn). */
  text: string
  nhom: (q: string) => NhomChon[]
  /** Nhận dòng vừa chọn + chữ đang gõ lúc chọn (cho "+ Tạo '<chữ>'"). */
  onPick: (value: string, q: string) => void
  placeholder?: string
  width?: number
  listWidth?: number
  /** Thứ đứng trước chữ trong ô (thẻ LỆNH SX / HẠNG MỤC). */
  prefix?: ReactNode
}) {
  const id = useId()
  const [mo, setMo] = useState(false)
  const [q, setQ] = useState<string | null>(null)
  const [hl, setHl] = useState(0)
  const wrap = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const groups = useMemo(() => nhom(q ?? ''), [nhom, q])
  const flat = groups.flatMap((g) => g.rows)

  const dong = () => {
    setMo(false)
    setQ(null)
  }
  const chon = (i: number) => {
    const r = flat[i]
    if (!r) return
    onPick(r.value, q ?? '')
    dong()
  }
  const mo_ = () => {
    setMo(true)
    const i = flat.findIndex((r) => r.value === value)
    setHl(i >= 0 ? i : 0)
  }

  useEffect(() => {
    if (!mo) return
    const off = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && dong()
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [mo])

  // Vị trí đầu của từng nhóm trong danh sách phẳng — để mỗi dòng biết chỉ số của nó.
  const dau = groups.map((_, gi) =>
    groups.slice(0, gi).reduce((t, g) => t + g.rows.length, 0),
  )
  return (
    <span
      ref={wrap}
      className="relative inline-flex items-center"
      style={width ? { width } : undefined}
    >
      {prefix}
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        aria-expanded={mo}
        aria-controls={`${id}-ds`}
        aria-activedescendant={mo && flat[hl] ? `${id}-${hl}` : undefined}
        aria-autocomplete="list"
        className="min-w-0 flex-1 bg-transparent px-1.5 py-[5px] text-[13px] outline-none"
        value={q ?? text}
        placeholder={placeholder}
        onFocus={(e) => {
          e.currentTarget.select()
          mo_()
        }}
        onMouseDown={() => !mo && mo_()}
        onChange={(e) => {
          setQ(e.target.value)
          setMo(true)
          setHl(0) // gõ → sáng dòng khớp đầu
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!mo) return mo_()
            setHl((i) => Math.min(i + 1, flat.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHl((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && mo) {
            e.preventDefault()
            chon(hl)
          } else if (e.key === 'Escape' && mo) {
            e.preventDefault()
            e.stopPropagation()
            dong()
          } else if (e.key === 'Tab') dong()
        }}
      />
      <span aria-hidden className="pr-1.5 text-[var(--ink-3)]">
        ▾
      </span>
      {mo && (
        <div
          id={`${id}-ds`}
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1 max-h-[360px] overflow-auto border border-[var(--line)] bg-[var(--surface-card)] shadow-[0_6px_18px_rgba(15,20,28,.12)]"
          style={{ width: listWidth }}
        >
          {flat.length === 0 && (
            <div className="px-3 py-2 text-[12.5px] text-[var(--ink-3)]">
              Không có dòng nào khớp “{q}”.
            </div>
          )}
          {groups.map((g, gi) =>
            g.rows.length === 0 && !g.con ? null : (
              <div key={g.title} role="group" aria-label={g.title}>
                <div className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-3 pt-2 pb-1 text-[10.5px] font-bold tracking-[.05em] text-[var(--ink-3)] uppercase">
                  {g.title}
                </div>
                {g.rows.map((r, ri) => {
                  const i = dau[gi] + ri
                  return (
                    <div
                      key={r.value}
                      id={`${id}-${i}`}
                      role="option"
                      aria-selected={i === hl}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHl(i)}
                      onClick={() => chon(i)}
                      className={`grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 border-b border-[var(--hair)] px-3 py-[7px] ${i === hl ? 'bg-[var(--act-wash)]' : ''}`}
                    >
                      <span
                        className={`font-semibold ${r.act ? 'text-[var(--act)]' : r.value === value ? 'text-[var(--act-text)]' : ''}`}
                      >
                        {r.label}
                      </span>
                      {r.right ? (
                        <span className="text-right font-mono text-[12px] text-[var(--ink-2)]">
                          {r.right}
                        </span>
                      ) : (
                        <span />
                      )}
                      {r.hint && (
                        <span className="col-span-2 text-[11.5px] text-[var(--ink-3)]">
                          {r.hint}
                        </span>
                      )}
                    </div>
                  )
                })}
                {g.con && (
                  <div className="border-b border-[var(--hair)] px-3 py-1.5 text-[11.5px] text-[var(--ink-3)]">
                    {g.con}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </span>
  )
}

/** Bỏ dấu + chữ thường — lọc tại chỗ ("van phong" khớp "Văn phòng"). */
export function khoaTim(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase() // prettier-ignore
}

/** Mọi từ gõ đều có trong chuỗi (AND), bỏ dấu. */
export function khop(q: string, ...fields: (string | null | undefined)[]): boolean {
  const hay = khoaTim(fields.filter(Boolean).join(' '))
  return khoaTim(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t))
}
