'use client'

import './kiem-ke.css'
import { useRef, useState, type KeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, ClipboardCheck, ListChecks, XCircle } from 'lucide-react'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { useBeRong } from '@/lib/use-be-rong'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  Rong,
  TabNgang,
  ThanhTT,
  type TabMuc,
} from '../_erp/khung'
import { HopLyDo } from '../de-nghi/huy-phieu'
import { MoDotHop } from './mo-dot'
import {
  RO_DOT,
  RO_DOT_NHAN,
  TRANG_THAI,
  huyDuoc,
  thuocRo,
  type DotRow,
  type RoDot,
} from './kiem-ke.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN')
const gio = (iso: string) => {
  const d = new Date(iso)
  const hh = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) // prettier-ignore
  return `${isoToVn(todayVn(d)).slice(0, 5)} ${hh}`
}

const RO_MAU: Record<RoDot, { mau: string; tone: TabMuc['tone'] }> = {
  lam: { mau: 'c-kiem', tone: 'warn' },
  cho: { mau: 'c-warn', tone: 'warn' },
  xong: { mau: 'c-ok', tone: 'mut' },
  huy: { mau: 'c-mut', tone: 'mut' },
  all: { mau: 'c-mut', tone: 'mut' },
}

/**
 * SỔ ĐỢT KIỂM KÊ — khuôn C (Kho B7a, bản vẽ KK-1 duyệt 19/10/2026). Câu màn trả
 * lời: đợt kiểm kê nào đang dở, ở bước nào, ai đếm.
 *
 * Đếm mù được giữ ở server: sổ không bày số lệch / tiền khi đợt đang đếm.
 * Phiếu đếm và màn đối chiếu là B7b / B7c.
 */
export function KiemKeScreen({
  rows,
  roUrl,
  canManage,
  laAdmin,
  userId,
}: {
  rows: DotRow[]
  roUrl: RoDot | null
  canManage: boolean
  laAdmin: boolean
  userId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const macDinh: RoDot = rows.some((r) => thuocRo(r, 'lam'))
    ? 'lam'
    : rows.some((r) => thuocRo(r, 'cho'))
      ? 'cho'
      : 'all'
  const ro = roUrl ?? macDinh
  const [chon, setChon] = useState<string | null>(null)
  const [mo, setMo] = useState<'mo' | 'huy' | null>(null)
  const [bao, setBao] = useState<string | null>(null)
  // Luật màn hẹp của Kho: ẩn cột bậc thấp thay vì cuộn ngang (điện thoại 375px: bảng từng rộng 852px).
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 760

  const hien = rows.filter((r) => thuocRo(r, ro))
  const sel = hien.find((r) => r.id === chon) ?? null
  const dem = (x: RoDot) => rows.filter((r) => thuocRo(r, x)).length

  const khongQuyen = canManage ? null : 'Chỉ phòng Kho mở / huỷ được đợt kiểm kê'
  const lyDoHuy = !sel
    ? 'Chọn một đợt trong bảng trước'
    : !huyDuoc(sel.status)
      ? sel.status === 'approved'
        ? 'Đợt đã duyệt — sai thì đảo phiếu KK ở Sổ phiếu, không huỷ đợt'
        : 'Đợt đã huỷ'
      : !laAdmin && sel.created_by !== userId
        ? 'Chỉ người mở đợt hoặc quản trị viên huỷ được'
        : null

  const doiRo = (x: RoDot) => {
    setChon(null)
    router.push(x === macDinh ? pathname : `${pathname}?ro=${x}`, { scroll: false })
  }
  /** Enter mở phiếu đếm; Space chỉ chọn dòng (để bấm nút ở Action Pane). */
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      router.push(`/warehouse/kiem-ke/${id}`)
    } else if (e.key === ' ') {
      e.preventDefault()
      setChon(id)
    }
  }
  const xong = (cau: string) => {
    setMo(null)
    setChon(null)
    setBao(cau)
    router.refresh()
  }

  return (
    <KhoKhung label="Kiểm kê">
      <DauTrang
        title="Kiểm kê"
        ctx="đếm mù · sổ chốt lúc bắt đầu đếm"
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<ClipboardCheck size={15} aria-hidden />}
                onClick={() => setMo('mo')}
                why={khongQuyen}
              >
                Mở đợt kiểm kê
              </ApNut>
              <ApNut
                icon={<XCircle size={15} aria-hidden />}
                onClick={() => setMo('huy')}
                why={khongQuyen ?? lyDoHuy}
              >
                {sel ? `Huỷ ${sel.code}` : 'Huỷ đợt'}
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut
                icon={<ListChecks size={15} aria-hidden />}
                href={sel ? `/warehouse/kiem-ke/${sel.id}` : undefined}
                why={sel ? null : 'Chọn một đợt trong bảng trước'}
              >
                {sel?.status === 'counting' ? 'Đếm tiếp' : 'Mở phiếu đếm'}
              </ApNut>
              <ApNut icon={<BookOpen size={15} aria-hidden />} href="/warehouse/phieu">
                Sổ phiếu
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <TabNgang
        label="Đợt kiểm kê theo trạng thái"
        tabs={RO_DOT.map((x) => ({
          key: x,
          label: RO_DOT_NHAN[x],
          on: ro === x,
          onClick: () => doiRo(x),
          n: dem(x),
          tone: RO_MAU[x].tone,
          mau: RO_MAU[x].mau,
        }))}
      />

      {bao && (
        <div className="kh-note ok" role="status">
          <span className="tag">Xong</span>
          <span>{bao}</span>
          <button
            type="button"
            className="dong"
            onClick={() => setBao(null)}
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {hien.length === 0 ? (
        rows.length === 0 ? (
          <Rong
            tieuDe="Chưa có đợt kiểm kê nào"
            lyDo="Kiểm kê so số trên máy với hàng ngoài kệ. Nên ghi xuất cho các lệnh trước, rồi đếm luân phiên vài nhóm mỗi cuối tháng."
            tiep={
              canManage ? (
                <button type="button" className="kh-btn p" onClick={() => setMo('mo')}>
                  Mở đợt kiểm kê
                </button>
              ) : undefined
            }
          />
        ) : (
          <Rong
            tieuDe={`Không có đợt nào ở “${RO_DOT_NHAN[ro]}”`}
            lyDo={`Sổ có ${fmt(rows.length)} đợt ở các trạng thái khác.`}
            tiep={
              <button type="button" className="kh-btn" onClick={() => doiRo('all')}>
                Xem tất cả đợt
              </button>
            }
          />
        )
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Sổ đợt kiểm kê">
            {hep ? (
              <colgroup>
                <col style={{ width: 118 }} />
                <col />
                <col style={{ width: 74 }} />
              </colgroup>
            ) : (
              <colgroup>
                <col style={{ width: 128 }} />
                <col />
                <col style={{ width: 104 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 200 }} />
              </colgroup>
            )}
            <thead>
              {hep ? (
                <tr>
                  <th>Đợt</th>
                  <th>Phạm vi · người đếm</th>
                  <th className="r">Đã đếm</th>
                </tr>
              ) : (
                <tr>
                  <th>Đợt</th>
                  <th>Phạm vi</th>
                  <th>Trạng thái</th>
                  <th>Người đếm</th>
                  <th>Sổ chốt lúc</th>
                  <th className="r">Đã đếm</th>
                  <th>Kết quả</th>
                </tr>
              )}
            </thead>
            <tbody>
              {hien.map((r) => {
                const tt = TRANG_THAI[r.status]
                const on = r.id === chon
                const pham =
                  r.scope_kind === 'group'
                    ? r.nhom.join(' · ')
                    : r.scope_kind === 'bin'
                      ? 'Theo khu kệ'
                      : 'Danh sách mã'
                return (
                  <tr
                    key={r.id}
                    className={on ? 'd on' : 'd'}
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => setChon(r.id)}
                    onDoubleClick={() => router.push(`/warehouse/kiem-ke/${r.id}`)}
                    onKeyDown={(e) => phim(e, r.id)}
                  >
                    <td className="kh-ma">
                      {r.code}
                      {hep && (
                        <span style={{ display: 'block' }}>
                          <span className={tt.lop}>{tt.nhan}</span>
                        </span>
                      )}
                    </td>
                    <td title={pham} style={hep ? { whiteSpace: 'normal' } : undefined}>
                      {pham} <span className="kh-mut">· {fmt(r.scope_count)} mã</span>
                      {hep && (
                        <span
                          className="kh-mut"
                          style={{ display: 'block', fontSize: 11.5 }}
                        >
                          {r.nguoi_dem ?? 'chưa phân người đếm'}
                          {r.freeze_at ? ` · chốt ${gio(r.freeze_at)}` : ''}
                        </span>
                      )}
                    </td>
                    {!hep && (
                      <td>
                        <span className={tt.lop}>{tt.nhan}</span>
                      </td>
                    )}
                    {!hep && (
                      <td className={r.nguoi_dem ? undefined : 'kh-empty'}>
                        {r.nguoi_dem ?? 'chưa phân'}
                      </td>
                    )}
                    {!hep && (
                      <td className={r.freeze_at ? 'kh-num' : 'kh-mut'}>
                        {r.freeze_at ? gio(r.freeze_at) : 'chưa chốt'}
                      </td>
                    )}
                    <td className="r kh-num">
                      {r.tong === 0 ? (
                        <span className="kh-empty">·</span>
                      ) : (
                        <>
                          {!hep && (
                            <span className="kh-bar" aria-hidden>
                              <i
                                style={{
                                  width: `${Math.round((r.da_dem / r.tong) * 100)}%`,
                                }}
                              />
                            </span>
                          )}
                          {fmt(r.da_dem)}/{fmt(r.tong)}
                        </>
                      )}
                    </td>
                    {!hep && (
                      <td title={r.reject_reason ?? undefined}>
                        {r.status === 'approved' && r.doc_code ? (
                          <span className="kh-num">phiếu {r.doc_code}</span>
                        ) : r.reject_reason ? (
                          <span className="kh-mut">{r.status === 'cancelled' ? 'Huỷ: ' : 'Trả về: '}{r.reject_reason}</span> // prettier-ignore
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

      <ThanhTT
        left="Enter / bấm đúp mở phiếu đếm · số lệch và tiền chỉ hiện sau khi gửi đối chiếu (đếm mù)"
        right={
          <>
            <b>{fmt(hien.length)}</b> / {fmt(rows.length)} đợt
          </>
        }
      />

      {mo === 'mo' && <MoDotHop onClose={() => setMo(null)} onDone={xong} />}
      {mo === 'huy' && sel && (
        <HopLyDo
          title={`Huỷ đợt ${sel.code}`}
          subtitle="Chỉ đổi trạng thái đợt — tồn kho không đổi. Đợt ở lại sổ với lý do."
          route={`/api/dept/warehouse/stocktakes/${sel.id}/cancel`}
          nhanNut="Huỷ đợt"
          nhanO="Lý do huỷ đợt"
          placeholder="VD: mở nhầm nhóm · chờ Kho ghi xuất xong mới đếm"
          onClose={() => setMo(null)}
          onDone={() => xong(`Đã huỷ ${sel.code} — đợt vẫn ở lại sổ với lý do.`)}
        />
      )}
    </KhoKhung>
  )
}
