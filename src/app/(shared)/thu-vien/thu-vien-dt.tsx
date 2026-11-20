'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { HO_SO_LABEL, HO_SO_O } from '@/lib/ho-so-sp'
import { SHOWROOM_ZONES } from '@/lib/showroom'
import { LIFECYCLES, LIFECYCLE_LABEL } from '@/lib/product-lifecycle'
import { locQuery } from './thu-vien.filters'
import {
  fmtGia,
  fmtKt,
  type LibraryCounts,
  type LibraryRow,
  type ThuVienFilters,
} from './thu-vien.shared'
import type { ThuVienCtx } from './useThuVien'

/**
 * THƯ VIỆN SP — KHỔ ĐIỆN THOẠI (< 640px bề rộng `.tv`), dựng theo bản vẽ
 * https://claude.ai/artifact/1csrtDXWHg55jb2c3CW51i (duyệt 20/11/2026, Q1–Q5
 * theo đề xuất). Bảng 13 cột không lọt 375px; ở đây mỗi SP một hàng 3 dòng, bấm
 * hàng mở hồ sơ, không thao tác trên dòng (Q4). Ô đếm dùng CHÍNH `counts` của
 * dải dữ kiện máy tính (Q3). Hiện / ẩn bằng container query `.dt-only` /
 * `.w-only` trong `thu-vien.css`, không đo bằng JS.
 */

/** Số điều kiện đang bật trong tấm Lọc (không tính từ khoá và tab "Thiếu…"). */
function soLoc(f: ThuVienFilters): number {
  return [f.kh, f.loai, f.khung, f.hs, f.khu, f.mau, f.the, f.anh, f.tt !== 'active'].filter(
    Boolean,
  )
    .length
}

/** Một dòng tóm tắt bộ lọc đang bật — "Khách: MERXX · Khu B2 · Có mẫu". */
function tomTat(f: ThuVienFilters): string {
  const kh = f.kh === '__common' ? 'Mẫu chung' : f.kh
  return [
    kh && `Khách: ${kh}`,
    f.loai && `Loại: ${PRODUCT_TYPES.find((t) => t.code === f.loai)?.label ?? f.loai}`,
    f.khung &&
      `Khung: ${FRAME_MATERIALS.find((m) => m.code === f.khung)?.label ?? f.khung}`,
    f.hs && `Hồ sơ: ${LIFECYCLE_LABEL[f.hs as keyof typeof LIFECYCLE_LABEL] ?? f.hs}`,
    f.khu && `Khu ${f.khu}`,
    f.mau === 'co' && 'Có mẫu',
    f.mau === 'chua' && 'Chưa có mẫu',
    f.the === 'da' && 'Đã treo thẻ',
    f.the === 'chua' && 'Chưa treo thẻ',
    f.anh === 'co' && 'Có ảnh',
    f.anh === 'chua' && 'Chưa có ảnh',
    f.tt === 'inactive' && 'Ngừng dùng',
    f.tt === 'all' && 'Cả SP ngừng',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function DauTrangDt({
  d,
  filters,
  counts,
  total,
  customers,
  canEdit,
  canPrice,
  exportUrl,
  xuat,
  xuatBusy,
}: {
  d: ThuVienCtx
  filters: ThuVienFilters
  counts: LibraryCounts
  total: number
  customers: { name: string; count: number }[]
  canEdit: boolean
  canPrice: boolean
  exportUrl: string
  xuat: (href: string) => void
  xuatBusy: boolean
}) {
  const [moLoc, setMoLoc] = useState(false)
  const n = soLoc(filters)
  const tt = tomTat(filters)
  const tapTat = !filters.thieu && !filters.kt && !filters.lenh && !filters.gia
  const tabs: { k: string; label: string; n: number; on: boolean; go: () => void }[] = [
    {
      k: 'all',
      label: 'Tất cả',
      n: counts.total,
      on: tapTat,
      go: () => d.doiLoc({ thieu: '', kt: '', lenh: '', gia: '' }),
    },
    {
      k: 'anh',
      label: 'Thiếu ảnh',
      n: counts.thieu.anh,
      on: filters.thieu === 'anh',
      go: () => d.lat('thieu', 'anh'),
    },
    { k: 'kt', label: 'Thiếu KT', n: counts.kt, on: filters.kt, go: () => d.latCo('kt') },
    {
      k: 'bom',
      label: 'Thiếu định mức',
      n: counts.thieu.bom,
      on: filters.thieu === 'bom',
      go: () => d.lat('thieu', 'bom'),
    },
    {
      k: 'dg',
      label: 'Thiếu đóng gói',
      n: counts.thieu.dg,
      on: filters.thieu === 'dg',
      go: () => d.lat('thieu', 'dg'),
    },
    {
      k: 'lenh',
      label: 'Trên lệnh',
      n: counts.lenh,
      on: filters.lenh,
      go: () => d.latCo('lenh'),
    },
  ]
  if (canPrice)
    tabs.push({
      k: 'gia',
      label: 'Chưa giá KH',
      n: counts.gia,
      on: filters.gia,
      go: () => d.latCo('gia'),
    })

  return (
    <div className="dt-only dt-dau">
      <div className="dt-hd">
        <h1>
          Thư viện SP <small>{total.toLocaleString('vi-VN')}</small>
        </h1>
        {canEdit && (
          <button type="button" className="btn pri" onClick={() => d.setTaoMoi(true)}>
            <Plus size={14} aria-hidden />
            Thêm
          </button>
        )}
        <details className="dd">
          <summary className="btn" aria-label="Thêm thao tác">
            <MoreHorizontal size={16} aria-hidden />
          </summary>
          <div className="dd-m dt-menu">
            <span className="g">Mọi người</span>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.closest('details')?.removeAttribute('open')
                d.doiXem(d.xem === 'luoi' ? 'bang' : 'luoi')
              }}
            >
              {d.xem === 'luoi' ? 'Xem dạng danh sách' : 'Xem dạng lưới ảnh'}
            </button>
            <Link href={`/thu-vien/in-the?${locQuery(filters)}`}>In thẻ treo</Link>
            <button
              type="button"
              aria-disabled={xuatBusy}
              onClick={(e) => {
                e.currentTarget.closest('details')?.removeAttribute('open')
                if (!xuatBusy) xuat(`${exportUrl}?${locQuery(filters)}`)
              }}
            >
              {xuatBusy ? 'Đang tạo file…' : 'Xuất Excel'}
              <small>SP đang lọc</small>
            </button>
            {canEdit && (
              <>
                <span className="g">Người sửa SP</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open')
                    d.setFromBom(true)
                  }}
                >
                  Tạo từ file BOM
                </button>
                <Link href="/thu-vien/nhap-excel">Nhập file Excel đã sửa</Link>
                <a href={`${exportUrl}?blank=1`}>Tải file mẫu trống</a>
              </>
            )}
          </div>
        </details>
      </div>

      <div className="dt-srch">
        <label htmlFor="tv-q-dt" className="sr">
          Tìm sản phẩm
        </label>
        <span className="in">
          <Search size={14} aria-hidden />
          <input
            id="tv-q-dt"
            type="search"
            value={d.nhap}
            onChange={(e) => d.setNhap(e.target.value)}
            placeholder="Mã HG, tên, mã KH, mã cũ…"
          />
        </span>
        <button
          type="button"
          className={n > 0 ? 'btn on' : 'btn'}
          aria-expanded={moLoc}
          onClick={() => setMoLoc(true)}
        >
          <SlidersHorizontal size={14} aria-hidden />
          Lọc{n > 0 && <b>{n}</b>}
        </button>
      </div>

      <div className="dt-tabs" role="toolbar" aria-label="Lọc theo hồ sơ thiếu">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            className={t.on ? 'on' : undefined}
            aria-pressed={t.on}
            onClick={t.go}
          >
            {t.label}
            <b>{t.n.toLocaleString('vi-VN')}</b>
          </button>
        ))}
      </div>

      {tt && (
        <div className="dt-act">
          <span>{tt}</span>
          <button type="button" onClick={d.boLoc}>
            Bỏ lọc
          </button>
        </div>
      )}

      {moLoc && (
        <TamLoc
          d={d}
          filters={filters}
          counts={counts}
          total={total}
          customers={customers}
          onClose={() => setMoLoc(false)}
        />
      )}
    </div>
  )
}

/** Hàng chọn một trong nhiều — nút phẳng liền nhau (không chip tròn). */
function Seg({
  label,
  opts,
  value,
  onPick,
}: {
  label: string
  opts: { v: string; t: string }[]
  value: string
  onPick: (v: string) => void
}) {
  return (
    <fieldset className="fld">
      <legend>{label}</legend>
      <div className="seg">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            className={o.v === value ? 'on' : undefined}
            aria-pressed={o.v === value}
            onClick={() => onPick(o.v)}
          >
            {o.t}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * TẤM LỌC trượt từ đáy. Mỗi lần đổi là áp NGAY (URL đổi, danh sách phía sau tải
 * lại), nên nút đáy đọc được số SP thật "Xem n SP" thay vì đoán trước.
 */
function TamLoc({
  d,
  filters,
  counts,
  total,
  customers,
  onClose,
}: {
  d: ThuVienCtx
  filters: ThuVienFilters
  counts: LibraryCounts
  total: number
  customers: { name: string; count: number }[]
  onClose: () => void
}) {
  return (
    <div
      className="dt-sheet-wrap"
      role="dialog"
      aria-modal="true"
      aria-label="Lọc sản phẩm"
    >
      <button type="button" className="dim" aria-label="Đóng" onClick={onClose} />
      <div className="dt-sheet">
        <div className="sh-h">
          Lọc sản phẩm
          <button
            type="button"
            onClick={() =>
              d.doiLoc({
                kh: '',
                loai: '',
                khung: '',
                hs: '',
                khu: '',
                mau: '',
                the: '',
                anh: '',
                tt: '',
              })
            }
          >
            Bỏ hết
          </button>
        </div>
        <div className="sh-b">
          <div className="fld">
            <label htmlFor="dt-kh">Khách</label>
            <select
              id="dt-kh"
              className={filters.kh ? 'on' : undefined}
              value={filters.kh}
              onChange={(e) => d.doiLoc({ kh: e.target.value })}
            >
              <option value="">Mọi khách ({customers.length})</option>
              <option value="__common">Mẫu chung</option>
              {customers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="dt-loai">Loại</label>
            <select
              id="dt-loai"
              className={filters.loai ? 'on' : undefined}
              value={filters.loai}
              onChange={(e) => d.doiLoc({ loai: e.target.value })}
            >
              <option value="">Mọi loại</option>
              {PRODUCT_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} · {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="dt-khung">Khung</label>
            <select
              id="dt-khung"
              className={filters.khung ? 'on' : undefined}
              value={filters.khung}
              onChange={(e) => d.doiLoc({ khung: e.target.value })}
            >
              <option value="">Mọi khung</option>
              {FRAME_MATERIALS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} · {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="dt-hs">Trạng thái hồ sơ</label>
            <select
              id="dt-hs"
              className={filters.hs ? 'on' : undefined}
              value={filters.hs}
              onChange={(e) => d.doiLoc({ hs: e.target.value })}
            >
              <option value="">Mọi trạng thái</option>
              {LIFECYCLES.map((s) => (
                <option key={s} value={s}>
                  {LIFECYCLE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <Seg
            label="Mẫu showroom"
            value={filters.mau}
            opts={[
              { v: '', t: 'Tất cả' },
              { v: 'co', t: `Có ${counts.mau.co}` },
              { v: 'chua', t: `Chưa có ${counts.mau.chua}` },
            ]}
            onPick={(v) => d.doiLoc({ mau: v })}
          />
          <Seg
            label="Thẻ treo"
            value={filters.the}
            opts={[
              { v: '', t: 'Tất cả' },
              { v: 'da', t: `Đã treo ${counts.treo.da}` },
              { v: 'chua', t: `Chưa treo ${counts.treo.chua}` },
            ]}
            onPick={(v) => d.doiLoc({ the: v })}
          />
          <Seg
            label="Ảnh đại diện"
            value={filters.anh}
            opts={[
              { v: '', t: 'Tất cả' },
              { v: 'co', t: `Có ảnh ${counts.anh.co}` },
              { v: 'chua', t: `Chưa có ${counts.anh.chua}` },
            ]}
            onPick={(v) => d.doiLoc({ anh: v })}
          />
          <Seg
            label="Khu showroom"
            value={filters.khu}
            opts={[{ v: '', t: 'Mọi' }, ...SHOWROOM_ZONES.map((z) => ({ v: z, t: z }))]}
            onPick={(v) => d.doiLoc({ khu: v })}
          />
          <Seg
            label="Trạng thái"
            value={filters.tt}
            opts={[
              { v: 'active', t: 'Đang dùng' },
              { v: 'inactive', t: `Ngừng ${counts.ngung}` },
              { v: 'all', t: 'Tất cả' },
            ]}
            onPick={(v) => d.doiLoc({ tt: v === 'active' ? '' : v })}
          />
        </div>
        <div className="sh-f">
          <button
            type="button"
            className="btn pri"
            onClick={onClose}
            aria-busy={d.dangChay}
          >
            {d.dangChay ? 'Đang lọc…' : `Xem ${total.toLocaleString('vi-VN')} SP`}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Ô đang THIẾU của một SP (Q2: chỉ bày ô thiếu). "Mẫu" không tính là thiếu. */
function oThieu(r: LibraryRow): string[] {
  const out: string[] = HO_SO_O.filter((o) => o !== 'mau' && r.check[o] === 'thieu').map(
    (o) => (o === 'bom' ? 'Định mức' : o === 'dg' ? 'Đóng gói' : HO_SO_LABEL[o]),
  )
  if (!fmtKt(r.length_mm, r.width_mm, r.height_mm)) out.unshift('KT')
  return out
}

export function DanhSachDt({
  rows,
  canPrice,
}: {
  rows: LibraryRow[]
  canPrice: boolean
}) {
  return (
    <ul className="dt-only dt-list">
      {rows.map((r) => {
        const kt = fmtKt(r.length_mm, r.width_mm, r.height_mm)
        const kh = [r.customer_name, r.customer_item_code].filter(Boolean).join(' · ')
        const gia = canPrice ? fmtGia(r.plan_price, r.plan_currency) : ''
        const thieu = oThieu(r)
        return (
          <li key={r.id}>
            <Link href={`/thu-vien/${r.id}`} className="dt-row">
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh qua /api/files/[id]/img đã tối ưu + cache
                <img className="th" src={r.image_url} alt="" loading="lazy" />
              ) : (
                <span className="th none">Chưa có ảnh</span>
              )}
              <span className="bd">
                <span className="l1">
                  <b className="code">{r.code}</b>
                  {r.is_set && <span className="tg">Bộ</span>}
                  {!r.is_active && <span className="tg">Ngừng</span>}
                  {r.showroom_zone && (
                    <span className="zone" title="Khu showroom">
                      {r.showroom_zone}
                    </span>
                  )}
                </span>
                <span className="nm">{r.name}</span>
                <span className="l3">
                  {kh && <span>{kh}</span>}
                  {kt ? (
                    <span className="m">{kt}</span>
                  ) : (
                    <span className="w">Chưa có KT</span>
                  )}
                  {gia && <span className="m">Giá KH {gia}</span>}
                </span>
                {(thieu.length > 0 || r.showroom_sample || r.lsx_open > 0) && (
                  <span className="flags">
                    {r.showroom_sample && <span className="f ok">Có mẫu</span>}
                    {/* Một nhãn gom mọi ô thiếu — 4–5 nhãn rời xuống hai dòng ở 375px. */}
                    {thieu.length > 0 && (
                      <span className="f miss">Thiếu: {thieu.join(' · ')}</span>
                    )}
                    {r.lsx_open > 0 && <span className="f">{r.lsx_open} lệnh</span>}
                  </span>
                )}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
