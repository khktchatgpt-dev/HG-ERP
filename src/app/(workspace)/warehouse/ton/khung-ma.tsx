'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, todayVn } from '@/lib/date-vn'
import type { BienDongGanDay, StockByBin } from '@/modules/dept/warehouse/stock.repo'
import { lenhGon, type CuaLenh } from './ton-lenh.shared'
import type { TonRow } from './TonKhoScreen'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

type ChiTiet = { ke: StockByBin[]; bienDong: BienDongGanDay[] }

/**
 * Gộp các dòng CÙNG PHIẾU + cùng chiều (một phiếu nhập nhiều dòng cùng mã —
 * PNK-2026-0125 có 6 dòng BAO0483) thành một dòng, giữ thứ tự mới trước; lấy 6.
 */
export function gopPhieu(ds: BienDongGanDay[]): BienDongGanDay[] {
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
 * KHUNG MÃ ĐANG CHỌN — bên phải lưới Tồn kho (B3 "Kho cho người mới", bản vẽ B1
 * https://claude.ai/artifact/QpEkCkMHdMhFhF3WYhEF7z). Thay ô chi tiết mở dưới
 * dòng (K2) và năm cột tồn phụ: mọi thứ về MỘT mã nằm một chỗ, kèm ba việc làm
 * tiếp. Màn cha dựng lại khối này bằng `key={material_id}` khi đổi mã.
 */
export function KhungMa({ row, cuaLenh }: { row: TonRow | null; cuaLenh: CuaLenh }) {
  const [d, setD] = useState<ChiTiet | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const id = row?.material_id ?? null
  useEffect(() => {
    if (!id) return
    let huy = false
    api<ChiTiet>(`/api/dept/warehouse/stock/${id}`)
      .then((x) => !huy && setD(x))
      .catch((e) => !huy && setLoi(apiErrorText(e, 'Không tải được chi tiết mã')))
    return () => {
      huy = true
    }
  }, [id])

  if (!row)
    return (
      <aside className="tm-khung rong" aria-label="Mã đang chọn">
        <b>Chọn một mã trong bảng</b>
        <span>
          Khung này bày tồn theo kệ, lệnh đang giữ, biến động gần nhất — và nút Xuất, Cập
          nhật số thực tế cho mã đó.
        </span>
      </aside>
    )

  const giu = cuaLenh.reduce((s, c) => s + c.qty, 0)
  const chung = Math.max(0, row.qty_ok - giu)
  const ma = encodeURIComponent(row.code)
  const lenhDau = cuaLenh[0]
  const bd = d ? gopPhieu(d.bienDong) : []

  return (
    <aside className="tm-khung" aria-label={`Mã đang chọn ${row.code}`}>
      <div className="dau">
        <span className="kh-ma">{row.code}</span>
        <h2>{row.name}</h2>
      </div>

      <dl className="tm-kv">
        <dt>Dùng được</dt>
        <dd className={`kh-num kh-b ${row.is_low ? 'kh-stop' : ''}`}>
          {fmt(row.qty_ok)} {row.unit}
          {row.is_low && row.min_stock > 0 && (
            <span className="kh-pill kh-stop">dưới {fmt(row.min_stock)}</span>
          )}
        </dd>
        {row.qty_qc > 0 && (
          <>
            <dt>Chờ kiểm</dt>
            <dd className="kh-num kh-warn">{fmt(row.qty_qc)}</dd>
          </>
        )}
        {row.qty_blocked > 0 && (
          <>
            <dt>Khoá</dt>
            <dd className="kh-num kh-stop">{fmt(row.qty_blocked)}</dd>
          </>
        )}
        <dt title="Phần lệnh đã cam kết (đã duyệt / đang SX) còn cần">Giữ cho lệnh</dt>
        <dd className="kh-num">{fmt(row.reserved)}</dd>
        <dt title="Dùng được − Giữ cho lệnh">Còn dùng</dt>
        <dd className={`kh-num ${row.available < 0 ? 'kh-stop' : ''}`}>
          {fmt(row.available)}
        </dd>
        <dt>Kệ</dt>
        <dd className={row.shelf_location ? undefined : 'kh-mut'}>
          {row.shelf_location ?? 'chưa kệ'}
        </dd>
      </dl>

      <div className="tm-nut">
        {lenhDau ? (
          <Link
            href={`/warehouse/xuat?lsx=${lenhDau.lsx_id}&ma=${ma}`}
            className="kh-btn"
          >
            Xuất cho lệnh {lenhGon(lenhDau.code)}
          </Link>
        ) : (
          <Link href={`/warehouse/xuat?ma=${ma}`} className="kh-btn">
            Xuất mã này
          </Link>
        )}
        <Link href={`/warehouse/cap-nhat-ton?ma=${ma}`} className="kh-btn">
          Cập nhật số thực tế
        </Link>
        <Link href={`/warehouse/vat-tu?ro=all&q=${ma}`} className="kh-btn">
          Thông tin vật tư
        </Link>
      </div>

      <section>
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
      </section>

      <section>
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
      </section>

      <section>
        <h4>Biến động gần nhất</h4>
        {loi ? null : !d ? (
          <span className="kh-mut">Đang tải…</span>
        ) : bd.length === 0 ? (
          <span className="kh-mut">Chưa có phiếu nào ghi mã này.</span>
        ) : (
          bd.map((m) => (
            <div key={m.id} className="ln">
              <span className="kh-num kh-mut">
                {isoToVn(todayVn(new Date(m.created_at)))}
              </span>
              <span>
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
      </section>
    </aside>
  )
}
