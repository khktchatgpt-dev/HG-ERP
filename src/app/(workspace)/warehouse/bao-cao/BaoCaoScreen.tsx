'use client'

import './bao-cao.css'
import {
  Fragment,
  useTransition,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Download } from 'lucide-react'
import { kyThang } from '@/lib/kho-nxt'
import { searchTokens } from '@/lib/search-text'
import { useBeRong } from '@/lib/use-be-rong'
import type { NxtBaoCao, NxtDong } from '@/modules/dept/warehouse/nxt.service'
import { ApNhom, ApNut, DauTrang, KhoKhung, Rong, ThanhLoc, ThanhTT } from '../_erp/khung'
import { ONgay } from '../_erp/o-nhap'
import {
  dmy,
  dsThang,
  dungCot,
  fmtSl,
  fmtTien,
  nhanThang,
  tachCot,
  type CotSo,
} from './bao-cao.shared'
import { TheKho } from './the-kho'

const KHONG_NHOM = '(chưa phân nhóm)'

/**
 * BÁO CÁO NHẬP–XUẤT–TỒN — `/warehouse/bao-cao` (Kho đợt 2 · B6). Bản vẽ duyệt
 * 19/10/2026 theo đề xuất Q1–Q6: https://claude.ai/artifact/XCqeNa92MkBZ5oGGwcGrjS
 *
 * Câu màn trả lời: "trong kỳ này mỗi mã vào bao nhiêu, ra bao nhiêu, cuối kỳ
 * còn bao nhiêu và đáng bao nhiêu tiền?". Luật tính ở `lib/kho-nxt.ts`.
 *
 * Kỳ nằm trên URL (server tính lại); tìm · nhóm · chỉ phát sinh · chế độ bày
 * lọc tại chỗ trên dữ liệu đã tải (277 mã tháng 10/2026).
 *
 * Dòng NHÓM chỉ cộng TIỀN: mỗi mã một ĐVT, cộng số lượng là vô nghĩa.
 */
export function BaoCaoScreen({ bc }: { bc: NxtBaoCao }) {
  const router = useRouter()
  // Đổi kỳ = server tính lại cả sổ (~1–1,5 s đo 19/10) — phải báo đang tính, không thì người dùng bấm lại.
  const [dangTinh, batDau] = useTransition()
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [nhom, setNhom] = useState('')
  const [chiPs, setChiPs] = useState(true)
  const [tien, setTien] = useState(true)
  const [dong, setDong] = useState<ReadonlySet<string>>(new Set())
  const [chon, setChon] = useState<string | null>(null)
  const [mo, setMo] = useState<string | null>(null)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)

  const coNhapKhac = bc.rows.some((r) => Math.abs(r.nhap.nhapKhac) > 1e-9)
  // Bề rộng cần để bày từng cột lý do: mở · mã · ĐVT · tên ≥ 220px + các cột số.
  const canDu =
    28 +
    96 +
    62 +
    220 +
    dungCot({ tien, chiTietCot: true, coNhapKhac }).reduce((t, c) => t + c.w, 0)
  const hep = beRong > 0 && beRong < 760
  const chiTietCot = beRong === 0 || beRong >= canDu
  const cot = dungCot({ tien, chiTietCot, coNhapKhac })

  const loc = useMemo(() => {
    const tk = searchTokens(q)
    return bc.rows.filter((r) => {
      if (chiPs && !r.phat_sinh) return false
      if (nhom && (r.group_name ?? KHONG_NHOM) !== nhom) return false
      if (tk.length) {
        const hay = searchTokens(`${r.code} ${r.name}`, 60).join(' ')
        if (!tk.every((t) => hay.includes(t))) return false
      }
      return true
    })
  }, [bc.rows, q, nhom, chiPs])

  const nhomDs = useMemo(() => {
    const m = new Map<string, NxtDong[]>()
    for (const r of loc) {
      const k = r.group_name ?? KHONG_NHOM
      const ds = m.get(k)
      if (ds) ds.push(r)
      else m.set(k, [r])
    }
    return [...m]
  }, [loc])
  const tatCaNhom = useMemo(
    () => [...new Set(bc.rows.map((r) => r.group_name ?? KHONG_NHOM))].sort((a, b) => a.localeCompare(b, 'vi')), // prettier-ignore
    [bc.rows],
  )

  const cong = (ds: NxtDong[], f: (r: NxtDong) => number | null) =>
    ds.reduce((s, r) => s + (f(r) ?? 0), 0)
  const thieuGia = loc.filter((r) => r.thieu_gia > 0 || (r.don_gia == null && r.ton_cuoi > 0)).length // prettier-ignore
  const am = loc.filter((r) => r.ton_cuoi < -1e-9).length
  const tyGia = loc.reduce((s, r) => s + r.thieu_ty_gia, 0)

  const dat = (p: { tu: string; den: string }) => {
    setChon(null)
    setMo(null)
    batDau(() => router.push(`${pathname}?tu=${p.tu}&den=${p.den}`, { scroll: false }))
  }
  const thang = kyThang(bc.tu)
  const laThang = thang.tu === bc.tu && thang.den === bc.den ? bc.tu.slice(0, 7) : ''
  const thangDs = dsThang(bc.thangDau ?? bc.homNay.slice(0, 7), bc.homNay.slice(0, 7))
  const tamTinh = bc.den > bc.homNay
  const conNgay = tamTinh
    ? Math.round((Date.parse(bc.den) - Date.parse(bc.homNay)) / 86_400_000)
    : 0
  const excel = `/api/dept/warehouse/bao-cao/excel?tu=${bc.tu}&den=${bc.den}${chiPs ? '' : '&tatca=1'}` // prettier-ignore
  const dangLoc = q.trim() !== '' || nhom !== '' || !chiPs

  const doiMo = (id: string) => {
    setChon(id)
    setMo((m) => (m === id ? null : id))
  }
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, f: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      f()
    }
  }
  const doiNhom = (k: string) =>
    setDong((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const soCot = (hep ? 1 : 4) + (hep ? cot.filter((c) => c.key === 'cuoi' || c.key === 'gt').length : cot.length) // prettier-ignore
  const cotHien = hep ? cot.filter((c) => c.key === 'cuoi' || c.key === 'gt') : cot
  const coKhoi = !hep && chiTietCot

  return (
    <KhoKhung label="Báo cáo nhập xuất tồn">
      <DauTrang
        title="Nhập–Xuất–Tồn"
        ctx={
          dangTinh
            ? 'Đang tính lại kỳ…'
            : laThang
              ? nhanThang(laThang)
              : `${dmy(bc.tu)} – ${dmy(bc.den)}`
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<Download size={15} aria-hidden />}
                onClick={() => {
                  window.location.href = excel
                }}
              >
                Xuất Excel
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut icon={<BookOpen size={15} aria-hidden />} href="/warehouse/phieu">
                Sổ phiếu
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <ThanhLoc>
        <select
          value={laThang}
          className={laThang ? 'on' : undefined}
          onChange={(e) => e.target.value && dat(kyThang(`${e.target.value}-01`))}
          aria-label="Kỳ báo cáo"
        >
          {!laThang && <option value="">Tuỳ chọn ngày</option>}
          {thangDs.map((m) => (
            <option key={m} value={m}>
              {nhanThang(m)}
            </option>
          ))}
        </select>
        <span className="nx-ky">
          <span>Từ</span>
          <ONgay
            value={bc.tu}
            label="Từ ngày"
            onChange={(v) => v && v !== bc.tu && dat({ tu: v, den: bc.den })}
          />{' '}
          <span>đến</span>
          <ONgay
            value={bc.den}
            label="Đến ngày"
            onChange={(v) => v && v !== bc.den && dat({ tu: bc.tu, den: v })}
          />{' '}
        </span>
        <select
          value={nhom}
          className={nhom ? 'on' : undefined}
          onChange={(e) => setNhom(e.target.value)}
          aria-label="Nhóm vật tư"
        >
          <option value="">Mọi nhóm vật tư</option>
          {tatCaNhom.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm mã, tên vật tư…"
          aria-label="Tìm mã hoặc tên vật tư"
        />
        <label className="nx-chk">
          <input
            type="checkbox"
            checked={chiPs}
            onChange={(e) => setChiPs(e.target.checked)}
          />
          Chỉ mã có phát sinh
        </label>
        <span className="nx-seg" role="group" aria-label="Bày số">
          <button type="button" aria-pressed={tien} onClick={() => setTien(true)}>
            SL + tiền
          </button>
          <button type="button" aria-pressed={!tien} onClick={() => setTien(false)}>
            Chỉ SL
          </button>
        </span>
        {dangLoc && (
          <button
            type="button"
            className="clr"
            onClick={() => {
              setQ('')
              setNhom('')
              setChiPs(true)
            }}
          >
            Bỏ lọc
          </button>
        )}
      </ThanhLoc>

      {tamTinh && (
        <div className="kh-note" role="status">
          <span className="tag">Tạm tính</span>
          <span>
            Kỳ đến {dmy(bc.den)} còn {conNgay} ngày chưa qua: số là tạm tính, đơn giá bình
            quân còn đổi khi có phiếu nhập mới.
          </span>
          <button
            type="button"
            className="kh-lnk"
            onClick={() =>
              dat({ tu: bc.tu > bc.homNay ? bc.homNay : bc.tu, den: bc.homNay })
            }
          >
            Chọn đến hôm nay ({dmy(bc.homNay)})
          </button>
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {loc.length === 0 ? (
        bc.soDong === 0 ? (
          <Rong
            tieuDe="Kỳ này không có phiếu kho nào"
            lyDo={`Từ ${dmy(bc.tu)} đến ${dmy(bc.den)} không có phiếu nhập hay xuất nào. Tồn đầu và tồn cuối bằng nhau.`} // prettier-ignore
            tiep={
              bc.kyGanNhat ? (
                <button
                  type="button"
                  className="kh-btn"
                  onClick={() => dat(kyThang(`${bc.kyGanNhat}-01`))}
                >
                  Xem {nhanThang(bc.kyGanNhat).toLowerCase()}, kỳ có phát sinh gần nhất
                </button>
              ) : undefined
            }
          />
        ) : (
          <Rong
            tieuDe="Không mã nào khớp bộ lọc"
            lyDo={`Kỳ có ${bc.soDong} dòng sổ nhưng không mã nào khớp tìm / nhóm đang chọn.`}
            tiep={
              <button
                type="button"
                className="kh-btn"
                onClick={() => {
                  setQ('')
                  setNhom('')
                  setChiPs(true)
                }}
              >
                Bỏ lọc
              </button>
            }
          />
        )
      ) : (
        <div className={dangTinh ? 'kh-grid nx-dang' : 'kh-grid'} aria-busy={dangTinh}>
          <table className="kh-tb" aria-label="Báo cáo nhập xuất tồn">
            <colgroup>
              <col style={{ width: 28 }} />
              {!hep && <col style={{ width: 96 }} />}
              <col />
              {!hep && <col style={{ width: 62 }} />}
              {cotHien.map((c) => (
                <col key={c.key} style={{ width: c.w }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={coKhoi ? 2 : 1} className="c0" aria-label="Mở thẻ kho" />
                {!hep && <th rowSpan={coKhoi ? 2 : 1}>Mã</th>}
                <th rowSpan={coKhoi ? 2 : 1}>{hep ? 'Vật tư' : 'Tên vật tư'}</th>
                {!hep && <th rowSpan={coKhoi ? 2 : 1}>ĐVT</th>}
                {coKhoi ? (
                  <DauHaiTang cot={cotHien} />
                ) : (
                  cotHien.map((c) => <ThCot key={c.key} c={c} />)
                )}
              </tr>
              {coKhoi && (
                <tr className="h2">
                  {cotHien
                    .filter((c) => c.khoi)
                    .map((c) => (
                      <ThCot key={c.key} c={c} />
                    ))}
                </tr>
              )}
            </thead>
            <tbody>
              {nhomDs.map(([ten, ds]) => {
                const thu = dong.has(ten)
                return (
                  <Fragment key={ten}>
                    <tr
                      className="nx-g"
                      tabIndex={0}
                      aria-expanded={!thu}
                      onClick={() => doiNhom(ten)}
                      title={
                        tien
                          ? `Giá trị nhập ${fmtTien(cong(ds, (r) => r.gt_nhap))} ₫ · giá trị xuất ${fmtTien(cong(ds, (r) => r.gt_xuat))} ₫`
                          : undefined
                      }
                      onKeyDown={(e) => phim(e, () => doiNhom(ten))}
                    >
                      <td className="c0" aria-hidden>
                        {thu ? '▸' : '▾'}
                      </td>
                      <td colSpan={hep ? 1 : 3} title={ten}>
                        {ten}
                        <span className="nx-n">{ds.length} mã</span>
                      </td>
                      {cotHien.map((c) => (
                        <td key={c.key} className={`r kh-num${c.sep ? 'sep' : ''}`}>
                          {tien && c.congTien ? fmtTien(cong(ds, c.tien!)) : ''}
                        </td>
                      ))}
                    </tr>
                    {!thu &&
                      ds.map((r) => {
                        const on = r.material_id === chon
                        const dangMo = r.material_id === mo
                        return (
                          <Fragment key={r.material_id}>
                            <tr
                              className={on ? 'd on' : 'd'}
                              tabIndex={0}
                              aria-selected={on}
                              aria-expanded={dangMo}
                              onClick={() => doiMo(r.material_id)}
                              onKeyDown={(e) => phim(e, () => doiMo(r.material_id))}
                            >
                              <td className="c0">
                                <span className="mo" aria-hidden>
                                  {dangMo ? '▾' : '▸'}
                                </span>
                              </td>
                              {!hep && <td className="kh-ma">{r.code}</td>}
                              <td title={r.name}>
                                {hep && (
                                  <span className="kh-ma" style={{ display: 'block' }}>
                                    {r.code}
                                  </span>
                                )}
                                {r.name}
                                {hep && <span className="kh-mut"> · {r.unit}</span>}
                              </td>
                              {!hep && <td className="kh-mut">{r.unit}</td>}
                              {cotHien.map((c) => (
                                <OSo
                                  key={c.key}
                                  c={c}
                                  r={r}
                                  tien={tien}
                                  chiTietCot={chiTietCot}
                                />
                              ))}
                            </tr>
                            {dangMo && (
                              <tr className="exp">
                                <td colSpan={soCot}>
                                  <TheKho
                                    r={r}
                                    dong={bc.chiTiet[r.material_id] ?? []}
                                    tien={tien}
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={hep ? 2 : 4}
                  title={`Chỉ cộng tiền: mỗi mã một đơn vị tính, cộng số lượng là vô nghĩa.${tien ? ` Giá trị nhập ${fmtTien(cong(loc, (r) => r.gt_nhap))} ₫ · giá trị xuất ${fmtTien(cong(loc, (r) => r.gt_xuat))} ₫ · giá trị tồn đầu ${fmtTien(cong(loc, (r) => r.gt_dau))} ₫.` : ''}`}
                >
                  Cộng {loc.length} mã · {nhomDs.length} nhóm
                  {tien ? ' · giá trị tồn cuối' : ''}
                </td>
                {cotHien.map((c) => (
                  <td key={c.key} className={`r kh-num${c.sep ? 'sep' : ''}`}>
                    {tien && c.congTien ? fmtTien(cong(loc, c.tien!)) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left={
          <>
            Kỳ theo ngày chứng từ · bình quân gia quyền cả kỳ · &quot;·&quot; = 0
            {tien && (thieuGia > 0 || am > 0 || tyGia > 0) && (
              <>
                {' · '}giá trị KHÔNG gồm: {thieuGia > 0 && `${thieuGia} mã thiếu giá`}
                {thieuGia > 0 && am > 0 && ', '}
                {am > 0 && `${am} mã tồn âm`}
                {tyGia > 0 &&
                  `${thieuGia + am > 0 ? ', ' : ''}${tyGia} dòng USD thiếu tỷ giá`}
              </>
            )}
          </>
        }
        right={
          <span
            title={`Báo cáo ${fmtSl(bc.doiChieu.bao_cao)} · sổ ${fmtSl(bc.doiChieu.so)}`}
          >
            Đối chiếu sổ kỳ ({bc.soDong} dòng):{' '}
            {bc.doiChieu.khop ? (
              <b className="kh-ok">khớp</b>
            ) : (
              <b className="kh-stop">lệch</b>
            )}
          </span>
        }
      />
    </KhoKhung>
  )
}

function ThCot({ c }: { c: CotSo }) {
  return (
    <th className={`r${c.sep ? 'sep' : ''}`} title={c.title}>
      {c.label}
    </th>
  )
}

/** Hàng tiêu đề trên: cột không thuộc khối đứng hai tầng, khối Nhập / Xuất gộp. */
function DauHaiTang({ cot }: { cot: CotSo[] }) {
  const out: ReactNode[] = []
  for (let i = 0; i < cot.length; i++) {
    const c = cot[i]
    if (!c.khoi) {
      out.push(
        <th key={c.key} rowSpan={2} className={`r${c.sep ? 'sep' : ''}`} title={c.title}>
          {c.label}
        </th>,
      )
      continue
    }
    let n = 0
    while (cot[i + n]?.khoi === c.khoi) n++
    out.push(
      <th key={`k-${c.khoi}`} colSpan={n} className={`g2 sep k-${c.khoi}`}>
        {c.khoi === 'n' ? 'Nhập trong kỳ' : 'Xuất trong kỳ'}
      </th>,
    )
    i += n - 1
  }
  return <>{out}</>
}

function OSo({
  c,
  r,
  tien,
  chiTietCot,
}: {
  c: CotSo
  r: NxtDong
  tien: boolean
  chiTietCot: boolean
}) {
  // prettier-ignore
  const cls = `r kh-num${c.sep ? ' sep' : ''}`
  if (c.donGia) {
    return <td className={cls}>{r.don_gia == null ? <span className="kh-empty">—</span> : fmtTien(r.don_gia)}</td> // prettier-ignore
  }
  if (c.key === 'gt') {
    if (r.ton_cuoi < -1e-9) return <td className={cls}><span className="nx-co stop">tồn âm</span></td> // prettier-ignore
    if (r.gt_cuoi == null)
      return (
        <td className={cls} title="Chưa lần nhập nào có giá — không tính là 0">
          <span className="kh-empty">—</span>
          {r.ton_cuoi > 0 && <span className="nx-co">thiếu giá</span>}
        </td>
      )
    return (
      <td className={cls}>
        {r.thieu_gia > 0 && (
          <span
            className="nx-co"
            title={`${r.thieu_gia}/${r.lan_mua} lần nhập mua chưa có giá — định giá theo bình quân`}
          >
            thiếu giá {r.thieu_gia}/{r.lan_mua}
          </span>
        )}
        {Math.abs(r.gt_cuoi) < 0.5 ? (
          <span className="kh-empty">·</span>
        ) : (
          fmtTien(r.gt_cuoi)
        )}
      </td>
    )
  }
  const n = c.sl!(r)
  const tach = !chiTietCot && c.khoi ? tachCot(r, c.khoi) : undefined
  const tone =
    c.key === 'cuoi' && n < -1e-9 ? 'kh-stop' : c.key === 'cuoi' ? 'kh-b' : undefined
  return (
    <td
      className={cls}
      title={
        tach ||
        (tien && c.tien && c.tien(r) != null ? `${fmtTien(c.tien(r)!)} ₫` : undefined)
      }
    >
      {Math.abs(n) < 1e-9 ? (
        <span className="kh-empty">·</span>
      ) : (
        <span className={n < 0 && c.key !== 'cuoi' ? 'nx-am' : tone}>{fmtSl(n)}</span>
      )}
    </td>
  )
}
