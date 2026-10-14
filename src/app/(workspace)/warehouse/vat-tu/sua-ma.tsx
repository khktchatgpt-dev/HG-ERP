'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { fieldsClearedByPayload } from '@/lib/material-group-fields'
import { barLengthFromName, saveBlockReason } from '@/lib/material-edit'
import {
  coreFromMaterial,
  useMaterialCore,
  type MaterialCore,
} from '@/components/warehouse/useMaterialCore'
import type { Material } from '@/modules/dept/warehouse/warehouse.repo'
import { GoiY, HopThoai, OChu, OSo, docSoVn } from '../_erp/o-nhap'
import {
  DoiChieu,
  LichSu,
  OMaMoi,
  XacNhanDoiMa,
  ngay,
  tien,
  useMaTuCap,
  type GiaMua,
  type ThayDoi,
} from './sua-ma-phu'

const soChu = (v: string) => (v.trim() === '' ? '' : String(docSoVn(v)))

/**
 * SỬA MÃ VẬT TƯ — bản của Kho (B7a, bản vẽ K-5c
 * https://claude.ai/artifact/FZeQh7hzZPTFtQFYYZsrFB, duyệt 14/10/2026).
 *
 * Viết tay theo lối Kho, KHÔNG dùng chung giao diện với panel Sửa của Mua hàng —
 * nhưng dùng CHUNG BỘ NÃO `useMaterialCore` (đọc kg/m từ tên, cổng barem, ĐVT
 * lạ, dò gần trùng, ghi null ô ngoài nhóm) và cùng `PATCH materials/[id]`, nên
 * hai phòng không thể ghi lệch luật nhau. Bốn khối:
 *   · Nhận diện + Quy đổi — trường nền hai phòng cùng dùng;
 *   · Tồn trữ — của Kho (kệ, ngưỡng, mã vạch);
 *   · Mua hàng — CHỈ XEM (Q1: giá, NCC, nhận vượt là việc của Cung ứng).
 * Bước "Chờ Kho rà" đã BỎ ở cả hai phòng (14/10/2026) — hộp không đọc, không ghi
 * cờ `needs_review` nữa.
 * Q3: đổi mã qua hộp xác nhận nói số dòng định mức SP / BOM lệnh đổi theo.
 *
 * THÊM MÃ (B7b, bản vẽ K-5d) = chính hộp này với `m = null`: cùng bộ ô, cùng
 * luật; thêm mã tự cấp theo nhóm (Nhóm đứng đầu vì nhóm quyết định mã) và bước
 * đối chiếu tên gần giống phải tích mới lưu. Khối Mua hàng ẩn; kệ, ngưỡng, mã
 * vạch khai luôn được (Kho giữ `warehouse.material.update`). `POST materials`.
 */
export function SuaMaHop({
  id,
  keList,
  onClose,
  onSaved,
}: {
  id: string
  /** id `<datalist>` các ô kệ (màn đã dựng sẵn). */
  keList: string
  onClose: () => void
  /** Bản đã lưu (từ PATCH) — màn cập nhật dòng + làm mới. */
  onSaved: (m: Material, cau: string) => void
}) {
  const [m, setM] = useState<Material | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    api<{ material: Material }>(`/api/dept/warehouse/materials/${id}`)
      .then((r) => live && setM(r.material))
      .catch((e) => live && setLoi(apiErrorText(e)))
    return () => {
      live = false
    }
  }, [id])

  if (!m)
    return (
      <HopThoai
        title="Sửa mã vật tư"
        onClose={onClose}
        width={760}
        footer={
          <button type="button" className="kh-btn" onClick={onClose}>
            Đóng
          </button>
        }
      >
        {loi ? (
          <p className="kh-stop">Không mở được vật tư: {loi}</p>
        ) : (
          <p className="kh-mut">Đang tải…</p>
        )}
      </HopThoai>
    )
  return <Form m={m} keList={keList} onClose={onClose} onSaved={onSaved} />
}

/** Thêm mã mới (B7b). `nhom` = nhóm đang lọc ở danh sách, điền sẵn. */
export function ThemMaHop({
  nhom,
  keList,
  onClose,
  onSaved,
  onOpenCode,
}: {
  nhom?: string
  keList: string
  onClose: () => void
  onSaved: (m: Material, cau: string) => void
  /** Bấm "dùng mã này" ở khối gần giống — đóng hộp, tìm mã đó. */
  onOpenCode: (code: string) => void
}) {
  return (
    <Form
      m={null}
      nhom={nhom}
      keList={keList}
      onClose={onClose}
      onSaved={onSaved}
      onOpenCode={onOpenCode}
    />
  )
}

function Form({
  m,
  nhom,
  keList,
  onClose,
  onSaved,
  onOpenCode,
}: {
  /** null = THÊM mã mới (B7b). */
  m: Material | null
  nhom?: string
  keList: string
  onClose: () => void
  onSaved: (m: Material, cau: string) => void
  onOpenCode?: (code: string) => void
}) {
  const dsDvt = useId()
  const dsCon = useId()
  const dsVl = useId()
  const dsMau = useId()
  const [tab, setTab] = useState<'tt' | 'ls'>('tt')
  const [busy, setBusy] = useState(false)
  const [loiGhi, setLoiGhi] = useState<string | null>(null)
  const [daThu, setDaThu] = useState(false)

  const s = useMaterialCore({ active: true, initial: m ? coreFromMaterial(m) : { group_name: nhom ?? '' }, excludeCode: m?.code }) // prettier-ignore
  const { f } = s
  const set = (k: keyof MaterialCore) => (v: string) => s.setF((p) => ({ ...p, [k]: v }))

  const [kho, setKho] = useState({
    shelf: m?.shelf_location ?? '',
    min: String(m?.min_stock ?? 0),
    barcode: m?.barcode ?? '',
  })
  const [maSua, setMaSua] = useState(m?.code ?? '')
  const maMoi = maSua.trim().replace(/\s+/g, ' ')
  const doiMa = !!m && maMoi !== '' && maMoi !== m.code
  const ma = useMaTuCap(m ? '' : f.group_name)
  /** Tên đã đối chiếu gần giống (chỉ khi THÊM) — sửa tên là phải đối chiếu lại. */
  const [daDoiChieu, setDaDoiChieu] = useState('')
  const canDoiChieu = !m && s.similar.length > 0 && daDoiChieu !== f.name
  /** Hộp xác nhận đổi mã: số dòng mã chữ sẽ đổi theo (Q3). */
  const [xacNhanMa, setXacNhanMa] = useState<{ parts: number; boms: number } | null>(null)

  // Lịch sử + giá mua nạp sau; hỏng thì hộp sửa vẫn dùng được.
  const [doi, setDoi] = useState<ThayDoi[] | null>(null)
  const [gia, setGia] = useState<GiaMua[] | null>(null)
  useEffect(() => {
    if (!m) return
    let live = true
    api<{ changes: ThayDoi[] }>(`/api/dept/warehouse/materials/${m.id}/changes`)
      .then((r) => live && setDoi(r.changes))
      .catch(() => live && setDoi([]))
    api<{ prices: GiaMua[] }>(`/api/dept/supply/materials/${m.id}/price-history`)
      .then((r) => live && setGia(r.prices))
      .catch(() => live && setGia([]))
    return () => {
      live = false
    }
  }, [m])

  const payload = s.corePayload()
  const cleared = useMemo(() => (m ? fieldsClearedByPayload(m as unknown as Record<string, unknown>, payload) : []), [m, payload]) // prettier-ignore
  const clearKey = cleared.map((c) => c.field).join(',')
  const [clearOkFor, setClearOkFor] = useState('')
  const barHint = barLengthFromName(f.name)
  const units = useMemo(() => [...new Set([...s.tax.units, m?.unit ?? ''].filter(Boolean))], [s.tax.units, m?.unit]) // prettier-ignore
  const unitWarnOpen = s.unitWarn != null && !s.unitConfirmed

  const why =
    saveBlockReason({
      name: f.name,
      unit: f.unit,
      unitUnconfirmed: unitWarnOpen,
      baremUnconfirmed: s.baremBlocked && !s.baremConfirmed,
      kgOffPct: s.kgOff || null,
      clearedUnconfirmed: clearOkFor === clearKey ? [] : cleared.map((c) => c.label),
    }) ??
    (!f.group_name.trim() ? 'chọn nhóm' : null) ??
    (m && maSua.trim() === '' ? 'mã vật tư không để trống' : null) ??
    (!m && ma.rieng && !ma.code.trim() ? 'gõ mã riêng hoặc bấm “tự cấp mã”' : null) ??
    (canDoiChieu ? `tích “đã đối chiếu” ${s.similar.length} mã gần giống` : null)

  async function ghi() {
    setBusy(true)
    setLoiGhi(null)
    try {
      const r = await api<{ material: Material }>(
        m ? `/api/dept/warehouse/materials/${m.id}` : '/api/dept/warehouse/materials',
        {
          method: m ? 'PATCH' : 'POST',
          body: {
            ...payload,
            // THÊM: bỏ trống = server tự cấp (đúng hàm đã cho xem trước).
            ...(m
              ? doiMa
                ? { code: maMoi }
                : {}
              : { code: ma.rieng ? ma.code.trim() : null }),
            shelf_location: kho.shelf.trim() || null,
            min_stock: docSoVn(kho.min),
            barcode: kho.barcode.trim() || null,
          },
        },
      )
      onSaved(
        r.material,
        !m
          ? `Đã thêm ${r.material.code} — dùng được ngay ở phiếu nhập, xuất và đơn mua.`
          : doiMa
            ? `Đã đổi mã ${m.code} → ${r.material.code} — phiếu, đơn đã có tự hiện mã mới; định mức SP và BOM lệnh đã đổi theo.`
            : `Đã lưu ${r.material.code}.`,
      )
    } catch (e) {
      setLoiGhi(apiErrorText(e))
      setBusy(false)
      setXacNhanMa(null)
    }
  }

  async function bamLuu() {
    setDaThu(true)
    if (why || busy) return
    if (!doiMa) return void ghi()
    // Q3: đổi mã thì nói trước số dòng mã chữ đổi theo, rồi mới ghi.
    setBusy(true)
    try {
      const r = await api<{ refs: { parts: number; boms: number } }>(
        `/api/dept/warehouse/materials/${m.id}/code-refs`,
      )
      setXacNhanMa(r.refs)
    } catch (e) {
      setLoiGhi(`Không đếm được chỗ dùng mã: ${apiErrorText(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const can = (need: boolean) => (need ? 'k need' : 'k')
  const tay = doi?.filter((c) => c.source !== 'import').length ?? null
  const lanMua = gia?.[0] ?? null

  const oNhom = (
    <label>
      <span className={can(daThu && !f.group_name.trim())}>Nhóm *</span>
      <select
        className="kh-o"
        value={f.group_name}
        onChange={(e) =>
          s.setF((p) => ({ ...p, group_name: e.target.value, sub_group: '' }))
        }
        aria-label="Nhóm"
      >
        <option value="">— chưa chọn —</option>
        {s.tax.groups.map((g) => (
          <option key={g.name} value={g.name}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  )

  if (m && xacNhanMa)
    return (
      <XacNhanDoiMa
        m={m}
        maMoi={maMoi}
        refs={xacNhanMa}
        busy={busy}
        onBack={() => setXacNhanMa(null)}
        onOk={() => void ghi()}
      />
    )

  return (
    <HopThoai
      title={m ? `Sửa mã ${m.code}` : 'Thêm mã vật tư'}
      subtitle={
        m
          ? [m.group_name ?? 'chưa nhóm', m.is_active ? null : 'ĐANG NGỪNG DÙNG'].filter(Boolean).join(' · ') // prettier-ignore
          : 'mã cấp khi lưu · chọn nhóm trước, nhóm quyết định mã'
      }
      onClose={onClose}
      width={780}
      footer={
        <>
          <span style={{ marginRight: 'auto', fontSize: 12.5 }}>
            {loiGhi ? (
              <span className="kh-stop" role="alert">
                Chưa lưu được: {loiGhi}
              </span>
            ) : why && daThu ? (
              <span className="kh-stop">Chưa lưu được: {why}</span>
            ) : (
              <span className="kh-mut">
                {m
                  ? 'Lưu là đổi cho mọi phiếu, đơn sau · vào sổ vết'
                  : 'Mã mới dùng được ngay ở phiếu nhập, xuất, đơn mua'}
              </span>
            )}
          </span>
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={!!why || busy || undefined}
            title={why ?? undefined}
            onClick={() => void bamLuu()}
          >
            {busy ? 'Đang lưu…' : m ? 'Lưu' : 'Thêm mã'}
          </button>
        </>
      }
    >
      {m && (
        <div
          className="kh-in-tabs"
          role="tablist"
          aria-label="Nội dung mã"
          style={{ margin: '-12px -14px 0' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tt'}
            onClick={() => setTab('tt')}
          >
            Thông tin
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ls'}
            onClick={() => setTab('ls')}
          >
            Lịch sử{tay != null ? ` · ${tay}` : ''}
          </button>
        </div>
      )}

      {tab === 'ls' ? (
        <LichSu doi={doi} gia={gia} />
      ) : (
        <>
          <datalist id={dsDvt}>
            {units.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <datalist id={dsCon}>
            {s.subs.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id={dsVl}>
            {s.grades.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id={dsMau}>
            {s.finishes.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>

          <div className="kh-sec">
            <div className="st">
              Nhận diện<span className="o">dùng chung hai phòng</span>
            </div>
            <div className="kh-fg">
              {!m && oNhom}
              <label>
                <span
                  className={can(
                    daThu && (m ? maSua.trim() === '' : ma.rieng && !ma.code.trim()),
                  )}
                >
                  Mã
                </span>
                {m ? (
                  <OChu value={maSua} onCommit={setMaSua} mono label="Mã vật tư" />
                ) : (
                  <OMaMoi
                    ma={ma}
                    group={f.group_name}
                    need={daThu && ma.rieng && !ma.code.trim()}
                  />
                )}
              </label>
              <label className="w2">
                <span className={can(daThu && !f.name.trim())}>Tên vật tư *</span>
                <OChu
                  value={f.name}
                  onCommit={set('name')}
                  label="Tên vật tư"
                  maxLength={200}
                />
              </label>
              <label>
                <span className={can(unitWarnOpen || (daThu && !f.unit.trim()))}>
                  ĐVT *
                </span>
                <OChu
                  value={f.unit}
                  onCommit={set('unit')}
                  list={dsDvt}
                  label="ĐVT"
                  tone={unitWarnOpen ? 'need' : undefined}
                />
              </label>
              <label>
                <span className="k">Quy cách</span>
                <OChu
                  value={f.spec}
                  onCommit={set('spec')}
                  mono
                  label="Quy cách"
                  placeholder={s.groupCfg.specPlaceholder}
                />
              </label>
              {m && oNhom}
              <label>
                <span className="k">Nhóm con</span>
                <OChu
                  value={f.sub_group}
                  onCommit={set('sub_group')}
                  list={dsCon}
                  label="Nhóm con"
                  placeholder="gõ hoặc chọn…"
                />
              </label>
              <label>
                <span className="k">Vật liệu / màu</span>
                <OChu
                  value={f.material_grade}
                  onCommit={set('material_grade')}
                  list={dsVl}
                  label="Vật liệu / màu"
                  placeholder={s.groupCfg.gradePlaceholder}
                />
              </label>
              {s.groupCfg.showFinish && (
                <label>
                  <span className="k">Màu / bề mặt</span>
                  <OChu
                    value={f.finish}
                    onCommit={set('finish')}
                    list={dsMau}
                    label="Màu / bề mặt"
                    placeholder="inox bóng, xi trắng…"
                  />
                </label>
              )}
              {s.groupCfg.showCarton && (
                <>
                  <label>
                    <span className="k">Cách mở thùng</span>
                    <OChu
                      value={f.open_style}
                      onCommit={set('open_style')}
                      label="Cách mở thùng"
                      placeholder="AD / MR / ĐK"
                    />
                  </label>
                  <label>
                    <span className="k">SP mỗi thùng</span>
                    <OSo
                      value={f.pcs_per_ctn}
                      onCommit={(v) => set('pcs_per_ctn')(soChu(v))}
                      label="SP mỗi thùng"
                    />
                  </label>
                </>
              )}
              {doiMa && (
                <div className="w4">
                  <GoiY tone="warn">
                    Đổi mã {m?.code} → <b>{maMoi}</b>: bấm Lưu sẽ hỏi lại, kèm số dòng
                    định mức SP / BOM lệnh đổi theo.
                  </GoiY>
                </div>
              )}
              {s.specSuggest && !f.spec.trim() && (
                <div className="w4">
                  <GoiY tone="mut" onClick={() => set('spec')(s.specSuggest ?? '')}>
                    Tên có quy cách “{s.specSuggest}” — bấm để điền
                  </GoiY>
                </div>
              )}
            </div>
          </div>

          {unitWarnOpen && s.unitWarn && (
            <div className="kh-note stop">
              <span className="tag">ĐVT lạ</span>
              <span>
                {s.unitWarn.kind === 'suggest'
                  ? `Danh mục có “${s.unitWarn.suggest}” — nghi gõ nhầm.`
                  : `ĐVT “${f.unit}” chưa ai dùng trong danh mục.`}{' '}
                Phiếu nhập, xuất, tồn đều đếm theo đơn vị này.{' '}
                <button
                  type="button"
                  className="kh-lnk"
                  style={{ fontFamily: 'inherit' }}
                  onClick={s.confirmUnit}
                >
                  Đúng là “{f.unit}”
                </button>
              </span>
            </div>
          )}
          {!m && s.similar.length > 0 && (
            <DoiChieu
              similar={s.similar}
              ok={daDoiChieu === f.name}
              onOk={(on) => setDaDoiChieu(on ? f.name : '')}
              onOpenCode={(c) => onOpenCode?.(c)}
            />
          )}
          {m && s.similar.length > 0 && (
            <div className="kh-note">
              <span className="tag">Gần trùng</span>
              <span>
                Nhóm này đã có {s.similar.map((x) => `${x.code} · ${x.name}`).join('; ')}.
                Hai mã một hàng thì tồn tách làm hai.
              </span>
            </div>
          )}
          {cleared.length > 0 && clearOkFor !== clearKey && (
            <div className="kh-note stop">
              <span className="tag">Lưu sẽ xoá</span>
              <span>
                Nhóm / hàng mới không dùng:{' '}
                {cleared.map((c) => `${c.label} ${c.oldValue}`).join(' · ')}.{' '}
                <button
                  type="button"
                  className="kh-lnk"
                  style={{ fontFamily: 'inherit' }}
                  onClick={() => setClearOkFor(clearKey)}
                >
                  Tôi hiểu, xoá khi lưu
                </button>
              </span>
            </div>
          )}

          {(s.needsBarWeight || (s.needsWeight && s.sheetLike)) && (
            <div className="kh-sec">
              <div className="st">
                Quy đổi
                <span className="o">số nhân thẳng vào cân thép, định mức, tiền</span>
              </div>
              <div className="kh-fg">
                {s.needsBarWeight ? (
                  <>
                    <label>
                      <span className={can(s.baremBlocked && !s.baremConfirmed)}>
                        kg / m
                      </span>
                      <OSo
                        value={f.kg_per_m}
                        onCommit={(v) => set('kg_per_m')(soChu(v))}
                        label="kg trên mét"
                        tone={s.baremBlocked && !s.baremConfirmed ? 'need' : undefined}
                      />
                    </label>
                    <label>
                      <span className="k">Dài cây (m)</span>
                      <OSo
                        value={f.default_bar_length_m}
                        onCommit={(v) => set('default_bar_length_m')(soChu(v))}
                        label="Dài cây (m)"
                      />
                    </label>
                  </>
                ) : (
                  <label>
                    <span className="k">kg mỗi {f.unit || 'đơn vị'}</span>
                    <OSo
                      value={f.kg_per_unit}
                      onCommit={(v) => set('kg_per_unit')(soChu(v))}
                      label="kg mỗi đơn vị"
                    />
                  </label>
                )}
                <div className="w2" style={{ justifyContent: 'flex-end' }}>
                  {s.derived?.kg != null && (
                    <GoiY tone="mut">
                      Máy đọc từ tên:{' '}
                      {s.derived.kg.toLocaleString('vi-VN', { maximumFractionDigits: 4 })}{' '}
                      kg/m
                      {f.kg_per_m.trim()
                        ? s.kgMismatch
                          ? ` — lệch ${Math.round(s.kgOff * 100)}%`
                          : ' — khớp (trong 5%)'
                        : ' — ô trống thì lưu số này'}
                    </GoiY>
                  )}
                  {s.needsBarWeight &&
                    !f.default_bar_length_m.trim() &&
                    barHint != null && (
                      <GoiY
                        tone="mut"
                        onClick={() => set('default_bar_length_m')(String(barHint))}
                      >
                        Điền dài cây {barHint} m (đọc từ tên)
                      </GoiY>
                    )}
                  {s.needsBarWeight &&
                    f.kg_per_m.trim() &&
                    f.default_bar_length_m.trim() && (
                      <GoiY tone="mut">
                        ≈{' '}
                        {(
                          Number(f.kg_per_m) * Number(f.default_bar_length_m)
                        ).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}{' '}
                        kg / cây
                      </GoiY>
                    )}
                </div>
              </div>
              {s.baremBlocked && !s.baremConfirmed && (
                <div
                  className="kh-note stop"
                  style={{ borderTop: '1px solid var(--kh-hair)' }}
                >
                  <span className="tag">Barem lệch</span>
                  <span>
                    Số gõ lệch quá 5% so với số máy tính — nghi gõ nhầm dấu chấm.{' '}
                    <button
                      type="button"
                      className="kh-lnk"
                      style={{ fontFamily: 'inherit' }}
                      onClick={s.confirmBarem}
                    >
                      Đúng là số này
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="kh-sec">
            <div className="st">
              Tồn trữ<span className="o">của Kho</span>
            </div>
            <div className="kh-fg">
              <label>
                <span className="k">Kệ gợi ý</span>
                <OChu
                  value={kho.shelf}
                  onCommit={(v) => setKho((k) => ({ ...k, shelf: v }))}
                  list={keList}
                  mono
                  label="Kệ gợi ý"
                  placeholder="chưa khai"
                  tone={kho.shelf ? undefined : 'nen'}
                />
              </label>
              <label>
                <span className="k">Ngưỡng tối thiểu</span>
                <OSo
                  value={kho.min}
                  onCommit={(v) => setKho((k) => ({ ...k, min: soChu(v) || '0' }))}
                  label="Ngưỡng tối thiểu"
                />
              </label>
              <label>
                <span className="k">Mã vạch</span>
                <OChu
                  value={kho.barcode}
                  onCommit={(v) => setKho((k) => ({ ...k, barcode: v }))}
                  mono
                  label="Mã vạch"
                  placeholder="EAN của NCC (nếu có)"
                />
              </label>
            </div>
          </div>

          {m && (
            <div className="kh-sec">
              <div className="st">
                Mua hàng<span className="o">Cung ứng giữ · chỉ xem</span>
              </div>
              <div className="kh-fg">
                <div>
                  <span className="k">Giá tham chiếu</span>
                  <span className="ro kh-num">
                    {m.last_purchase_price != null
                      ? `${tien(m.last_purchase_price)} ₫/${m.price_unit || m.unit}`
                      : '— chưa có'}
                  </span>
                </div>
                <div className="w3">
                  <span className="k">Lần mua gần nhất</span>
                  <span
                    className="ro"
                    style={{ whiteSpace: 'normal', paddingBlock: 3 }}
                    title={
                      lanMua
                        ? `${lanMua.po_code} · ${lanMua.supplier_name ?? ''}`
                        : undefined
                    }
                  >
                    {gia == null
                      ? 'đang tải…'
                      : lanMua
                        ? `${lanMua.po_code} · ${lanMua.supplier_name ?? 'NCC ?'} · ${tien(lanMua.unit_price, lanMua.currency)} ${lanMua.currency} · ${ngay(lanMua.at)}`
                        : 'chưa đơn nào mua mã này'}
                  </span>
                </div>
                <div>
                  <span className="k">Nhận vượt tối đa</span>
                  <span className="ro kh-num">
                    {(m.over_tolerance_pct ?? 0).toLocaleString('vi-VN')} %
                  </span>
                </div>
                <div className="w4">
                  <GoiY tone="mut">
                    NCC mặc định {m.default_supplier_id ? 'đã chọn' : 'chưa chọn'} · giá,
                    NCC, nhận vượt, mẫu đơn sửa ở Mua hàng › Vật tư.
                  </GoiY>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </HopThoai>
  )
}
