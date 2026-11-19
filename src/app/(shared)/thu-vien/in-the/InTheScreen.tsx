'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Check, Eye, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ngayVn, soTo, theThieu, type TheNguon } from '@/lib/the-treo'
import { BanIn, TheTreoTag, XemBanIn } from './the-treo'
import { useInThe, type InTheCtx, type TabThe } from './useInThe'

const TABS: [TabThe, string][] = [
  ['chua', 'Chưa treo thẻ'],
  ['da', 'Đã treo thẻ'],
  ['all', 'Tất cả'],
]

/**
 * IN THẺ TREO MẪU SHOWROOM — dựng theo bản vẽ duyệt 19/11/2026 (v2,
 * https://claude.ai/artifact/HyVmMJMPEpMjeoFao19xQC). Khuôn C thu gọn: một câu
 * hỏi "in thẻ cho SP nào, SP nào đã treo xong". Lưới chọn SP · ngăn phải xem
 * trước thẻ của dòng đang chọn · nút In mở hộp in của trình duyệt.
 */
export function InTheScreen({
  rows,
  origin,
  canMark,
  backHref,
}: {
  rows: TheNguon[]
  origin: string
  canMark: boolean
  backHref: string
}) {
  const d = useInThe({ rows, canMark })
  const nDanh = d.chuaTreoTrongChon.length
  const hep = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches
  return (
    <>
      <header className="head">
        <div className="head-l">
          <Link className="eyebrow" href={backHref}>
            ‹ Thư viện SP
          </Link>
          <h1>In thẻ treo</h1>
          <span className="it-sum" aria-live="polite">
            Đã chọn <b>{d.chon.length}</b>/{d.hien.length} SP · <b>{d.soTo}</b> tờ A4
          </span>
        </div>
        <div className="head-r">
          {canMark && (
            <button
              type="button"
              className="btn"
              title="Đánh dấu các SP đang chọn là đã treo thẻ"
              aria-disabled={nDanh === 0 || d.busy}
              onClick={() => d.danhDau(d.chuaTreoTrongChon.map((r) => r.id))}
            >
              <Check size={14} aria-hidden />
              <span className="t">{d.busy ? 'Đang ghi…' : `Đã treo (${nDanh})`}</span>
            </button>
          )}
          <button
            type="button"
            className="btn"
            title="Xem đủ các tờ A4 sẽ in"
            aria-pressed={d.xemIn}
            onClick={() => d.setXemIn(!d.xemIn)}
          >
            <Eye size={14} aria-hidden />
            <span className="t">
              {d.xemIn ? 'Về danh sách' : `Xem bản in (${d.soTo} tờ)`}
            </span>
          </button>
          <button
            type="button"
            className="btn pri"
            aria-disabled={d.chon.length === 0 || !!d.dangIn}
            onClick={d.batDauIn}
          >
            <Printer size={14} aria-hidden />
            <span className="t">
              {d.dangIn ? 'Đang chuẩn bị…' : `In ${d.chon.length} thẻ`}
            </span>
          </button>
        </div>
      </header>
      <ThongBao d={d} canMark={canMark} />
      <div className="it-tabs" role="tablist" aria-label="Trạng thái treo thẻ">
        {TABS.map(([k, ten]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={d.tab === k}
            className="it-tab"
            onClick={() => d.setTab(k)}
          >
            {ten}
            <span className="c">{d.dem[k]}</span>
          </button>
        ))}
      </div>
      <Loc d={d} />
      <ThanhChon d={d} />
      {d.xemIn ? (
        <div className="it-body xem">
          <div className="scroll">
            {d.chon.length === 0 ? (
              <p className="it-empty">
                Chưa chọn SP nào để in.{' '}
                <button
                  type="button"
                  className="it-link"
                  onClick={() => d.setXemIn(false)}
                >
                  Về danh sách
                </button>{' '}
                để tick, hoặc dùng “Chọn nhanh”.
              </p>
            ) : (
              <XemBanIn tags={d.theChon} moiTo={d.moiTo} origin={origin} anh={d.inAnh} />
            )}
          </div>
        </div>
      ) : (
        <div className="it-body">
          <div className="scroll">
            {d.hien.length === 0 ? (
              <Rong d={d} backHref={backHref} />
            ) : (
              <Luoi
                d={d}
                onXem={(id) => {
                  d.setFocus(id)
                  if (hep()) d.setPhong(true)
                }}
              />
            )}
          </div>
          <aside className="it-fb" aria-label="Xem trước thẻ">
            {d.dangXem ? (
              <>
                <div className="it-fb-h">
                  <h2>Xem trước · {d.dangXem.code}</h2>
                  <button
                    type="button"
                    className="it-link"
                    onClick={() => d.setPhong(true)}
                  >
                    Phóng to
                  </button>
                </div>
                <button
                  type="button"
                  className="it-fb-the"
                  onClick={() => d.setPhong(true)}
                  aria-label={`Phóng to thẻ ${d.dangXem.code}`}
                >
                  <TheTreoTag t={d.the(d.dangXem)} origin={origin} anh={d.inAnh} />
                </button>
              </>
            ) : (
              <p>Chưa có dòng nào để xem trước.</p>
            )}
          </aside>
        </div>
      )}
      <div className="foot">
        <span>{d.tongSp} SP theo bộ lọc Thư viện</span>
        <span className="c-md">
          Cần PDF: bấm In → Máy in “Lưu dưới dạng PDF” · A4{' '}
          {d.moiTo === 2 ? 'ngang' : 'dọc'}, lề Không, bật Đồ hoạ nền
        </span>
      </div>
      {d.phong && d.dangXem && (
        <PhongThe onDong={() => d.setPhong(false)} code={d.dangXem.code}>
          <TheTreoTag t={d.the(d.dangXem)} origin={origin} anh={d.inAnh} />
        </PhongThe>
      )}
      {d.dangIn && (
        <BanIn
          tags={d.theIn}
          moiTo={d.moiTo}
          origin={origin}
          anh={d.inAnh}
          onXong={d.xongIn}
        />
      )}
    </>
  )
}

/** Lớp phủ thẻ cỡ lớn (vừa chiều cao màn) — Esc / bấm nền để đóng. */
function PhongThe({
  code,
  onDong,
  children,
}: {
  code: string
  onDong: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onDong()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onDong])
  return (
    <div
      className="it-zoom"
      role="dialog"
      aria-modal="true"
      aria-label={`Thẻ ${code}`}
      onClick={onDong}
    >
      <div className="it-zoom-in" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
      <button type="button" className="btn it-zoom-x" onClick={onDong} autoFocus>
        Đóng (Esc)
      </button>
    </div>
  )
}

/** Chọn nhanh theo nhóm + tuỳ chọn in — tách khỏi thanh lọc dữ liệu. */
function ThanhChon({ d }: { d: InTheCtx }) {
  return (
    <div className="it-chon">
      <span className="muted">Chọn nhanh:</span>
      <button
        type="button"
        className="btn sm2"
        onClick={d.latTatCa}
        aria-pressed={d.tatCa}
      >
        {d.tatCa ? 'Bỏ chọn dòng đang hiện' : `Tất cả đang hiện (${d.hien.length})`}
      </button>
      {d.nhom.coMau > 0 && (
        <button
          type="button"
          className="btn sm2"
          onClick={() => d.chonNhom((r) => r.showroom_sample)}
        >
          Có mẫu ({d.nhom.coMau})
        </button>
      )}
      {d.nhom.khu.map(([k, n]) => (
        <button
          key={k}
          type="button"
          className="btn sm2"
          onClick={() => d.chonNhom((r) => r.showroom_zone === k)}
        >
          Khu {k} ({n})
        </button>
      ))}
      {d.chon.length > 0 && (
        <button type="button" className="it-link" onClick={d.boChonHet}>
          Bỏ chọn hết
        </button>
      )}
      <span className="it-in">
        <select
          id="it-kho"
          aria-label="Số thẻ mỗi tờ A4"
          className="it-inp"
          value={d.moiTo}
          onChange={(e) => d.setMoiTo(e.target.value === '4' ? 4 : 2)}
        >
          <option value={2}>2 thẻ/tờ · A5</option>
          <option value={4}>4 thẻ/tờ · A6</option>
        </select>
        <label className="it-ck">
          <input
            type="checkbox"
            checked={d.inAnh}
            onChange={(e) => d.setInAnh(e.target.checked)}
          />
          In ảnh
        </label>
        <label className="it-ck">
          <input
            type="checkbox"
            checked={d.inKhach}
            onChange={(e) => d.setInKhach(e.target.checked)}
          />
          In tên khách
        </label>
      </span>
    </div>
  )
}

/** Báo TẠI CHỖ dưới đầu trang: bị chặn · đang chuẩn bị in · vừa in xong · kết quả ghi. */
function ThongBao({ d, canMark }: { d: InTheCtx; canMark: boolean }) {
  const vuaIn = d.vuaIn
  return (
    <>
      {d.chan && (
        <div className="it-why" role="alert">
          {d.chan}{' '}
          {d.chon.length === 0 && d.hien.length > 0 && (
            <button type="button" className="it-link" onClick={d.latTatCa}>
              Chọn tất cả {d.hien.length}
            </button>
          )}
        </div>
      )}
      {d.dangIn && (
        <div className="it-ok" role="status">
          Đang chuẩn bị {d.dangIn.length} thẻ ({soTo(d.dangIn.length, d.moiTo)} tờ): chờ
          tải ảnh rồi mở hộp in…
        </div>
      )}
      {vuaIn && (
        <div className="it-ok" role="status">
          <span>
            Đã gửi {vuaIn.length} thẻ ra máy in. Treo xong thì ghi lại để lần sau khỏi in
            trùng.
          </span>
          {canMark && (
            <button
              type="button"
              className="btn pri"
              aria-disabled={d.busy}
              onClick={() => d.danhDau(vuaIn)}
            >
              <Check size={14} aria-hidden />
              Đánh dấu đã treo {vuaIn.length} thẻ
            </button>
          )}
          <button type="button" className="btn" onClick={() => d.setVuaIn(null)}>
            Để sau
          </button>
        </div>
      )}
      {d.bao && (
        <div className={d.bao.ok ? 'it-ok' : 'notice red'} role="status">
          {d.bao.text}
        </div>
      )}
    </>
  )
}

function Loc({ d }: { d: InTheCtx }) {
  return (
    <div className="filters">
      <label htmlFor="it-q" className="sr">
        Tìm SP
      </label>
      <input
        id="it-q"
        type="search"
        className="it-inp"
        placeholder="Tìm mã, tên SP…"
        value={d.q}
        onChange={(e) => d.setQ(e.target.value)}
      />
      <select
        id="it-kh"
        aria-label="Khách"
        className="it-inp"
        value={d.kh}
        onChange={(e) => d.setKh(e.target.value)}
      >
        <option value="">Khách: tất cả</option>
        {d.khachs.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <select
        id="it-mau"
        aria-label="Mẫu showroom"
        className="it-inp"
        value={d.mau}
        onChange={(e) => d.setMau(e.target.value as typeof d.mau)}
      >
        <option value="">Mẫu: tất cả</option>
        <option value="co">Có mẫu</option>
        <option value="chua">Chưa có mẫu</option>
      </select>
      <button
        type="button"
        className={cn('fact', d.thieuKt && 'on')}
        aria-pressed={d.thieuKt}
        onClick={() => d.setThieuKt(!d.thieuKt)}
      >
        Thiếu kích thước <b className="w">{d.thieu.kt}</b>
      </button>
      <button
        type="button"
        className={cn('fact', d.thieuAnh && 'on')}
        aria-pressed={d.thieuAnh}
        onClick={() => d.setThieuAnh(!d.thieuAnh)}
      >
        Chưa ảnh <b className="w">{d.thieu.anh}</b>
      </button>
      <button type="button" className="btn" onClick={d.boLoc}>
        Bỏ lọc
      </button>
    </div>
  )
}

function Luoi({ d, onXem }: { d: InTheCtx; onXem: (id: string) => void }) {
  return (
    <table className="it-g">
      <thead>
        <tr>
          <th className="ck">
            <input
              type="checkbox"
              checked={d.tatCa}
              onChange={d.latTatCa}
              aria-label="Chọn tất cả dòng đang hiện"
            />
          </th>
          <th>Khu</th>
          <th>Mã HG</th>
          <th>Tên SP</th>
          <th className="c-lg">Khách</th>
          <th className="num c-md">D×R×C mm</th>
          <th className="c-lg">Ảnh</th>
          <th className="c-lg">Mẫu</th>
          <th className="c-lg">Treo thẻ</th>
          <th className="c-sm">Thẻ sẽ thiếu</th>
        </tr>
      </thead>
      <tbody>
        {d.hien.map((r) => {
          const th = theThieu(r)
          const miss = [th.kt && 'KT', th.anh && 'ảnh'].filter(Boolean)
          return (
            <tr
              key={r.id}
              className={cn(d.dangXem?.id === r.id && 'sel')}
              onClick={() => d.setFocus(r.id)}
            >
              <td className="ck">
                <input
                  type="checkbox"
                  checked={d.daChon.has(r.id)}
                  onChange={() => d.latChon(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Chọn ${r.code}`}
                />
              </td>
              <td>{r.showroom_zone ?? <span className="muted">—</span>}</td>
              <td>
                <button
                  type="button"
                  className="it-code"
                  onClick={(e) => {
                    e.stopPropagation()
                    onXem(r.id)
                  }}
                  aria-label={`Xem thẻ ${r.code}`}
                >
                  {r.code}
                </button>
              </td>
              <td className="it-name" title={r.name}>
                {r.name}
              </td>
              <td className="c-lg">
                {r.customer_name ?? <span className="muted">—</span>}
              </td>
              <td className="num c-md">
                {th.kt ? (
                  <span className="muted">—</span>
                ) : (
                  `${Math.round(r.length_mm!)}×${Math.round(r.width_mm!)}×${Math.round(r.height_mm!)}`
                )}
              </td>
              <td className="c-lg">
                {r.image_url ? 'Có' : <span className="muted">—</span>}
              </td>
              <td className="c-lg">
                {r.showroom_sample ? 'Có' : <span className="muted">—</span>}
              </td>
              <td className="num c-lg">
                {r.showroom_tagged_at ? (
                  ngayVn(r.showroom_tagged_at)
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td className="c-sm">
                {miss.length > 0 && (
                  <>
                    <span
                      className="it-miss"
                      title={`Thẻ sẽ thiếu ${[th.kt && 'kích thước (ô để trống ghi tay)', th.anh && 'ảnh'].filter(Boolean).join(' và ')}`}
                    >
                      Thiếu {miss.join(', ')}
                    </span>{' '}
                    <Link
                      href={`/thu-vien/${r.id}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
                      sửa
                    </Link>
                  </>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={10}>
            Đã chọn {d.chon.length}/{d.hien.length} SP · {d.soTo} tờ A4 · thiếu kích thước{' '}
            {d.thieu.kt} · chưa ảnh {d.thieu.anh}. Cột Khách chỉ hiện trên màn, không in
            lên thẻ (trừ khi bật “In tên khách”).
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

/** Rỗng: nói vì sao và làm gì tiếp, một dòng. */
function Rong({ d, backHref }: { d: InTheCtx; backHref: string }) {
  if (d.tongSp === 0)
    return (
      <p className="it-empty">
        Bộ lọc của Thư viện không còn SP nào. <Link href={backHref}>Về Thư viện SP</Link>{' '}
        để đổi bộ lọc.
      </p>
    )
  if (d.dem.all === 0)
    return (
      <p className="it-empty">
        Không SP nào khớp ô tìm / khách / mẫu.{' '}
        <button type="button" className="it-link" onClick={d.boLoc}>
          Bỏ lọc
        </button>
      </p>
    )
  if (d.tab === 'da' && d.dem.da === 0)
    return (
      <p className="it-empty">
        Chưa SP nào đánh dấu đã treo thẻ. In ở tab{' '}
        <button type="button" className="it-link" onClick={() => d.setTab('chua')}>
          Chưa treo thẻ
        </button>
        , treo xong thì bấm “Đánh dấu đã treo thẻ”.
      </p>
    )
  if (d.tab === 'chua' && d.dem.chua === 0)
    return (
      <p className="it-empty">
        Mọi SP trong bộ lọc đã treo thẻ. In lại thẻ hỏng ở tab{' '}
        <button type="button" className="it-link" onClick={() => d.setTab('da')}>
          Đã treo thẻ
        </button>
        .
      </p>
    )
  return (
    <p className="it-empty">
      Không SP nào thiếu dữ liệu như ô lọc đang bật.{' '}
      <button type="button" className="it-link" onClick={d.boLoc}>
        Bỏ lọc
      </button>
    </p>
  )
}
