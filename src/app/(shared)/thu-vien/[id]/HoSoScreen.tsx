'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Boxes,
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Package,
  PenLine,
  Table2,
} from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { HO_SO_O, HO_SO_TEN } from '@/lib/ho-so-sp'
import { LIFECYCLE_LABEL } from '@/lib/product-lifecycle'
import { KHUNG_LABEL, LOAI_LABEL } from '../thu-vien.shared'
import { HoSoDinhMuc } from './ho-so-dinh-muc'
import { HoSoDongGoi } from './ho-so-dong-goi'
import { HoSoLichSu } from './ho-so-lich-su'
import { HoSoTaiLieu } from './ho-so-tai-lieu'
import { HoSoThanhPhan } from './ho-so-thanh-phan'
import { HoSoPhieu } from './ho-so-phieu'
import { dmyShort, nz, type HoSoView } from './ho-so.shared'
import { useHoSo } from './useHoSo'

/**
 * HỒ SƠ SẢN PHẨM — khuôn E. Bố cục: đầu trang (tên + thẻ nhận diện + nút góc
 * phải) → dải hiệu suất → dải chặn → ảnh + khối phiếu → mục lục → Định mức →
 * Đóng gói → Thành phần → Tài liệu → Lịch sử.
 *
 * HAI CHẾ ĐỘ rõ ràng như app CodeIgniter cũ (08/10/2026): XEM là mặc định,
 * chỉ chữ; bấm "Sửa" ở góc phải mới hiện ô nhập + dải vàng "Đang sửa"; "Xong"
 * trả về xem (hỏi trước nếu lưới định mức còn dòng chưa lưu).
 */
export function HoSoScreen({
  d,
  canEdit,
  canPrice,
  canBom,
}: {
  d: HoSoView
  canEdit: boolean
  canPrice: boolean
  /** Quyền `technical.bom.save` — sửa dòng định mức tại chỗ. */
  canBom: boolean
}) {
  const c = useHoSo({ d, canEdit: canEdit || canBom })
  const confirm = useConfirm()
  const [dirtyBom, setDirtyBom] = useState(0)
  const onDirty = useCallback((n: number) => setDirtyBom(n), [])
  const suaDuocTrang = (canEdit || canBom) && !c.khoa

  async function thoatSua() {
    if (dirtyBom > 0) {
      const ok = await confirm({
        title: `Còn ${dirtyBom} dòng định mức chưa lưu`,
        description:
          'Thoát chế độ sửa sẽ bỏ các thay đổi đó. Bấm Lưu (Ctrl+S) ở lưới nếu muốn giữ.',
        tone: 'danger',
        confirmLabel: 'Bỏ và thoát',
      })
      if (!ok) return
    }
    c.setCheDoSua(false)
  }

  const thieu = HO_SO_O.filter((o) => d.check[o] === 'thieu')
  const tabs = [
    {
      id: 'dinh-muc',
      label: 'Định mức',
      icon: <Table2 aria-hidden />,
      n: String(d.parts.length),
      dot: thieu.includes('bom') || d.thieuSo.length > 0,
      on: true,
    },
    {
      id: 'dong-goi',
      label: 'Đóng gói',
      icon: <Package aria-hidden />,
      n: String(d.packingCount),
      dot: thieu.includes('dg') || thieu.includes('xc'),
    },
    {
      id: 'thanh-phan',
      label: 'Thành phần',
      icon: <Boxes aria-hidden />,
      n: d.is_set ? `${d.setItems.length} món` : '—',
      dot: false,
    },
    {
      id: 'tai-lieu',
      label: 'Tài liệu',
      icon: <FileText aria-hidden />,
      n: String(d.files.length),
      dot: thieu.includes('bv') || thieu.includes('anh'),
    },
    {
      id: 'lich-su',
      label: 'Lịch sử',
      icon: <History aria-hidden />,
      n: d.rev ? `#${d.rev}` : '—',
      dot: false,
    },
  ]
  const dmValue = d.parts.length
    ? `${d.parts.length - d.thieuSo.length} / ${d.parts.length}`
    : d.check.bom === 'khong_ap_dung'
      ? 'không cần'
      : '0'
  const dmTone = d.thieuSo.length
    ? 'warn'
    : d.parts.length
      ? 'done'
      : d.check.bom === 'thieu'
        ? 'stop'
        : ''

  return (
    <>
      <TopProgressBar active={!!c.busy} />
      <header className="head2">
        <div style={{ minWidth: 0 }}>
          <div className="crumb">
            <Link href="/thu-vien">Thư viện sản phẩm</Link> › {d.code}
          </div>
          <h1>{d.name}</h1>
          <div className="meta">
            <span className="tagb">{d.code}</span>
            {d.code_legacy && <span className="tagb">cũ {d.code_legacy}</span>}
            <span className="tagb">
              {d.customer_name ?? 'Mẫu chung'}
              {d.customer_item_code ? ` · ${d.customer_item_code}` : ''}
            </span>
            <span className="tagb">
              {LOAI_LABEL[d.product_type ?? ''] ?? '—'} ·{' '}
              {KHUNG_LABEL[d.frame_material ?? ''] ?? '—'}
            </span>
            <span className="tagb">ĐVT {d.unit}</span>
            {d.rev > 0 && <span className="tagb">Bản #{d.rev}</span>}
            <span className="tagb">{LIFECYCLE_LABEL[d.lifecycle]}</span>
            {d.locked_at && (
              <span className="tag done">Đã khoá {dmyShort(d.locked_at)}</span>
            )}
            {!d.is_active && <span className="tag stop">Ngừng dùng</span>}
          </div>
        </div>
        <div className="head-r">
          <a
            className="btn"
            href={`/api/dept/technical/products/${d.id}/export`}
            title="Xuất Excel hồ sơ"
          >
            <FileSpreadsheet size={14} aria-hidden />
            <span className="t">Excel</span>
          </a>
          {canEdit && (
            <Link
              className="btn"
              href={`/thu-vien?clone=${d.id}`}
              title="Nhân bản sản phẩm"
            >
              <Copy size={14} aria-hidden />
              <span className="t">Nhân bản</span>
            </Link>
          )}
          {suaDuocTrang ? (
            c.cheDoSua ? (
              <button
                type="button"
                className="btn on"
                onClick={() => void thoatSua()}
                title="Thoát chế độ sửa, về xem"
              >
                <Check size={14} aria-hidden />
                <span className="t">Xong</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn pri"
                onClick={() => c.setCheDoSua(true)}
                title="Bật chế độ sửa: gõ thẳng vào ô trên trang"
              >
                <PenLine size={14} aria-hidden />
                <span className="t">Sửa</span>
              </button>
            )
          ) : (
            <span
              className="btn"
              aria-disabled="true"
              title={
                c.khoa
                  ? 'Hồ sơ đã khoá — mở khoá ở form đầy đủ mới sửa được'
                  : 'Việc này do Kỹ thuật quản lý'
              }
            >
              <Lock size={14} aria-hidden />
              <span className="t">{c.khoa ? 'Đã khoá' : 'Chỉ xem'}</span>
            </span>
          )}
        </div>
      </header>

      {c.cheDoSua && (
        <div className="editbar" role="status">
          <PenLine size={14} aria-hidden />
          <b>Đang sửa</b>
          <span className="t">
            — thông số và đóng gói lưu khi rời ô; định mức gõ như Excel rồi bấm Lưu
            (Ctrl+S).
          </span>
          {canEdit && (
            <Link href={`/products/${d.id}`} title="Mở form đầy đủ mọi trường">
              Form đầy đủ
            </Link>
          )}
          <span className="r">
            <button type="button" className="btn" onClick={() => void thoatSua()}>
              <Check size={14} aria-hidden />
              Xong
            </button>
          </span>
        </div>
      )}

      <div className="strip">
        <a className={cn('metric', thieu.length ? 'warn' : 'done')} href="#dinh-muc">
          <span className="l">Hồ sơ</span>
          <b>
            {d.diem.co} / {d.diem.apDung}
          </b>
          <small>
            {thieu.length
              ? `thiếu ${thieu.map((o) => HO_SO_TEN[o]).join(' · ')}`
              : 'đủ mọi ô áp dụng'}
          </small>
        </a>
        <a className={cn('metric', dmTone)} href="#dinh-muc">
          <span className="l">Định mức</span>
          <b>{dmValue}</b>
          <small>
            {d.parts.length
              ? `dòng đủ số · bản #${d.rev || 0}`
              : d.check.bom === 'khong_ap_dung'
                ? 'phụ kiện bán rời'
                : 'chưa có dòng nào'}
          </small>
        </a>
        {canPrice && (
          <span className={cn('metric', d.plan?.price == null && 'none')}>
            <span className="l">Giá KH</span>
            <b>
              {d.plan?.price != null
                ? `${nz(d.plan.price, 2)} ${d.plan.currency ?? ''}`
                : 'chưa khai'}
            </b>
            <small title={d.plan?.source ?? undefined}>
              {d.plan?.price != null
                ? `Bán hàng · ${dmyShort(d.plan.at) || '—'} · ${d.plan.source ?? 'FOB'}`
                : 'Bán hàng chưa khai giá kế hoạch'}
            </small>
          </span>
        )}
        <span className={cn('metric', !d.hasSample && 'none')}>
          <span className="l">Mẫu</span>
          <b>{d.hasSample ? 'có' : 'chưa làm'}</b>
          <small>{d.hasSample ? 'hiện vật chưa thanh lý' : 'chưa có hiện vật'}</small>
        </span>
      </div>

      {d.thieuSo.length > 0 ? (
        <div className="blocked" role="status">
          <div>
            <b>Chưa chốt được định mức:</b> {d.thieuSo.length} dòng thiếu số (
            {d.thieuSo
              .slice(0, 3)
              .map(
                (t) => `#${t.part_no ?? '?'} ${t.part_name} thiếu ${t.thieu.join(', ')}`,
              )
              .join('; ')}
            {d.thieuSo.length > 3 ? '; …' : ''}). <a href="#dinh-muc">Xem các dòng</a>
            {canBom && !c.khoa ? ' — bấm Sửa để điền.' : ' — việc của Kỹ thuật.'}
          </div>
        </div>
      ) : thieu.length > 0 ? (
        <div className="blocked" role="status">
          <div>
            <b>Còn thiếu {thieu.map((o) => HO_SO_TEN[o]).join(', ')}.</b> Lệnh và báo giá
            vẫn lập được, nhưng xưởng và khách sẽ hỏi.
          </div>
        </div>
      ) : null}

      <HoSoPhieu d={d} c={c} />

      <nav className="tabs" aria-label="Phần hồ sơ sản phẩm">
        {/* Mọi mục nằm NGAY TRÊN TRANG (neo #) — tab chỉ là mục lục, không đổi trang. */}
        {tabs.map((t) => (
          <a key={t.id} href={`#${t.id}`} className={t.on ? 'on' : undefined}>
            {t.icon}
            {t.label}
            <span className="n">{t.n}</span>
            {t.dot && <span className="dot" aria-label="còn thiếu" />}
          </a>
        ))}
      </nav>

      <HoSoDinhMuc d={d} c={c} canEditBom={canBom} onDirty={onDirty} />
      <HoSoDongGoi d={d} c={c} />
      <HoSoThanhPhan d={d} />
      <HoSoTaiLieu d={d} c={c} canEdit={canEdit} />
      <HoSoLichSu d={d} />
    </>
  )
}
