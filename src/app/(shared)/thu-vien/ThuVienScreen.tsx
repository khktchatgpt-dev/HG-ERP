'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { FileSpreadsheet, FileUp, Plus, Tag } from 'lucide-react'
import { BomAiNewProduct } from '@/components/technical/BomAiNewProduct'
import { TopProgressBar } from '@/components/erp/Spinner'
import { Modal } from '@/components/Modal'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { HO_SO_O, HO_SO_TEN } from '@/lib/ho-so-sp'
import { SHOWROOM_ZONES } from '@/lib/showroom'
import { LIFECYCLES, LIFECYCLE_LABEL } from '@/lib/product-lifecycle'
import { CloneForm } from '../products/_components/CloneForm'
import { ImagePreviewModal } from '../products/_components/ImagePreviewModal'
import { BangThuVien } from './thu-vien-bang'
import { LuoiThuVien } from './thu-vien-luoi'
import { TaoSp } from './tao-sp'
import { DanhSachDt, DauTrangDt } from './thu-vien-dt'
import {
  PAGE_SIZE,
  type LibraryCounts,
  type LibraryRow,
  type ThuVienFilters,
} from './thu-vien.shared'
import { useThuVien } from './useThuVien'
import { locQuery } from './thu-vien.filters'
import { useXuatExcel } from '@/components/technical/useXuatExcel'

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

const EXPORT_URL = '/api/dept/technical/products/sp-excel/export'

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
  const xe = useXuatExcel()
  const soTrang = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tu = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const den = Math.min(page * PAGE_SIZE, total)
  const locTap =
    !!filters.thieu ||
    filters.kt ||
    filters.lenh ||
    !!filters.mau ||
    !!filters.the ||
    !!filters.anh ||
    filters.gia

  return (
    <>
      <TopProgressBar active={d.busy || d.dangChay || xe.busy} />
      {/* Khổ điện thoại (< 640px): đầu trang gọn + tấm lọc — `thu-vien-dt.tsx`. */}
      <DauTrangDt
        d={d}
        filters={filters}
        counts={counts}
        total={total}
        customers={customers}
        canEdit={canEdit}
        canPrice={canPrice}
        exportUrl={EXPORT_URL}
        xuat={(href) => void xe.xuat(href)}
        xuatBusy={xe.busy}
      />
      <header className="head w-only">
        <div className="head-l">
          <span className="eyebrow">Dùng chung</span>
          <h1>Thư viện sản phẩm</h1>
          <Fact
            label="SP"
            n={counts.total}
            on={!locTap}
            onClick={() =>
              d.doiLoc({ thieu: '', kt: '', lenh: '', mau: '', the: '', anh: '', gia: '' })
            }
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
              label="Chưa giá bán KH"
              n={counts.gia}
              on={filters.gia}
              onClick={() => d.latCo('gia')}
            />
          )}
        </div>
        <div className="head-r">
          <Link
            className="btn"
            href={`/thu-vien/in-the?${locQuery(filters)}`}
            title="In thẻ treo mẫu showroom cho các SP đang lọc"
          >
            <Tag size={14} aria-hidden />
            <span className="t">In thẻ treo</span>
          </Link>
          {!canEdit && (
            // Người chỉ xem (mọi phòng từ 20/11/2026) vẫn xuất được — Kinh doanh cần
            // file SP gửi khách. Nhập / mẫu trống thì chỉ người sửa được.
            <button
              type="button"
              className="btn"
              title="Xuất các SP đang lọc ra Excel (kèm ảnh)"
              aria-busy={xe.busy}
              aria-disabled={xe.busy}
              onClick={() => void xe.xuat(`${EXPORT_URL}?${locQuery(filters)}`)}
            >
              <FileSpreadsheet size={14} aria-hidden />
              <span className="t">{xe.busy ? 'Đang tạo file…' : 'Xuất Excel'}</span>
            </button>
          )}
          {canEdit && (
            <>
              <details className="dd">
                <summary
                  className="btn"
                  title="Thêm / cập nhật SP bằng file Excel"
                  aria-busy={xe.busy}
                >
                  <FileSpreadsheet size={14} aria-hidden />
                  <span className="t">{xe.busy ? 'Đang tạo file…' : 'Excel'}</span> ▾
                </summary>
                <div className="dd-m">
                  <a href={`${EXPORT_URL}?blank=1`}>Tải file mẫu trống</a>
                  <a
                    href={`${EXPORT_URL}?${locQuery(filters)}`}
                    aria-disabled={xe.busy}
                    onClick={(e) => {
                      // Gọi qua hook để bày "Đang tạo file…" + chặn bấm lại (~20 giây).
                      e.preventDefault()
                      e.currentTarget.closest('details')?.removeAttribute('open')
                      void xe.xuat(`${EXPORT_URL}?${locQuery(filters)}`)
                    }}
                  >
                    {xe.busy ? 'Đang tạo file…' : 'Xuất SP đang lọc (kèm ảnh)'}
                  </a>
                  <Link href="/thu-vien/nhap-excel">Nhập file đã sửa…</Link>
                </div>
              </details>
              <button
                type="button"
                className="btn"
                onClick={() => d.setFromBom(true)}
                title="Tạo sản phẩm từ file BOM"
              >
                <FileUp size={14} aria-hidden />
                <span className="t">Tạo từ file BOM</span>
              </button>
              <button
                type="button"
                className="btn pri"
                title="Thêm sản phẩm"
                onClick={() => d.setTaoMoi(true)}
              >
                <Plus size={14} aria-hidden />
                <span className="t">Thêm sản phẩm</span>
              </button>
            </>
          )}
        </div>
      </header>
      {/* Xuất Excel đang chạy / xong / lỗi — báo TẠI CHỖ, không để màn đứng im. */}
      {(xe.busy || xe.err || xe.xong != null) && (
        <div className={xe.err ? 'notice red' : 'notice'} role="status">
          {xe.busy
            ? 'Đang tạo file Excel kèm ảnh — khoảng 20 giây cho cả thư viện, đừng bấm lại.'
            : xe.err
              ? xe.err
              : `Đã tạo file ${xe.xong} SP — trình duyệt đang tải về (xem thư mục Tải xuống).`}
        </div>
      )}

      <div className="filters w-only">
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
        <label htmlFor="tv-hs" className="sr">
          Trạng thái hồ sơ
        </label>
        <select
          id="tv-hs"
          className="pick"
          value={filters.hs}
          onChange={(e) => d.doiLoc({ hs: e.target.value })}
        >
          <option value="">Mọi trạng thái hồ sơ</option>
          {LIFECYCLES.map((s) => (
            <option key={s} value={s}>
              {LIFECYCLE_LABEL[s]}
            </option>
          ))}
        </select>
        <label htmlFor="tv-khu" className="sr">
          Khu showroom
        </label>
        <select
          id="tv-khu"
          className="pick"
          value={filters.khu}
          onChange={(e) => d.doiLoc({ khu: e.target.value })}
        >
          <option value="">Mọi khu showroom</option>
          {SHOWROOM_ZONES.map((z) => (
            <option key={z} value={z}>
              Khu {z}
            </option>
          ))}
        </select>
        {/* Ba ô RÀ SOÁT hai chiều (20/11/2026) — kết hợp được với nhau và với
            khách / loại: "MERXX · chưa có mẫu", "có mẫu · chưa treo thẻ"… */}
        <label htmlFor="tv-mau" className="sr">
          Mẫu showroom
        </label>
        <select
          id="tv-mau"
          className={cn('pick', filters.mau && 'on')}
          value={filters.mau}
          onChange={(e) => d.doiLoc({ mau: e.target.value })}
        >
          <option value="">Mẫu: tất cả</option>
          <option value="co">Có mẫu ({counts.mau.co})</option>
          <option value="chua">Chưa có mẫu ({counts.mau.chua})</option>
        </select>
        <label htmlFor="tv-the" className="sr">
          Thẻ treo
        </label>
        <select
          id="tv-the"
          className={cn('pick', filters.the && 'on')}
          value={filters.the}
          onChange={(e) => d.doiLoc({ the: e.target.value })}
        >
          <option value="">Thẻ treo: tất cả</option>
          <option value="da">Đã treo thẻ ({counts.treo.da})</option>
          <option value="chua">Chưa treo thẻ ({counts.treo.chua})</option>
        </select>
        <label htmlFor="tv-anh" className="sr">
          Ảnh đại diện
        </label>
        <select
          id="tv-anh"
          className={cn('pick', filters.anh && 'on')}
          value={filters.anh}
          onChange={(e) => d.doiLoc({ anh: e.target.value })}
        >
          <option value="">Ảnh: tất cả</option>
          <option value="co">Có ảnh ({counts.anh.co})</option>
          <option value="chua">Chưa có ảnh ({counts.anh.chua})</option>
        </select>
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
                <button
                  type="button"
                  className="btn pri"
                  onClick={() => d.setTaoMoi(true)}
                >
                  <Plus size={14} aria-hidden />
                  Thêm sản phẩm
                </button>
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
        <>
          <DanhSachDt rows={rows} canPrice={canPrice} canEdit={canEdit} />
          <div className="w-only" style={{ display: 'contents' }}>
            <BangThuVien
              d={d}
              rows={rows}
              total={total}
              page={page}
              filters={filters}
              canPrice={canPrice}
            />
          </div>
        </>
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
        <span className="w-only">
          Số trên dữ kiện đếm trong tập khách / loại / khung đang chọn, không tính từ khoá
        </span>
        <span className="num" style={{ marginLeft: 'auto' }}>
          {tu}–{den} / {total.toLocaleString('vi-VN')}
        </span>
      </div>

      {d.fromBom && <BomAiNewProduct onClose={() => d.setFromBom(false)} />}
      <TaoSp open={d.taoMoi} onClose={() => d.setTaoMoi(false)} customers={customers} />
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
