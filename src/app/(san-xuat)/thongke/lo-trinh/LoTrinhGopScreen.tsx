'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { isUnshaped, needsRoute, type ShapingRow } from '@/lib/shaping-status'
import type { DinhHinhProps } from '../lsx/[id]/dinh-hinh/dinh-hinh.shared'
import { LoTrinhLenh } from '../lsx/[id]/dinh-hinh/lo-trinh-lenh'
import { useDinhHinh } from '../lsx/[id]/dinh-hinh/useDinhHinh'
import { BangLenh } from './bang-lenh'

export type LoTrinhGopProps = {
  rows: ShapingRow[]
  canEdit: boolean
  /** Lệnh đang mở (dữ liệu đủ cho hook); null = đang ở danh sách. */
  lenh: DinhHinhProps | null
  /** ‹ › giữa các lệnh còn cụm chưa khai: vị trí 1-based và hai id kề. */
  nav: { pos: number; total: number; prev: string | null; next: string | null } | null
  /** Bảng chi tiết vừa tự nạp lúc mở (lệnh cũ có định mức mà chưa có bảng). */
  autoNap: { added: number; missing: string[] } | null
}

/**
 * LỘ TRÌNH CÔNG ĐOẠN — bản vẽ 3 (04/11/2026, chủ dự án: "rất khó nhìn, không
 * muốn các thanh cuộn trái phải"): KHÔNG cột trái, KHÔNG khung cuộn con. Không
 * có `?lsx=` thì là bảng danh sách khuôn C; có thì là ma trận MỘT lệnh trọn chiều
 * ngang, đổi lệnh bằng ô chọn + ‹ › ngay trên đầu. Bảng chi tiết (định mức Kỹ
 * thuật) tự có, không phải bước ở đây.
 */
export function LoTrinhGopScreen(props: LoTrinhGopProps) {
  if (!props.lenh) {
    const can = props.rows.filter(needsRoute).length
    return (
      <SxKhung bare label="Lộ trình công đoạn">
        <div className="sx-body">
          <DauTrang
            crumb="Sản xuất › 2 · Kế hoạch chuẩn bị"
            title="Lộ trình công đoạn"
            ctx={
              <>
                <b>{props.rows.length}</b> lệnh đang chạy · <b>{can}</b> còn cụm chưa khai
              </>
            }
          />
          {props.rows.length === 0 ? (
            <Rong
              tieuDe="Không có lệnh nào đang chạy"
              lyDo="Chỉ lệnh đã duyệt hoặc đang chạy mới cần khai lộ trình."
              tiep={
                <Link href="/thongke/lenh" className="lnk">
                  Xem Lệnh sản xuất
                </Link>
              }
            />
          ) : (
            <BangLenh rows={props.rows} canEdit={props.canEdit} />
          )}
          <ThanhTT
            left="Chỉ lệnh đã duyệt / đang chạy"
            right="production_components.stages"
          />
        </div>
      </SxKhung>
    )
  }
  return <MotLenh key={props.lenh.lsx.id} {...props} lenh={props.lenh} />
}

function MotLenh({
  rows,
  lenh,
  nav,
  autoNap,
}: Omit<LoTrinhGopProps, 'lenh'> & { lenh: DinhHinhProps }) {
  const router = useRouter()
  const d = useDinhHinh(lenh)
  const { p, editable } = d
  const khaiRieng = d.rows.filter((r) => r.kind === 'assembly' && r.stages != null).length
  const theoNhom = d.nCum - khaiRieng
  const thieuDinhMuc = p.orderLines.filter((l) => !l.has_profile)
  const chuaCoDong = p.orderLines.filter((l) => (d.byLine.get(l.id) ?? []).length === 0)
  const luuWhy = d.luuWhy
  const dmy = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      : '—'
  const row = rows.find((r) => r.lsx.id === p.lsx.id)
  const tinhTrang = (r: ShapingRow) =>
    needsRoute(r)
      ? `${r.cluster_unrouted}/${r.cluster_count} cụm chưa khai`
      : isUnshaped(r)
        ? r.lines_missing_bom > 0
          ? 'chờ Kỹ thuật'
          : 'chưa nạp bảng'
        : 'xong'

  return (
    <SxKhung bare label={`Lộ trình công đoạn ${p.lsx.code}`}>
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất › Lộ trình công đoạn"
          title={p.lsx.code}
          ctx={
            <>
              {p.lsx.customer_name} · <b>{p.orderLines.length}</b> dòng SP · bảng chi tiết{' '}
              <b>{d.rows.length}</b> dòng · <b>{d.nCum}</b> cụm
              {row?.lsx.ship_date && (
                <>
                  {' '}
                  · hạn xuất <b>{dmy(row.lsx.ship_date)}</b>
                </>
              )}
            </>
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/thongke/lo-trinh">‹ Danh sách</ApNut>
                <ApNut href={`/thongke/lsx/${p.lsx.id}/dinh-hinh`}>Bảng chi tiết ↗</ApNut>
                <ApNut href={`/thongke/lsx/${p.lsx.id}`}>Hồ sơ lệnh</ApNut>
              </ApNhom>
              <ApNhom>
                <ApNut primary onClick={d.save} why={luuWhy} busy={d.busy}>
                  Lưu lộ trình
                </ApNut>
              </ApNhom>
            </>
          }
        />

        <div className="sx-hc">
          <label className="c">
            Lệnh
            <select
              value={p.lsx.id}
              onChange={(e) => router.push(`/thongke/lo-trinh?lsx=${e.target.value}`)}
              aria-label="Chọn lệnh"
              style={{ minWidth: 260 }}
            >
              {rows.map((r) => (
                <option key={r.lsx.id} value={r.lsx.id}>
                  {r.lsx.code} · {r.lsx.customer_name} · {tinhTrang(r)}
                </option>
              ))}
            </select>
          </label>
          {nav && nav.total > 0 && (
            <span className="c">
              {nav.prev ? (
                <Link href={`/thongke/lo-trinh?lsx=${nav.prev}`} className="lnk">
                  ‹ trước
                </Link>
              ) : (
                <span className="mut">‹ trước</span>
              )}
              <span className="mut">
                còn cụm chưa khai:{' '}
                <b>{nav.pos > 0 ? `${nav.pos}/${nav.total}` : nav.total}</b>
              </span>
              {nav.next ? (
                <Link href={`/thongke/lo-trinh?lsx=${nav.next}`} className="lnk">
                  sau ›
                </Link>
              ) : (
                <span className="mut">sau ›</span>
              )}
            </span>
          )}
          <label className="c">
            SP
            <select
              value={d.spLoc}
              onChange={(e) => d.setSpLoc(e.target.value)}
              aria-label="Lọc SP"
            >
              <option value="">tất cả</option>
              {p.orderLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.product_code}
                </option>
              ))}
            </select>
          </label>
          <span className="sp mut">
            <b style={{ color: 'var(--sx-ink)' }}>✓</b> khai riêng lệnh ·{' '}
            <b style={{ color: '#8d96a5' }}>✓</b> theo hồ sơ SP / nhóm · ô trống = ngoài
            lộ trình, bấm để thêm · = bậc chi tiết
          </span>
        </div>

        {autoNap && autoNap.added > 0 && (
          <div className="sx-note ok">
            <b>Bảng chi tiết đã tự nạp từ định mức Kỹ thuật lúc mở:</b> {autoNap.added}{' '}
            dòng. Mọi cụm đang chạy theo mặc định nhóm vật tư — đánh ✓ chỗ nào khác mặc
            định rồi Lưu.
          </div>
        )}
        {p.lockedByEntries && !p.lsxClosed && (
          <div className="sx-note stop">
            <b>Lệnh đã có {p.pbsCount} phiếu sản lượng — lộ trình khoá.</b> Đổi lộ trình
            khi đã có số là sổ mất chỗ bám: xoá phiếu ở Hồ sơ lệnh › Phiếu rồi mới sửa. Ma
            trận chỉ để tra cứu.
          </div>
        )}
        {p.lsxClosed && (
          <div className="sx-note">
            <b>Lệnh đã kết thúc</b> — ma trận chỉ để tra cứu.
          </div>
        )}
        {chuaCoDong.length > 0 && (
          <div className="sx-note">
            <b>
              {chuaCoDong.length}/{p.orderLines.length} SP chưa có cụm để khai
            </b>
            {thieuDinhMuc.length > 0 ? (
              <>
                {' '}
                — {thieuDinhMuc.map((l) => l.product_code).join(', ')} chờ Kỹ thuật nạp
                định mức. Kỹ thuật xong thì mở lại màn này là có. Không gõ tay ở đây: bảng
                chi tiết là của Kỹ thuật.
              </>
            ) : (
              <>
                {' '}
                — hồ sơ có định mức nhưng bảng chưa nạp; mở “Bảng chi tiết ↗” bấm Nạp từ
                BOM.
              </>
            )}
          </div>
        )}
        {d.loi && <div className="sx-err">{d.loi}</div>}
        {d.thongBao && !d.loi && (
          <div className="sx-note ok">
            {d.thongBao}
            <button type="button" className="lnk mut" onClick={() => d.setThongBao(null)}>
              Đóng
            </button>
          </div>
        )}

        {d.rows.length > 0 ? (
          <LoTrinhLenh d={d} />
        ) : (
          <Rong
            tieuDe="Lệnh chưa có bảng chi tiết"
            lyDo={
              thieuDinhMuc.length
                ? `${thieuDinhMuc.map((l) => l.product_code).join(', ')} chờ Kỹ thuật nạp định mức — chưa có cụm để khai.`
                : 'Hồ sơ SP có định mức nhưng bảng chưa nạp vào lệnh.'
            }
            tiep={
              <Link href={`/thongke/lsx/${p.lsx.id}/dinh-hinh`} className="sx-btn">
                Mở Bảng chi tiết của lệnh
              </Link>
            }
          />
        )}

        {editable && d.rows.length > 0 && (
          <div className="sx-cb">
            <span className="sum">
              {d.dirty ? (
                <>
                  Sắp lưu <b>{khaiRieng}</b> cụm khai riêng · <b>{theoNhom}</b> cụm giữ
                  theo nhóm
                </>
              ) : d.nCum === 0 ? (
                'BOM phẳng — không có cụm để khai, cụm mặc nhiên lo'
              ) : (
                'Chưa đổi gì — cụm theo nhóm vật tư vẫn ghi sổ được; chỉ khai khi khác mặc định'
              )}
            </span>
            {luuWhy && luuWhy !== 'Chưa đổi gì' && (
              <span className="blk">Chưa lưu được: {luuWhy}</span>
            )}
            <span className="sp">
              {khaiRieng > 0 && (
                <label
                  className="sx-ck"
                  title="Hồ sơ SP nhận lộ trình cụm theo bản này — bỏ tick khi lệnh là ngoại lệ một lần"
                >
                  <input
                    type="checkbox"
                    checked={d.syncProfile}
                    onChange={(e) => d.setSyncProfile(e.target.checked)}
                  />
                  Cập nhật lộ trình cụm vào hồ sơ SP
                </label>
              )}
              <button
                type="button"
                className="sx-btn p"
                onClick={d.save}
                disabled={!!luuWhy || d.busy}
                aria-busy={d.busy || undefined}
              >
                {d.busy ? 'Đang lưu…' : 'Lưu lộ trình'}
              </button>
            </span>
          </div>
        )}
        <ThanhTT
          left={
            p.lsxClosed
              ? 'Lệnh đã kết thúc'
              : p.lockedByEntries
                ? `Khoá vì đã có ${p.pbsCount} phiếu PBS`
                : 'Lệnh chưa có sổ — còn sửa được; có phiếu PBS đầu tiên là khoá'
          }
          right="production_components.stages · bước 3: Giao tổ & hạn"
        />
      </div>
    </SxKhung>
  )
}
