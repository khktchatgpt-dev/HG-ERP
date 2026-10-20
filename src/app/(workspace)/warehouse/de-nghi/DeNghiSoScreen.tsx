'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus } from 'lucide-react'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { DE_NGHI_NHAN, DE_NGHI_TONE, dangO } from '@/lib/de-nghi'
import { searchMatcher } from '@/lib/search-text'
import { useBeRong } from '@/lib/use-be-rong'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  Rong,
  TabNgang,
  ThanhLoc,
  ThanhTT,
  type TabMuc,
} from '../_erp/khung'
import type { DeNghiSoRow } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN')

const RO = ['viec', 'cho', 'mua', 'xong', 'all'] as const
type Ro = (typeof RO)[number]
const RO_NHAN: Record<Ro, string> = {
  viec: 'Kho cần làm',
  cho: 'Chờ duyệt',
  mua: 'Đã duyệt · Kho đi mua',
  xong: 'Xong · đã huỷ',
  all: 'Tất cả',
}
const RO_MAU: Record<Ro, { mau: string; tone: TabMuc['tone'] }> = {
  viec: { mau: 'c-dnm', tone: 'warn' },
  cho: { mau: 'c-warn', tone: 'warn' },
  mua: { mau: 'c-nhap', tone: 'mut' },
  xong: { mau: 'c-mut', tone: 'mut' },
  all: { mau: 'c-mut', tone: 'mut' },
}
const thuoc = (r: DeNghiSoRow, ro: Ro) =>
  ro === 'all' ||
  (ro === 'viec' && r.status === 'draft') ||
  (ro === 'cho' && r.status === 'pending') ||
  (ro === 'mua' && (r.status === 'approved' || r.status === 'ordering')) ||
  (ro === 'xong' && (r.status === 'done' || r.status === 'cancelled'))

/** Nhãn trạng thái theo vòng đời — nền nhạt, không bao giờ nền đặc (nền đặc = bấm được). */
const LOP_TAG: Record<string, string> = {
  neutral: 'kh-tag',
  warn: 'kh-tag warn',
  run: 'kh-tag run',
  done: 'kh-tag done',
  stop: 'kh-tag',
}

/**
 * SỔ ĐỀ NGHỊ MUA VẬT TƯ — khuôn C (0236 · Đ1, bản vẽ DN-4), dựng lại trên khung
 * Kho lối ERP · B5 (14/10/2026). Câu màn trả lời: phiếu nào của Kho đang kẹt ở
 * ai — nháp chưa gửi, bị từ chối chờ sửa, đang chờ lãnh đạo, hay đã duyệt chờ
 * Kho đi mua. Tab mặc định "Kho cần làm" (nháp + bị từ chối).
 */
export function DeNghiSoScreen({
  rows,
  canManage,
}: {
  rows: DeNghiSoRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const coViec = rows.some((r) => thuoc(r, 'viec'))
  const [ro, setRo] = useState<Ro>(coViec ? 'viec' : rows.some((r) => thuoc(r, 'cho')) ? 'cho' : 'all') // prettier-ignore
  const [q, setQ] = useState('')
  const [chon, setChon] = useState<string | null>(null)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 900

  const khop = searchMatcher(q)
  const theoTim = rows.filter((r) => khop([r.code, r.nguoi ?? '', r.lsx_code ?? '']))
  const hien = theoTim.filter((r) => thuoc(r, ro))
  const dem = Object.fromEntries(RO.map((x) => [x, theoTim.filter((r) => thuoc(r, x)).length])) as Record<Ro, number> // prettier-ignore
  const tong = hien.reduce((s, r) => s + r.tong, 0)
  const tuChoi = rows.filter((r) => r.bi_tu_choi).length
  const sel = hien.find((r) => r.id === chon) ?? null
  const mo = (id: string) => router.push(`/warehouse/de-nghi/${id}`)
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      mo(id)
    }
  }

  const tabs: TabMuc[] = RO.map((x) => ({
    key: x,
    label: RO_NHAN[x],
    on: ro === x,
    onClick: () => setRo(x),
    n: dem[x],
    tone: dem[x] > 0 ? (x === 'viec' && tuChoi > 0 ? 'red' : RO_MAU[x].tone) : undefined,
    mau: RO_MAU[x].mau,
    note: x === 'viec' && tuChoi > 0 ? `${tuChoi} bị từ chối` : undefined,
  }))

  return (
    <KhoKhung label="Đề nghị mua">
      <DauTrang
        title="Đề nghị mua"
        ctx={
          <>
            <b>{rows.length}</b> phiếu · lãnh đạo duyệt, Kho tự mua rồi nhập kho
          </>
        }
        actions={
          <>
            {canManage && (
              <ApNhom>
                <ApNut
                  primary
                  icon={<Plus size={15} aria-hidden />}
                  href="/warehouse/de-nghi/moi"
                >
                  Lập đề nghị
                </ApNut>
              </ApNhom>
            )}
            <ApNhom>
              <ApNut
                icon={<FileText size={15} aria-hidden />}
                href={sel ? `/warehouse/de-nghi/${sel.id}` : undefined}
                why={sel ? null : 'Chọn một phiếu trong bảng trước'}
              >
                {sel ? `Mở ${sel.code}` : 'Mở phiếu'}
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <TabNgang label="Phiếu đang ở đâu" tabs={tabs} />

      <ThanhLoc>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm số phiếu, người, lệnh…"
          aria-label="Tìm số phiếu, người, lệnh"
        />
        {q.trim() && (
          <button type="button" className="clr" onClick={() => setQ('')}>
            Bỏ tìm
          </button>
        )}
      </ThanhLoc>

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {hien.length === 0 ? (
        <Rong
          tieuDe={rows.length === 0 ? 'Chưa có phiếu đề nghị mua nào' : `Không có phiếu nào trong "${RO_NHAN[ro]}"`} // prettier-ignore
          lyDo={
            rows.length === 0
              ? 'Kho lập "Giấy đề nghị mua vật tư" ở đây thay cho tờ giấy chụp gửi Zalo: lãnh đạo duyệt trên hệ thống, Kho đi mua rồi nhập kho theo phiếu.'
              : q.trim()
                ? `Không phiếu nào khớp "${q.trim()}".`
                : 'Tab này đang trống.'
          }
          tiep={
            rows.length === 0 && canManage ? (
              <Link href="/warehouse/de-nghi/moi" className="kh-btn p">
                Lập đề nghị đầu tiên
              </Link>
            ) : (
              <button
                type="button"
                className="kh-btn"
                onClick={() => {
                  setQ('')
                  setRo('all')
                }}
              >
                Xem tất cả phiếu
              </button>
            )
          }
        />
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Sổ đề nghị mua vật tư">
            <colgroup>
              <col style={{ width: 150 }} />
              <col style={{ width: 92 }} />
              {!hep && <col style={{ width: 160 }} />}
              <col style={{ width: 84 }} />
              <col style={{ width: 132 }} />
              <col style={{ width: 120 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Phiếu</th>
                <th>Ngày</th>
                {!hep && <th>Người đề nghị</th>}
                <th className="r">Số dòng</th>
                <th className="r">Tổng dự kiến</th>
                <th>Trạng thái</th>
                <th>Đang ở</th>
              </tr>
            </thead>
            <tbody>
              {hien.map((r) => {
                const on = r.id === chon
                return (
                  <tr
                    key={r.id}
                    className={on ? 'd on' : 'd'}
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => setChon(r.id)}
                    onDoubleClick={() => mo(r.id)}
                    onKeyDown={(e) => phim(e, r.id)}
                  >
                    <td>
                      <span className="kh-sq c-dnm" aria-hidden />
                      <Link
                        href={`/warehouse/de-nghi/${r.id}`}
                        className="kh-lnk"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.code}
                      </Link>
                    </td>
                    <td className="kh-num kh-mut">
                      {isoToVn(todayVn(new Date(r.created_at)))}
                    </td>
                    {!hep && <td className="kh-mut">{r.nguoi ?? '—'}</td>}
                    <td className="r kh-num">
                      {r.so_dong}
                      {r.chua_ma > 0 && (
                        <span
                          className="kh-warn"
                          style={{ display: 'block', fontSize: 11 }}
                          title="Dòng chưa có mã — gắn mã khi nhập kho"
                        >
                          {r.chua_ma} chưa mã
                        </span>
                      )}
                    </td>
                    <td className="r kh-num kh-b">
                      {fmt(r.tong)}
                      {r.thieu_gia > 0 && (
                        <span
                          className="kh-mut"
                          style={{ display: 'block', fontSize: 11, fontWeight: 400 }}
                        >
                          {r.thieu_gia} dòng chưa giá
                        </span>
                      )}
                    </td>
                    <td>
                      {r.bi_tu_choi ? (
                        <span
                          className="kh-tag"
                          style={{ color: 'var(--kh-stop)', fontWeight: 600 }}
                        >
                          Bị từ chối
                        </span>
                      ) : (
                        <span className={LOP_TAG[DE_NGHI_TONE[r.status]]}>
                          {DE_NGHI_NHAN[r.status]}
                        </span>
                      )}
                    </td>
                    <td title={r.rejected_reason ?? r.cancel_reason ?? undefined}>
                      {dangO(r.status, r.bi_tu_choi)}
                      {r.bi_tu_choi && r.rejected_reason && (
                        <span className="kh-stop" style={{ fontWeight: 400 }}>
                          {' '}
                          · “{r.rejected_reason}”
                        </span>
                      )}
                      {r.status === 'cancelled' && r.cancel_reason && (
                        <span className="kh-mut"> · huỷ: {r.cancel_reason}</span>
                      )}
                      {r.need_by && r.status !== 'done' && r.status !== 'cancelled' && (
                        <span className="kh-mut"> · cần trước {isoToVn(r.need_by)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hep ? 3 : 4}>{hien.length} phiếu</td>
                <td className="r kh-num">{fmt(tong)}</td>
                <td colSpan={2} style={{ fontWeight: 400 }}>
                  Dự kiến = SL × đơn giá Kho ghi + VAT từng dòng + vận chuyển; dòng chưa
                  có giá không cộng
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left="Enter / bấm đúp mở phiếu · lãnh đạo duyệt trên hệ thống, Kho mua rồi nhập kho theo phiếu đã duyệt"
        right={
          <b>
            {hien.length} / {rows.length} phiếu
          </b>
        }
      />
    </KhoKhung>
  )
}
