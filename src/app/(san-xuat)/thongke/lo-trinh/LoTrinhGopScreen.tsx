'use client'

import Link from 'next/link'
import { useRouterBao } from '@/lib/tai-trang'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import {
  componentRoute,
  isNgoaiKhung,
  isPurchasedGroup,
  routeForGroup,
} from '@/lib/stage-route'
import { shortStageLabel } from '@/lib/stage-config'
import { isUnshaped, needsRoute, type ShapingRow } from '@/lib/shaping-status'
import type { DinhHinhProps, OrderLine } from '../lsx/[id]/dinh-hinh/dinh-hinh.shared'
import { cx, fmt } from '../lsx/[id]/dinh-hinh/dinh-hinh.shared'
import { LoTrinhLenh } from '../lsx/[id]/dinh-hinh/lo-trinh-lenh'
import { KhoaGiao, nhanKhoa, PhieuKhoa } from '../lsx/[id]/dinh-hinh/phieu-khoa'
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
  /** id dòng lệnh → bộ đồng bộ đã xong (cùng hàm Hồ sơ lệnh). */
  daXong: Record<string, number>
  /** Ngày hôm nay (ISO, giờ VN) từ server — tính "còn n ngày" mà không gọi Date.now() trong render. */
  today: string
}

/**
 * LỘ TRÌNH CÔNG ĐOẠN — bản vẽ 4 (04/11/2026): chọn LỆNH → chọn SẢN PHẨM → dải
 * thông tin SP (tên, phải làm, hạn, cụm, chi tiết, định mức, lộ trình hiệu lực)
 * + ma trận của riêng SP đó. Bản nháp giữ cho cả lệnh: đổi SP không mất thay
 * đổi, Lưu ghi một lượt. Không `?lsx=` thì là bảng danh sách khuôn C.
 */
export function LoTrinhGopScreen(props: LoTrinhGopProps) {
  if (!props.lenh) {
    const can = props.rows.filter(needsRoute).length
    return (
      <SxKhung bare label="Lộ trình công đoạn">
        <div className="sx-body">
          <DauTrang
            crumb="Sản xuất › Kế hoạch chuẩn bị"
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
          <ThanhTT left="Chỉ lệnh đã duyệt / đang chạy" />
        </div>
      </SxKhung>
    )
  }
  return <MotLenh key={props.lenh.lsx.id} {...props} lenh={props.lenh} />
}

type TrangThaiSp = 'can' | 'khai' | 'phang' | 'chuanap' | 'choKT'

function MotLenh({
  rows,
  lenh,
  nav,
  autoNap,
  daXong,
  today,
}: Omit<LoTrinhGopProps, 'lenh'> & { lenh: DinhHinhProps }) {
  const router = useRouterBao()
  const d = useDinhHinh(lenh)
  const { p, editable } = d
  const row = rows.find((r) => r.lsx.id === p.lsx.id)
  const dmy = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      : '—'
  const conNgay = (iso: string | null) =>
    iso
      ? Math.ceil((new Date(iso).getTime() - new Date(today).getTime()) / 86_400_000)
      : null

  // ── Tình trạng từng SP (cùng luật với danh sách lệnh / badge) ────────────
  const allRows = (id: string) => d.byLine.get(id) ?? []
  const trangThai = (l: OrderLine): TrangThaiSp => {
    const rs = allRows(l.id)
    if (rs.length === 0) return l.has_profile ? 'chuanap' : 'choKT'
    const cum = rs.filter((r) => r.kind === 'assembly')
    if (cum.length === 0) return 'phang'
    return cum.some((r) => r.stages == null) ? 'can' : 'khai'
  }
  const nhan: Record<TrangThaiSp, { dot: string; text: string }> = {
    can: { dot: 'w', text: 'chưa khai' },
    khai: { dot: 'g', text: 'đã khai' },
    phang: { dot: 'm', text: 'BOM phẳng' },
    chuanap: { dot: 'm', text: 'chưa nạp bảng' },
    choKT: { dot: 'w', text: 'chờ Kỹ thuật' },
  }
  const thuTu: Record<TrangThaiSp, number> = {
    can: 0,
    khai: 1,
    phang: 2,
    chuanap: 3,
    choKT: 4,
  }
  const spSorted = [...p.orderLines].sort(
    (a, b) => thuTu[trangThai(a)] - thuTu[trangThai(b)],
  )
  const sp = p.orderLines.find((l) => l.id === d.spLoc) ?? spSorted[0] ?? null
  const spIdx = sp ? spSorted.findIndex((l) => l.id === sp.id) : -1
  const chonSp = (id: string) => {
    d.setSpLoc(id)
    // Chỉ đổi URL để chia sẻ được — KHÔNG gọi router: đổi SP là việc client,
    // tải lại server mỗi lần là 1–2 s chờ vô ích (hồ sơ lệnh, định mức…).
    window.history.replaceState(null, '', `/thongke/lo-trinh?lsx=${p.lsx.id}&sp=${id}`)
  }
  const spTruoc = spIdx > 0 ? spSorted[spIdx - 1] : null
  const spSau = spIdx >= 0 && spIdx < spSorted.length - 1 ? spSorted[spIdx + 1] : null

  // ── Dải thông tin SP đang chọn ───────────────────────────────────────────
  const rs = sp ? allRows(sp.id) : []
  const cum = rs.filter((r) => r.kind === 'assembly')
  const cumChua = cum.filter((r) => r.stages == null).length
  const trongCum = rs.filter((r) => r.kind === 'part' && r.cluster.trim()).length
  // Ngoài khung (gỗ, nệm…) tách khỏi hàng mua (bản vẽ 15/11 QR43i6tr…, Q1): TB0182HG-AL
  // từng ghi "33 ngũ kim" trong khi 9 dòng là chi tiết gỗ.
  const ngoai = rs.filter(
    (r) => r.kind === 'part' && !r.cluster.trim() && isNgoaiKhung(r.group_code || null),
  ).length
  const mua = rs.filter((r) => isPurchasedGroup(r.group_code || null)).length - ngoai
  const roi = rs.length - cum.length - trongCum - mua - ngoai
  const tt = sp ? trangThai(sp) : null
  const order = new Map(p.stageCfg.map((s, i) => [s.code, i]))
  const hieuLuc = [
    ...new Set(
      rs.flatMap((r) =>
        componentRoute(undefined, {
          group_code: r.group_code || null,
          stages: r.stages,
          first_stage: r.first_stage,
          final_stage: r.final_stage,
        }),
      ),
    ),
  ]
    .filter((c) => order.has(c))
    .sort((a, b) => order.get(a)! - order.get(b)!)
  const labelOf = (c: string) =>
    shortStageLabel(p.stageCfg.find((s) => s.code === c)?.label ?? c)

  // ── Thanh chốt: cụm đổi so với lúc mở, đếm theo SP ───────────────────────
  const gocStages = new Map(p.initialRows.map((r, i) => [`r${i + 1}`, r.stages ?? null]))
  const same = (a: string[] | null, b: string[] | null) =>
    a === b ||
    (a != null && b != null && a.length === b.length && a.every((s, i) => s === b[i]))
  const cumDoi = d.rows.filter(
    (r) => r.kind === 'assembly' && !same(r.stages, gocStages.get(r.key) ?? null),
  )
  // Chi tiết rời đổi lộ trình (khung rời + ngoài khung, 15/11/2026): so lộ trình
  // HIỆU LỰC — bỏ tick rồi tick lại không tính là đổi.
  const hieuLucCua = (r: (typeof d.rows)[number], st: string[] | null) =>
    st && st.length ? st : routeForGroup(r.group_code || null)
  const ctDoi = d.rows.filter((r) => {
    if (r.kind !== 'part') return false
    const a = hieuLucCua(r, r.stages)
    const b = hieuLucCua(r, gocStages.get(r.key) ?? null)
    return a.length !== b.length || a.some((x) => !b.includes(x))
  })
  const spDoi = new Set([...cumDoi, ...ctDoi].map((r) => r.production_order_line_id)).size
  const luuWhy = d.luuWhy

  return (
    <SxKhung bare label={`Lộ trình công đoạn ${p.lsx.code}`}>
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất › Lộ trình công đoạn"
          title={p.lsx.code}
          ctx={
            <>
              {p.lsx.customer_name}
              {row?.lsx.ship_date && (
                <>
                  {' '}
                  · hạn xuất <b>{dmy(row.lsx.ship_date)}</b>
                </>
              )}{' '}
              · <b>{p.orderLines.length}</b> SP · <b>{d.nCum}</b> cụm ·{' '}
              <b>
                {d.rows.filter((r) => r.kind === 'assembly' && r.stages == null).length}
              </b>{' '}
              chưa khai
            </>
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/thongke/lo-trinh">‹ Danh sách lệnh</ApNut>
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
          <span className="lb">Lệnh</span>
          <label className="c">
            <select
              value={p.lsx.id}
              onChange={(e) => router.push(`/thongke/lo-trinh?lsx=${e.target.value}`)}
              aria-label="Chọn lệnh"
              style={{ width: 240 }}
            >
              {rows.map((r) => (
                <option key={r.lsx.id} value={r.lsx.id}>
                  {r.lsx.code} · {r.lsx.customer_name} ·{' '}
                  {needsRoute(r)
                    ? `${r.cluster_unrouted}/${r.cluster_count} cụm chưa khai`
                    : isUnshaped(r)
                      ? r.lines_missing_bom > 0
                        ? 'chờ Kỹ thuật'
                        : 'chưa nạp bảng'
                      : 'xong'}
                </option>
              ))}
            </select>
          </label>
          {nav && nav.total > 0 && (
            <span className="c">
              {nav.prev ? (
                <Link href={`/thongke/lo-trinh?lsx=${nav.prev}`} className="lnk">
                  ‹
                </Link>
              ) : (
                <span className="mut">‹</span>
              )}
              <span className="mut">
                còn cụm chưa khai{' '}
                <b>{nav.pos > 0 ? `${nav.pos}/${nav.total}` : nav.total}</b>
              </span>
              {nav.next ? (
                <Link href={`/thongke/lo-trinh?lsx=${nav.next}`} className="lnk">
                  ›
                </Link>
              ) : (
                <span className="mut">›</span>
              )}
            </span>
          )}
          <span className="sep" />
          <span className="lb">Sản phẩm</span>
          <label className="c">
            <select
              value={sp?.id ?? ''}
              onChange={(e) => chonSp(e.target.value)}
              aria-label="Chọn sản phẩm"
              style={{ width: 320 }}
            >
              {spSorted.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.product_code} · {l.product_name} · {fmt(l.qty)} {l.unit} ·{' '}
                  {nhan[trangThai(l)].text}
                </option>
              ))}
            </select>
          </label>
          <span className="c">
            {spTruoc ? (
              <button type="button" className="lnk" onClick={() => chonSp(spTruoc.id)}>
                ‹
              </button>
            ) : (
              <span className="mut">‹</span>
            )}
            <span className="mut">
              SP{' '}
              <b>
                {spIdx + 1}/{spSorted.length}
              </b>
              {tt && (
                <>
                  {' '}
                  · <i className={cx('sx-dot', nhan[tt].dot)} />
                  {nhan[tt].text}
                </>
              )}
            </span>
            {spSau ? (
              <button type="button" className="lnk" onClick={() => chonSp(spSau.id)}>
                ›
              </button>
            ) : (
              <span className="mut">›</span>
            )}
          </span>
        </div>

        {sp && (
          <div className="sx-fact">
            <div style={{ width: 300 }}>
              <span className="d">Sản phẩm</span>
              <span className="t" title={sp.product_name}>
                {sp.product_name}
              </span>
              <span className="s">
                <span className="ma">{sp.product_code}</span>
                {sp.group_title ? ` · ${sp.group_title}` : ''}
              </span>
            </div>
            <div>
              <span className="d">Phải làm</span>
              <span className="v">
                {fmt(sp.qty)} <small>{sp.unit}</small>
              </span>
              <span className="s">
                {daXong[sp.id] != null
                  ? `đã đồng bộ ${fmt(daXong[sp.id])} bộ`
                  : 'chưa có sổ'}
              </span>
            </div>
            <div>
              <span className="d">Hạn xuất</span>
              <span className="v">{dmy(row?.lsx.ship_date ?? null)}</span>
              <span className="s">
                {(() => {
                  const n = conNgay(row?.lsx.ship_date ?? null)
                  return n == null ? '—' : n < 0 ? `quá hạn ${-n} ngày` : `còn ${n} ngày`
                })()}
              </span>
            </div>
            <div>
              <span className="d">Cụm</span>
              <span className={cx('v', cumChua > 0 && 'w')}>
                {cum.length}
                {cum.length > 0 && (
                  <small> {cumChua > 0 ? `${cumChua} chưa khai` : 'đã khai'}</small>
                )}
                {cum.length === 0 && rs.length > 0 && <small> BOM phẳng</small>}
              </span>
              <span className="s" title={cum.map((r) => r.cluster || r.name).join(' · ')}>
                {cum.length
                  ? cum.map((r) => r.cluster || r.name).join(' · ')
                  : 'cụm mặc nhiên lo'}
              </span>
            </div>
            <div>
              <span className="d">Chi tiết</span>
              <span className="v">{rs.length}</span>
              <span className="s">
                {rs.length
                  ? [
                      trongCum > 0 && `${trongCum} trong cụm`,
                      roi > 0 && `${roi} rời`,
                      ngoai > 0 && `${ngoai} ngoài khung`,
                      mua > 0 && `${mua} hàng mua`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : '—'}
              </span>
            </div>
            <div>
              <span className="d">Định mức Kỹ thuật</span>
              <span className={cx('v', 'txt', tt === 'choKT' && 'w')}>
                {tt === 'choKT' ? (
                  <>
                    <i className="sx-dot w" />
                    chưa có — chờ Kỹ thuật nạp
                  </>
                ) : tt === 'chuanap' ? (
                  <>
                    <i className="sx-dot m" />
                    có, bảng chưa nạp vào lệnh
                  </>
                ) : (
                  <>
                    <i className="sx-dot g" />
                    có · {rs.length} dòng
                  </>
                )}
              </span>
              <span className="s" title={hieuLuc.map(labelOf).join(' → ')}>
                {hieuLuc.length
                  ? `lộ trình hiệu lực: ${hieuLuc.map(labelOf).join(' → ')}`
                  : tt === 'choKT'
                    ? 'Kỹ thuật nạp xong thì mở lại là có cụm · không gõ tay ở đây'
                    : 'mở “Bảng chi tiết ↗” bấm Nạp từ BOM'}
              </span>
            </div>
          </div>
        )}

        {autoNap && autoNap.added > 0 && (
          <div className="sx-note ok">
            <b>Bảng chi tiết đã tự nạp từ định mức Kỹ thuật lúc mở:</b> {autoNap.added}{' '}
            dòng. Mọi cụm đang chạy theo mặc định nhóm vật tư — đánh ✓ chỗ nào khác mặc
            định rồi Lưu.
          </div>
        )}
        {p.lockedByEntries && !p.lsxClosed && (
          <div className="sx-note stop">
            {/* MỘT span: .sx-note là flex, mỗi mảnh chữ / link thành một ô riêng. */}
            <span>
              <b>Lộ trình khoá.</b>{' '}
              {p.pbsCount > 0 && (
                <>
                  Lệnh đã có {p.pbsCount} phiếu sản lượng
                  <PhieuKhoa nos={p.pbsNos ?? []} /> — đổi lộ trình khi đã có số là sổ mất
                  chỗ bám: xoá các phiếu đó ở Sổ theo ngày (bấm mã phiếu; sổ ngày đã chốt
                  thì mở chốt ở Sổ ngày trước) rồi mới sửa.{' '}
                </>
              )}
              <KhoaGiao nos={p.pgtNos ?? []} />
              Ma trận chỉ để tra cứu.
            </span>
          </div>
        )}
        {p.lsxClosed && (
          <div className="sx-note">
            <b>Lệnh đã kết thúc</b> — ma trận chỉ để tra cứu.
          </div>
        )}
        {d.loi && <div className="sx-err">{d.loi}</div>}
        {d.thongBao && !d.loi && (
          <div className="sx-note ok">
            <span>
              {d.thongBao}
              {d.taiLai && <span className="mut"> · đang cập nhật lộ trình…</span>}
            </span>
            <button type="button" className="lnk mut" onClick={() => d.setThongBao(null)}>
              Đóng
            </button>
          </div>
        )}

        {sp ? (
          <LoTrinhLenh d={d} />
        ) : (
          <Rong
            tieuDe="Lệnh chưa có dòng sản phẩm"
            lyDo="Soạn dòng lệnh trước rồi mới có gì để khai lộ trình."
            tiep={
              <Link href={`/thongke/lsx/${p.lsx.id}`} className="sx-btn">
                Về hồ sơ lệnh
              </Link>
            }
          />
        )}

        {editable && d.rows.length > 0 && (
          <div className="sx-cb">
            <span className="sum">
              {cumDoi.length + ctDoi.length > 0 ? (
                <>
                  Sắp lưu{' '}
                  {cumDoi.length > 0 && (
                    <>
                      <b>{cumDoi.length}</b> cụm{ctDoi.length > 0 && ' + '}
                    </>
                  )}
                  {ctDoi.length > 0 && (
                    <>
                      <b>{ctDoi.length}</b> chi tiết rời
                    </>
                  )}{' '}
                  đổi ở <b>{spDoi}</b> SP
                  {ctDoi.length > 0 && (
                    <span className="mut"> · chi tiết rời chỉ áp cho lệnh này</span>
                  )}
                  {cumDoi.length > 0 && cumDoi.length <= 3 && (
                    <span className="mut">
                      {' '}
                      ({cumDoi.map((r) => r.cluster || r.name).join(', ')})
                    </span>
                  )}
                </>
              ) : d.dirty ? (
                'Có thay đổi chưa lưu'
              ) : cum.length === 0 && rs.length > 0 ? (
                'BOM phẳng — cụm mặc nhiên lo; bấm ô trên dòng nhóm để thêm công đoạn cho cả nhóm'
              ) : (
                'Chưa đổi gì — cụm theo nhóm vật tư vẫn ghi sổ được; chỉ khai khi khác mặc định'
              )}
            </span>
            {luuWhy && luuWhy !== 'Chưa đổi gì' && (
              <span className="blk">Chưa lưu được: {luuWhy}</span>
            )}
            <span className="sp">
              {cumDoi.length > 0 && (
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
                {d.taiLai ? 'Đang cập nhật…' : d.busy ? 'Đang lưu…' : 'Lưu lộ trình'}
              </button>
            </span>
          </div>
        )}
        <ThanhTT
          left={
            p.lsxClosed
              ? 'Lệnh đã kết thúc'
              : p.lockedByEntries
                ? `Khoá vì đã có ${nhanKhoa(p.pbsCount, p.pgtNos?.length ?? 0)}`
                : 'Lệnh chưa có sổ — còn sửa được; có phiếu PBS đầu tiên là khoá'
          }
          right="Bước tiếp: Giao tổ & hạn"
        />
      </div>
    </SxKhung>
  )
}
