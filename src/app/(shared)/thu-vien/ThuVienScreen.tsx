'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { FileUp, Plus } from 'lucide-react'
import { BomAiNewProduct } from '@/components/technical/BomAiNewProduct'
import { TopProgressBar } from '@/components/erp/Spinner'
import { Modal } from '@/components/Modal'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { HO_SO_O, HO_SO_TEN } from '@/lib/ho-so-sp'
import { CloneForm } from '../products/_components/CloneForm'
import { ImagePreviewModal } from '../products/_components/ImagePreviewModal'
import { BangThuVien } from './thu-vien-bang'
import { LuoiThuVien } from './thu-vien-luoi'
import {
  PAGE_SIZE,
  type LibraryCounts,
  type LibraryRow,
  type ThuVienFilters,
} from './thu-vien.shared'
import { useThuVien } from './useThuVien'

/**
 * THƯ VIỆN SẢN PHẨM — khuôn C · Danh sách, dựng ĐÚNG artboard "Màn 1" trên
 * canvas Claude Design: đầu trang một hàng (nhãn khu · tiêu đề · 7 dữ kiện
 * bấm được · nút góc phải), hàng lọc, bảng / lưới, thanh trạng thái.
 */
/** Dữ kiện đầu trang BẤM ĐƯỢC — bấm là lọc; số đếm bằng đúng hàm lọc của bảng. */
function Fact({
  label,
  n,
  warn,
  on,
  onClick,
}: {
  label: string
  n: number
  warn?: boolean
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn('fact', on && 'on')}
      aria-pressed={on}
      onClick={onClick}
    >
      {label}{' '}
      <b className={warn && n > 0 ? 'w' : undefined}>{n.toLocaleString('vi-VN')}</b>
    </button>
  )
}

export function ThuVienScreen({
  rows,
  total,
  fuzzy,
  counts,
  customers,
  filters,
  page,
  canEdit,
  canPrice,
}: {
  rows: LibraryRow[]
  total: number
  fuzzy: boolean
  counts: LibraryCounts
  customers: { name: string; count: number }[]
  filters: ThuVienFilters
  page: number
  canEdit: boolean
  canPrice: boolean
}) {
  const d = useThuVien({ filters, canEdit })
  const soTrang = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tu = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const den = Math.min(page * PAGE_SIZE, total)
  const locTap =
    !!filters.thieu || filters.kt || filters.lenh || filters.mau || filters.gia

  return (
    <>
      <TopProgressBar active={d.busy || d.dangChay} />
      <header className="head">
        <div className="head-l">
          <span className="eyebrow">Dùng chung</span>
          <h1>Thư viện sản phẩm</h1>
          <Fact
            label="SP"
            n={counts.total}
            on={!locTap}
            onClick={() => d.doiLoc({ thieu: '', kt: '', lenh: '', mau: '', gia: '' })}
          />
          <Fact
            label="Thiếu định mức"
            n={counts.thieu.bom}
            warn
            on={filters.thieu === 'bom'}
            onClick={() => d.lat('thieu', 'bom')}
          />
          <Fact
            label="Thiếu KTSP"
            n={counts.kt}
            warn
            on={filters.kt}
            onClick={() => d.latCo('kt')}
          />
          <Fact
            label="Thiếu đóng gói"
            n={counts.thieu.dg}
            warn
            on={filters.thieu === 'dg'}
            onClick={() => d.lat('thieu', 'dg')}
          />
          <Fact
            label="Thiếu ảnh"
            n={counts.thieu.anh}
            on={filters.thieu === 'anh'}
            onClick={() => d.lat('thieu', 'anh')}
          />
          <Fact
            label="Đang trên lệnh"
            n={counts.lenh}
            on={filters.lenh}
            onClick={() => d.latCo('lenh')}
          />
          {canPrice && (
            <Fact
              label="Chưa giá KH"
              n={counts.gia}
              on={filters.gia}
              onClick={() => d.latCo('gia')}
            />
          )}
        </div>
        {canEdit && (
          <div className="head-r">
            <button
              type="button"
              className="btn"
              onClick={() => d.setFromBom(true)}
              title="Tạo sản phẩm từ file BOM"
            >
              <FileUp size={14} aria-hidden />
              <span className="t">Tạo từ file BOM</span>
            </button>
            <Link href="/products/new" className="btn pri" title="Thêm sản phẩm">
              <Plus size={14} aria-hidden />
              <span className="t">Thêm sản phẩm</span>
            </Link>
          </div>
        )}
      </header>

      <div className="filters">
        <label htmlFor="tv-q" className="sr">
          Tìm sản phẩm
        </label>
        <input
          id="tv-q"
          type="search"
          className="pick"
          style={{ width: 320 }}
          value={d.nhap}
          onChange={(e) => d.setNhap(e.target.value)}
          placeholder="Tìm mã HG, mã cũ, mã KH, tên, khách…"
        />
        <label htmlFor="tv-kh" className="sr">
          Khách hàng
        </label>
        <select
          id="tv-kh"
          className="pick"
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
        <label htmlFor="tv-loai" className="sr">
          Loại sản phẩm
        </label>
        <select
          id="tv-loai"
          className="pick"
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
        <label htmlFor="tv-khung" className="sr">
          Vật liệu khung
        </label>
        <select
          id="tv-khung"
          className="pick"
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
        <label htmlFor="tv-thieu" className="sr">
          Thiếu hồ sơ
        </label>
        <select
          id="tv-thieu"
          className="pick"
          value={filters.thieu}
          onChange={(e) => d.doiLoc({ thieu: e.target.value })}
        >
          <option value="">Hồ sơ: không lọc</option>
          <option value="any">Thiếu bất kỳ ({counts.thieu.any})</option>
          {HO_SO_O.filter((o) => o !== 'mau').map((o) => (
            <option key={o} value={o}>
              Thiếu {HO_SO_TEN[o]} ({counts.thieu[o]})
            </option>
          ))}
        </select>
        <label htmlFor="tv-tt" className="sr">
          Trạng thái
        </label>
        <select
          id="tv-tt"
          className="pick"
          value={filters.tt}
          onChange={(e) =>
            d.doiLoc({ tt: e.target.value === 'active' ? '' : e.target.value })
          }
        >
          <option value="active">Đang dùng</option>
          <option value="inactive">Ngừng dùng ({counts.ngung})</option>
          <option value="all">Tất cả</option>
        </select>
        <button
          type="button"
          className={cn('chip', filters.mau && 'on')}
          aria-pressed={filters.mau}
          onClick={() => d.latCo('mau')}
        >
          Có mẫu <span className="n">{counts.mau}</span>
        </button>
        {d.dangLoc && (
          <button type="button" className="btn" onClick={d.boLoc}>
            Bỏ lọc
          </button>
        )}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
          <button
            type="button"
            className={cn('chip', d.xem === 'bang' && 'on')}
            aria-pressed={d.xem === 'bang'}
            onClick={() => d.doiXem('bang')}
          >
            Bảng
          </button>
          <button
            type="button"
            className={cn('chip', d.xem === 'luoi' && 'on')}
            aria-pressed={d.xem === 'luoi'}
            onClick={() => d.doiXem('luoi')}
          >
            Lưới ảnh
          </button>
        </span>
      </div>

      {fuzzy && rows.length > 0 && (
        <div className="notice" role="status">
          Không có SP nào khớp đúng “{filters.q}” — đây là {rows.length} SP có mã/tên GẦN
          GIỐNG, xếp theo độ giống. Kiểm lại mã trước khi dùng.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">
          <b>
            {d.dangLoc
              ? 'Không có sản phẩm nào khớp bộ lọc'
              : 'Thư viện chưa có sản phẩm nào'}
          </b>
          <div className="why">
            {d.dangLoc
              ? `Trong ${counts.total.toLocaleString('vi-VN')} SP ${filters.tt === 'active' ? 'đang dùng' : filters.tt === 'inactive' ? 'ngừng dùng' : ''}${
                  filters.kh
                    ? ` của ${filters.kh === '__common' ? 'mẫu chung' : filters.kh}`
                    : ''
                }, ${
                  [
                    filters.q ? `từ khoá “${filters.q}”` : '',
                    locTap ? 'điều kiện hồ sơ đang bật' : '',
                  ].filter(Boolean).length
                    ? `không SP nào thoả ${[filters.q ? `từ khoá “${filters.q}”` : '', locTap ? 'điều kiện hồ sơ đang bật' : ''].filter(Boolean).join(' và ')}`
                    : 'không còn SP nào'
                }${page > 1 ? ` ở trang ${page}` : ''}.`
              : 'Chưa có hồ sơ nào trong thư viện — mọi lệnh sản xuất và báo giá đều cần hồ sơ ở đây.'}
          </div>
          <div className="next">
            {d.dangLoc ? (
              <>
                <button type="button" className="btn pri" onClick={d.boLoc}>
                  Bỏ lọc
                </button>
                {page > 1 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => d.doiLoc({ trang: '1' })}
                  >
                    Về trang 1
                  </button>
                )}
              </>
            ) : canEdit ? (
              <>
                <Link href="/products/new" className="btn pri">
                  + Thêm sản phẩm
                </Link>
                <button type="button" className="btn" onClick={() => d.setFromBom(true)}>
                  Tạo từ file BOM
                </button>
              </>
            ) : (
              <span className="muted">
                Hồ sơ do phòng Kỹ thuật lập — liên hệ Kỹ thuật để thêm.
              </span>
            )}
          </div>
        </div>
      ) : d.xem === 'luoi' ? (
        <LuoiThuVien d={d} rows={rows} />
      ) : (
        <BangThuVien
          d={d}
          rows={rows}
          total={total}
          page={page}
          filters={filters}
          canPrice={canPrice}
        />
      )}

      <div className="foot">
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button
            type="button"
            className="btn"
            disabled={page <= 1 || d.dangChay}
            onClick={() => d.doiLoc({ trang: String(page - 1) })}
          >
            ‹ Trước
          </button>
          <button
            type="button"
            className="btn"
            disabled={page >= soTrang || d.dangChay}
            onClick={() => d.doiLoc({ trang: String(page + 1) })}
          >
            Sau ›
          </button>
        </span>
        <span>
          {d.dangChay
            ? 'Đang tải…'
            : d.dangLoc
              ? 'Khung nhìn: đang lọc'
              : 'Khung nhìn: SP đang dùng'}
        </span>
        <span>
          Số trên dữ kiện đếm trong tập khách / loại / khung đang chọn, không tính từ khoá
        </span>
        <span className="num" style={{ marginLeft: 'auto' }}>
          {tu}–{den} / {total.toLocaleString('vi-VN')}
        </span>
      </div>

      {d.fromBom && <BomAiNewProduct onClose={() => d.setFromBom(false)} />}
      <ImagePreviewModal
        preview={d.preview ? { product: d.preview.row, url: d.preview.url } : null}
        onClose={() => d.setPreview(null)}
      />
      <Modal
        open={!!d.cloning}
        onClose={() => d.setCloning(null)}
        title={d.cloning ? `Nhân bản mẫu — ${d.cloning.name}` : ''}
      >
        {d.cloning && (
          <CloneForm
            source={d.cloning}
            suggestedCode={d.cloneCode}
            customerNames={customers}
            onSubmit={d.guiNhanBan}
          />
        )}
      </Modal>
    </>
  )
}
