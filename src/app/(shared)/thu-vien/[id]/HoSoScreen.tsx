'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  AlertTriangle,
  Box,
  Boxes,
  Check,
  ClipboardCheck,
  Copy,
  DollarSign,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Package,
  PenLine,
  Table2,
  Trash2,
} from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
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

type Tab = 'dinh-muc' | 'dong-goi' | 'thanh-phan' | 'tai-lieu' | 'lich-su'

/**
 * HỒ SƠ SẢN PHẨM — bản THẺ 09/10/2026, dựng theo bản vẽ đã duyệt
 * https://claude.ai/artifact/2aJmfRiWs29AnByCZDsux6 (ngôn ngữ app CodeIgniter
 * cũ): thẻ trắng bo góc trên nền xám · dải chỉ số có icon màu · ảnh + lưới
 * thông số kẻ ô · TAB THẬT mỗi lần một mục · mỗi phần một màu chỉ ở icon và
 * vạch. Chế độ Sửa (dải vàng) giữ nguyên; "Sửa thông số" trên khối bật cùng
 * chế độ đó.
 */
export function HoSoScreen({
  d,
  canEdit,
  canPrice,
  canBom,
  canRemove = false,
  batDauSua = false,
}: {
  d: HoSoView
  canEdit: boolean
  canPrice: boolean
  /** Quyền `technical.bom.save` — sửa dòng định mức tại chỗ. */
  canBom: boolean
  /** Quyền `technical.product.remove` — nút Xoá ở đầu trang. */
  canRemove?: boolean
  /** Mở trang đã ở chế độ sửa (vừa tạo SP mới từ form gọn). */
  batDauSua?: boolean
}) {
  const c = useHoSo({ d, canEdit: canEdit || canBom, batDauSua })
  const confirm = useConfirm()
  const [dirtyBom, setDirtyBom] = useState(0)
  const onDirty = useCallback((n: number) => setDirtyBom(n), [])
  const suaDuocTrang = (canEdit || canBom) && !c.khoa
  const [tab, setTab] = useState<Tab>('dinh-muc')

  async function xoaSp() {
    const ok = await confirm({
      title: `Xoá sản phẩm "${d.name}"?`,
      description:
        'Định mức, đóng gói và file đính kèm của sản phẩm bị xoá theo. SP đang nằm trên báo giá / đơn hàng / mẫu thì không xoá được — dùng "Ngừng dùng". Không hoàn tác được.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    try {
      await api(`/api/dept/technical/products/${d.id}`, { method: 'DELETE' })
      c.toast.success('Đã xoá', d.code)
      c.router.push('/thu-vien')
    } catch (e) {
      c.toast.error('Không xoá được', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

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
  const tabs: {
    id: Tab
    label: string
    icon: React.ReactNode
    n: string
    dot: boolean
    sec: string
  }[] = [
    {
      id: 'dinh-muc',
      label: 'Định mức',
      icon: <Table2 aria-hidden />,
      n: String(d.parts.length),
      dot: thieu.includes('bom') || d.thieuSo.length > 0,
      sec: 'sec-dm',
    },
    {
      id: 'dong-goi',
      label: 'Đóng gói',
      icon: <Package aria-hidden />,
      n: String(d.packingCount),
      dot: thieu.includes('dg') || thieu.includes('xc'),
      sec: 'sec-dg',
    },
    ...(d.is_set || d.setItems.length
      ? [
          {
            id: 'thanh-phan' as Tab,
            label: 'Thành phần',
            icon: <Boxes aria-hidden />,
            n: `${d.setItems.length} món`,
            dot: false,
            sec: 'sec-ls',
          },
        ]
      : []),
    {
      id: 'tai-lieu',
      label: 'Tài liệu',
      icon: <FileText aria-hidden />,
      n: String(d.files.length),
      dot: thieu.includes('bv') || thieu.includes('anh'),
      sec: 'sec-tl',
    },
    {
      id: 'lich-su',
      label: 'Lịch sử',
      icon: <History aria-hidden />,
      n: d.rev ? `#${d.rev}` : '0',
      dot: false,
      sec: 'sec-ls',
    },
  ]
  const dmValue = d.parts.length
    ? `${d.parts.length - d.thieuSo.length} / ${d.parts.length}`
    : d.check.bom === 'khong_ap_dung'
      ? 'Không cần'
      : '0'
  const dmTone = d.thieuSo.length
    ? 'warn'
    : d.parts.length
      ? 'ok'
      : d.check.bom === 'thieu'
        ? 'bad'
        : 'gray'
  const kgTong = d.parts.reduce((a, p) => a + (p.weight_kg ?? 0), 0)

  return (
    <div
      className="hs"
      onDoubleClick={(e) => {
        // Nháy đúp vào một ô bảng khi đang XEM → bật chế độ sửa (thói quen Excel).
        if (!suaDuocTrang || c.cheDoSua) return
        if ((e.target as HTMLElement).closest('table')) c.setCheDoSua(true)
      }}
    >
      <TopProgressBar active={!!c.busy} />

      <section className="card">
        <header className="head">
          <div style={{ minWidth: 0 }}>
            <div className="crumb">
              <Link href="/thu-vien">Thư viện sản phẩm</Link> › {d.code}
            </div>
            <h1>{d.name}</h1>
            <div className="meta">
              <span className="chip code">{d.code}</span>
              {d.code_legacy && <span className="chip">cũ {d.code_legacy}</span>}
              <span className="chip">
                {d.customer_name ?? 'Mẫu chung'}
                {d.customer_item_code ? ` · ${d.customer_item_code}` : ''}
              </span>
              <span className="chip">
                {LOAI_LABEL[d.product_type ?? ''] ?? '—'} ·{' '}
                {KHUNG_LABEL[d.frame_material ?? ''] ?? '—'}
              </span>
              <span className="chip">ĐVT {d.unit}</span>
              {d.rev > 0 && <span className="chip">Bản #{d.rev}</span>}
              <span className="pill gray">{LIFECYCLE_LABEL[d.lifecycle]}</span>
              {d.locked_at && (
                <span className="pill ok">Đã khoá {dmyShort(d.locked_at)}</span>
              )}
              {!d.is_active && <span className="pill bad">Ngừng dùng</span>}
              {thieu.length > 0 && (
                <span className="pill warn">
                  Thiếu {thieu.map((o) => HO_SO_TEN[o]).join(', ')}
                </span>
              )}
            </div>
          </div>
          <div className="r">
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
            {canRemove && !c.khoa && (
              <button
                type="button"
                className="btn del"
                onClick={() => void xoaSp()}
                title="Xoá sản phẩm khỏi thư viện"
              >
                <Trash2 size={14} aria-hidden />
                <span className="t">Xoá</span>
              </button>
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
                  <span className="t">Sửa hồ sơ</span>
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
        <div className="stats">
          <button
            type="button"
            className="stat"
            onClick={() => setTab('tai-lieu')}
            title="Mở Tài liệu"
          >
            <span className={cn('ic', thieu.length ? 'warn' : 'ok')}>
              <ClipboardCheck aria-hidden />
            </span>
            <span>
              <span className="l">Hồ sơ</span>
              <b>
                {d.diem.co} / {d.diem.apDung}
              </b>
              <small>
                {thieu.length
                  ? `thiếu ${thieu.map((o) => HO_SO_TEN[o]).join(' · ')}`
                  : 'đủ mọi ô áp dụng'}
              </small>
            </span>
          </button>
          <button
            type="button"
            className="stat"
            onClick={() => setTab('dinh-muc')}
            title="Mở Định mức"
          >
            <span className={cn('ic', dmTone)}>
              <Table2 aria-hidden />
            </span>
            <span>
              <span className="l">Định mức</span>
              <b>{dmValue}</b>
              <small>
                {d.parts.length
                  ? `dòng đủ số · ${d.groups.filter((g) => d.parts.some((p) => p.group_code === g.code)).length} nhóm · ${nz(kgTong, 2)} kg`
                  : d.check.bom === 'khong_ap_dung'
                    ? 'phụ kiện bán rời'
                    : 'chưa có dòng nào'}
              </small>
            </span>
          </button>
          {canPrice && (
            <div className="stat">
              <span className={cn('ic', d.plan?.price != null ? 'act' : 'gray')}>
                <DollarSign aria-hidden />
              </span>
              <span>
                <span className="l">Giá KH</span>
                <b>
                  {d.plan?.price != null
                    ? `${nz(d.plan.price, 2)} ${d.plan.currency ?? ''}`
                    : 'Chưa khai'}
                </b>
                <small title={d.plan?.source ?? undefined}>
                  {d.plan?.price != null
                    ? `Bán hàng · ${dmyShort(d.plan.at) || '—'} · ${d.plan.source ?? 'FOB'}`
                    : 'Bán hàng chưa khai giá kế hoạch'}
                </small>
              </span>
            </div>
          )}
          <div className="stat">
            <span className={cn('ic', d.hasSample ? 'ok' : 'gray')}>
              <Box aria-hidden />
            </span>
            <span>
              <span className="l">Mẫu</span>
              <b>{d.hasSample ? 'Có' : 'Chưa làm'}</b>
              <small>{d.hasSample ? 'hiện vật chưa thanh lý' : 'chưa có hiện vật'}</small>
            </span>
          </div>
        </div>
      </section>

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

      {d.thieuSo.length > 0 ? (
        <div className="warnbar" role="status">
          <AlertTriangle aria-hidden />
          <span>
            <b>Chưa chốt được định mức:</b> {d.thieuSo.length} dòng thiếu số (
            {d.thieuSo
              .slice(0, 3)
              .map(
                (t) => `#${t.part_no ?? '?'} ${t.part_name} thiếu ${t.thieu.join(', ')}`,
              )
              .join('; ')}
            {d.thieuSo.length > 3 ? '; …' : ''}).{' '}
            <button type="button" className="lnk" onClick={() => setTab('dinh-muc')}>
              Xem các dòng →
            </button>
          </span>
        </div>
      ) : thieu.length > 0 ? (
        <div className="warnbar" role="status">
          <AlertTriangle aria-hidden />
          <span>
            <b>Còn thiếu {thieu.map((o) => HO_SO_TEN[o]).join(', ')}.</b> Lệnh và báo giá
            vẫn lập được, nhưng xưởng và khách sẽ hỏi.{' '}
            {(thieu.includes('bv') || thieu.includes('anh')) && (
              <button type="button" className="lnk" onClick={() => setTab('tai-lieu')}>
                Tải lên ở Tài liệu →
              </button>
            )}
          </span>
        </div>
      ) : null}

      <HoSoPhieu d={d} c={c} />

      <section className="card">
        <nav className="tabs" aria-label="Phần hồ sơ sản phẩm">
          {suaDuocTrang && !c.cheDoSua && (
            <span className="hint">Nháy đúp vào ô, hoặc bấm Sửa hồ sơ, để sửa thẳng như Excel</span>
          )}
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn('tab', t.sec, tab === t.id && 'on')}
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <span className="ic-sec">{t.icon}</span>
              {t.label}
              <span className="n">{t.n}</span>
              {t.dot && <span className="dot" aria-label="còn thiếu" />}
            </button>
          ))}
        </nav>
        {tab === 'dinh-muc' && (
          <HoSoDinhMuc d={d} c={c} canEditBom={canBom} onDirty={onDirty} />
        )}
        {tab === 'dong-goi' && <HoSoDongGoi d={d} c={c} />}
        {tab === 'thanh-phan' && <HoSoThanhPhan d={d} />}
        {tab === 'tai-lieu' && <HoSoTaiLieu d={d} c={c} canEdit={canEdit} />}
        {tab === 'lich-su' && <HoSoLichSu d={d} />}
      </section>
    </div>
  )
}
