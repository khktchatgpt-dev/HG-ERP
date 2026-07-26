'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, RefreshCw } from 'lucide-react'
import { api, apiErrorText, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

const UNITS = ['cai', 'bo', 'set', 'pcs']

/**
 * Tạo sản phẩm — CHỈ những gì phải có ngay để SP tồn tại và tìm được.
 *
 * Quy cách đóng gói, thông số LSX, mô tả, shipping mark… bỏ hết khỏi đây: điền
 * lúc tạo là điền mò (chưa có bản vẽ, chưa chốt carton), mà form 30 ô thì người
 * nhập bỏ trống gần hết. Trang chi tiết đã chia sẵn từng phần sửa riêng kèm
 * thanh "hồ sơ hoàn thiện" dẫn đi điền tiếp — đó mới là chỗ hoàn thiện hồ sơ.
 *
 * Mã nội bộ do hệ thống cấp theo loại + vật liệu khung (`@/lib/product-code`),
 * còn nút "Sửa tay" để nhập SP mã cũ / mã đặc biệt.
 */
export function ProductForm({
  defaultType,
  defaultMaterial,
  initialCode,
  customerNames,
}: {
  defaultType: string
  defaultMaterial: string
  /** Mã cho (defaultType, defaultMaterial), cấp sẵn ở server nên hiện ngay khi mở. */
  initialCode: string
  /** Nhãn khách/nhóm đã dùng — chỉ để gợi ý, KHÔNG giới hạn giá trị nhập. */
  customerNames: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const [type, setType] = useState(defaultType)
  const [material, setMaterial] = useState(defaultMaterial)
  const [code, setCode] = useState(initialCode)
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  /** Người dùng bấm "Sửa tay" → ngừng cấp mã tự động, giữ nguyên ô đang gõ. */
  const [manualCode, setManualCode] = useState(false)

  const fetchCode = useCallback(async (t: string, m: string) => {
    setCodeBusy(true)
    setCodeError(null)
    try {
      const r = await api<{ code: string }>(
        `/api/dept/technical/products/next-code?type=${t}&material=${m}`,
      )
      setCode(r.code)
    } catch (e) {
      setCodeError(apiErrorText(e, 'Chưa cấp được mã'))
    } finally {
      setCodeBusy(false)
    }
  }, [])

  /**
   * Đổi loại / vật liệu → xin mã mới ngay trong handler, KHÔNG qua effect: đây
   * là phản ứng với thao tác người dùng, không phải đồng bộ với hệ thống ngoài.
   * Mã đầu tiên đã do server cấp nên lúc mở form không phải gọi gì.
   */
  function pick(next: { type?: string; material?: string }) {
    const t = next.type ?? type
    const m = next.material ?? material
    setType(t)
    setMaterial(m)
    if (!manualCode) void fetchCode(t, m)
  }

  /** Quay lại cấp mã tự động — xin lại mã cho lựa chọn hiện tại. */
  function resumeAutoCode() {
    setManualCode(false)
    void fetchCode(type, material)
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (k: string) => String(fd.get(k) ?? '').trim()
    const body = {
      code: code.trim(),
      name: str('name'),
      name_foreign: str('name_foreign') || null,
      customer_name: str('customer_name') || null,
      unit: str('unit') || 'cai',
    }
    if (!body.code) {
      toast.error('Chưa có mã sản phẩm', 'Chọn loại và vật liệu, hoặc nhập mã tay')
      return
    }

    setBusy(true)
    try {
      const { product } = await api<{ product: { id: string } }>(
        '/api/dept/technical/products',
        { method: 'POST', body },
      )
      toast.success('Đã thêm sản phẩm', `${body.code} · ${body.name}`)
      router.push(`/technical/products/${product.id}`)
    } catch (err) {
      // Ai đó vừa lấy mất số này. Xin số mới ngay để người dùng chỉ cần bấm Lưu lại.
      if (err instanceof ApiError && err.code === 'CODE_TAKEN' && !manualCode) {
        await fetchCode(type, material)
        toast.error('Mã vừa bị dùng', 'Đã cấp mã mới — bấm “Thêm sản phẩm” lần nữa')
      } else {
        toast.error('Lưu thất bại', apiErrorText(err))
      }
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kỹ thuật', href: '/technical' },
          { label: 'Thư viện sản phẩm', href: '/technical/products' },
          { label: 'Thêm sản phẩm' },
        ]}
        title="Thêm sản phẩm"
        description="Điền phần nhận diện thôi. Quy cách, thông số và tài liệu bổ sung ở trang chi tiết."
        actions={
          <Link
            href="/technical/products"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Huỷ
          </Link>
        }
      />

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <form onSubmit={submit} className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Loại sản phẩm <span className="text-red-500">*</span>
            <select
              value={type}
              onChange={(e) => pick({ type: e.target.value })}
              className={cls}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Vật liệu khung <span className="text-red-500">*</span>
            <select
              value={material}
              onChange={(e) => pick({ material: e.target.value })}
              className={cls}
            >
              {FRAME_MATERIALS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.label}
                </option>
              ))}
            </select>
          </label>

          {/* Mã cấp tự động — hiện ra để người nhập thấy trước khi lưu, không giấu. */}
          <div className="flex flex-col gap-1 text-sm sm:col-span-2">
            <div className="flex items-center gap-2">
              <span>Mã nội bộ</span>
              {manualCode ? (
                <button
                  type="button"
                  onClick={resumeAutoCode}
                  className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  <RefreshCw className="size-3" /> Cấp mã tự động
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setManualCode(true)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  <Pencil className="size-3" /> Sửa tay
                </button>
              )}
              {codeBusy && <Spinner size={12} />}
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              readOnly={!manualCode}
              required
              maxLength={100}
              placeholder={manualCode ? 'Nhập mã tay' : 'Đang cấp mã…'}
              className={`${cls} font-mono ${!manualCode ? 'bg-zinc-50 dark:bg-zinc-900/60' : ''}`}
            />
            <p className="text-muted-foreground text-xs">
              {codeError ? (
                <span className="text-red-600 dark:text-red-400">
                  {codeError} — bấm “Sửa tay” để tự nhập.
                </span>
              ) : manualCode ? (
                'Đang nhập tay — dùng cho sản phẩm mã cũ. Mã phải chưa có trong thư viện.'
              ) : (
                'Dạng [loại][số thứ tự]HG-[vật liệu]. Số thứ tự đếm riêng theo từng loại.'
              )}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Tên SP (tiếng Việt) <span className="text-red-500">*</span>
            <input name="name" required maxLength={200} autoFocus className={cls} />
          </label>

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Tên theo khách — in trên LSX
            <input
              name="name_foreign"
              maxLength={300}
              className={cls}
              placeholder="Tên hàng theo cách gọi của khách (Đức / Anh / Pháp…)"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Khách hàng / nhóm
            <input
              name="customer_name"
              list="product-customer-names"
              maxLength={200}
              className={cls}
              placeholder="Gõ tên bất kỳ — để trống là mẫu chung"
            />
            <datalist id="product-customer-names">
              {customerNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            ĐVT bán
            <input
              name="unit"
              list="product-units"
              maxLength={30}
              defaultValue="cai"
              className={cls}
            />
            <datalist id="product-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>

          <div className="mt-1 flex items-center justify-end gap-3 sm:col-span-2">
            <p className="text-muted-foreground mr-auto text-xs">
              Lưu xong sẽ mở trang chi tiết để thêm ảnh, quy cách và tài liệu.
            </p>
            <Link
              href="/technical/products"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Huỷ
            </Link>
            <button
              disabled={busy || codeBusy}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : 'Thêm sản phẩm'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
