'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Ban, Boxes, Pencil, Plus, RotateCcw } from 'lucide-react'
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
import { SuaMaHop, ThemMaHop } from './sua-ma'
import { BoMaHop } from './bo-ma'

export type VatTuRow = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  sub_group: string | null
  shelf_location: string | null
  min_stock: number
  is_active: boolean
  /** Lần ngừng dùng gần nhất — chỉ nạp ở rổ "Ngừng dùng". */
  ngung?: { at: string; by: string | null; reason: string | null } | null
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
/** Thứ tự tab theo VIỆC: chưa kệ → chưa ngưỡng → tất cả (rổ "Chờ Kho rà" bỏ 14/10). */
const THU_TU: RoVatTu[] = ['no_shelf', 'no_min', 'all', 'off']
const TAB_MAU: Record<RoVatTu, { mau: string; tone: TabMuc['tone'] }> = {
  no_shelf: { mau: 'c-mut', tone: 'mut' },
  no_min: { mau: 'c-mut', tone: 'mut' },
  all: { mau: 'c-mut', tone: 'mut' },
  off: { mau: 'c-mut', tone: 'mut' },
}

type Bao = { tone: 'ok' | 'stop'; text: string }

/**
 * DANH MỤC VẬT TƯ — bản của Kho. Kho lối ERP · B4 (bản vẽ K-5
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR), viết tay không kit.
 *
 * Tab theo VIỆC: Chưa có kệ · Chưa khai ngưỡng · Tất cả. Lưới sửa
 * tại chỗ như bảng tính — rời ô là `PATCH materials/[id]`, sổ vết 0177 tự ghi:
 *  · ĐVT là Ô GÕ CÓ GỢI Ý (một `datalist` chung) thay hộp chọn 55 lựa chọn mỗi
 *    dòng (50 dòng = 2.750 lựa chọn trong trang). Gõ "kg" ra "Kg"; ĐVT chưa có
 *    trong danh sách thì HỎI trước khi lưu (K4);
 *  · Kệ gợi ý: ô gõ có gợi ý các ô kệ của kho;
 *  · Ngưỡng: ô số kiểu VN.
 * B7a (14/10): Kho SỬA ĐỦ một mã — tích đúng một dòng rồi "Sửa" ở Action Pane,
 * hoặc nhấp đúp dòng (ngoài ô gõ) → hộp `sua-ma.tsx` (nhận diện · quy đổi · tồn
 * trữ; trường mua hàng chỉ xem).
 *
 * Danh mục KHÔNG có vòng đời duyệt. Bước "Chờ Kho rà" (Cung ứng khai vội, Kho
 * xác nhận lại) đã BỎ 14/10/2026 — chủ dự án: "không cần thiết". Trường mua hàng
 * (giá, NCC, mẫu đơn) là của Cung ứng — không sửa ở đây.
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
  canCreate = false,
  canRetire = false,
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
  /** Quyền `warehouse.material.create` — nút Thêm mã (B7b). */
  canCreate?: boolean
  /** Quyền `warehouse.material.retire` — Ngừng dùng / Xoá / Dùng lại (B7c). */
  canRetire?: boolean
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
  /** Mã đang mở hộp Sửa (B7a). */
  const [sua, setSua] = useState<string | null>(null)
  /** Hộp Thêm mã đang mở (B7b). */
  const [them, setThem] = useState(false)
  /** Mã đang mở hộp Ngừng dùng / Xoá (B7c). */
  const [boMa, setBoMa] = useState<VatTuRow | null>(null)

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

  // Chọn MỘT dòng (không còn việc hàng loạt từ khi bỏ "Đã rà xong").
  const lat = (id: string) => setChon((s) => (s.has(id) ? new Set() : new Set([id])))

  const dangLoc = qUrl.trim() !== '' || nhom !== ''
  const viec = RO_VT_VIEC[ro]
  const motMa = chon.size === 1 ? rows.find((r) => chon.has(r.id)) : null
  /*
    Ô GÕ TRÊN DÒNG (B4 "Kho cho người mới", 27/10/2026): đo trước 202 ô gõ sẵn ở
    màn đầu (ĐVT · kệ · ngưỡng × 50 dòng) — người mới không biết sửa ô nào là
    lưu thật. Nay ô chỉ mở ở DÒNG ĐANG CHỌN; riêng tab việc giữ gõ hàng loạt
    cho đúng cột của việc đó (Chưa có kệ → ô Kệ, Chưa khai ngưỡng → ô Ngưỡng).
  */
  const dangSua = (id: string) => canEdit && motMa?.id === id

  /** Dùng lại mã đang ngừng — đảo được nên không hỏi lại, báo tại chỗ. */
  async function dungLai(r: VatTuRow) {
    setBusy(r.id)
    try {
      await api(`/api/dept/warehouse/materials/${r.id}/active`, { method: 'POST', body: { active: true } })
      setBao({ tone: 'ok', text: `${r.code} dùng lại — hiện lại ở ô tìm khi nhập, xuất, soạn đơn.` })
      setChon(new Set())
      router.refresh()
    } catch (e) {
      setBao({ tone: 'stop', text: `Không dùng lại được ${r.code}: ${apiErrorText(e)}` })
    } finally {
      setBusy(null)
    }
  } // prettier-ignore

  // Q4: tab "Ngừng dùng" chỉ hiện khi có mã ngừng (hoặc đang đứng ở đó).
  const tabs: TabMuc[] = THU_TU.filter(
    (id) => id !== 'off' || counts.off > 0 || ro === 'off',
  ).map((id) => ({
    key: id,
    label: RO_VT_NHAN[id],
    on: ro === id,
    onClick: () => dat({ ro: id === 'no_shelf' ? null : id }),
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
                icon={<Plus size={15} aria-hidden />}
                onClick={canCreate ? () => setThem(true) : undefined}
                why={canCreate ? null : 'Tài khoản này không thêm được mã vật tư'}
              >
                Thêm mã
              </ApNut>
              <ApNut
                icon={<Pencil size={15} aria-hidden />}
                onClick={motMa ? () => setSua(motMa.id) : undefined}
                why={
                  !canEdit
                    ? 'Tài khoản này không sửa được danh mục'
                    : motMa
                      ? null
                      : 'Tích đúng một mã trước (hoặc nhấp đúp dòng)'
                }
              >
                {motMa ? `Sửa ${motMa.code}` : 'Sửa mã'}
              </ApNut>
              {motMa && !motMa.is_active ? (
                <ApNut
                  icon={<RotateCcw size={15} aria-hidden />}
                  onClick={canRetire && !busy ? () => void dungLai(motMa) : undefined}
                  why={
                    !canRetire
                      ? 'Tài khoản này không đổi được trạng thái dùng của mã'
                      : busy
                        ? 'Đang lưu…'
                        : null
                  }
                >
                  {`Dùng lại ${motMa.code}`}
                </ApNut>
              ) : (
                <ApNut
                  icon={<Ban size={15} aria-hidden />}
                  onClick={motMa && canRetire ? () => setBoMa(motMa) : undefined}
                  why={
                    !canRetire
                      ? 'Tài khoản này không ngừng dùng / xoá được mã'
                      : motMa
                        ? null
                        : 'Tích đúng một mã trước'
                  }
                >
                  Ngừng dùng / xoá…
                </ApNut>
              )}
            </ApNhom>
            <ApNhom>
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
            dangLoc
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
              {!hep && <col style={{ width: 64 }} />}
            </colgroup>
            <thead>
              <tr>
                <th className="c0" aria-label="Chọn" />
                <th>Mã</th>
                <th>Tên vật tư</th>
                <th>ĐVT</th>
                {!hep && <th>Nhóm</th>}
                <th>Kệ gợi ý</th>
                <th className="r">Ngưỡng tối thiểu</th>
                {!hep && <th>Tồn</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = chon.has(r.id)
                return (
                  <tr
                    key={r.id}
                    className={on ? 'd f on' : 'd f'}
                    aria-selected={on}
                    title={canEdit ? 'Bấm để sửa ĐVT · kệ · ngưỡng — nhấp đúp để sửa cả mã' : undefined} // prettier-ignore
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input, select, a, button'))
                        return
                      setChon(new Set([r.id]))
                    }}
                    onDoubleClick={(e) => {
                      if (!canEdit) return
                      if ((e.target as HTMLElement).closest('input, select, a, button'))
                        return
                      setSua(r.id)
                    }}
                  >
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
                      {!r.is_active && (
                        <span
                          className="kh-mut"
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            whiteSpace: 'normal',
                          }}
                        >
                          <span className="kh-tag warn">ngừng dùng</span>{' '}
                          {r.ngung
                            ? [r.ngung.at.slice(0, 10).split('-').reverse().join('/'), r.ngung.by, r.ngung.reason && `“${r.ngung.reason}”`].filter(Boolean).join(' · ') // prettier-ignore
                            : null}
                        </span>
                      )}
                      {hep && (
                        <span
                          className="kh-mut"
                          style={{ display: 'block', fontSize: 11.5 }}
                        >
                          {r.group_name ?? 'chưa có nhóm'}
                        </span>
                      )}
                    </td>
                    <td className={dangSua(r.id) ? 'go' : undefined}>
                      {dangSua(r.id) ? (
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
                    <td
                      className={
                        canEdit && (ro === 'no_shelf' || dangSua(r.id)) ? 'go' : undefined
                      }
                    >
                      {canEdit && (ro === 'no_shelf' || dangSua(r.id)) ? (
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
                        (r.shelf_location ?? <span className="kh-mut">chưa khai</span>)
                      )}
                    </td>
                    <td
                      className={
                        canEdit && (ro === 'no_min' || dangSua(r.id))
                          ? 'r go'
                          : 'r kh-num'
                      }
                    >
                      {canEdit && (ro === 'no_min' || dangSua(r.id)) ? (
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
                  {rows.length} mã trang này{motMa ? ` · đang chọn ${motMa.code}` : ''} ·
                  bấm dòng để sửa ĐVT · kệ · ngưỡng, rời ô là lưu, mọi lượt sửa vào sổ vết
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left="Tab / Enter đi ô như Excel · sửa xong ô là lưu ô đó · nhấp đúp dòng = sửa đủ mã · giá mua, NCC, mẫu đơn là của Cung ứng"
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

      {boMa && (
        <BoMaHop
          m={boMa}
          onClose={() => setBoMa(null)}
          onDone={(kieu, cau) => {
            if (kieu === 'xoa') setRows((rs) => rs.filter((r) => r.id !== boMa.id))
            setBoMa(null)
            setChon(new Set())
            setBao({ tone: 'ok', text: cau })
            router.refresh()
          }}
        />
      )}

      {them && (
        <ThemMaHop
          nhom={nhom || undefined}
          keList={dsKe}
          onClose={() => setThem(false)}
          onOpenCode={(c) => {
            setThem(false)
            setQ(c)
            dat({ q: c, ro: 'all' })
          }}
          onSaved={(m, cau) => {
            setThem(false)
            setBao({ tone: 'ok', text: cau })
            // Đưa mã vừa thêm lên lưới: tìm đúng mã ở tab Tất cả.
            setQ(m.code)
            dat({ q: m.code, ro: 'all' })
            router.refresh()
          }}
        />
      )}

      {sua && (
        <SuaMaHop
          id={sua}
          keList={dsKe}
          onClose={() => setSua(null)}
          onSaved={(m, cau) => {
            setRows((rs) =>
              rs.map((r) =>
                r.id === m.id
                  ? {
                      ...r,
                      code: m.code,
                      name: m.name,
                      unit: m.unit,
                      group_name: m.group_name,
                      sub_group: m.sub_group,
                      shelf_location: m.shelf_location,
                      min_stock: m.min_stock,
                    }
                  : r,
              ),
            )
            setSua(null)
            setBao({ tone: 'ok', text: cau })
            router.refresh()
          }}
        />
      )}

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
