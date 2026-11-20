'use client'

import { useState } from 'react'
import { ClipboardPaste, Copy, FileUp, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { BomAiImport } from '@/components/technical/BomAiImport'
import { PartsBulkEntry } from '@/components/technical/PartsBulkEntry'
import { PartsCopyDialog } from '@/components/technical/PartsCopyDialog'
import { PartsRollupCard } from '@/components/technical/PartsRollupCard'
import type { PartView } from '@/components/technical/ProductProfileCards'
import { OTxt, soVn } from './ho-so-o'
import { nz, type HoSoView } from './ho-so.shared'
import type { HoSoCtx } from './useHoSo'

/**
 * CÔNG CỤ ĐỊNH MỨC của hồ sơ mới (B3, 20/11/2026 — chuyển từ tab Định mức của
 * `/products` cũ trước khi xoá trang đó): đọc file BOM bằng AI cho SP đã có,
 * dán từ Excel, chép từ SP khác, quản lý cụm, tổng hợp vật tư.
 *
 * Ba hộp thoại là thành phần DÙNG CHUNG của app (như "Tạo từ file BOM" ở danh
 * sách) — không dựng lại: chúng ghi qua đúng route `parts/ai-apply`,
 * `parts/bulk`, `parts/copy` và tự `router.refresh()`.
 */
export function CongCuDinhMuc({
  d,
  c,
  canEditBom,
  dirty,
}: {
  d: HoSoView
  c: HoSoCtx
  canEditBom: boolean
  /** Số dòng lưới chưa lưu — công cụ ghi cả lô thì chờ lưu xong mới cho chạy. */
  dirty: number
}) {
  const [mo, setMo] = useState<'ai' | 'dan' | 'chep' | null>(null)
  const dung = canEditBom && !c.khoa
  const chan = dirty > 0 ? `Lưu ${dirty} dòng đang sửa trước đã` : null

  return (
    <>
      {dung && (
        <div className="bar dm-tools" role="toolbar" aria-label="Công cụ định mức">
          <button
            type="button"
            className="btn"
            aria-disabled={!!chan}
            title={
              chan ?? 'Đọc file BOM (.xlsx / PDF / ảnh) thành bản nháp để soát rồi ghi'
            }
            onClick={() => !chan && setMo('ai')}
          >
            <FileUp size={14} aria-hidden />
            <span className="t">Đọc file BOM</span>
          </button>
          <button
            type="button"
            className="btn"
            aria-disabled={!!chan}
            title={chan ?? 'Dán nhiều dòng copy từ Excel'}
            onClick={() => !chan && setMo('dan')}
          >
            <ClipboardPaste size={14} aria-hidden />
            <span className="t">Dán từ Excel</span>
          </button>
          <button
            type="button"
            className="btn"
            aria-disabled={!!chan}
            title={chan ?? 'Chép toàn bộ định mức từ một SP khác'}
            onClick={() => !chan && setMo('chep')}
          >
            <Copy size={14} aria-hidden />
            <span className="t">Chép từ SP khác</span>
          </button>
          {chan && <span className="pend">{chan}</span>}
        </div>
      )}

      {d.clusters.length > 0 && <Cum d={d} c={c} sua={dung && c.cheDoSua} />}

      {d.parts.length > 0 && (
        <details className="panel dm-rollup">
          <summary>Tổng hợp vật tư (kim loại theo hệ, sơn, mua rời)</summary>
          <PartsRollupCard
            parts={d.partsRaw as unknown as PartView[]}
            paintCoverage={d.paint_coverage_m2_per_kg}
            actualWeightKg={d.actual_weight_kg}
            groups={d.groupsFull}
          />
        </details>
      )}

      {mo === 'ai' && (
        <BomAiImport productId={d.id} groups={d.groupsFull} onClose={() => setMo(null)} />
      )}
      {mo === 'dan' && (
        <PartsBulkEntry
          productId={d.id}
          groups={d.groupsFull}
          defaultGroup={d.groupsFull[0]?.code ?? 'FRAME'}
          onClose={() => setMo(null)}
        />
      )}
      {mo === 'chep' && (
        <PartsCopyDialog
          productId={d.id}
          hasParts={d.parts.length > 0}
          onClose={() => setMo(null)}
        />
      )}
    </>
  )
}

/**
 * CỤM của SP: đổi tên, SL cụm/SP, bỏ cụm. Lộ trình công đoạn KHÔNG sửa ở đây —
 * kế hoạch định hình trên lệnh là đường chính (CLAUDE.md, 04/11/2026).
 */
function Cum({ d, c, sua }: { d: HoSoView; c: HoSoCtx; sua: boolean }) {
  const confirm = useConfirm()
  const soDong = new Map<string, number>()
  for (const p of d.parts)
    if (p.cluster_id) soDong.set(p.cluster_id, (soDong.get(p.cluster_id) ?? 0) + 1)

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    try {
      await api(`/api/dept/technical/products/${d.id}/clusters/${id}`, {
        method: 'PATCH',
        body,
      })
      c.router.refresh()
      c.toast.success(ok)
    } catch (e) {
      c.toast.error('Chưa lưu được', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  async function bo(id: string, name: string) {
    const ok = await confirm({
      title: `Bỏ cụm “${name}”?`,
      description: `Cụm biến mất khỏi bảng, nhưng ${soDong.get(id) ?? 0} dòng chi tiết của nó KHÔNG bị xoá — chúng về nhóm “Rời”.`,
      confirmLabel: 'Bỏ cụm',
    })
    if (!ok) return
    try {
      await api(`/api/dept/technical/products/${d.id}/clusters/${id}`, {
        method: 'DELETE',
      })
      c.router.refresh()
      c.toast.success('Đã bỏ cụm', `Dòng của “${name}” về nhóm Rời`)
    } catch (e) {
      c.toast.error('Bỏ cụm thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  return (
    <section className="panel dm-cum" aria-label="Cụm của sản phẩm">
      <table className="xl">
        <thead>
          <tr>
            <th>Cụm ({d.clusters.length})</th>
            <th className="num">SL cụm / SP</th>
            <th className="num">Số dòng chi tiết</th>
            {sua && <th aria-label="Thao tác" />}
          </tr>
        </thead>
        <tbody>
          {d.clusters.map((x) => (
            <tr key={x.id}>
              <td>
                <OTxt
                  sua={sua}
                  value={x.name}
                  ph="tên cụm"
                  w={220}
                  onSave={(raw) => {
                    if (raw.trim())
                      return patch(x.id, { name: raw.trim() }, 'Đã đổi tên cụm')
                  }}
                />
              </td>
              <td className="num">
                <OTxt
                  sua={sua}
                  num
                  value={x.qty_per_product != null ? nz(x.qty_per_product, 3) : ''}
                  ph="1"
                  w={70}
                  onSave={(raw) => {
                    const v = soVn(raw)
                    if (v === undefined) {
                      c.toast.error('Số không hợp lệ', `"${raw}" — gõ số, ví dụ 2`)
                      return
                    }
                    return patch(x.id, { qty_per_product: v }, 'Đã lưu SL cụm')
                  }}
                />
              </td>
              <td className="num">{soDong.get(x.id) ?? 0}</td>
              {sua && (
                <td>
                  <button
                    type="button"
                    className="btn sm del"
                    aria-label={`Bỏ cụm ${x.name}`}
                    title="Bỏ cụm — dòng chi tiết về nhóm Rời"
                    onClick={() => void bo(x.id, x.name)}
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
