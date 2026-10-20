'use client'

import {
  previewHeaderFromDraft,
  previewLinesFromDraft,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-preview'
import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import type { Line } from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import { ghiBanXemTruoc } from '@/lib/po-print-nhap'
import type { PoTemplate } from '@/lib/po-template'
import { columnsToShipments, type PlanColumn } from './soan-don'

/**
 * NÚT "XEM TRƯỚC" LÚC SOẠN / SỬA (10/10/2026 — "phiếu in khi chỉnh sửa khác phiếu
 * in khi xem chi tiết, dùng 1 loại thôi, loại trong chi tiết"). Mở TAB IN y như
 * "Phiếu đặt hàng" ở chi tiết đơn; tab đó dựng phiếu bằng đúng nguồn của trang in
 * chi tiết (`loadPoPrintDraft`), chỉ đầu đơn + dòng + đợt giao lấy từ bản đang gõ.
 * Bản cũ vẽ trong ngăn kéo 900px từ dữ liệu màn soạn — thiếu địa chỉ / MST / người
 * nhận của NCC và tên người lập.
 */
export function moXemTruoc(x: {
  poId: string | null
  header: PoHeader
  template: PoTemplate
  lines: Line[]
  shipCols: PlanColumn[]
  supplierName: string
}) {
  const k = ghiBanXemTruoc({
    po_id: x.poId,
    supplier_id: x.header.supplierId || null,
    lsx_id: x.header.poType === 'lsx' && x.header.lsxId ? x.header.lsxId : null,
    extra_lsx_ids: x.header.poType === 'lsx' ? x.header.extraLsxIds : [],
    header: previewHeaderFromDraft(x.header, {
      code: '(cấp khi lưu)',
      supplierName: x.supplierName,
      lsxCode: null,
      orderCode: null,
      createdAt: new Date().toISOString(),
    }),
    lines: previewLinesFromDraft(x.template, x.lines),
    shipments: columnsToShipments(x.shipCols),
  })
  window.open(`/print/supply/nhap?k=${k}`, '_blank')
}
