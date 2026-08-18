'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Trash2 } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import type { ApprovalThresholds } from '@/lib/exec-ops'

type Row = { currency: string; limit: string }

function toRows(t: ApprovalThresholds): Row[] {
  return Object.entries(t)
    .map(([currency, limit]) => ({ currency, limit: String(limit) }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

/**
 * LUẬT KÝ — bảng ngưỡng "giá trị lớn" theo từng tiền tệ.
 *
 * Điều quan trọng nhất trên màn này là câu giải thích chuyện gì xảy ra với tiền
 * tệ KHÔNG có trong bảng: nó bị coi là lớn, tức luôn phải mở ra ký riêng. Người
 * ký phải hiểu vì sao đơn USD của mình không cho tích chọn, nếu không họ sẽ
 * tưởng hệ thống hỏng.
 */
export function ThresholdsScreen({
  thresholds,
  canEdit,
}: {
  thresholds: ApprovalThresholds
  canEdit: boolean
}) {
  const toast = useToast()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(toRows(thresholds))
  const [busy, setBusy] = useState(false)

  function patch(i: number, p: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...p } : row)))
  }

  const problems = rows.flatMap((r, i) => {
    const out: string[] = []
    if (!/^[A-Z]{3}$/.test(r.currency)) {
      out.push(`Dòng ${i + 1}: mã tiền tệ phải là 3 chữ in hoa (VND, USD…)`)
    }
    const n = Number(r.limit)
    if (r.limit.trim() === '' || !Number.isFinite(n) || n < 0) {
      out.push(`Dòng ${i + 1}: ngưỡng phải là số không âm`)
    }
    return out
  })
  const dup = rows.length !== new Set(rows.map((r) => r.currency)).size

  async function save() {
    setBusy(true)
    try {
      const body = Object.fromEntries(rows.map((r) => [r.currency, Number(r.limit)]))
      await api('/api/exec/thresholds', { method: 'PUT', body: { thresholds: body } })
      toast.success('Đã lưu luật ký')
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <TopProgressBar active={busy} />

      <PageHeader
        breadcrumbs={[{ label: 'Ban Giám đốc', href: '/exec' }, { label: 'Luật ký' }]}
        title="Luật ký"
        description="Phiếu đạt hoặc vượt ngưỡng dưới đây sẽ KHÔNG được ký nhanh hàng loạt — phải mở ra đọc rồi ký riêng."
      />

      <div className="bg-card max-w-2xl space-y-4 rounded-xl border p-4">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr>
              <th className="pb-2 text-left font-medium">Tiền tệ</th>
              <th className="pb-2 text-left font-medium">Ngưỡng giá trị lớn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1.5 pe-3">
                  <Input
                    value={r.currency}
                    disabled={!canEdit || busy}
                    onChange={(e) =>
                      patch(i, { currency: e.target.value.toUpperCase().slice(0, 3) })
                    }
                    className="h-9 w-24 font-mono"
                    aria-label={`Mã tiền tệ dòng ${i + 1}`}
                  />
                </td>
                <td className="py-1.5 pe-3">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={r.limit}
                    disabled={!canEdit || busy}
                    onChange={(e) => patch(i, { limit: e.target.value })}
                    className="h-9 w-48 text-right tabular-nums"
                    aria-label={`Ngưỡng dòng ${i + 1}`}
                  />
                </td>
                <td className="py-1.5">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                      aria-label={`Xoá ngưỡng ${r.currency}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted-foreground py-3 text-sm">
                  Chưa đặt ngưỡng nào — nghĩa là <b>mọi phiếu</b> đều phải mở ra ký riêng.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setRows((r) => [...r, { currency: '', limit: '' }])}
            >
              <Plus className="size-4" aria-hidden />
              Thêm tiền tệ
            </Button>
            <Button
              className="ms-auto"
              disabled={busy || problems.length > 0 || dup}
              onClick={() => void save()}
            >
              {busy ? <Spinner size={14} /> : <Save className="size-4" aria-hidden />}
              Lưu
            </Button>
          </div>
        )}

        {(problems.length > 0 || dup) && (
          <ul className="space-y-1 text-xs text-[var(--stop)]">
            {dup && <li>Một mã tiền tệ xuất hiện hai lần</li>}
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-muted-foreground max-w-2xl space-y-2 text-sm">
        <p>
          <b>Tiền tệ không có trong bảng thì luôn bị coi là giá trị lớn.</b> Hệ thống
          không lưu tỉ giá nên không quy đổi được — mặc định an toàn là bắt mở ra đọc.
          Muốn ký nhanh đơn USD thì thêm dòng USD với ngưỡng của nó.
        </p>
        <p>
          Ngưỡng chỉ áp cho <b>đơn mua</b> — thứ ký xong là công ty mất tiền. Lệnh sản
          xuất không bao giờ bị chặn ký nhanh: tiền của lệnh là doanh thu sắp thu về, ký
          lệnh không tiêu đồng nào.
        </p>
      </div>
    </div>
  )
}
