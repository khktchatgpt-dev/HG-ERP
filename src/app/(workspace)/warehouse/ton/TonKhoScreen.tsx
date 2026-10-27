'use client'

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpFromLine, BookOpen, NotebookPen, Package } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { useBeRong } from '@/lib/use-be-rong'
import type { BienDongGanDay, StockByBin } from '@/modules/dept/warehouse/stock.repo'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  ODem,
  PhanTrang,
  Rong,
  So,
  TabNgang,
  ThanhLoc,
  ThanhTT,
} from '../_erp/khung'
import { RO_NHAN, RO_TON, type RoTon } from './ro-ton'
import { lenhGon, type CuaLenh } from './ton-lenh.shared'

export type TonRow = {
  material_id: string
  code: string
  name: string
  unit: string
  qty_ok: number
  qty_qc: number
  qty_blocked: number
  reserved: number
  available: number
  shelf_location: string | null
  is_low: boolean
  min_stock: number
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

/** Dòng phụ của từng rổ + màu vạch — rổ chỉ nói MỘT lần (không lặp ở đầu trang). */
const RO_KHAI: Record<RoTon, { s: string; mau: string }> = {
  has: { s: 'mã còn hàng', mau: 'c-ok' },
  chung: { s: 'không lệnh nào giữ', mau: 'c-mut' },
  low: { s: 'dưới ngưỡng tối thiểu', mau: 'c-stop' },
  out: { s: 'mã đã về rồi hết', mau: 'c-mut' },
  qc: { s: 'chờ kiểm hàng', mau: 'c-warn' },
  blocked: { s: 'hỏng · sai quy cách', mau: 'c-stop' },
  short: { s: 'tồn ít hơn phần của lệnh', mau: 'c-stop' },
  all: { s: 'kể cả mã hết hàng', mau: 'c-mut' },
}

/**
 * TỒN KHO · THEO MÃ — Kho lối ERP · B1 (bản vẽ K-1
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR, duyệt 14/10/2026). Viết
 * tay, không kit — khung chung ở `../_erp/khung.tsx`.
 *
 * Câu màn trả lời: "mã nào cần tôi động vào?" — tám RỔ là điều khiển chính
 * (ô đếm vuông, số nói một lần). Ba cột tồn gom dưới "Tồn theo tình trạng";
 * số tính đủ–thiếu luôn là DÙNG ĐƯỢC, không phải tổng tồn.
 *
 * K1: không còn nút trên từng dòng — chọn dòng rồi bấm ở Action Pane. K2: bấm
 * ▸ (hoặc Enter trên dòng) mở chi tiết NGAY DƯỚI DÒNG: tồn theo kệ · lệnh
 * đang giữ · biến động gần nhất (`GET /api/dept/warehouse/stock/[id]`).
 *
 * Mọi bộ lọc trên URL, server lọc + cắt trang (13.481 mã).
 */
export function TonKhoScreen({
  rows,
  cuaLenh,
  counts,
  total,
  trang,
  soTrang,
  ro,
  q: qUrl,
  nhom,
  nhomOptions,
}: {
  rows: TonRow[]
  /** Lệnh được chia tồn của từng mã trên trang (cột "Của lệnh"). */
  cuaLenh: Record<string, CuaLenh>
  counts: Record<RoTon, number>
  total: number
  trang: number
  soTrang: number
  ro: RoTon
  q: string
  nhom: string
  nhomOptions: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(qUrl)
  const [chon, setChon] = useState<string | null>(null)
  const [mo, setMo] = useState<string | null>(null)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  /* Bộ cột theo bề rộng KHUNG: < 900 gộp ĐVT · kệ xuống dòng hai, bỏ ba cột
     phụ; ≥ 1200 thêm cột "Của lệnh". */
  const hep = beRong > 0 && beRong < 900
  const coCotLenh = beRong >= 1200

  /** Đổi tham số → về trang 1 (giữ trang cũ là lọc xong rơi vào trang trống). */
  const dat = (p: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) s.set(k, v)
      else s.delete(k)
    }
    if (!('trang' in p)) s.delete('trang')
    setChon(null)
    setMo(null)
    const qs = s.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const dangLoc = ro !== 'has' || qUrl.trim() !== '' || nhom !== ''
  const sel = rows.find((r) => r.material_id === chon) ?? null
  const cong = rows.reduce(
    (a, r) => ({
      ok: a.ok + r.qty_ok,
      qc: a.qc + r.qty_qc,
      blocked: a.blocked + r.qty_blocked,
      res: a.res + r.reserved,
      avail: a.avail + r.available,
    }),
    { ok: 0, qc: 0, blocked: 0, res: 0, avail: 0 },
  )
  const ghiLenh = (id: string) =>
    (cuaLenh[id] ?? []).map((c) => `${lenhGon(c.code)} ${fmt(c.qty)}`).join(' · ')
  const doiMo = (id: string) => {
    setChon(id)
    setMo((m) => (m === id ? null : id))
  }
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      doiMo(id)
    }
  }
  const soCot = hep ? 4 : coCotLenh ? 11 : 10
  const canChon = 'Chọn một dòng trong bảng trước'

  return (
    <KhoKhung label="Tồn kho">
      <DauTrang
        title="Tồn kho"
        ctx={
          <>
            <b>{fmt(counts.all)}</b> mã trong danh mục
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<ArrowUpFromLine size={15} aria-hidden />}
                href={sel ? `/warehouse/xuat?ma=${encodeURIComponent(sel.code)}` : undefined} // prettier-ignore
                why={sel ? null : canChon}
              >
                {sel ? `Xuất ${sel.code}` : 'Xuất mã này'}
              </ApNut>
              <ApNut
                icon={<Package size={15} aria-hidden />}
                href={sel ? `/warehouse/vat-tu?ro=all&q=${encodeURIComponent(sel.code)}` : undefined} // prettier-ignore
                why={sel ? null : canChon}
              >
                Thông tin vật tư
              </ApNut>
              {/* B1 "Kho cho người mới": số trên máy lệch kệ → gõ số đếm được. */}
              <ApNut
                icon={<NotebookPen size={15} aria-hidden />}
                href={sel ? `/warehouse/cap-nhat-ton?ma=${encodeURIComponent(sel.code)}` : undefined} // prettier-ignore
                why={sel ? null : canChon}
              >
                Cập nhật số thực tế
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut href="/warehouse/xuat">Lập phiếu xuất</ApNut>
              <ApNut icon={<BookOpen size={15} aria-hidden />} href="/warehouse/phieu">
                Sổ phiếu
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <TabNgang
        label="Xem tồn kho"
        tabs={[
          { key: 'ma', label: 'Theo mã', on: true, href: '/warehouse/ton', mau: 'c-ok' },
          {
            key: 'lenh',
            label: 'Theo lệnh',
            on: false,
            href: '/warehouse/ton?xem=lenh',
            mau: 'c-xuat',
          },
        ]}
      />

      <ThanhLoc>
        <form
          role="search"
          style={{ display: 'contents' }}
          onSubmit={(e) => {
            e.preventDefault()
            dat({ q: q.trim() || null })
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã, tên vật tư… (Enter)"
            aria-label="Tìm mã hoặc tên vật tư"
          />
        </form>
        <select
          value={nhom}
          className={nhom ? 'on' : undefined}
          onChange={(e) => dat({ nhom: e.target.value || null })}
          aria-label="Nhóm vật tư"
        >
          <option value="">Mọi nhóm vật tư</option>
          {nhomOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {dangLoc && (
          <button
            type="button"
            className="clr"
            onClick={() => {
              setQ('')
              dat({ ro: null, q: null, nhom: null })
            }}
          >
            Bỏ lọc
          </button>
        )}
      </ThanhLoc>

      <ODem
        label="Rổ tồn kho"
        items={RO_TON.map((id) => ({
          key: id,
          t: RO_NHAN[id],
          n: counts[id],
          s: RO_KHAI[id].s,
          mau: RO_KHAI[id].mau,
          on: ro === id,
          onClick: () => dat({ ro: id === 'has' ? null : id }),
        }))}
      />

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {rows.length === 0 ? (
        <Rong
          tieuDe={dangLoc ? `Rổ "${RO_NHAN[ro]}" không có mã nào` : 'Kho chưa có mã nào còn tồn'} // prettier-ignore
          lyDo={
            dangLoc
              ? `Không mã nào khớp bộ lọc đang bật. Bỏ lọc để xem lại, hoặc chọn rổ "Cả danh mục" (${fmt(counts.all)} mã).`
              : 'Tồn chỉ tăng khi ghi phiếu nhập. Hàng nhà cung cấp đã giao mà chưa ghi sổ thì chưa tính là tồn.'
          }
          tiep={
            dangLoc ? (
              <button
                type="button"
                className="kh-btn"
                onClick={() => {
                  setQ('')
                  dat({ ro: null, q: null, nhom: null })
                }}
              >
                Bỏ lọc
              </button>
            ) : (
              <Link href="/warehouse/nhap" className="kh-btn p">
                Sang Hàng về để nhận hàng
              </Link>
            )
          }
        />
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Tồn kho theo mã">
            <colgroup>
              <col style={{ width: 28 }} />
              {!hep && <col style={{ width: 96 }} />}
              <col />
              {!hep && <col style={{ width: 58 }} />}
              <col style={{ width: 94 }} />
              {!hep && <col style={{ width: 82 }} />}
              {!hep && <col style={{ width: 62 }} />}
              {!hep && <col style={{ width: 108 }} />}
              <col style={{ width: hep ? 88 : 90 }} />
              {coCotLenh && <col style={{ width: 170 }} />}
              {!hep && <col style={{ width: 70 }} />}
            </colgroup>
            <thead>
              {hep ? (
                <tr>
                  <th className="c0" aria-label="Mở chi tiết" />
                  <th>Vật tư</th>
                  <th className="r">Dùng được</th>
                  <th className="r">Còn dùng</th>
                </tr>
              ) : (
                <>
                  <tr>
                    <th rowSpan={2} className="c0" aria-label="Mở chi tiết" />
                    <th rowSpan={2}>Mã</th>
                    <th rowSpan={2}>Tên vật tư</th>
                    <th rowSpan={2}>ĐVT</th>
                    <th className="g2" colSpan={3}>
                      Tồn theo tình trạng
                    </th>
                    <th rowSpan={2} className="r">
                      Giữ cho lệnh
                    </th>
                    <th rowSpan={2} className="r">
                      Còn dùng
                    </th>
                    {coCotLenh && <th rowSpan={2}>Của lệnh</th>}
                    <th rowSpan={2}>Kệ</th>
                  </tr>
                  <tr className="h2">
                    <th className="r">Dùng được</th>
                    <th className="r">Chờ kiểm</th>
                    <th className="r">Khoá</th>
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = r.material_id === chon
                const dangMo = r.material_id === mo
                return (
                  <Fragment key={r.material_id}>
                    <tr
                      className={on ? 'd on' : 'd'}
                      tabIndex={0}
                      aria-selected={on}
                      aria-expanded={dangMo}
                      onClick={() => setChon(r.material_id)}
                      onDoubleClick={() => doiMo(r.material_id)}
                      onKeyDown={(e) => phim(e, r.material_id)}
                    >
                      <td className="c0">
                        <button
                          type="button"
                          className="mo"
                          aria-label={`${dangMo ? 'Đóng' : 'Mở'} chi tiết ${r.code}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            doiMo(r.material_id)
                          }}
                        >
                          {dangMo ? '▾' : '▸'}
                        </button>
                      </td>
                      {!hep && (
                        <td
                          className="kh-ma"
                          title={!coCotLenh && cuaLenh[r.material_id] ? `Của lệnh: ${ghiLenh(r.material_id)}` : undefined} // prettier-ignore
                        >
                          {r.code}
                        </td>
                      )}
                      <td title={r.name}>
                        {hep && (
                          <span className="kh-ma" style={{ display: 'block' }}>
                            {r.code}
                          </span>
                        )}
                        {r.name}
                        {hep && (
                          <span
                            className="kh-mut"
                            style={{ display: 'block', fontSize: 11.5 }}
                          >
                            {r.unit} · {r.shelf_location ?? 'chưa kệ'}
                            {r.qty_qc > 0 && ` · chờ kiểm ${fmt(r.qty_qc)}`}
                            {r.qty_blocked > 0 && ` · khoá ${fmt(r.qty_blocked)}`}
                          </span>
                        )}
                      </td>
                      {!hep && <td className="kh-mut">{r.unit}</td>}
                      <td className="r kh-num">
                        <So n={r.qty_ok} tone={r.is_low ? 'stop' : undefined} />
                      </td>
                      {!hep && (
                        <td className="r kh-num">
                          <So n={r.qty_qc} tone="warn" />
                        </td>
                      )}
                      {!hep && (
                        <td className="r kh-num">
                          <So n={r.qty_blocked} tone="stop" />
                        </td>
                      )}
                      {!hep && (
                        <td className="r kh-num kh-mut">
                          <So n={r.reserved} />
                        </td>
                      )}
                      {/* Còn dùng ÂM = đã hứa nhiều hơn số có — chỗ đáng đỏ. */}
                      <td className="r kh-num">
                        <So
                          n={r.available}
                          tone={r.available < 0 || r.is_low ? 'stop' : 'b'}
                        />
                        {r.is_low && r.min_stock > 0 && (
                          <span className="kh-pill kh-stop">dưới {fmt(r.min_stock)}</span>
                        )}
                      </td>
                      {coCotLenh && (
                        <td
                          title={ghiLenh(r.material_id) || undefined}
                          style={{ fontSize: 12 }}
                        >
                          {cuaLenh[r.material_id] ? (
                            cuaLenh[r.material_id].map((c, i) => (
                              <span key={c.lsx_id}>
                                {i > 0 && ' · '}
                                {lenhGon(c.code)} <b className="kh-num">{fmt(c.qty)}</b>
                              </span>
                            ))
                          ) : r.qty_ok > 0 ? (
                            <i className="kh-mut">tồn chung</i>
                          ) : (
                            <span className="kh-empty">—</span>
                          )}
                        </td>
                      )}
                      {!hep && (
                        <td className={r.shelf_location ? undefined : 'kh-empty'}>
                          {r.shelf_location ?? 'chưa kệ'}
                        </td>
                      )}
                    </tr>
                    {dangMo && (
                      <tr className="exp">
                        <td colSpan={soCot}>
                          <ChiTietMa row={r} cuaLenh={cuaLenh[r.material_id] ?? []} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hep ? 2 : 4}>
                  Cộng {rows.length} mã trang này · nhiều ĐVT, chỉ để đối chiếu
                </td>
                <td className="r kh-num">{fmt(cong.ok)}</td>
                {!hep && <td className="r kh-num">{fmt(cong.qc)}</td>}
                {!hep && <td className="r kh-num">{fmt(cong.blocked)}</td>}
                {!hep && <td className="r kh-num">{fmt(cong.res)}</td>}
                <td className="r kh-num">{fmt(cong.avail)}</td>
                {coCotLenh && <td />}
                {!hep && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left={
          hep
            ? 'Bấm ▸ xem kệ, lệnh giữ, biến động'
            : '"·" = 0 · Còn dùng = Dùng được − Giữ cho lệnh · tồn chỉ đổi qua phiếu · Enter / bấm đúp mở chi tiết'
        }
        right={
          <>
            <PhanTrang
              trang={trang}
              soTrang={soTrang}
              onDoi={(t) => dat({ trang: t > 1 ? String(t) : null })}
            />
            <b>
              {rows.length} / {fmt(total)}
            </b>{' '}
            mã
          </>
        }
      />
    </KhoKhung>
  )
}

type ChiTiet = { ke: StockByBin[]; bienDong: BienDongGanDay[] }

/**
 * Gộp các dòng CÙNG PHIẾU + cùng chiều (một phiếu nhập nhiều dòng cùng mã —
 * PNK-2026-0125 có 6 dòng BAO0483) thành một dòng, giữ thứ tự mới trước; lấy 6.
 */
function gopPhieu(ds: BienDongGanDay[]): BienDongGanDay[] {
  const out: BienDongGanDay[] = []
  const idx = new Map<string, number>()
  for (const m of ds) {
    const k = m.doc_id ? `${m.doc_id}|${m.direction}` : null
    const i = k ? idx.get(k) : undefined
    if (i !== undefined) out[i] = { ...out[i], qty: out[i].qty + m.qty }
    else {
      if (k) idx.set(k, out.length)
      out.push({ ...m })
    }
  }
  return out.slice(0, 6)
}

const TT_NHAN: Record<string, string> = {
  ok: 'dùng được',
  qc: 'chờ kiểm',
  blocked: 'khoá',
}

/**
 * Ô CHI TIẾT MỞ DƯỚI DÒNG (K2): tồn theo kệ × tình trạng, lệnh đang giữ (cùng
 * nguồn chia tồn với cột "Của lệnh" / màn Theo lệnh), 6 biến động gần nhất.
 */
function ChiTietMa({ row, cuaLenh }: { row: TonRow; cuaLenh: CuaLenh }) {
  const [d, setD] = useState<ChiTiet | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  useEffect(() => {
    let huy = false
    api<ChiTiet>(`/api/dept/warehouse/stock/${row.material_id}`)
      .then((x) => !huy && setD(x))
      .catch((e) => !huy && setLoi(apiErrorText(e, 'Không tải được chi tiết mã')))
    return () => {
      huy = true
    }
  }, [row.material_id])
  const giu = cuaLenh.reduce((s, c) => s + c.qty, 0)
  const chung = Math.max(0, row.qty_ok - giu)
  return (
    <div className="kh-exp">
      <div>
        <h4>Tồn theo kệ</h4>
        {loi ? (
          <span className="kh-stop">{loi}</span>
        ) : !d ? (
          <span className="kh-mut">Đang tải…</span>
        ) : d.ke.length === 0 ? (
          <span className="kh-mut">Không còn hàng ở kệ nào.</span>
        ) : (
          d.ke.map((k, i) => (
            <div key={i} className="ln">
              <span className={k.bin_code ? undefined : 'kh-mut'}>
                {k.bin_code ?? (k.qty < 0 ? 'xuất chưa ghi kệ' : 'chưa xếp kệ')}
              </span>
              {k.stock_status !== 'ok' && (
                <span className={k.stock_status === 'qc' ? 'kh-warn' : 'kh-stop'}>
                  {TT_NHAN[k.stock_status] ?? k.stock_status}
                </span>
              )}
              <span>{fmt(k.qty)}</span>
            </div>
          ))
        )}
      </div>
      <div>
        <h4 title="Hàng đã mua cho lệnh, chia theo hạn xuất (cùng nguồn màn Theo lệnh)">
          Của lệnh
        </h4>
        {cuaLenh.length === 0 && row.qty_ok <= 0 ? (
          <span className="kh-mut">Không phải hàng của lệnh nào.</span>
        ) : (
          <>
            {cuaLenh.map((c) => (
              <div key={c.lsx_id} className="ln">
                <span className="kh-ma">{c.code}</span>
                <span>{fmt(c.qty)}</span>
              </div>
            ))}
            {chung > 0 && (
              <div className="ln">
                <span className="kh-mut">Tồn chung</span>
                <span>{fmt(chung)}</span>
              </div>
            )}
          </>
        )}
      </div>
      <div>
        <h4>Biến động gần nhất</h4>
        {loi ? null : !d ? (
          <span className="kh-mut">Đang tải…</span>
        ) : gopPhieu(d.bienDong).length === 0 ? (
          <span className="kh-mut">Chưa có phiếu nào ghi mã này.</span>
        ) : (
          gopPhieu(d.bienDong).map((m) => (
            <div key={m.id} className="ln">
              <span className="kh-num kh-mut">
                {isoToVn(todayVn(new Date(m.created_at)))}
              </span>
              <span>
                <span
                  className={`kh-sq ${m.direction === 'in' ? 'c-nhap' : 'c-xuat'}`}
                  aria-hidden
                />
                {m.doc_id && m.doc_code ? (
                  <Link href={`/warehouse/phieu/${m.doc_id}`} className="kh-lnk">
                    {m.doc_code}
                  </Link>
                ) : (
                  <span className="kh-mut">{m.reason_code ?? 'phiếu cũ'}</span>
                )}
                {m.lenh_code && <span className="kh-mut"> · {lenhGon(m.lenh_code)}</span>}
              </span>
              <span className={m.direction === 'in' ? 'kh-ok' : 'kh-stop'}>
                {m.direction === 'in' ? '+' : '−'}
                {fmt(m.qty)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
