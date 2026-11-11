'use client'

import '@/app/(workspace)/exec/approvals/hop-ky.css'
import './cho-xem.css'
import { useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Undo2 } from 'lucide-react'
import { ngayGioVn } from '@/lib/date-vn'
import {
  congTheoTien,
  GIU_DUYET_THAY_NGAY,
  tienVn,
  trangThaiXem,
  type HopXem,
} from '@/lib/cho-xem'
import { useChoXem, type ChoXemCtx, type GomXem, type TabXem } from './useChoXem'
import { LuoiDon } from './luoi-don'
import { ChiTiet } from './chi-tiet'
import { LuoiDuyetThay } from './duyet-thay'

/**
 * CHỜ TÔI XEM (/mua-hang/cho-xem) — trưởng phòng Cung ứng xem nháp NV lập rồi
 * trình Giám đốc. BẢN 2 (06/11/2026, bản vẽ
 * https://claude.ai/artifact/RcqWLU7F1z33btAR97gZBo khung 6 + 7, Q7–Q11 duyệt
 * theo đề xuất) — sau khi anh Hiếu thấy bản 1 "rất kỳ": không biết đơn ở trạng
 * thái nào, của ai, mua gì, hẹn về khi nào; ổ khoá trên mọi dòng.
 *
 *  · Lưới gom theo TRẠNG THÁI (Trình được ngay · NV gửi thẳng GĐ · Còn thiếu ·
 *    Bị trả lại thu gọn), mỗi dòng hai tầng (luoi-don.tsx);
 *  · KHUNG CHI TIẾT cố định dưới lưới, dòng đầu chọn sẵn (chi-tiet.tsx);
 *  · số đỏ menu + số tab = việc làm được ngay (lib/cho-xem `lamDuocNgay`);
 *  · bỏ ổ khoá — cột Trạng thái nói vì sao; nháp còn thiếu thì nút trình xám +
 *    câu vướng gì, ai gỡ ngay dưới thanh hành động.
 *
 * KHÔNG KIT: dùng lại hop-ky.css (hộp ký GĐ) + phần thêm ở cho-xem.css.
 */
export function ChoXemScreen({ box }: { box: HopXem }) {
  const d = useChoXem(box)
  /* CHỐT CHIỀU CAO = 100dvh − đỉnh màn (như hộp ký): lưới + khung chi tiết chia
     phần còn lại, đầu trang và thanh trạng thái đứng yên. */
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 60px)')
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])
  const dem = (k: string) => d.cho.filter((x) => trangThaiXem(x) === k).length
  const khoaTrinh = d.tab !== 'cho' || (!!d.viSao && d.daTich.length === 0)
  return (
    <div className="hk cx" ref={goc} style={{ height: cao }}>
      <div className="hk-ph">
        <span className="hk-crumb">Mua hàng ›</span>
        <h1>Chờ tôi xem</h1>
        <span className="cx-sub">
          <b className="cx-ok">{d.soCho} đơn làm được ngay</b>
          {dem('thieu') > 0 && ` · ${dem('thieu')} nháp đang soạn`}
          {dem('tra_lai') > 0 && ` · ${dem('tra_lai')} bị trả lại`}
          {d.da.length > 0 && ` · ${d.da.length} đã trình, chờ GĐ`}
        </span>
        <div className="hk-ap" role="toolbar" aria-label="Xem đơn">
          <div>
            <button
              type="button"
              className={khoaTrinh ? 'hk-btn cx-khoa' : 'hk-btn p'}
              aria-disabled={khoaTrinh || d.busy}
              aria-busy={d.busy}
              disabled={d.busy || d.tab !== 'cho'}
              onClick={d.daXem}
            >
              <Check size={15} aria-hidden />
              {/* trình nhiều đơn là vòng lặp từng đơn — phải nói đang chạy (11/11/2026) */}
              {d.busy
                ? 'Đang trình GĐ…'
                : d.daTich.length > 0
                  ? `Đã xem — trình GĐ (${d.daTich.length})`
                  : 'Đã xem — trình GĐ'}
            </button>
            <button
              type="button"
              className="hk-btn"
              disabled={d.busy || d.tab === 'thay'}
              onClick={d.moTraLai}
            >
              <Undo2 size={15} aria-hidden />
              Trả lại để sửa
            </button>
          </div>
          <div>
            {d.dangXem ? (
              <Link href={d.dangXem.href} className="hk-btn">
                <ExternalLink size={15} aria-hidden />
                Mở đơn đầy đủ
              </Link>
            ) : (
              <button
                type="button"
                className="hk-btn"
                disabled
                title="Chọn một đơn trước"
              >
                <ExternalLink size={15} aria-hidden />
                Mở đơn đầy đủ
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="hk-ptabs" role="tablist" aria-label="Đơn cần trưởng phòng xem">
        <Tab d={d} t="cho" ten="Chờ tôi xem" n={d.soCho} hot />
        <Tab d={d} t="da" ten="Đã trình, chờ GĐ" n={d.da.length} />
        <Tab d={d} t="thay" ten="GĐ duyệt khi tôi chưa xem" n={box.duyet_thay.length} />
      </div>

      <DaiTaiCho d={d} />

      {d.tab !== 'thay' && (
        <div className="hk-fb">
          <span className={d.daTich.length ? 'hk-sel' : undefined}>
            {d.daTich.length
              ? `Đã tích ${d.daTich.length} đơn · ${congTheoTien(d.daTich)
                  .map((t) => tienVn(t.value, t.currency))
                  .join(' · ')}`
              : d.dangXem
                ? `Đang xem: ${d.dangXem.code}`
                : 'Chưa có đơn'}
          </span>
          <input
            type="search"
            value={d.q}
            onChange={(e) => d.setQ(e.target.value)}
            placeholder="Tìm mã đơn, NCC, vật tư, người lập…"
            aria-label="Tìm đơn"
          />
          <span className="hk-seg" role="group" aria-label="Gom theo">
            {(
              [
                ['trang_thai', 'Theo trạng thái'],
                ['nguoi', 'Theo người lập'],
                ['lenh', 'Theo lệnh'],
              ] as [GomXem, string][]
            ).map(([k, ten]) => (
              <button
                key={k}
                type="button"
                aria-pressed={d.gom === k}
                onClick={() => d.setGom(k)}
              >
                {ten}
              </button>
            ))}
          </span>
        </div>
      )}

      {d.tab === 'thay' ? (
        <LuoiDuyetThay d={d} />
      ) : d.rows.length === 0 ? (
        <Rong d={d} />
      ) : (
        <>
          <LuoiDon d={d} />
          <ChiTiet d={d} />
        </>
      )}

      <div className="hk-sb">
        <span>
          {d.tab === 'cho'
            ? 'Số trên menu, tab = đơn trình được + đơn NV gửi thẳng GĐ anh chưa xem'
            : d.tab === 'da'
              ? 'Đơn anh đã xem, đang chờ Giám đốc'
              : `Giám đốc duyệt khi anh chưa xem · ${GIU_DUYET_THAY_NGAY} ngày qua · chỉ xem`}
        </span>
        {d.tab === 'cho' && (
          <span>nháp còn thiếu: người lập điền đủ là tự lên “Trình được”</span>
        )}
        <span style={{ marginLeft: 'auto' }}>cập nhật {ngayGioVn(box.at).slice(11)}</span>
      </div>
    </div>
  )
}

function Tab({
  d,
  t,
  ten,
  n,
  hot = false,
}: {
  d: ChoXemCtx
  t: TabXem
  ten: string
  n: number
  hot?: boolean
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={d.tab === t}
      className="hk-pt lp-all"
      onClick={() => d.doiTab(t)}
    >
      <span className="ten">{ten}</span>
      <span className={n === 0 || !hot ? 'hk-badge zero' : 'hk-badge'}>{n}</span>
    </button>
  )
}

/**
 * Dải TẠI CHỖ dưới thanh hành động (khung 7): vì sao đơn đang xem chưa trình
 * được, câu chặn, dải lý do trả lại, kết quả lượt bấm. Không toast.
 */
function DaiTaiCho({ d }: { d: ChoXemCtx }) {
  const kq = d.ketQua
  const tra = d.traLai ? d.box.items.find((x) => x.id === d.traLai!.id) : null
  return (
    <>
      {/* dải chặn (d.chan) đã nói cùng câu thì không lặp lại ở đây */}
      {d.viSao && d.dangXem && !d.traLai && !d.chan && d.daTich.length === 0 && (
        <div className="cx-why" role="note">
          <span className="k">Chưa trình được {d.dangXem.code}</span>
          <span>{d.viSao}</span>
        </div>
      )}
      {tra && d.traLai && (
        <div className="cx-tra">
          <label htmlFor="ly-do-tra" className="hk-b">
            Lý do trả lại {tra.code}
          </label>
          <input
            id="ly-do-tra"
            className="cx-inp"
            type="text"
            maxLength={1000}
            autoComplete="off"
            value={d.traLai.lyDo}
            onChange={(e) => d.setTraLai({ id: tra.id, lyDo: e.target.value })}
            placeholder="Người lập sửa theo câu này"
          />
          <button
            type="button"
            className={d.lyDoDu ? 'hk-btn p' : 'hk-btn cx-khoa'}
            aria-disabled={!d.lyDoDu || d.busy}
            aria-busy={d.busy}
            onClick={() => d.lyDoDu && !d.busy && d.guiTraLai()}
          >
            {d.busy ? 'Đang gửi…' : 'Gửi trả lại'}
          </button>
          <button
            type="button"
            className="hk-btn cx-vien"
            onClick={() => d.setTraLai(null)}
          >
            Huỷ
          </button>
          {!d.lyDoDu && <span className="hk-warn">Ghi lý do ít nhất 5 ký tự</span>}
        </div>
      )}
      {(d.chan || (kq && (kq.ok.length > 0 || kq.loi.length > 0 || kq.traLai))) && (
        <div className="cx-dai" role="status">
          {d.chan && (
            <div className="cx-band wn">
              <span className="k">Chưa làm được</span>
              <span>{d.chan}</span>
            </div>
          )}
          {kq && kq.ok.length > 0 && (
            <div className="cx-band ok">
              <span className="k">✓ {kq.ok.length} đơn đã trình GĐ</span>
              <span>
                {kq.ok
                  .map((x) => `${x.code} · ${x.ncc} · ${tienVn(x.value, x.currency)}`)
                  .join(' — ')}{' '}
                — sang tab “Đã trình, chờ GĐ”
              </span>
              <button
                type="button"
                className="hk-btn x"
                onClick={() => d.setKetQua(null)}
              >
                Đóng
              </button>
            </div>
          )}
          {kq?.traLai && (
            <div className="cx-band ok">
              <span className="k">✓ Đã trả lại {kq.traLai}</span>
              <span>
                Người lập nhận lý do trong Trao đổi của đơn — đơn nằm ở nhóm “Bị trả lại”
                tới khi được sửa.
              </span>
              <button
                type="button"
                className="hk-btn x"
                onClick={() => d.setKetQua(null)}
              >
                Đóng
              </button>
            </div>
          )}
          {kq?.loi.map((l) => (
            <div key={l.code} className="cx-band st">
              <span className="k">Không ghi được</span>
              <span>{l.msg.startsWith(l.code) ? l.msg : `${l.code}: ${l.msg}`}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** Rỗng: một dòng — vì sao rỗng + việc làm tiếp (khung 7·C). */
function Rong({ d }: { d: ChoXemCtx }) {
  const timKiem = d.q.trim() !== ''
  return (
    <div
      className="hk-empty"
      style={{ flex: 1, padding: '14px 16px', textAlign: 'left' }}
    >
      {timKiem ? (
        <>
          Ô tìm “{d.q.trim()}” không khớp đơn nào trong tab này — xoá ô tìm để thấy lại cả
          tab.
        </>
      ) : d.tab === 'cho' ? (
        <>
          Không có nháp nào, và không đơn nào NV gửi thẳng GĐ mà anh chưa xem.
          {d.da.length > 0 && (
            <>
              {' '}
              {d.da.length} đơn anh đã trình đang chờ GĐ.{' '}
              <button
                type="button"
                className="hk-btn cx-vien"
                onClick={() => d.doiTab('da')}
              >
                Mở tab Đã trình, chờ GĐ
              </button>
            </>
          )}
        </>
      ) : (
        <>
          Chưa có đơn nào anh đã trình đang chờ Giám đốc — đơn anh bấm “Đã xem — trình GĐ”
          nằm ở đây tới khi Giám đốc duyệt hoặc trả lại.
        </>
      )}
    </div>
  )
}

/** Người không phải trưởng phòng mở thẳng /mua-hang/cho-xem. */
export function ChoXemKhongQuyen() {
  return (
    <div className="hk cx" style={{ height: 'auto' }}>
      <div className="hk-ph">
        <span className="hk-crumb">Mua hàng ›</span>
        <h1>Chờ tôi xem</h1>
      </div>
      <div className="hk-empty" style={{ padding: '14px 16px', textAlign: 'left' }}>
        Hộp này dành cho trưởng phòng Cung ứng — xem nháp rồi trình Giám đốc. Đơn bạn lập
        nằm ở{' '}
        <Link
          href="/mua-hang/don"
          style={{ color: 'var(--hk-act)', textDecoration: 'underline' }}
        >
          sổ Đơn mua
        </Link>
        .
      </div>
    </div>
  )
}
