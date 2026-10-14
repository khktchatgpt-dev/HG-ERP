'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Boxes, Check } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useBeRong } from '@/lib/use-be-rong'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  PhanTrang,
  Rong,
  TabNgang,
  ThanhLoc,
  ThanhTT,
  type TabMuc,
} from '../_erp/khung'
import { HopThoai, OChu, OSo, docSoVn } from '../_erp/o-nhap'
import { RO_VT_NHAN, RO_VT_VIEC, type RoVatTu } from './ro-vat-tu'

export type VatTuRow = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  sub_group: string | null
  shelf_location: string | null
  min_stock: number
  needs_review: boolean
  is_active: boolean
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
/** Thứ tự tab theo VIỆC (bản vẽ K-5): chờ rà → chưa kệ → chưa ngưỡng → tất cả. */
const THU_TU: RoVatTu[] = ['review', 'no_shelf', 'no_min', 'all']
const TAB_MAU: Record<RoVatTu, { mau: string; tone: TabMuc['tone'] }> = {
  review: { mau: 'c-warn', tone: 'warn' },
  no_shelf: { mau: 'c-mut', tone: 'mut' },
  no_min: { mau: 'c-mut', tone: 'mut' },
  all: { mau: 'c-mut', tone: 'mut' },
}

type Bao = { tone: 'ok' | 'stop'; text: string }

/**
 * DANH MỤC VẬT TƯ — bản của Kho. Kho lối ERP · B4 (bản vẽ K-5
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR), viết tay không kit.
 *
 * Tab theo VIỆC: Chờ Kho rà · Chưa có kệ · Chưa khai ngưỡng · Tất cả. Lưới sửa
 * tại chỗ như bảng tính — rời ô là `PATCH materials/[id]`, sổ vết 0177 tự ghi:
 *  · ĐVT là Ô GÕ CÓ GỢI Ý (một `datalist` chung) thay hộp chọn 55 lựa chọn mỗi
 *    dòng (50 dòng = 2.750 lựa chọn trong trang). Gõ "kg" ra "Kg"; ĐVT chưa có
 *    trong danh sách thì HỎI trước khi lưu (K4);
 *  · Kệ gợi ý: ô gõ có gợi ý các ô kệ của kho;
 *  · Ngưỡng: ô số kiểu VN.
 * Chọn nhiều dòng rồi "Đã rà xong" một lượt ở Action Pane.
 *
 * Danh mục KHÔNG có vòng đời duyệt: `needs_review` là hàng đợi việc "Cung ứng
 * khai vội, Kho xác nhận lại", không phải một bậc duyệt. Trường mua hàng (giá,
 * NCC, mẫu đơn) là của Cung ứng — không sửa ở đây.
 */
export function VatTuKhoScreen({
  rows: initialRows,
  counts,
  total,
  trang,
  soTrang,
  ro,
  q: qUrl,
  nhom,
  nhomOptions,
  dvtOptions,
  keOptions = [],
  canEdit,
}: {
  rows: VatTuRow[]
  counts: Record<RoVatTu, number>
  total: number
  trang: number
  soTrang: number
  ro: RoVatTu
  q: string
  nhom: string
  nhomOptions: string[]
  dvtOptions: string[]
  /** Mã các ô kệ đang dùng — gợi ý cho ô Kệ. */
  keOptions?: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const dsDvt = useId()
  const dsKe = useId()
  const [q, setQ] = useState(qUrl)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 900
  const [rows, setRows] = useState(initialRows)
  const [busy, setBusy] = useState<string | null>(null)
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [bao, setBao] = useState<Bao | null>(null)
  /** ĐVT lạ đang chờ xác nhận (K4). */
  const [dvtLa, setDvtLa] = useState<{ r: VatTuRow; unit: string } | null>(null)
  /** Tăng khi bỏ ĐVT lạ — dựng lại ô ĐVT để chữ gõ dở trở về đơn vị cũ. */
  const [dvtReset, setDvtReset] = useState(0)

  // Dữ liệu server đổi (đổi tab, sang trang) thì vẽ lại lưới — chỉnh state ngay
  // trong lượt render, không `useEffect`.
  const [seen, setSeen] = useState(initialRows)
  if (seen !== initialRows) {
    setSeen(initialRows)
    setRows(initialRows)
    setChon(new Set())
  }

  const dat = (p: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) s.set(k, v)
      else s.delete(k)
    }
    if (!('trang' in p)) s.delete('trang')
    const qs = s.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  /** Ghi một trường của một mã. Lưới cập nhật LẠC QUAN, hỏng thì trả về cũ. */
  async function ghi(
    id: string,
    patch: Partial<VatTuRow>,
    nhan: string,
  ): Promise<boolean> {
    const truoc = rows.find((r) => r.id === id)
    if (!truoc) return false
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setBusy(id)
    try {
      await api(`/api/dept/warehouse/materials/${id}`, { method: 'PATCH', body: patch })
      return true
    } catch (e) {
      setRows((rs) => rs.map((r) => (r.id === id ? truoc : r)))
      setBao({
        tone: 'stop',
        text: `Không lưu được ${nhan} của ${truoc.code}: ${apiErrorText(e)}`,
      })
      return false
    } finally {
      setBusy(null)
    }
  }

  /** ĐVT: gõ không phân biệt hoa thường → đổi về đúng chữ trong danh sách; lạ thì hỏi. */
  const doiDvt = (r: VatTuRow, go: string) => {
    const v = go.trim()
    if (!v || v === r.unit) return
    const khop = dvtOptions.find((u) => u.toLowerCase() === v.toLowerCase())
    if (khop) {
      if (khop !== r.unit) void ghi(r.id, { unit: khop }, 'đơn vị tính')
    } else setDvtLa({ r, unit: v })
  }

  const raDuoc = rows.filter((r) => chon.has(r.id) && r.needs_review)
  async function daRaXong() {
    let ok = 0
    for (const r of raDuoc)
      if (await ghi(r.id, { needs_review: false }, 'cờ chờ rà')) ok++
    if (ok > 0) {
      setBao({
        tone: 'ok',
        text: `${ok} mã đã rà xong — rời khỏi tab “Chờ Kho rà” khi tải lại.`,
      })
      setChon(new Set())
      router.refresh()
    }
  }
  const lat = (id: string) =>
    setChon((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const tatCa = rows.length > 0 && rows.every((r) => chon.has(r.id))

  const dangLoc = qUrl.trim() !== '' || nhom !== ''
  const viec = RO_VT_VIEC[ro]
  const motMa = chon.size === 1 ? rows.find((r) => chon.has(r.id)) : null

  const tabs: TabMuc[] = THU_TU.map((id) => ({
    key: id,
    label: RO_VT_NHAN[id],
    on: ro === id,
    onClick: () => dat({ ro: id === 'review' ? null : id }),
    n: counts[id],
    tone: counts[id] > 0 ? TAB_MAU[id].tone : undefined,
    mau: TAB_MAU[id].mau,
  }))

  return (
    <KhoKhung label="Danh mục vật tư">
      <DauTrang
        title="Danh mục vật tư"
        ctx={
          <>
            <b>{fmt(counts.all)}</b> mã · Kho giữ ĐVT · kệ · ngưỡng
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<Check size={15} aria-hidden />}
                onClick={() => void daRaXong()}
                why={
                  !canEdit
                    ? 'Tài khoản này không sửa được danh mục'
                    : raDuoc.length === 0
                      ? 'Tích các mã đang chờ rà trước'
                      : busy
                        ? 'Đang lưu…'
                        : null
                }
              >
                {raDuoc.length > 0 ? `Đã rà xong ${raDuoc.length} mã` : 'Đã rà xong'}
              </ApNut>
              <ApNut
                icon={<Boxes size={15} aria-hidden />}
                href={
                  motMa
                    ? `/warehouse/ton?ro=all&q=${encodeURIComponent(motMa.code)}`
                    : undefined
                }
                why={motMa ? null : 'Tích đúng một mã trước'}
              >
                Xem tồn
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut href="/warehouse/ton">Tồn kho</ApNut>
            </ApNhom>
          </>
        }
      />

      <TabNgang label="Việc trên danh mục" tabs={tabs} />

      <ThanhLoc>
        <form
          role="search"
          style={{ display: 'contents' }}
          onSubmit={(e) => {
            e.preventDefault()
            dat({ q: q.trim() || null })
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã hoặc tên vật tư… (Enter)"
            aria-label="Tìm mã hoặc tên vật tư"
          />
        </form>
        <select
          value={nhom}
          className={nhom ? 'on' : undefined}
          onChange={(e) => dat({ nhom: e.target.value || null })}
          aria-label="Nhóm vật tư"
        >
          <option value="">Mọi nhóm vật tư</option>
          {nhomOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {dangLoc && (
          <button
            type="button"
            className="clr"
            onClick={() => {
              setQ('')
              dat({ q: null, nhom: null })
            }}
          >
            Bỏ lọc
          </button>
        )}
        {bao && (
          <span className={bao.tone === 'ok' ? 'kh-ok' : 'kh-stop'} role="status">
            {bao.text}
          </span>
        )}
      </ThanhLoc>

      {viec && (
        <div className="kh-note">
          <span className="tag">{RO_VT_NHAN[ro]}</span>
          <span>{viec}</span>
        </div>
      )}
      {!canEdit && (
        <div className="kh-note mut">
          <span className="tag">Chỉ xem</span>
          <span>
            Đơn vị tính · kệ · ngưỡng là trường của Kho. Tài khoản này xem được nhưng
            không sửa được ở đây.
          </span>
        </div>
      )}

      <datalist id={dsDvt}>
        {dvtOptions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id={dsKe}>
        {keOptions.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {rows.length === 0 ? (
        <Rong
          tieuDe={`Không có mã nào trong “${RO_VT_NHAN[ro]}”`}
          lyDo={
            ro === 'review'
              ? 'Không còn mã nào chờ Kho rà — Cung ứng chưa khai mã mới nào từ lần rà trước.'
              : dangLoc
                ? 'Tab này trống với bộ lọc hiện tại. Bỏ lọc để xem lại.'
                : `Tab này trống. Danh mục đang có ${fmt(counts.all)} mã.`
          }
          tiep={
            <button
              type="button"
              className="kh-btn"
              onClick={() =>
                dangLoc ? dat({ q: null, nhom: null }) : dat({ ro: 'all' })
              }
            >
              {dangLoc ? 'Bỏ lọc' : `Xem tất cả ${fmt(counts.all)} mã`}
            </button>
          }
        />
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Danh mục vật tư">
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 100 }} />
              <col />
              <col style={{ width: 96 }} />
              {!hep && <col style={{ width: 210 }} />}
              <col style={{ width: 108 }} />
              <col style={{ width: 134 }} />
              {!hep && <col style={{ width: 110 }} />}
            </colgroup>
            <thead>
              <tr>
                <th className="c0">
                  <input
                    type="checkbox"
                    checked={tatCa}
                    onChange={() =>
                      setChon(tatCa ? new Set() : new Set(rows.map((r) => r.id)))
                    }
                    aria-label="Chọn cả trang"
                  />
                </th>
                <th>Mã</th>
                <th>Tên vật tư</th>
                <th>ĐVT</th>
                {!hep && <th>Nhóm</th>}
                <th>Kệ gợi ý</th>
                <th className="r">Ngưỡng tối thiểu</th>
                {!hep && <th>Tình trạng</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = chon.has(r.id)
                return (
                  <tr key={r.id} className={on ? 'd f on' : 'd f'} aria-selected={on}>
                    <td className="c0">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => lat(r.id)}
                        aria-label={`Chọn ${r.code}`}
                      />
                    </td>
                    <td className="kh-ma">{r.code}</td>
                    <td
                      title={[r.name, r.group_name, r.sub_group]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {r.name}
                      {hep && (
                        <span
                          className="kh-mut"
                          style={{ display: 'block', fontSize: 11.5 }}
                        >
                          {r.group_name ?? 'chưa có nhóm'}
                        </span>
                      )}
                    </td>
                    <td className={canEdit ? 'go' : undefined}>
                      {canEdit ? (
                        <OChu
                          key={`${r.id}-${dvtReset}`}
                          value={r.unit}
                          onCommit={(v) => doiDvt(r, v)}
                          list={dsDvt}
                          disabled={busy === r.id}
                          label={`Đơn vị tính ${r.code}`}
                        />
                      ) : (
                        r.unit
                      )}
                    </td>
                    {!hep && (
                      <td className="kh-mut" title={r.sub_group ?? undefined}>
                        {r.group_name ?? '—'}
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            color: 'var(--kh-empty)',
                          }}
                        >
                          {r.sub_group ?? 'chưa có nhóm phụ'}
                        </span>
                      </td>
                    )}
                    <td className={canEdit ? 'go' : undefined}>
                      {canEdit ? (
                        <>
                          <OChu
                            value={r.shelf_location ?? ''}
                            onCommit={(v) => void ghi(r.id, { shelf_location: v.trim() || null }, 'kệ gợi ý')} // prettier-ignore
                            placeholder="chưa khai"
                            mono
                            label={`Kệ gợi ý ${r.code}`}
                            disabled={busy === r.id}
                            tone={r.shelf_location ? undefined : 'nen'}
                            list={dsKe}
                          />
                        </>
                      ) : (
                        (r.shelf_location ?? <span className="kh-empty">—</span>)
                      )}
                    </td>
                    <td className={canEdit ? 'r go' : 'r kh-num'}>
                      {canEdit ? (
                        <OSo
                          value={String(r.min_stock)}
                          onCommit={(v) => void ghi(r.id, { min_stock: docSoVn(v) }, 'ngưỡng tối thiểu')} // prettier-ignore
                          label={`Ngưỡng tối thiểu ${r.code}`}
                          disabled={busy === r.id}
                        />
                      ) : (
                        fmt(r.min_stock)
                      )}
                    </td>
                    {!hep && (
                      <td>
                        {r.needs_review ? (
                          <span className="kh-tag warn">chờ rà</span>
                        ) : (
                          <span className="kh-mut">—</span>
                        )}{' '}
                        <Link
                          href={`/warehouse/ton?ro=all&q=${encodeURIComponent(r.code)}`}
                          className="kh-mut"
                          style={{ fontSize: 11.5 }}
                        >
                          tồn ›
                        </Link>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hep ? 6 : 8}>
                  {rows.length} mã trang này · đã chọn {chon.size}
                  {raDuoc.length > 0 && ` (${raDuoc.length} đang chờ rà)`} · rời ô là lưu,
                  mọi lượt sửa vào sổ vết
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left="Tab / Enter đi ô như Excel · sửa xong ô là lưu ô đó · giá mua, NCC, mẫu đơn là của Cung ứng"
        right={
          <>
            <PhanTrang
              trang={trang}
              soTrang={soTrang}
              onDoi={(t) => dat({ trang: t > 1 ? String(t) : null })}
            />
            <b>
              {rows.length} / {fmt(total)}
            </b>{' '}
            mã
          </>
        }
      />

      {dvtLa && (
        <HopThoai
          title={`Đơn vị tính “${dvtLa.unit}” chưa có trong danh sách`}
          subtitle={`${dvtLa.r.code} · ${dvtLa.r.name} — đang là “${dvtLa.r.unit}”`}
          onClose={() => {
            setDvtLa(null)
            setDvtReset((n) => n + 1)
          }}
          footer={
            <>
              <button
                type="button"
                className="kh-btn"
                onClick={() => {
                  setDvtLa(null)
                  setDvtReset((n) => n + 1)
                }}
              >
                Giữ “{dvtLa.r.unit}”
              </button>
              <button
                type="button"
                className="kh-btn p"
                onClick={() => {
                  void ghi(dvtLa.r.id, { unit: dvtLa.unit }, 'đơn vị tính')
                  setDvtLa(null)
                }}
              >
                Vẫn dùng “{dvtLa.unit}”
              </button>
            </>
          }
        >
          <p>
            Danh sách đơn vị đang có {dvtOptions.length} mục. Gõ sai chính tả thì một mã
            sẽ mang đơn vị khác hẳn các mã cùng loại — phiếu nhập, xuất, tồn đều đếm theo
            đơn vị này.
          </p>
        </HopThoai>
      )}
    </KhoKhung>
  )
}
