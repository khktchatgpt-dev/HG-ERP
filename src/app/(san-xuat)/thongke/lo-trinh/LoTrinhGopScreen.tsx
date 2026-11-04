'use client'

import Link from 'next/link'
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
import { DanhSachLenh } from './danh-sach-lenh'

export type LoTrinhGopProps = {
  rows: ShapingRow[]
  /** Lệnh đang chọn (dữ liệu đủ cho hook); null = chưa chọn / không có lệnh. */
  lenh: DinhHinhProps | null
  /** Bảng chi tiết vừa tự nạp lúc mở (lệnh cũ có định mức mà chưa có bảng). */
  autoNap: { added: number; missing: string[] } | null
}

/**
 * LỘ TRÌNH CÔNG ĐOẠN — màn gộp (04/11/2026, bản vẽ
 * https://claude.ai/artifact/A4U5vgYDeUwYrnDUkzfCq1): một màn, một việc của Kế
 * hoạch. Trái: lệnh đang chạy, còn cụm chưa khai xếp trước. Phải: ma trận cụm ×
 * công đoạn của lệnh đang chọn, đánh x rồi Lưu; hồ sơ SP nhận theo. Bảng chi
 * tiết (định mức Kỹ thuật) tự có, không phải bước ở đây — thống kê sửa nó ở
 * Hồ sơ lệnh › Bảng chi tiết.
 */
export function LoTrinhGopScreen(props: LoTrinhGopProps) {
  const can = props.rows.filter(needsRoute).length
  const choKT = props.rows.filter(
    (r) => !needsRoute(r) && isUnshaped(r) && r.lines_missing_bom > 0,
  ).length
  return (
    <SxKhung bare label="Lộ trình công đoạn">
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất › 2 · Kế hoạch chuẩn bị"
          title="Lộ trình công đoạn"
          ctx={
            <>
              <b>{props.rows.length}</b> lệnh đang chạy · <b>{can}</b> còn cụm chưa khai ·{' '}
              <b>{choKT}</b> chờ Kỹ thuật
            </>
          }
        />
        <div className="sx-two ds">
          <DanhSachLenh rows={props.rows} selected={props.lenh?.lsx.id ?? null} />
          {props.lenh ? (
            <Phai key={props.lenh.lsx.id} lenh={props.lenh} autoNap={props.autoNap} />
          ) : (
            <div>
              <Rong
                tieuDe={
                  props.rows.length
                    ? 'Chọn một lệnh bên trái'
                    : 'Không có lệnh nào đang chạy'
                }
                lyDo={
                  props.rows.length
                    ? 'Lệnh còn cụm chưa khai xếp trên cùng — bấm vào là thấy ma trận công đoạn.'
                    : 'Chỉ lệnh đã duyệt hoặc đang chạy mới cần khai lộ trình.'
                }
                tiep={
                  <Link href="/thongke/lenh" className="lnk">
                    Xem Lệnh sản xuất
                  </Link>
                }
              />
            </div>
          )}
        </div>
      </div>
    </SxKhung>
  )
}

/** Nửa phải: đầu lệnh + ma trận + thanh chốt — một hook `useDinhHinh` cho lệnh đang chọn. */
function Phai({
  lenh,
  autoNap,
}: {
  lenh: DinhHinhProps
  autoNap: LoTrinhGopProps['autoNap']
}) {
  const d = useDinhHinh(lenh)
  const { p, editable } = d
  const khaiRieng = d.rows.filter((r) => r.kind === 'assembly' && r.stages != null).length
  const theoNhom = d.nCum - khaiRieng
  const thieuDinhMuc = p.orderLines.filter((l) => !l.has_profile)
  const chuaCoDong = p.orderLines.filter((l) => (d.byLine.get(l.id) ?? []).length === 0)
  const luuWhy = d.luuWhy ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="sx-hc">
        <span className="c">
          Lệnh <b>{p.lsx.code}</b>
        </span>
        <span className="c">{p.lsx.customer_name}</span>
        <span className="c">
          <b>{p.orderLines.length}</b> dòng SP
        </span>
        <span className="c">
          bảng chi tiết <b>{d.rows.length}</b> dòng · <b>{d.nCum}</b> cụm
        </span>
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
        <span className="sp" style={{ display: 'flex', gap: 2 }}>
          <ApNhom>
            <ApNut href={`/thongke/lsx/${p.lsx.id}/dinh-hinh`}>
              Bảng chi tiết của lệnh ↗
            </ApNut>
            <ApNut href={`/thongke/lsx/${p.lsx.id}`}>Hồ sơ lệnh</ApNut>
          </ApNhom>
        </span>
      </div>
      <div className="sx-leg">
        <span>
          <i className="o" /> ngoài lộ trình — bấm để thêm
        </span>
        <span>x đậm = khai riêng lệnh</span>
        <span>x mờ = theo hồ sơ SP / nhóm vật tư</span>
        <span>· = bậc chi tiết, cụm không đi qua</span>
      </div>

      {autoNap && autoNap.added > 0 && (
        <div className="sx-note ok">
          <b>Bảng chi tiết đã tự nạp từ định mức Kỹ thuật lúc mở:</b> {autoNap.added}{' '}
          dòng. Mọi cụm đang chạy theo mặc định nhóm vật tư — đánh x chỗ nào khác mặc định
          rồi Lưu.
        </div>
      )}
      {p.lockedByEntries && !p.lsxClosed && (
        <div className="sx-note stop">
          <b>Lệnh đã có {p.pbsCount} phiếu sản lượng — lộ trình khoá.</b> Đổi lộ trình khi
          đã có số là sổ mất chỗ bám: xoá phiếu ở Hồ sơ lệnh › Phiếu rồi mới sửa. Ma trận
          chỉ để tra cứu.
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
              — {thieuDinhMuc.map((l) => l.product_code).join(', ')} chờ Kỹ thuật nạp định
              mức. Kỹ thuật xong thì vào “Bảng chi tiết của lệnh” bấm Nạp từ BOM. Không gõ
              tay ở đây: bảng chi tiết là của Kỹ thuật.
            </>
          ) : (
            <>
              {' '}
              — hồ sơ có định mức nhưng bảng chưa nạp; mở “Bảng chi tiết của lệnh” bấm Nạp
              từ BOM.
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
                Sắp lưu <b>{khaiRieng}</b> cụm khai riêng · <b>{theoNhom}</b> cụm giữ theo
                nhóm
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
  )
}
