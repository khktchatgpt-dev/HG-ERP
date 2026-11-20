'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useUrlSearch } from '@/lib/use-url-search'
import { api, ApiError } from '@/lib/api'
import { parseProductCode } from '@/lib/product-code'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { Product } from '@/modules/dept/technical/technical.repo'
import { XEM_KEY, type LibraryRow, type ThuVienFilters } from './thu-vien.shared'

/**
 * GIỮ BỘ LỌC (20/11/2026, chủ dự án: "giữ phiên filter để tránh load lại làm mất
 * filter"): mỗi lần URL đổi thì ghi query vào localStorage; vào lại /thu-vien
 * TRẦN (bấm menu, nút quay về từ hồ sơ) thì khôi phục. "Bỏ lọc" làm URL trần nên
 * xoá luôn bản đã nhớ. Không ghi tham số mở hộp thoại (nhân bản / BOM).
 */
const LOC_KEY = 'tv-loc-v1'
const KHONG_NHO = ['clone', 'openbom']
function queryNho(params: URLSearchParams): string {
  const p = new URLSearchParams(params.toString())
  for (const k of KHONG_NHO) p.delete(k)
  // tt=active là mặc định — một mình nó không phải "đang lọc".
  if (p.get('tt') === 'active') p.delete('tt')
  if (p.get('trang') === '1') p.delete('trang')
  return p.toString()
}
function docNho(): string {
  try {
    return localStorage.getItem(LOC_KEY) ?? ''
  } catch {
    return ''
  }
}
function ghiNho(qs: string) {
  try {
    if (qs) localStorage.setItem(LOC_KEY, qs)
    else localStorage.removeItem(LOC_KEY)
  } catch {
    /* trình duyệt chặn bộ nhớ — bỏ qua, màn vẫn chạy */
  }
}

/** Toàn bộ state + xử lý của màn Thư viện sản phẩm. Các khối nhận `d` và chỉ gọi hàm. */
export function useThuVien({
  filters,
  canEdit,
}: {
  filters: ThuVienFilters
  canEdit: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [dangChay, batDau] = useTransition()
  const [busy, setBusy] = useState(false)

  // Màn có thể dựng lại sau mỗi lần đổi URL, nên KHÔNG dựa cờ trong component:
  // doiLoc ghi bản nhớ TRƯỚC khi đổi URL (kể cả khi về trần), nên URL trần mà bộ
  // nhớ còn query chỉ xảy ra khi người dùng vào từ ngoài (menu, quay về từ hồ sơ).
  useEffect(() => {
    const qs = queryNho(new URLSearchParams(params.toString()))
    const nho = docNho()
    if (!qs && nho) router.replace(`${pathname}?${nho}`, { scroll: false })
    else ghiNho(qs)
  }, [params, pathname, router])

  /*
    Ô tìm gõ ở client, truy vấn ở server (cột `search_text` + nhánh gần đúng).
    Bản nháp cục bộ + 350ms ngừng gõ — cùng hook với màn Vật tư.
  */
  const [nhap, setNhap] = useUrlSearch(filters.q, (q) => doiLoc({ q, trang: '1' }))

  function doiLoc(patch: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === '0') p.delete(k)
      else p.set(k, v)
    }
    // Đổi lọc là về trang 1, trừ khi chính nút lật trang gọi.
    if (!('trang' in patch)) p.delete('trang')
    const qs = p.toString()
    ghiNho(queryNho(p))
    batDau(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  /** Chip/ô bật-tắt: bấm lại giá trị đang bật thì bỏ. */
  const lat = (k: 'thieu', v: string) => doiLoc({ [k]: filters[k] === v ? '' : v })
  const latCo = (k: 'kt' | 'lenh' | 'gia') => doiLoc({ [k]: filters[k] ? '' : '1' })

  const dangLoc =
    !!filters.q ||
    !!filters.kh ||
    !!filters.loai ||
    !!filters.khung ||
    !!filters.hs ||
    !!filters.thieu ||
    filters.kt ||
    filters.lenh ||
    !!filters.mau ||
    !!filters.the ||
    !!filters.anh ||
    !!filters.khu ||
    filters.gia ||
    filters.tt !== 'active'
  const boLoc = () =>
    doiLoc({
      q: '',
      kh: '',
      loai: '',
      khung: '',
      hs: '',
      thieu: '',
      kt: '',
      lenh: '',
      mau: '',
      the: '',
      anh: '',
      khu: '',
      gia: '',
      tt: '',
      trang: '1',
    })

  /*
    KIỂU XEM là thói quen cá nhân (xưởng/showroom tra ảnh, Kỹ thuật/Sale tra
    bảng) nên nhớ theo máy. Mặc định BẢNG (Q5 của bản vẽ). Đọc SAU hydration —
    lazy-init từ localStorage sẽ lệch với HTML server.
  */
  const [xem, setXem] = useState<'bang' | 'luoi'>('bang')
  useEffect(() => {
    try {
      const v = localStorage.getItem(XEM_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ 1 lần từ localStorage
      if (v === 'bang' || v === 'luoi') setXem(v)
    } catch {
      /* private window — giữ mặc định */
    }
  }, [])
  const doiXem = (v: 'bang' | 'luoi') => {
    setXem(v)
    try {
      localStorage.setItem(XEM_KEY, v)
    } catch {
      /* bỏ qua */
    }
  }

  // ── hộp thoại ──
  const [fromBom, setFromBom] = useState(false)
  const [taoMoi, setTaoMoi] = useState(false)
  const [preview, setPreview] = useState<{ row: LibraryRow; url: string } | null>(null)
  const [cloning, setCloning] = useState<Product | null>(null)
  const [cloneCode, setCloneCode] = useState('')

  async function goi(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<boolean> {
    setBusy(true)
    try {
      await api(url, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function xoa(r: LibraryRow) {
    const ok = await confirm({
      title: `Xoá sản phẩm "${r.name}"?`,
      description:
        r.lsx_total > 0
          ? `${r.code} đang nằm trên ${r.lsx_total} lệnh sản xuất — xoá thì dòng lệnh mất liên kết hồ sơ (vẫn còn mã dạng chữ). Định mức, đóng gói, file đính kèm bị xoá theo. Không hoàn tác được.`
          : 'Định mức, đóng gói và file đính kèm của sản phẩm bị xoá theo. Không hoàn tác được.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    if (await goi(`/api/dept/technical/products/${r.id}`, 'DELETE'))
      toast.success('Đã xoá', r.name)
  }

  async function ngungDung(r: LibraryRow) {
    const ok = await goi(`/api/dept/technical/products/${r.id}`, 'PATCH', {
      is_active: !r.is_active,
    })
    if (ok) toast.success(r.is_active ? 'Đã ngừng dùng' : 'Đã kích hoạt lại', r.code)
  }

  /** Nạp SP đầy đủ (danh sách chỉ giữ bản nhẹ) rồi mở hộp nhân bản, xin sẵn mã kế tiếp. */
  const nhanBan = useCallback(
    async (id: string) => {
      setBusy(true)
      try {
        const { product } = await api<{ product: Product }>(
          `/api/dept/technical/products/${id}`,
        )
        const src = parseProductCode(product.code)
        const code = src
          ? await api<{ code: string }>(
              `/api/dept/technical/products/next-code?type=${src.type}&material=${src.material}`,
            )
              .then((r) => r.code)
              .catch(() => '')
          : ''
        setCloneCode(code)
        setCloning(product)
      } catch (e) {
        toast.error(
          'Không tải được sản phẩm',
          e instanceof ApiError ? e.message : 'Có lỗi',
        )
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  async function guiNhanBan(body: Record<string, unknown>) {
    if (!cloning) return
    const ok = await goi(`/api/dept/technical/products/${cloning.id}/clone`, 'POST', body)
    if (ok) {
      toast.success('Đã nhân bản', `${cloning.code} → ${String(body.code)}`)
      setCloning(null)
    }
  }

  // Deep-link từ trang chi tiết: ?clone=<id>. Gỡ tham số nhưng giữ bộ lọc.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const clone = params.get('clone')
    if (!clone) return
    if (canEdit) void nhanBan(clone)
    const p = new URLSearchParams(params.toString())
    p.delete('clone')
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Menu ⋯ cho dòng bảng và thẻ lưới — một bộ hành động, một thứ tự. */
  function menu(r: LibraryRow) {
    const items: {
      label: string
      onClick?: () => void
      danger?: boolean
      why?: string
      group?: string
    }[] = [
      { label: 'Mở hồ sơ', onClick: () => router.push(`/thu-vien/${r.id}`) },
      { label: 'Định mức', onClick: () => router.push(`/thu-vien/${r.id}?tab=dinh-muc`) },
      { label: 'Đóng gói', onClick: () => router.push(`/thu-vien/${r.id}?tab=dong-goi`) },
    ]
    if (canEdit) {
      items.push(
        { label: 'Nhân bản mẫu', onClick: () => void nhanBan(r.id), group: 'Sửa' },
        {
          label: r.is_active ? 'Ngừng dùng' : 'Kích hoạt lại',
          onClick: () => void ngungDung(r),
          group: 'Sửa',
        },
        r.lsx_open > 0
          ? {
              label: 'Xoá',
              danger: true,
              why: `Đang trên ${r.lsx_open} lệnh chưa xong — ngừng dùng thay vì xoá`,
            }
          : { label: 'Xoá', onClick: () => void xoa(r), danger: true },
      )
    }
    return items
  }

  return {
    router,
    dangChay,
    busy,
    nhap,
    setNhap,
    doiLoc,
    lat,
    latCo,
    dangLoc,
    boLoc,
    xem,
    doiXem,
    fromBom,
    setFromBom,
    taoMoi,
    setTaoMoi,
    preview,
    setPreview,
    cloning,
    setCloning,
    cloneCode,
    guiNhanBan,
    menu,
    /** Được tick mẫu showroom trên dòng (0303). */
    canEdit,
  } as const
}

export type ThuVienCtx = ReturnType<typeof useThuVien>
