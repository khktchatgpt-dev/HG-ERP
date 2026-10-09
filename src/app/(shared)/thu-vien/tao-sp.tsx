'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'

/**
 * TẠO SẢN PHẨM NHANH ngay trong thư viện (09/10/2026, chủ dự án chọn "form gọn
 * ngay trong /thu-vien"): chỉ 7 ô — Loại · Khung · Mã HG (tự cấp theo quy tắc,
 * sửa được) · Tên · Khách · Mã KH · ĐVT. Tạo xong mở thẳng hồ sơ ở chế độ SỬA
 * để điền tiếp (`?sua=1`); form 80 cột cũ vẫn mở được từ dải "Đang sửa".
 *
 * Mã HG: xin `next-code` mỗi lần đổi Loại / Khung (hai thứ đó nằm trong mã);
 * server trả CODE_TAKEN (ai đó vừa lưu cùng số) thì xin số mới rồi bảo bấm lại —
 * cùng cách `ProductForm.tsx` làm.
 */
export function TaoSp({
  open,
  onClose,
  customers,
}: {
  open: boolean
  onClose: () => void
  customers: { name: string; count: number }[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [type, setType] = useState('CH')
  const [material, setMaterial] = useState('AL')
  const [code, setCode] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  const [name, setName] = useState('')
  const [customer, setCustomer] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [unit, setUnit] = useState('cái')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [daXinMa, setDaXinMa] = useState(false)

  async function xinMa(t: string, m: string) {
    setCodeBusy(true)
    try {
      const r = await api<{ code: string }>(
        `/api/dept/technical/products/next-code?type=${t}&material=${m}`,
      )
      setCode(r.code)
      setLoi(null)
    } catch (e) {
      setLoi(e instanceof ApiError ? e.message : 'Chưa cấp được mã')
    } finally {
      setCodeBusy(false)
    }
  }
  // Xin mã lần đầu khi mở — trong handler render chứ không qua effect (phản ứng với việc mở hộp).
  if (open && !daXinMa) {
    setDaXinMa(true)
    void xinMa(type, material)
  }
  if (!open && daXinMa) setDaXinMa(false)

  async function tao(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !name.trim()) {
      setLoi('Cần có mã HG và tên sản phẩm')
      return
    }
    setBusy(true)
    setLoi(null)
    try {
      const { product } = await api<{ product: { id: string; code: string } }>(
        '/api/dept/technical/products',
        {
          method: 'POST',
          body: {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            product_type: type,
            frame_material: material,
            customer_name: customer.trim() || null,
            customer_item_code: itemCode.trim() || null,
            unit: unit.trim() || 'cái',
          },
        },
      )
      toast.success('Đã tạo sản phẩm', `${product.code} — điền tiếp hồ sơ`)
      onClose()
      router.push(`/thu-vien/${product.id}?sua=1`)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CODE_TAKEN') {
        setLoi(`Mã ${code} vừa có người dùng — đã xin số mới, bấm Tạo lại`)
        await xinMa(type, material)
      } else setLoi(e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Thêm sản phẩm">
      <form className="tv-form" onSubmit={(e) => void tao(e)}>
        <div className="row2">
          <label>
            Loại sản phẩm
            <select
              className="pick"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                void xinMa(e.target.value, material)
              }}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vật liệu khung
            <select
              className="pick"
              value={material}
              onChange={(e) => {
                setMaterial(e.target.value)
                void xinMa(type, e.target.value)
              }}
            >
              {FRAME_MATERIALS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Mã HG <span className="muted">(tự cấp theo loại + khung, sửa được)</span>
          <input
            className="pick"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={codeBusy}
            placeholder={codeBusy ? 'đang cấp mã…' : 'VD CH0310HG-AL'}
            required
          />
        </label>
        <label>
          Tên sản phẩm <span className="req">*</span>
          <input
            className="pick"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD Ghế 5 bậc Keros khung Inox, nan gỗ keo FSC"
            maxLength={200}
            required
            autoFocus
          />
        </label>
        <div className="row2">
          <label>
            Khách / nhóm <span className="muted">(trống = mẫu chung)</span>
            <input
              className="pick"
              list="tv-kh-list"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="MERXX, BLACKIN…"
              maxLength={200}
            />
            <datalist id="tv-kh-list">
              {customers.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </label>
          <label>
            Mã khách đặt
            <input
              className="pick"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              placeholder="VD 22120-011"
              maxLength={100}
            />
          </label>
        </div>
        <label style={{ maxWidth: 160 }}>
          ĐVT
          <select className="pick" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="cái">cái</option>
            <option value="bộ">bộ</option>
          </select>
        </label>
        {loi && (
          <div className="loi" role="alert">
            {loi}
          </div>
        )}
        <div className="form-foot">
          <button type="submit" className="btn pri" disabled={busy || codeBusy}>
            {busy && <Spinner />}
            Tạo và mở hồ sơ
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <span className="muted" style={{ fontSize: 11 }}>
            Tạo xong, hồ sơ mở ở chế độ Sửa để điền kích thước, định mức, đóng gói.
          </span>
        </div>
      </form>
    </Modal>
  )
}
