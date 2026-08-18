'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, TriangleAlert, Upload } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'

/**
 * TẠO SẢN PHẨM MỚI TỪ FILE BOM.
 *
 * Khác `BomAiImport` (đọc định mức cho hồ sơ CÓ SẴN) ở chỗ đọc thêm khối thông
 * tin chung ở đầu file — tên, mã khách, KTSP, đóng gói — nên dựng được cả hồ sơ
 * chứ không chỉ định mức.
 *
 * Vẫn giữ nguyên nguyên tắc của luồng kia: mô hình chỉ đề xuất, người dùng soi
 * và sửa, không có gì được ghi cho tới khi bấm Tạo. Ở đây còn quan trọng hơn vì
 * một hồ sơ sai sẽ đi theo sản phẩm suốt vòng đời.
 *
 * Bản nháp định mức KHÔNG cho sửa từng dòng ở màn này — cố ý. Việc ở đây là
 * dựng đúng hồ sơ; soi kỹ từng dòng quy cách thì làm ở tab Định mức của SP vừa
 * tạo, nơi có đủ lưới, cột khối lượng tính và nút sửa.
 */

const ACCEPT =
  '.xlsx,.pdf,.png,.jpg,.jpeg,.webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,image/png,image/jpeg,image/webp'

type DraftProduct = {
  name: string | null
  code: string | null
  customer_item_code: string | null
  customer_name: string | null
  unit: string | null
  product_type: string | null
  frame_material: string | null
  /** Thông số hỗ trợ in LSX — BOM không ghi thì trống, LSX in ô trống. */
  spec_paint: string | null
  spec_wood: string | null
  spec_glass: string | null
  spec_cushion: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  carton_l_mm: number | null
  carton_w_mm: number | null
  carton_h_mm: number | null
  qty_per_carton: number | null
  loading_40hc: number | null
  nw_kg: number | null
  gw_kg: number | null
  confidence: number
}

type Draft = {
  product: DraftProduct
  sections: {
    group_code: string
    section_title: string | null
    unit_basis: string | null
    lines: Record<string, unknown>[]
  }[]
  meta: {
    provider: string
    model: string
    filename: string
    truncated: string[]
    dropped: number
    lines: number
    embeddedImageBytes: number | null
  }
}

const head =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-[var(--primary)] focus:outline-none'

const nOrNull = (v: string) => {
  const s = v.trim().replace(',', '.')
  if (!s) return null
  const x = Number(s)
  return Number.isFinite(x) ? x : null
}
const show = (v: number | null) => (v == null ? '' : String(v))
/** Ảnh vài trăm byte mà làm tròn về "0 KB" thì trông như hỏng — dưới 1 KB ghi byte. */
const fileSize = (b: number) => (b < 1024 ? `${b} byte` : `${(b / 1024).toFixed(0)} KB`)
/** mm → cm cho bộ `packing.*_cm`; biểu mẫu BOM ghi KTBB bằng mm. */
const mmToCm = (v: number | null) => (v == null ? undefined : Math.round(v) / 10)

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Không đọc được file'))
    r.onload = () => {
      const s = String(r.result)
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.readAsDataURL(file)
  })
}

export function BomAiNewProduct({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [picked, setPicked] = useState<File | null>(null)
  /** Mặc định BẬT cả hai: đã có sẵn trong file thì lưu luôn, đỡ một vòng thao tác. */
  const [saveFile, setSaveFile] = useState(true)
  const [saveImage, setSaveImage] = useState(true)
  const [busy, setBusy] = useState<'read' | 'create' | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [p, setP] = useState<DraftProduct | null>(null)

  /**
   * File có ghi sẵn mã HG hợp lệ (và chưa ai dùng) thì GIỮ mã đó — nó là mã
   * thật của sản phẩm ngoài đời. Chỉ khi file bỏ trống mới xin mã tự động, và
   * lúc đó phải theo đúng quy tắc đánh số như form "Thêm sản phẩm".
   */
  const [manualCode, setManualCode] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)

  const patch = (v: Partial<DraftProduct>) =>
    setP((old) => (old ? { ...old, ...v } : old))

  /** Xin mã kế tiếp cho (loại, vật liệu) — cùng nguồn với form tạo SP chuẩn. */
  const fetchCode = useCallback(
    async (type: string, material: string) => {
      setCodeBusy(true)
      try {
        const r = await api<{ code: string }>(
          `/api/dept/technical/products/next-code?type=${type}&material=${material}`,
        )
        setP((old) => (old ? { ...old, code: r.code } : old))
      } catch (e) {
        toast.error('Chưa cấp được mã', apiErrorText(e))
      } finally {
        setCodeBusy(false)
      }
    },
    [toast],
  )

  /**
   * Đổi loại / vật liệu → mã phải đổi theo, vì hai thứ đó nằm NGAY TRONG mã
   * (CH…HG-IN). Không cấp lại là hồ sơ có mã nói một đằng, cột phân loại một nẻo.
   */
  function pick(next: { product_type?: string | null; frame_material?: string | null }) {
    if (!p) return
    const type = next.product_type ?? p.product_type
    const material = next.frame_material ?? p.frame_material
    patch(next)
    if (!manualCode && type && material) void fetchCode(type, material)
  }

  async function read() {
    if (!picked) return
    setBusy('read')
    try {
      const d = await api<Draft>('/api/dept/technical/products/from-bom', {
        method: 'POST',
        body: {
          filename: picked.name,
          mime: picked.type,
          data_base64: await toBase64(picked),
        },
      })
      setDraft(d)
      setP(d.product)
      setManualCode(false)
      // File không ghi mã (hoặc mã đã có SP dùng, service đã bỏ) → cấp mã theo
      // đúng quy tắc ngay, đừng bắt người dùng tự nghĩ ra số thứ tự.
      if (!d.product.code && d.product.product_type && d.product.frame_material) {
        void fetchCode(d.product.product_type, d.product.frame_material)
      }
      toast.success(
        `Đọc xong ${d.meta.lines} dòng định mức`,
        'Kiểm lại thông tin sản phẩm trước khi tạo',
      )
    } catch (e) {
      toast.error('Đọc file thất bại', apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function create() {
    if (!draft || !p) return
    if (!p.code?.trim() || !p.name?.trim()) {
      return toast.error('Thiếu thông tin bắt buộc', 'Cần cả mã sản phẩm và tên')
    }
    setBusy('create')
    try {
      const r = await api<{
        product_id: string
        code: string
        added: number
        saved_file: boolean
        saved_image: boolean
      }>('/api/dept/technical/products/from-bom?create=1', {
        method: 'POST',
        body: {
          product: {
            code: p.code.trim(),
            name: p.name.trim(),
            customer_item_code: p.customer_item_code,
            customer_name: p.customer_name,
            unit: p.unit || 'cai',
            product_type: p.product_type,
            frame_material: p.frame_material,
            tech_spec: {
              paint: p.spec_paint ?? undefined,
              wood: p.spec_wood ?? undefined,
              glass: p.spec_glass ?? undefined,
              cushion: p.spec_cushion ?? undefined,
            },
            length_mm: p.length_mm,
            width_mm: p.width_mm,
            height_mm: p.height_mm,
            packing: {
              carton_l_cm: mmToCm(p.carton_l_mm),
              carton_w_cm: mmToCm(p.carton_w_mm),
              carton_h_cm: mmToCm(p.carton_h_mm),
              qty_per_carton: p.qty_per_carton ?? undefined,
              loading_40hc: p.loading_40hc ?? undefined,
              nw_kg: p.nw_kg ?? undefined,
              gw_kg: p.gw_kg ?? undefined,
            },
          },
          sections: draft.sections,
          // Gửi lại file để đính vào hồ sơ + bóc ảnh nhúng. `picked` vẫn còn
          // trong bộ nhớ trình duyệt nên không phải đọc lại từ đĩa.
          source_file:
            picked && (saveFile || saveImage)
              ? {
                  filename: picked.name,
                  mime: picked.type,
                  data_base64: await toBase64(picked),
                  save_file: saveFile,
                  save_image: saveImage,
                }
              : undefined,
        },
      })
      const extras = [
        `${r.added} dòng định mức`,
        r.saved_file && 'đã đính file BOM',
        r.saved_image && 'đã lấy ảnh SP',
      ].filter(Boolean)
      toast.success(`Đã tạo ${r.code}`, `Kèm ${extras.join(' · ')}`)
      router.push(`/products/${r.product_id}/dinh-muc`)
      onClose()
    } catch (e) {
      setBusy(null)
      // Ai đó vừa lấy mất số này giữa lúc mình đang soi form — xin số mới ngay
      // để người dùng chỉ việc bấm lại, không phải đoán số kế tiếp.
      if (
        e instanceof ApiError &&
        e.code === 'CODE_TAKEN' &&
        !manualCode &&
        p.product_type &&
        p.frame_material
      ) {
        await fetchCode(p.product_type, p.frame_material)
        toast.error('Mã vừa bị dùng', 'Đã cấp mã mới — bấm Tạo lần nữa')
        return
      }
      toast.error('Tạo sản phẩm thất bại', apiErrorText(e))
    }
  }

  const lowConfidence = p != null && p.confidence < 0.8

  return (
    <Modal
      open
      onClose={onClose}
      title="AI tạo sản phẩm từ file BOM"
      maxWidth="sm:max-w-3xl"
    >
      <TopProgressBar active={busy !== null} />
      <div className="flex flex-col gap-3">
        {!draft && (
          <>
            <p className="text-muted-foreground text-xs">
              Đọc cả <b>thông tin sản phẩm</b> (tên, mã khách, kích thước, đóng gói) lẫn{' '}
              <b>định mức</b> từ một file BOM, rồi dựng hồ sơ mới. Không có gì được ghi
              cho tới khi bạn bấm Tạo.
            </p>

            <label className="flex cursor-pointer flex-col gap-1.5">
              <div className="hover:bg-muted flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-xs">
                <Upload className="size-4 shrink-0" />
                {picked ? (
                  <span className="truncate">
                    {picked.name}{' '}
                    <span className="text-muted-foreground">
                      ({(picked.size / 1024).toFixed(0)} KB)
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Bấm để chọn file BOM (.xlsx, PDF hoặc ảnh)
                  </span>
                )}
              </div>
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => setPicked(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="hover:bg-muted rounded-md border px-4 py-2 text-sm"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={busy !== null || !picked}
                onClick={() => void read()}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-50"
              >
                {busy === 'read' ? (
                  <Spinner size={14} />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {busy === 'read' ? 'Đang đọc…' : 'Đọc file'}
              </button>
            </div>
          </>
        )}

        {draft && p && (
          <>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 rounded-md border p-2.5 text-xs">
              <span className="text-foreground font-medium">{draft.meta.filename}</span>
              <span>
                {draft.sections.length} khối · {draft.meta.lines} dòng định mức
              </span>
              <span className="ml-auto">
                {draft.meta.provider} · {draft.meta.model}
              </span>
            </div>
            {(lowConfidence || draft.meta.truncated.length > 0) && (
              <div className="flex items-start gap-2 rounded-md border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] p-2.5 text-xs text-[var(--warn)]">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <div>
                  {lowConfidence && (
                    <div>
                      Khối thông tin sản phẩm đọc không chắc chắn (
                      {Math.round(p.confidence * 100)}%) — soi kỹ từng ô.
                    </div>
                  )}
                  {draft.meta.truncated.map((t) => (
                    <div key={t}>{t}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Mã sản phẩm *
                <input
                  value={p.code ?? ''}
                  onChange={(e) => {
                    setManualCode(true)
                    patch({ code: e.target.value || null })
                  }}
                  className={`${head} font-mono`}
                  placeholder={codeBusy ? 'Đang cấp mã…' : 'CH0201HG-IN'}
                />
                <span className="text-muted-foreground text-xs">
                  {manualCode ? (
                    <>
                      Đang gõ tay.{' '}
                      <button
                        type="button"
                        className="font-medium text-[var(--primary)] hover:underline"
                        onClick={() => {
                          setManualCode(false)
                          if (p.product_type && p.frame_material) {
                            void fetchCode(p.product_type, p.frame_material)
                          }
                        }}
                      >
                        Cấp mã tự động
                      </button>
                    </>
                  ) : (
                    'Mã cấp tự động theo loại + vật liệu khung; đổi hai ô đó là cấp lại.'
                  )}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Mã khách hàng
                <input
                  value={p.customer_item_code ?? ''}
                  onChange={(e) => patch({ customer_item_code: e.target.value || null })}
                  className={head}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Tên sản phẩm *
                <input
                  value={p.name ?? ''}
                  onChange={(e) => patch({ name: e.target.value || null })}
                  className={head}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Loại
                <select
                  value={p.product_type ?? ''}
                  onChange={(e) => pick({ product_type: e.target.value || null })}
                  className={head}
                >
                  <option value="">— suy từ mã —</option>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Vật liệu khung
                <select
                  value={p.frame_material ?? ''}
                  onChange={(e) => pick({ frame_material: e.target.value || null })}
                  className={head}
                >
                  <option value="">— suy từ mã —</option>
                  {FRAME_MATERIALS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Khách hàng
                <input
                  value={p.customer_name ?? ''}
                  onChange={(e) => patch({ customer_name: e.target.value || null })}
                  className={head}
                  placeholder="để trống = mẫu chung"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Đơn vị tính
                <input
                  value={p.unit ?? ''}
                  onChange={(e) => patch({ unit: e.target.value || null })}
                  className={head}
                  placeholder="cai"
                />
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Kích thước sản phẩm (mm)</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['width_mm', 'Rộng W'],
                    ['length_mm', 'Sâu D'],
                    ['height_mm', 'Cao H'],
                  ] as const
                ).map(([f, label]) => (
                  <label
                    key={f}
                    className="text-muted-foreground flex flex-col gap-1 text-xs"
                  >
                    {label}
                    <input
                      value={show(p[f])}
                      onChange={(e) => patch({ [f]: nOrNull(e.target.value) })}
                      className={`${head} text-right`}
                      inputMode="decimal"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Đóng gói</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ['carton_l_mm', 'Thùng D (mm)'],
                    ['carton_w_mm', 'Thùng R (mm)'],
                    ['carton_h_mm', 'Thùng C (mm)'],
                    ['qty_per_carton', 'Cái / thùng'],
                    ['loading_40hc', 'Cái / 40HC'],
                    ['nw_kg', 'NW (kg)'],
                    ['gw_kg', 'GW (kg)'],
                  ] as const
                ).map(([f, label]) => (
                  <label
                    key={f}
                    className="text-muted-foreground flex flex-col gap-1 text-xs"
                  >
                    {label}
                    <input
                      value={show(p[f])}
                      onChange={(e) => patch({ [f]: nOrNull(e.target.value) })}
                      className={`${head} text-right`}
                      inputMode="decimal"
                    />
                  </label>
                ))}
              </div>
            </div>
            {/* Thông số hỗ trợ in trên LSX (`tech_spec`) — BOM không ghi thì
                trống, LSX in ô trống. Người tạo + ngày tạo hệ thống tự ghi
                theo phiên đăng nhập, không có khối ISO ở đây. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Thông số in trên LSX</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ['spec_paint', 'Sơn'],
                    ['spec_wood', 'Gỗ'],
                    ['spec_glass', 'Kính'],
                    ['spec_cushion', 'Nệm'],
                  ] as const
                ).map(([f, label]) => (
                  <label
                    key={f}
                    className="text-muted-foreground flex flex-col gap-1 text-xs"
                  >
                    {label}
                    <input
                      value={p[f] ?? ''}
                      onChange={(e) => patch({ [f]: e.target.value || null })}
                      className={head}
                      placeholder="BOM không ghi — để trống"
                    />
                  </label>
                ))}
              </div>
            </div>
            {draft.sections.length > 0 && (
              <div className="rounded-md border p-2.5 text-xs">
                <div className="mb-1 font-medium">Định mức sẽ ghi kèm</div>
                <ul className="text-muted-foreground flex flex-col gap-0.5">
                  {draft.sections.map((s, i) => (
                    <li key={i}>
                      {s.group_code} · {s.section_title || '(không tiêu đề)'} —{' '}
                      {s.lines.length} dòng
                    </li>
                  ))}
                </ul>
                <div className="text-muted-foreground mt-1.5">
                  Soi kỹ từng dòng ở tab Định mức sau khi tạo xong.
                </div>
              </div>
            )}
            {/* Lưu kèm — cả hai thứ này đã nằm sẵn trong file, không lưu thì
                người dùng phải tự upload lại đúng file vừa đọc. */}
            <div className="flex flex-col gap-1.5 rounded-md border p-2.5 text-xs">
              <div className="font-medium">Lưu kèm vào hồ sơ</div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveFile}
                  onChange={(e) => setSaveFile(e.target.checked)}
                />
                <span>
                  Đính file <b>{draft.meta.filename}</b> vào tab Tài liệu
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveImage}
                  disabled={draft.meta.embeddedImageBytes == null}
                  onChange={(e) => setSaveImage(e.target.checked)}
                />
                <span
                  className={draft.meta.embeddedImageBytes == null ? 'opacity-60' : ''}
                >
                  {draft.meta.embeddedImageBytes != null ? (
                    <>
                      Lấy <b>ảnh sản phẩm</b> nhúng trong file (
                      {fileSize(draft.meta.embeddedImageBytes)}) làm ảnh đại diện
                    </>
                  ) : (
                    'File không có ảnh nhúng — tải ảnh lên sau ở hồ sơ'
                  )}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setP(null)
                }}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                ← Đọc file khác
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="hover:bg-muted rounded-md border px-4 py-2 text-sm"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void create()}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-50"
                >
                  {busy === 'create' && <Spinner size={14} />}
                  {busy === 'create'
                    ? 'Đang tạo…'
                    : `Tạo sản phẩm + ${draft.meta.lines} dòng`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
