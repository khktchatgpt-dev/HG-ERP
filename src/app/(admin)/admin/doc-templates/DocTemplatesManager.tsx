'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Hash, RotateCcw, Signature, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  DEFAULT_DOC_TEMPLATES,
  RESET_LABEL,
  RESET_SCOPES,
  formatDocCode,
  resolveSignatures,
  type DocKind,
  type ResetScope,
  type SignatureCol,
} from '@/lib/doc-templates'

type View = (typeof DEFAULT_DOC_TEMPLATES)[DocKind] & {
  updated_at: string | null
  updated_by_name: string | null
}

/**
 * MẪU CHỨNG TỪ — mỗi loại phiếu một thẻ, hai phần: ĐÁNH SỐ và MẪU IN.
 *
 * Bày XEM TRƯỚC mã kế tiếp ngay dưới ô khuôn: đổi tiền tố hay số chữ số là thấy
 * liền "đơn tới sẽ mang mã gì". Không có nó thì người sửa phải lưu, đi lập một
 * phiếu thật rồi xoá đi — đúng kiểu thao tác khiến người ta ngại đụng cấu hình.
 */
export type PreviewCompany = {
  company_name?: string | null
  company_address?: string | null
  company_tax_code?: string | null
  company_phone?: string | null
}

export function DocTemplatesManager({
  templates,
  nextSeqs,
  company,
}: {
  templates: View[]
  nextSeqs: Record<string, number>
  /** Thông tin công ty THẬT — ô xem trước dựng tờ giấy bằng dữ liệu này. */
  company: PreviewCompany
}) {
  const [openKind, setOpenKind] = useState<DocKind | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Quản trị', href: '/admin' }, { label: 'Mẫu chứng từ' }]}
        title="Mẫu chứng từ"
        description="Bấm vào một loại phiếu để mở. Sửa xong bấm Lưu — phiếu lập từ lúc đó mang mã và khuôn mới, phiếu cũ giữ nguyên."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {templates.map((t) => (
          <TemplateCard
            key={t.kind}
            t={t}
            company={company}
            nextSeq={nextSeqs[t.kind] ?? 1}
            open={openKind === t.kind}
            onToggle={() => setOpenKind(openKind === t.kind ? null : t.kind)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * ĐIỀU KHOẢN KHÔNG cấu hình ở đây — hai loại phiếu có điều khoản đều đã lấy mặc
 * định ở tầng SÁT HƠN, thêm một ô "mặc định chung" là đẻ ra nguồn thứ hai đá
 * nhau với nguồn đang dùng.
 */
const TERMS_NOTE: Partial<Record<DocKind, string>> = {
  PO: 'Điều khoản (chất lượng · giao hàng · thanh toán · chứng từ · thời gian) điền sẵn theo MẪU ĐƠN của từng loại vật tư, sửa được ngay trên form soạn đơn.',
  BG: 'Điều khoản thanh toán điền sẵn theo TỪNG KHÁCH (hồ sơ khách hàng), sửa được trên form báo giá.',
}

/**
 * KIỂU SỐ CHỌN SẴN — người dùng chọn "trông như thế này", không phải học cú pháp
 * {prefix}-{yyyy}-{seq}. Ô gõ khuôn vẫn còn nhưng nằm sau mục "Kiểu khác", cho
 * công ty nào có cách đánh riêng.
 */
const PATTERNS = [
  '{prefix}-{yyyy}-{seq}',
  '{prefix}/{yyyy}/{seq}',
  '{prefix}{yy}-{seq}',
  '{prefix}{yy}{mm}-{seq}',
  '{prefix}-{seq}',
]

/**
 * Cột ký TỰ ĐIỀN — giá trị lưu trong DB là chữ máy (`{company}`), nhưng trên màn
 * phải hiện tiếng Việt: bày `{signer_role}` trong ô nhập thì người dùng đọc ra
 * "lỗi chưa điền" và xoá mất chỗ móc dữ liệu (đúng như phản hồi 22/08/2026).
 */
/** Số LSX ghép tên khách lúc phát lệnh — trên màn cấu hình nói bằng tiếng Việt. */
const humanCode = (code: string) => code.replace(/{customer}/g, '(tên khách)')

const AUTO_ROLE: Record<string, string> = {
  '{company}': 'Tên công ty',
  '{signer_role}': 'Chức danh người ký của phiếu',
}

const inp =
  'border-input bg-background focus:border-[var(--primary)] w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none'
const lbl = 'text-muted-foreground text-[11px] font-medium'

/** Chữ mẫu cho các ô hệ TỰ ĐIỀN — để người sửa biết chỗ đó máy tự đổ, không gõ. */
const SLOT_SAMPLE = {
  creator: '(tên người lập)',
  approver: '(tên người duyệt)',
  counterparty: '(tên người giao/nhận)',
}
const SIGNER_ROLE_SAMPLE = 'TRƯỞNG PHÒNG CUNG ỨNG'

function TemplateCard({
  t,
  company,
  nextSeq,
  open,
  onToggle,
}: {
  t: View
  company: PreviewCompany
  nextSeq: number
  open: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [d, setD] = useState({
    prefix: t.prefix ?? '',
    pattern: t.pattern,
    seq_pad: String(t.seq_pad),
    reset_scope: t.reset_scope as ResetScope,
    title_vi: t.title_vi,
    title_en: t.title_en ?? '',
    national_heading: t.national_heading,
    form_no: t.form_no ?? '',
    signatures: t.signatures,
  })

  // "Kiểu khác" bật sẵn khi khuôn đang dùng không nằm trong danh sách chọn sẵn.
  const [custom, setCustom] = useState(() => !PATTERNS.includes(t.pattern))
  const pad = Math.min(10, Math.max(1, Number(d.seq_pad) || 1))
  /** Ví dụ THẬT của một kiểu số — dùng chính chữ đầu mã người dùng đang gõ. */
  const sample = (pattern: string) =>
    formatDocCode({ prefix: d.prefix || null, pattern, seq_pad: pad }, nextSeq, new Date())
  const preview = formatDocCode(
    { prefix: d.prefix || null, pattern: d.pattern, seq_pad: pad },
    nextSeq,
    new Date(),
  )
  const patternOk = d.pattern.includes('{seq}')

  async function save() {
    if (!patternOk) return
    setBusy(true)
    try {
      await api(`/api/admin/doc-templates/${t.kind}`, {
        method: 'PUT',
        body: {
          prefix: d.prefix.trim() || null,
          pattern: d.pattern.trim(),
          seq_pad: pad,
          reset_scope: d.reset_scope,
          title_vi: d.title_vi.trim(),
          title_en: d.title_en.trim() || null,
          national_heading: d.national_heading,
          form_no: d.form_no.trim() || null,
          signatures: d.signatures.filter((s) => s.role.trim()),
        },
      })
      router.refresh()
      toast.success('Đã lưu mẫu', t.label)
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    const ok = await confirm({
      title: `Khôi phục mặc định "${t.label}"?`,
      description:
        'Mọi thay đổi về đánh số và mẫu in của loại phiếu này quay lại giá trị gốc. Mã đã cấp cho phiếu cũ không đổi.',
      confirmLabel: 'Khôi phục',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/admin/doc-templates/${t.kind}`, { method: 'DELETE' })
      router.refresh()
      toast.success('Đã về mặc định', t.label)
    } catch (err) {
      toast.error('Khôi phục thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  const setSig = (i: number, patch: Partial<SignatureCol>) =>
    setD((s) => ({
      ...s,
      signatures: s.signatures.map((x, k) => (k === i ? { ...x, ...patch } : x)),
    }))

  return (
    <div className="bg-card rounded-lg border">
      <TopProgressBar active={busy} />
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-muted/40 flex w-full items-center gap-2 rounded-t-lg px-4 py-3 text-left"
      >
        <FileText className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-semibold">{t.label}</span>
        <span className="text-muted-foreground font-mono text-xs">{t.kind}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
            {humanCode(preview)}
          </span>
          <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t px-4 py-3">
          {/* ── Đánh số ─────────────────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <Hash className="text-muted-foreground size-3.5" />
              <span className="text-[11px] font-semibold tracking-wide uppercase">
                Đánh số
              </span>
              <div className="bg-border h-px flex-1" />
            </div>

            {t.prefix === null && DEFAULT_DOC_TEMPLATES[t.kind].prefix === null ? (
              <p className="text-muted-foreground text-xs">
                Số lệnh sản xuất đếm theo <b>từng khách trong năm</b> (
                <code>01/26 - Rosco</code>) — không dùng bộ đếm chung của công ty, nên chỉ
                sửa được số chữ số.
              </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex w-28 flex-col gap-1">
                <span className={lbl}>Chữ đầu mã</span>
                <input
                  className={inp}
                  value={d.prefix}
                  maxLength={10}
                  onChange={(e) => setD({ ...d, prefix: e.target.value })}
                />
              </label>
              <label className="flex min-w-56 flex-1 flex-col gap-1">
                <span className={lbl}>Kiểu số</span>
                <select
                  className={inp}
                  value={custom ? '__custom' : d.pattern}
                  onChange={(e) => {
                    if (e.target.value === '__custom') return setCustom(true)
                    setCustom(false)
                    setD({ ...d, pattern: e.target.value })
                  }}
                >
                  {/* Nhãn là VÍ DỤ THẬT, không phải cú pháp: "PO-2026-0024". */}
                  {PATTERNS.map((p) => (
                    <option key={p} value={p}>
                      {humanCode(sample(p))}
                    </option>
                  ))}
                  <option value="__custom">Kiểu khác (tự gõ)…</option>
                </select>
              </label>
              <label className="flex w-36 flex-col gap-1">
                <span className={lbl}>Số thứ tự dài</span>
                <select
                  className={inp}
                  value={String(pad)}
                  onChange={(e) => setD({ ...d, seq_pad: e.target.value })}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} chữ số · {'0'.repeat(n - 1)}1
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex w-44 flex-col gap-1">
                <span className={lbl}>Về lại số 1 khi</span>
                <select
                  className={inp}
                  value={d.reset_scope}
                  onChange={(e) =>
                    setD({ ...d, reset_scope: e.target.value as ResetScope })
                  }
                >
                  {RESET_SCOPES.map((r) => (
                    <option key={r} value={r}>
                      {RESET_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {custom && (
              <label className="mt-2 flex flex-col gap-1">
                <span className={lbl}>Tự gõ kiểu số</span>
                <input
                  className={cn(inp, 'font-mono', !patternOk && 'border-[var(--stop)]')}
                  value={d.pattern}
                  maxLength={60}
                  onChange={(e) => setD({ ...d, pattern: e.target.value })}
                />
                <span className="text-muted-foreground text-xs">
                  Ghép từ: <code>{'{prefix}'}</code> chữ đầu · <code>{'{yyyy}'}</code>{' '}
                  năm 2026 · <code>{'{yy}'}</code> năm 26 · <code>{'{mm}'}</code> tháng ·{' '}
                  <code>{'{seq}'}</code> số thứ tự <b>(bắt buộc)</b>
                </span>
              </label>
            )}

            {/* Xem trước bằng SỐ THẬT của bộ đếm — không phải ví dụ bịa. */}
            <div className="bg-accent mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-3 py-2 text-xs">
              <span className="text-muted-foreground">Phiếu lập tới đây sẽ là</span>
              <b className="font-mono text-sm">{humanCode(preview)}</b>
              <span className="text-muted-foreground">
                · rồi{' '}
                {humanCode(
                  formatDocCode(
                    { prefix: d.prefix || null, pattern: d.pattern, seq_pad: pad },
                    nextSeq + 1,
                    new Date(),
                  ),
                )}
              </span>
            </div>
            {!patternOk && (
              <p className="mt-1 text-xs text-[var(--stop)]">
                Khuôn phải có <code>{'{seq}'}</code> — thiếu thì mọi phiếu ra trùng mã.
              </p>
            )}
          </section>

          {/* ── Mẫu in ──────────────────────────────────────────────────── */}
          {t.printable ? (
            <section>
              <div className="mb-2 flex items-center gap-1.5">
                <Signature className="text-muted-foreground size-3.5" />
                <span className="text-[11px] font-semibold tracking-wide uppercase">
                  Mẫu in
                </span>
                <div className="bg-border h-px flex-1" />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-44 flex-1 flex-col gap-1">
                  <span className={lbl}>Tiêu đề (tiếng Việt)</span>
                  <input
                    className={inp}
                    value={d.title_vi}
                    maxLength={120}
                    onChange={(e) => setD({ ...d, title_vi: e.target.value })}
                  />
                </label>
                <label className="flex min-w-44 flex-1 flex-col gap-1">
                  <span className={lbl}>Dòng tiếng Anh (bỏ trống = không in)</span>
                  <input
                    className={inp}
                    value={d.title_en}
                    maxLength={120}
                    onChange={(e) => setD({ ...d, title_en: e.target.value })}
                  />
                </label>
                <label className="flex w-32 flex-col gap-1">
                  <span className={lbl}>Mẫu số (phiếu kho)</span>
                  <input
                    className={inp}
                    value={d.form_no}
                    maxLength={20}
                    placeholder="01-VT"
                    onChange={(e) => setD({ ...d, form_no: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={d.national_heading}
                    onChange={(e) => setD({ ...d, national_heading: e.target.checked })}
                  />
                  In quốc hiệu
                </label>
              </div>

              {/* XEM TRƯỚC TỜ GIẤY — sửa ô nào thấy đổi ngay ở đây. Không có
                  nó thì người sửa phải đoán "quốc hiệu" hay "mẫu số" nằm chỗ
                  nào trên tờ phiếu. */}
              <div className="mt-3 rounded-md border bg-white p-3 text-center text-[10px] text-black">
                <div className="flex items-start justify-between gap-2 text-[9px]">
                  <div className="max-w-[55%] text-left">
                    <div className="font-semibold uppercase">
                      {company.company_name || 'TÊN CÔNG TY (chưa khai ở Cấu hình)'}
                    </div>
                    {company.company_address && <div>Địa chỉ: {company.company_address}</div>}
                    {(company.company_tax_code || company.company_phone) && (
                      <div>
                        {[
                          company.company_tax_code && `MST: ${company.company_tax_code}`,
                          company.company_phone && `SĐT: ${company.company_phone}`,
                        ]
                          .filter(Boolean)
                          .join('   ')}
                      </div>
                    )}
                  </div>
                  <div>
                    {d.national_heading && (
                      <>
                        <div className="font-semibold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div>Độc lập – Tự do – Hạnh phúc</div>
                      </>
                    )}
                    {d.form_no.trim() && (
                      <div className="text-right font-semibold">Mẫu số: {d.form_no}</div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm font-bold">
                  {d.title_vi || '(chưa có tiêu đề)'}
                </div>
                {d.title_en.trim() && <div>{d.title_en}</div>}
                <div className="text-muted-foreground my-2 border-y py-3 text-[9px] italic">
                  … phần bảng nội dung của phiếu …
                </div>
                <div className="flex justify-between gap-2">
                  {(d.signatures.length
                    ? resolveSignatures(d.signatures, {
                        company: company.company_name,
                        signer_role: SIGNER_ROLE_SAMPLE,
                      })
                    : [{ role: '(chưa có cột ký)' }]
                  ).map((sig, i) => (
                    <div key={i} className="flex-1">
                      <div className="font-semibold">{sig.role || '…'}</div>
                      {sig.hint && <div className="text-[9px] italic">({sig.hint})</div>}
                      {/* Ô tên người do hệ tự điền khi in phiếu thật. */}
                      <div className="mt-4 text-[9px] text-zinc-400 italic">
                        {d.signatures[i]?.slot ? SLOT_SAMPLE[d.signatures[i].slot!] : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <div className={cn(lbl, 'mb-1')}>Các cột ký (trái → phải như trên giấy)</div>
                <div className="flex flex-col gap-1.5">
                  {d.signatures.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      {AUTO_ROLE[s.role] ? (
                        <span
                          className="border-input bg-muted text-muted-foreground flex w-56 items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm"
                          title={`Máy tự điền khi in: ${s.role}`}
                        >
                          <Wand2 className="size-3.5 shrink-0" />
                          <span className="truncate">{AUTO_ROLE[s.role]}</span>
                          <button
                            type="button"
                            onClick={() => setSig(i, { role: '' })}
                            className="text-primary ml-auto shrink-0 text-[11px] hover:underline"
                          >
                            Gõ tay
                          </button>
                        </span>
                      ) : (
                        <input
                          className={cn(inp, 'w-56')}
                          value={s.role}
                          maxLength={80}
                          placeholder="Tên cột ký"
                          onChange={(e) => setSig(i, { role: e.target.value })}
                        />
                      )}
                      <input
                        className={cn(inp, 'w-56')}
                        value={s.hint ?? ''}
                        maxLength={80}
                        placeholder="Dòng trong ngoặc (Ký, ghi rõ họ tên)"
                        onChange={(e) => setSig(i, { hint: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setD({
                            ...d,
                            signatures: d.signatures.filter((_, k) => k !== i),
                          })
                        }
                        className="text-muted-foreground text-xs hover:underline"
                      >
                        Bỏ
                      </button>
                    </div>
                  ))}
                  {d.signatures.length < 6 && (
                    <button
                      type="button"
                      onClick={() =>
                        setD({ ...d, signatures: [...d.signatures, { role: '' }] })
                      }
                      className="text-primary self-start text-xs font-medium hover:underline"
                    >
                      + Thêm cột ký
                    </button>
                  )}
                </div>
                {/* Ô thay thế của khối ký — PO lấy chức danh người ký của chính
                    đơn, và tên công ty ở cột Giám đốc. */}
                <p className="text-muted-foreground mt-1.5 text-xs">
                  Ô nền xám là cột <b>máy tự điền</b> khi in (tên công ty, chức danh
                  người ký của từng phiếu) — muốn ghi cứng một chức danh thì bấm
                  “Gõ tay”.
                </p>
              </div>

              {TERMS_NOTE[t.kind] && (
                <p className="text-muted-foreground mt-3 text-xs">
                  {TERMS_NOTE[t.kind]}
                </p>
              )}
            </section>
          ) : (
            <p className="text-muted-foreground text-xs">
              Loại này chỉ dùng bộ đếm để cấp mã, chưa có phiếu in.
            </p>
          )}

          {/* ── Thanh nút ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {t.updated_at && (
              <span className="text-muted-foreground text-xs">
                Sửa lần cuối {new Date(t.updated_at).toLocaleString('vi-VN')}
                {t.updated_by_name && ` · ${t.updated_by_name}`}
              </span>
            )}
            <button
              type="button"
              onClick={() => void reset()}
              disabled={busy}
              className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-xs hover:underline disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" /> Khôi phục mặc định
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !patternOk}
              className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {busy && <Spinner size={12} />}
              Lưu mẫu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
