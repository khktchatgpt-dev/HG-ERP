'use client'

import { useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { parsePoPaste, sameUnit, type PastedPoLine } from '@/lib/po-paste'
import type { PoMaterial } from '@/lib/po-material.types'
import { HopThoai, INPUT, NUM, Nhan, Nut, TD, TH } from '../../_erp/ui'
import { so } from './ke-hoach.shared'
import type { KeHoachCtx } from './useKeHoachMua'

type KetQuaKhop = {
  match: PoMaterial | null
  candidates: PoMaterial[]
  confidence: 'code' | 'sure' | 'fuzzy' | null
}
type DongDoc = {
  dan: PastedPoLine
  ungVien: PoMaterial[]
  /** Chỉ số ứng viên đã chọn, hoặc 'bo' = bỏ dòng này. */
  chon: number | 'bo'
  tin: KetQuaKhop['confidence']
}

const MAU_DAN = 'Tên vật tư\tSL\nNhôm hộp 20x40x1.0\t420\nVít dù 4x12, 7M\t27200'

/**
 * DÁN BẢNG KÊ (Bước 1) — nhận vùng bảng NV đã tính trong Excel: tên hoặc mã + SL
 * (thứ tự cột tuỳ, có tiêu đề thì đọc tiêu đề). Khớp mã ở máy chủ bằng đúng API
 * "Dán từ Excel" của form soạn đơn (`po-materials/match`), nên hai nơi khớp như
 * nhau. Dòng không khớp phải chọn mã hoặc bỏ — không ghi số vào mã đoán.
 *
 * Cùng một mã xuất hiện nhiều dòng (bảng kê chia theo SP) → CỘNG lại. Số dán
 * THAY số cần của mã đó (ghi đè từng mã, chốt 05/09/2026): mã khác giữ nguyên.
 */
export function DanBangKe({ d }: { d: KeHoachCtx }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [dong, setDong] = useState<DongDoc[] | null>(null)
  const [boQua, setBoQua] = useState(0)
  const [docTieuDe, setDocTieuDe] = useState(false)
  const [dangDoc, setDangDoc] = useState(false)

  async function doc() {
    const p = parsePoPaste(text, 200)
    if (p.lines.length === 0) {
      toast.error(
        'Chưa đọc được dòng nào',
        'Dán vùng bảng có cột tên (hoặc mã) và cột số lượng, mỗi vật tư một hàng.',
      )
      return
    }
    setDangDoc(true)
    try {
      const out: DongDoc[] = []
      // API khớp nhận tối đa 100 dòng một lượt.
      for (let i = 0; i < p.lines.length; i += 100) {
        const phan = p.lines.slice(i, i + 100)
        const { results } = await api<{ results: KetQuaKhop[] }>(
          '/api/dept/supply/po-materials/match',
          {
            method: 'POST',
            body: { items: phan.map((l) => ({ name: l.name, code: l.code })) },
          },
        )
        results.forEach((r, j) => {
          const ung = r.candidates.length > 0 ? r.candidates : r.match ? [r.match] : []
          const idx = r.match ? ung.findIndex((c) => c.id === r.match!.id) : -1
          out.push({
            dan: phan[j],
            ungVien: ung,
            chon: idx >= 0 ? idx : 'bo',
            tin: r.confidence,
          })
        })
      }
      setDong(out)
      setBoQua(p.skipped)
      setDocTieuDe(p.headerDetected)
    } catch (e) {
      toast.error('Chưa khớp được mã', apiErrorText(e))
    } finally {
      setDangDoc(false)
    }
  }

  /** Gộp theo mã: dòng đã chọn mã + có SL, cộng các dòng trùng mã. */
  const ghi = useMemo(() => {
    const m = new Map<string, { mat: PoMaterial; qty: number; tu: string[] }>()
    for (const x of dong ?? []) {
      if (x.chon === 'bo' || x.dan.qty == null || x.dan.qty < 0) continue
      const mat = x.ungVien[x.chon]
      // Sổ ghi kg mà mã tính theo Cây → KHÔNG ghi: số đúng, đơn vị sai là mua lệch cả chục lần.
      if (!sameUnit(x.dan.unit, mat.unit)) continue
      const cur = m.get(mat.id) ?? { mat, qty: 0, tu: [] }
      cur.qty += x.dan.qty
      cur.tu.push(x.dan.name)
      m.set(mat.id, cur)
    }
    return [...m.values()]
  }, [dong])
  const thieuMa = (dong ?? []).filter((x) => x.chon === 'bo').length
  const thieuSl = (dong ?? []).filter((x) => x.chon !== 'bo' && x.dan.qty == null).length
  const lechDvt = (dong ?? []).filter(
    (x) => x.chon !== 'bo' && !sameUnit(x.dan.unit, x.ungVien[x.chon].unit),
  ).length

  async function luu() {
    const ok = await d.ghiSoTay(
      ghi.map((g) => ({
        material_id: g.mat.id,
        qty_needed: Math.round(g.qty * 10000) / 10000,
        note: 'Dán bảng kê',
      })),
    )
    if (ok) d.setMoDan(false)
  }

  return (
    <HopThoai
      title="Dán bảng kê vào lệnh"
      aside={d.bk.lsx.code}
      width={dong ? 860 : 560}
      onClose={() => d.setMoDan(false)}
      footer={
        dong ? (
          <>
            <span className="mr-auto text-[12px] text-[var(--ink-2)]">
              {ghi.length} mã sẽ ghi
              {thieuMa > 0 ? ` · ${thieuMa} dòng chưa có mã (bỏ qua)` : ''}
              {thieuSl > 0 ? ` · ${thieuSl} dòng không đọc được SL (bỏ qua)` : ''}
              {lechDvt > 0 ? ` · ${lechDvt} dòng lệch ĐVT (bỏ qua)` : ''}
            </span>
            <Nut onClick={() => setDong(null)}>Dán lại</Nut>
            <Nut
              chinh
              busy={d.busy}
              khoa={ghi.length === 0 ? 'Chưa có dòng nào đủ mã + số lượng' : undefined}
              onClick={() => void luu()}
            >
              Ghi số cần cho {ghi.length} mã
            </Nut>
          </>
        ) : (
          <>
            <Nut onClick={() => d.setMoDan(false)}>Thôi</Nut>
            <Nut
              chinh
              busy={dangDoc}
              khoa={text.trim() ? undefined : 'Dán vùng bảng từ Excel vào ô trước'}
              onClick={() => void doc()}
            >
              Đọc vùng dán
            </Nut>
          </>
        )
      }
    >
      {!dong ? (
        <>
          <span className="text-[12.5px] text-[var(--ink-2)]">
            Bôi đen vùng bảng kê trong Excel (cột <b>Tên</b> hoặc <b>Mã</b> vật tư + cột{' '}
            <b>SL cần</b>; có hàng tiêu đề càng tốt) rồi dán vào đây. SL hiểu theo đơn vị
            của mã trong danh mục.
          </span>
          <textarea
            autoFocus
            aria-label="Vùng dán bảng kê"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={MAU_DAN}
            className={`${INPUT} h-[200px] resize-y font-mono text-[12px]`}
          />
          <span className="text-[11.5px] text-[var(--ink-3)]">
            Số dán sẽ THAY số cần của mã đó trên lệnh (kể cả số tính từ định mức). Mã
            không có trong vùng dán giữ nguyên.
          </span>
        </>
      ) : (
        <>
          <span className="text-[12px] text-[var(--ink-2)]">
            Đọc được {dong.length} dòng
            {docTieuDe ? ' theo hàng tiêu đề' : ' (không thấy tiêu đề — máy đoán cột)'}
            {boQua > 0 ? ` · bỏ ${boQua} dòng trống/tổng` : ''}. Kiểm cột Mã — dòng khớp
            mờ hãy chọn lại cho đúng.
          </span>
          <div className="max-h-[52vh] overflow-auto border border-[var(--line)]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Dòng dán</th>
                  <th className={`${TH} text-right`}>SL</th>
                  <th className={TH}>Mã vật tư</th>
                  <th className={`${TH} text-right`}>Số cần đang có</th>
                </tr>
              </thead>
              <tbody>
                {dong.map((x, i) => {
                  const mat = x.chon === 'bo' ? null : x.ungVien[x.chon]
                  const cu = mat ? d.byId.get(mat.id) : undefined
                  return (
                    <tr
                      key={i}
                      className={x.chon === 'bo' ? 'bg-[var(--warn-wash)]' : ''}
                    >
                      <td className={`${TD} max-w-[260px]`}>
                        <span className="block truncate" title={x.dan.name}>
                          {x.dan.code ? (
                            <span className="font-mono text-[12px]">{x.dan.code} · </span>
                          ) : null}
                          {x.dan.name}
                        </span>
                      </td>
                      <td className={`${TD} ${NUM}`}>
                        {x.dan.qty == null ? (
                          <span className="text-[var(--stop)]">không đọc được</span>
                        ) : (
                          <>
                            {so(x.dan.qty)}
                            {mat && (
                              <span className="ml-1 text-[11px] text-[var(--ink-3)]">
                                {mat.unit}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className={TD}>
                        <span className="flex items-center gap-1.5">
                          <select
                            aria-label={`Mã cho dòng ${x.dan.name}`}
                            value={x.chon === 'bo' ? 'bo' : String(x.chon)}
                            onChange={(e) =>
                              setDong((cur) =>
                                cur!.map((y, j) =>
                                  j === i
                                    ? {
                                        ...y,
                                        chon:
                                          e.target.value === 'bo'
                                            ? 'bo'
                                            : Number(e.target.value),
                                      }
                                    : y,
                                ),
                              )
                            }
                            className="max-w-[300px] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-[3px] text-[12px]"
                          >
                            <option value="bo">
                              {x.ungVien.length
                                ? '— bỏ dòng này —'
                                : '— không tìm thấy mã —'}
                            </option>
                            {x.ungVien.map((c, j) => (
                              <option key={c.id} value={j}>
                                {c.code} · {c.name}
                                {c.spec ? ` · ${c.spec}` : ''} ({c.unit})
                              </option>
                            ))}
                          </select>
                          {x.chon !== 'bo' &&
                            !sameUnit(x.dan.unit, x.ungVien[x.chon].unit) && (
                              <Nhan
                                tone="stop"
                                title="Dòng này không được ghi — đổi số trên sổ sang ĐVT của mã, hoặc chọn mã khác đúng ĐVT"
                              >
                                sổ ghi {x.dan.unit} · mã tính {x.ungVien[x.chon].unit}
                              </Nhan>
                            )}
                          {x.chon !== 'bo' &&
                            (x.tin === 'fuzzy' ? (
                              <Nhan tone="warn">khớp mờ</Nhan>
                            ) : (
                              <Nhan tone="done">
                                {x.tin === 'code' ? 'khớp mã' : 'khớp tên'}
                              </Nhan>
                            ))}
                        </span>
                      </td>
                      <td className={`${TD} ${NUM} text-[var(--ink-3)]`}>
                        {cu ? (
                          <>
                            {so(cu.d.can)} {cu.r.unit}
                            <span className="block text-[11px]">
                              {cu.r.source === 'manual'
                                ? 'nhập tay'
                                : cu.r.source === 'none'
                                  ? 'ngoài định mức'
                                  : 'định mức'}
                            </span>
                          </>
                        ) : (
                          'mới'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {ghi.some((g) => g.tu.length > 1) && (
            <span className="text-[11.5px] text-[var(--ink-3)]">
              Dòng trùng mã được cộng lại:{' '}
              {ghi
                .filter((g) => g.tu.length > 1)
                .map((g) => `${g.mat.code} (${g.tu.length} dòng = ${so(g.qty)})`)
                .join(' · ')}
            </span>
          )}
        </>
      )}
    </HopThoai>
  )
}
