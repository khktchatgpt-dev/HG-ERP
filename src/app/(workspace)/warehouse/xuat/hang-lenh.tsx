'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn } from '@/lib/date-vn'
import type { HangLenhRow } from '@/lib/kho-hang-lenh'
import { lenhGon } from '../ton/ton-lenh.shared'
import { searchMatcher } from '@/lib/search-text'
import {
  Btn,
  Cell,
  Chip,
  Code,
  NoticeBar,
  Row,
  Sheet,
  THead,
  Table,
  Tick,
} from '@/components/kit'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Số kiểu VN: "1.390" = 1390 · "108,40" = 108,4. */
const docSo = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'))
const R = { textAlign: 'right' } as const
/** Tiêu đề cột số được xuống dòng — nowrap của kit ép bảng rộng hơn hộp. */
const RH = { textAlign: 'right', whiteSpace: 'normal' } as const

export type LayHang = {
  id: string
  code: string
  name: string
  unit: string
  qty_ok: number
  qty: number
}

/**
 * LẤY HÀNG CỦA LỆNH — Kho đợt 2 · Bước 4 (bản vẽ B4-1/B4-2/B4-3
 * https://claude.ai/artifact/4x4FTaGvwxx1xqF6ozFZLA, duyệt 12/10/2026).
 *
 * Đo 12/10: 15 lệnh, ~167 mã đã mua cho lệnh còn trong kho mà chưa ghi xuất —
 * từ 03/10 không còn phiếu xuất nào vì chọn lệnh xong phải TÌM TỪNG MÃ (09/26-27
 * MX có 49 mã). Khối này nạp `GET lsx/[id]/hang-lenh` khi chọn lệnh, nói "kho còn
 * N mã của lệnh", mở hộp tích chọn với số điền sẵn = min(còn của lệnh, tồn dùng
 * được) (Q1) rồi đưa cả loạt vào lưới phiếu — số vẫn sửa được trước khi Ghi sổ.
 *
 * Mã đã về mà kho hết: bày mờ, không tích được, có lý do (Q4). Lệnh quá hạn xuất
 * hàng mà còn hàng trên máy: nói ra để ghi bù (Q3).
 */
export function HangLenh({
  lsx,
  today,
  onLay,
}: {
  lsx: { id: string; code: string; ship_date: string | null }
  today: string
  /** Đưa các mã đã chọn vào lưới phiếu (màn tự gộp, giữ dòng đã có). */
  onLay: (chon: LayHang[]) => void
}) {
  const [rows, setRows] = useState<HangLenhRow[] | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [mo, setMo] = useState(false)

  // Đổi lệnh = màn dựng lại khối này bằng `key={lsx.id}` (state mới, rows null) —
  // không xoá state đồng bộ trong effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    let huy = false
    api<{ rows: HangLenhRow[] }>(`/api/dept/warehouse/lsx/${lsx.id}/hang-lenh`)
      .then((r) => !huy && setRows(r.rows))
      .catch((e) => !huy && setLoi(apiErrorText(e)))
    return () => {
      huy = true
    }
  }, [lsx.id])

  const conTon = rows?.filter((r) => !r.het).length ?? 0
  const het = rows?.filter((r) => r.het).length ?? 0
  const quaHan = !!lsx.ship_date && lsx.ship_date.slice(0, 10) < today

  if (loi)
    return (
      <NoticeBar tone="warn" tag="Hàng của lệnh">
        Không tải được hàng đã về cho lệnh {lsx.code}: {loi}. Vẫn thêm dòng được bằng ô
        tìm.
      </NoticeBar>
    )
  return (
    <>
      <div className="text-k-sm flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
        {rows == null ? (
          <span className="text-[var(--ink-3)]">
            Đang tìm hàng đã về cho lệnh {lsx.code}…
          </span>
        ) : rows.length === 0 ? (
          <span className="text-[var(--ink-3)]">
            Chưa có hàng nào đã mua cho lệnh <b className="num">{lsx.code}</b> về kho mà
            chưa xuất. Mã tổ lấy thì thêm bằng ô tìm bên dưới.
          </span>
        ) : (
          <>
            <span>
              Kho còn <b className="num">{conTon}</b> mã đã mua cho lệnh{' '}
              <b className="num">{lsx.code}</b>, chưa ghi xuất
              {het > 0 && (
                <span className="text-[var(--ink-3)]">
                  {' '}
                  · {het} mã đã về nhưng kho hết
                </span>
              )}
              .
            </span>
            <Btn icon="xuatKho" primary={conTon > 0} onClick={() => setMo(true)}>
              Lấy hàng của lệnh{conTon > 0 ? ` (${conTon})` : ''}
            </Btn>
            {quaHan && conTon > 0 && (
              <span className="font-semibold text-[var(--warn)]">
                Lệnh đã quá hạn xuất hàng {isoToVn(lsx.ship_date!.slice(0, 10))} — xưởng
                đã dùng thì ghi bù để tồn trên máy đúng kho thật.
              </span>
            )}
          </>
        )}
      </div>
      {mo && rows && (
        <HangLenhSheet
          lsxCode={lsx.code}
          rows={rows}
          onClose={() => setMo(false)}
          onLay={(c) => {
            onLay(c)
            setMo(false)
          }}
        />
      )}
    </>
  )
}

type Ro = 'con' | 'het' | 'tat_ca'

function HangLenhSheet({
  lsxCode,
  rows,
  onClose,
  onLay,
}: {
  lsxCode: string
  rows: HangLenhRow[]
  onClose: () => void
  onLay: (chon: LayHang[]) => void
}) {
  // Mặc định tích HẾT mã còn tồn, số = gợi ý (Q1).
  const [chon, setChon] = useState<Set<string>>(
    () => new Set(rows.filter((r) => !r.het).map((r) => r.material_id)),
  )
  const [so_, setSo] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.material_id, so(r.goi_y)])),
  )
  const [q, setQ] = useState('')
  const [ro, setRo] = useState<Ro>(rows.some((r) => !r.het) ? 'con' : 'tat_ca')
  const conTon = rows.filter((r) => !r.het).length
  const hien = useMemo(() => {
    const khop = searchMatcher(q)
    return rows.filter(
      (r) =>
        (ro === 'tat_ca' || (ro === 'con' ? !r.het : r.het)) && khop([r.code, r.name]),
    )
  }, [rows, ro, q])
  const lay = rows
    .filter((r) => chon.has(r.material_id))
    .map((r) => ({ r, qty: docSo(so_[r.material_id] ?? '') }))
  const sai = lay.filter((x) => !Number.isFinite(x.qty) || x.qty < 0)
  const latHet = (on: boolean) =>
    setChon(
      on ? new Set(rows.filter((r) => !r.het).map((r) => r.material_id)) : new Set(),
    )

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Hàng của lệnh ${lsxCode}`}
      subtitle={`${conTon} mã còn trong kho · ${rows.length - conTon} mã đã về nhưng kho hết`}
      stakes="nhe"
      width={920}
      footer={
        <span className="flex w-full items-center gap-3">
          <span className="text-k-sm text-[var(--ink-3)]">
            {sai.length > 0
              ? `Số chưa đúng ở ${sai.map((x) => x.r.code).join(', ')}`
              : 'Số điền sẵn = min(còn của lệnh, tồn dùng được) — sửa ở đây hoặc trong lưới phiếu.'}
          </span>
          <span className="ml-auto flex gap-2">
            <Btn onClick={onClose}>Huỷ</Btn>
            <Btn
              icon="xuatKho"
              primary
              disabled={lay.length === 0 || sai.length > 0}
              onClick={() =>
                onLay(
                  lay.map(({ r, qty }) => ({
                    id: r.material_id,
                    code: r.code,
                    name: r.name,
                    unit: r.unit,
                    qty_ok: r.ton,
                    qty,
                  })),
                )
              }
            >
              Đưa {lay.length} dòng vào phiếu
            </Btn>
          </span>
        </span>
      }
    >
      <div
        className="flex flex-col gap-2"
        style={{ '--col-grow': '160px' } as CSSProperties}
      >
        <span className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lọc mã, tên…"
            aria-label="Lọc hàng của lệnh"
            className="text-k-sm h-[var(--ctl-h)] w-56 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 placeholder:text-[var(--ink-3)] focus:border-[var(--act)]"
          />
          <Chip on={ro === 'con'} count={conTon} onClick={() => setRo('con')}>
            Còn tồn
          </Chip>
          <Chip
            on={ro === 'het'}
            count={rows.length - conTon}
            onClick={() => setRo('het')}
          >
            Kho hết
          </Chip>
          <Chip on={ro === 'tat_ca'} count={rows.length} onClick={() => setRo('tat_ca')}>
            Tất cả
          </Chip>
          <span className="text-k-sm ml-auto">
            Đã chọn <b className="num">{chon.size}</b> ·{' '}
            <button
              type="button"
              className="text-[var(--act-text)] underline underline-offset-2"
              onClick={() => latHet(chon.size === 0)}
            >
              {chon.size === 0 ? 'chọn hết mã còn tồn' : 'bỏ chọn hết'}
            </button>
          </span>
        </span>
        {ro !== 'con' && rows.some((r) => r.het) && (
          <p className="text-k-sm m-0 text-[var(--ink-3)]">
            Mã “kho hết”: đã về cho lệnh nhưng tồn hiện bằng 0 — đã dùng cho việc khác,
            hoặc kiểm kê đã đưa về 0 (đợt nạp nền 11/09). “Giữ cho …”: mã chung nhiều
            lệnh, tồn chia trước cho lệnh hạn xuất sớm hơn. Không gợi ý; tổ vẫn lấy thì
            thêm bằng ô tìm.
          </p>
        )}
        <Table minWidth={640}>
          <THead>
            <th style={{ width: 34 }} />
            <th style={{ width: 96 }}>Mã</th>
            <th>Tên vật tư</th>
            <th style={{ width: 46 }}>ĐVT</th>
            <th style={{ ...RH, width: 88 }}>Đã về cho lệnh</th>
            <th style={{ ...RH, width: 80 }}>Đã xuất</th>
            <th style={{ ...RH, width: 88 }}>Còn của lệnh</th>
            <th style={{ ...RH, width: 92 }}>Tồn dùng được</th>
            <th style={{ ...RH, width: 104 }}>Lấy lần này</th>
          </THead>
          <tbody>
            {hien.map((r) => {
              const on = chon.has(r.material_id)
              return (
                <Row key={r.material_id}>
                  <Cell>
                    {r.het ? (
                      <span
                        className="text-[var(--ink-empty)]"
                        title="Kho hết — không lấy được"
                      >
                        —
                      </span>
                    ) : (
                      <Tick
                        checked={on}
                        onChange={(v) =>
                          setChon((s) => {
                            const n = new Set(s)
                            if (v) n.add(r.material_id)
                            else n.delete(r.material_id)
                            return n
                          })
                        }
                        label={`Lấy ${r.code}`}
                      />
                    )}
                  </Cell>
                  <Cell>
                    <Code>{r.code}</Code>
                  </Cell>
                  <Cell grow title={r.name} muted={r.het}>
                    {r.name}
                  </Cell>
                  <Cell muted>{r.unit}</Cell>
                  <Cell num>{so(r.ve)}</Cell>
                  <Cell num muted>
                    {so(r.xuat)}
                  </Cell>
                  <Cell num>
                    <b>{so(r.con)}</b>
                  </Cell>
                  <Cell
                    num
                    title={
                      r.giu_cho
                        ? `Kho còn ${so(r.ton)}, chia trước cho ${r.giu_cho.join(', ')}`
                        : !r.het && r.goi_y < r.con
                          ? `Kho chỉ còn ${so(r.goi_y)} cho lệnh này`
                          : undefined
                    }
                  >
                    <span
                      className={
                        !r.het && r.goi_y < r.con
                          ? 'font-semibold text-[var(--warn)]'
                          : r.het
                            ? 'text-[var(--ink-3)]'
                            : undefined
                      }
                    >
                      {so(r.ton)}
                    </span>
                  </Cell>
                  <Cell num>
                    {r.het ? (
                      <span className="block truncate text-[var(--ink-3)]">
                        {r.giu_cho && r.ton > 0
                          ? `giữ cho ${r.giu_cho.map(lenhGon).join(', ')}`
                          : 'kho hết'}
                      </span>
                    ) : (
                      <input
                        value={so_[r.material_id] ?? ''}
                        onChange={(e) =>
                          setSo((m) => ({ ...m, [r.material_id]: e.target.value }))
                        }
                        disabled={!on}
                        inputMode="decimal"
                        aria-label={`Lấy lần này ${r.code}`}
                        className="num h-6 w-[88px] rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 text-right focus:border-[var(--act)] disabled:bg-[var(--surface-raised)] disabled:text-[var(--ink-3)]"
                      />
                    )}
                  </Cell>
                </Row>
              )
            })}
          </tbody>
        </Table>
      </div>
    </Sheet>
  )
}
