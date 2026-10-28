'use client'

import './ton-ma.css'
import { useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpFromLine, NotebookPen } from 'lucide-react'
import { useBeRong } from '@/lib/use-be-rong'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  MenuNut,
  PhanTrang,
  Rong,
  So,
  TabNgang,
  ThanhLoc,
  ThanhTT,
} from '../_erp/khung'
import { RO_NHAN, RO_TON, type RoTon } from './ro-ton'
import { lenhGon, type CuaLenh } from './ton-lenh.shared'
import { KhungMa } from './khung-ma'

export type TonRow = {
  material_id: string
  code: string
  name: string
  unit: string
  qty_ok: number
  /** Tổng trên sổ (mọi trạng thái) — số Cập nhật số thực tế so với. */
  on_hand: number
  qty_qc: number
  qty_blocked: number
  reserved: number
  available: number
  shelf_location: string | null
  is_low: boolean
  min_stock: number
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

/**
 * TỒN KHO · THEO MÃ — B3 "Kho cho người mới" (bản vẽ B1
 * https://claude.ai/artifact/QpEkCkMHdMhFhF3WYhEF7z, duyệt 27/10/2026). Viết
 * tay, không kit — khung chung ở `../_erp/khung.tsx`.
 *
 * Câu màn trả lời: "mã này còn bao nhiêu, ở kệ nào, của lệnh nào?". Đo trước khi
 * làm lại: 67 nút ở màn đầu (8 ô rổ, 21 nhóm, ▸ từng dòng), 11 cột. Nay: ô tìm
 * lớn, MỘT ô "Lọc" (tám rổ, kèm số) + ô nhóm, lưới 6 cột; chọn dòng thì khung
 * bên phải (`khung-ma.tsx`) bày mọi thứ về mã đó + Xuất / Cập nhật số thực tế.
 * "Dùng được" vẫn là số tính đủ–thiếu, không phải tổng tồn.
 *
 * Mọi bộ lọc trên URL, server lọc + cắt trang (13.540 mã).
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
  laTruong,
  canEdit,
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
  /** Trưởng kho — cập nhật số thực tế trong khung mã đổi tồn ngay. */
  laTruong: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(qUrl)
  const [chon, setChonId] = useState<string | null>(null)
  /** Khối Cập nhật số thực tế trong khung mã — đổi mã là đóng. */
  const [moCapNhat, setMoCapNhat] = useState(false)
  const setChon = (id: string | null) => {
    if (id !== chon) setMoCapNhat(false)
    setChonId(id)
  }
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  /* Khung hẹp (< 900, laptop phóng to + menu mở): bỏ Kệ, Của lệnh — khung phải
     vẫn bày đủ hai thứ đó cho mã đang chọn. */
  const hep = beRong > 0 && beRong < 900
  /* 900–1200 (laptop 1000px, hay 1280 kèm menu mở): thu Kệ, Của lệnh để tên vật
     tư không bị bóp dưới 200px — tên ở đây dài ("BB Bàn Chữ nhật - KTLL…"). */
  const vua = beRong > 0 && beRong < 1200

  /** Đổi tham số → về trang 1 (giữ trang cũ là lọc xong rơi vào trang trống). */
  const dat = (p: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) s.set(k, v)
      else s.delete(k)
    }
    if (!('trang' in p)) s.delete('trang')
    setChon(null)
    const qs = s.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const dangLoc = ro !== 'has' || qUrl.trim() !== '' || nhom !== ''
  // Một kết quả tìm duy nhất thì chọn sẵn — tra một mã là việc hay gặp nhất.
  const sel =
    rows.find((r) => r.material_id === chon) ?? (rows.length === 1 ? rows[0] : null)
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setChon(id)
    }
  }
  const canChon = 'Chọn một dòng trong bảng trước'
  const ma = sel ? encodeURIComponent(sel.code) : ''
  const boLoc = () => {
    setQ('')
    dat({ ro: null, q: null, nhom: null })
  }

  return (
    <KhoKhung label="Tồn kho">
      <DauTrang
        title="Tồn kho"
        ctx={
          <>
            <b>{fmt(counts.has)}</b> mã đang có hàng · {fmt(counts.all)} mã trong danh mục
          </>
        }
        actions={
          <ApNhom>
            <ApNut
              primary
              icon={<NotebookPen size={15} aria-hidden />}
              // Mở khối cập nhật NGAY trong khung mã (28/10/2026), không sang màn khác.
              onClick={sel ? () => setMoCapNhat(true) : undefined}
              why={sel ? null : canChon}
            >
              Cập nhật số thực tế
            </ApNut>
            <ApNut
              icon={<ArrowUpFromLine size={15} aria-hidden />}
              href={sel ? `/warehouse/xuat?ma=${ma}` : undefined}
              why={sel ? null : canChon}
            >
              {sel ? `Xuất ${sel.code}` : 'Xuất mã này'}
            </ApNut>
            <MenuNut
              label="Khác"
              items={[
                {
                  label: 'Thông tin vật tư',
                  href: sel ? `/warehouse/vat-tu?ro=all&q=${ma}` : undefined,
                  why: sel ? null : canChon,
                },
                // Nhiều mã một lượt vẫn ở màn riêng; một mã thì ngay khung bên phải.
                { label: 'Cập nhật nhiều mã', href: '/warehouse/cap-nhat-ton' },
                { label: 'Lập phiếu xuất', href: '/warehouse/xuat' },
                { label: 'Phiếu đã ghi', href: '/warehouse/phieu' },
              ]}
            />
          </ApNhom>
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
            className="tm-tim"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Gõ mã hoặc tên vật tư rồi Enter"
            aria-label="Tìm mã hoặc tên vật tư"
          />
        </form>
        <label className="tm-loc">
          <span>Lọc</span>
          <select
            value={ro}
            className={ro !== 'has' ? 'on' : undefined}
            onChange={(e) =>
              dat({ ro: e.target.value === 'has' ? null : e.target.value })
            }
            aria-label="Lọc tồn kho"
          >
            {RO_TON.map((id) => (
              <option key={id} value={id}>
                {RO_NHAN[id]} ({fmt(counts[id])})
              </option>
            ))}
          </select>
        </label>
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
          <button type="button" className="clr" onClick={boLoc}>
            Bỏ lọc
          </button>
        )}
      </ThanhLoc>

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      <div className={hep ? 'tm-than hep' : 'tm-than'}>
        {rows.length === 0 ? (
          <Rong
            tieuDe={dangLoc ? `"${RO_NHAN[ro]}" không có mã nào khớp` : 'Kho chưa có mã nào còn tồn'} // prettier-ignore
            lyDo={
              dangLoc
                ? `Không mã nào khớp bộ lọc đang bật. Bỏ lọc để xem lại, hoặc chọn "Cả danh mục" (${fmt(counts.all)} mã).`
                : 'Tồn chỉ tăng khi ghi phiếu nhập. Hàng nhà cung cấp đã giao mà chưa ghi sổ thì chưa tính là tồn.'
            }
            tiep={
              dangLoc ? (
                <button type="button" className="kh-btn" onClick={boLoc}>
                  Bỏ lọc
                </button>
              ) : (
                <Link href="/warehouse/nhap" className="kh-btn p">
                  Sang Nhận hàng
                </Link>
              )
            }
          />
        ) : (
          <div className="kh-grid">
            <table className="kh-tb" aria-label="Tồn kho theo mã">
              <colgroup>
                <col style={{ width: vua ? 96 : 104 }} />
                <col />
                <col style={{ width: 58 }} />
                {!hep && <col style={{ width: vua ? 72 : 84 }} />}
                <col style={{ width: 100 }} />
                {!hep && <col style={{ width: vua ? 140 : 190 }} />}
              </colgroup>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên vật tư</th>
                  <th>ĐVT</th>
                  {!hep && <th>Kệ</th>}
                  <th className="r" title="Hàng đạt — không gồm chờ kiểm, khoá">
                    Dùng được
                  </th>
                  {!hep && <th>Của lệnh</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = r.material_id === sel?.material_id
                  const cl = cuaLenh[r.material_id]
                  return (
                    <tr
                      key={r.material_id}
                      className={on ? 'd on' : 'd'}
                      tabIndex={0}
                      aria-selected={on}
                      onClick={() => setChon(r.material_id)}
                      onKeyDown={(e) => phim(e, r.material_id)}
                    >
                      <td className="kh-ma">{r.code}</td>
                      <td title={r.name}>{r.name}</td>
                      <td className="kh-mut">{r.unit}</td>
                      {!hep && (
                        <td className={r.shelf_location ? undefined : 'kh-empty'}>
                          {r.shelf_location ?? 'chưa kệ'}
                        </td>
                      )}
                      <td className="r kh-num">
                        <So n={r.qty_ok} tone={r.is_low ? 'stop' : 'b'} />
                        {r.is_low && r.min_stock > 0 && (
                          <span className="kh-pill kh-stop">dưới {fmt(r.min_stock)}</span>
                        )}
                      </td>
                      {!hep && (
                        <td
                          title={cl ? cl.map((c) => `${c.code} ${fmt(c.qty)}`).join(' · ') : undefined} // prettier-ignore
                          style={{ fontSize: 12 }}
                        >
                          {cl ? (
                            cl.map((c, i) => (
                              <span key={c.lsx_id}>
                                {i > 0 && ' · '}
                                <span className="tm-chip">{lenhGon(c.code)}</span>
                              </span>
                            ))
                          ) : r.qty_ok > 0 ? (
                            <span className="tm-chip chung">tồn chung</span>
                          ) : (
                            <span className="kh-empty">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <KhungMa
          key={sel?.material_id ?? 'rong'}
          row={sel}
          cuaLenh={sel ? (cuaLenh[sel.material_id] ?? []) : []}
          laTruong={laTruong}
          canEdit={canEdit}
          moCapNhat={moCapNhat}
          onMoCapNhat={setMoCapNhat}
        />
      </div>

      <ThanhTT
        left="Số theo ĐVT từng mã, không cộng dồn · hàng chờ kiểm / khoá không tính vào Dùng được · bấm dòng xem chi tiết bên phải"
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
