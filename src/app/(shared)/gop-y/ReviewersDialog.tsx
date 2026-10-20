'use client'

import { useEffect, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/shadcn/dialog'
import { ToolbarInput } from '@/components/erp/Toolbar'
import { Spinner } from '@/components/erp/Spinner'

/**
 * ĐỔI NGƯỜI XÁC NHẬN (admin hệ thống). Danh sách trống = tắt cửa: góp ý tới
 * thẳng đội phát triển.
 */
export function ReviewersDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    api<{ ids: string[]; candidates: { id: string; name: string }[] }>('/api/feedback/reviewers')
      .then((r) => {
        if (!alive) return
        setPeople(r.candidates)
        setPicked(new Set(r.ids))
      })
      .catch((e) => toast.error('Không tải được danh sách', apiErrorText(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [open, toast])

  async function save() {
    setBusy(true)
    try {
      await api('/api/feedback/reviewers', { method: 'PUT', body: { ids: [...picked] } })
      toast.success(
        picked.size ? `Đã đặt ${picked.size} người xác nhận` : 'Đã tắt cửa xác nhận',
        picked.size ? undefined : 'Góp ý mới tới thẳng đội phát triển.',
      )
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Người xác nhận góp ý</DialogTitle>
        <DialogDescription>
          Người được chọn lọc góp ý của nhân viên trước khi tới đội phát triển (đồng ý / trả
          lại). Không chọn ai = tắt cửa.
        </DialogDescription>
        <ToolbarInput value={q} onChange={setQ} placeholder="Tìm tên…" />
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {loading ? (
            <div className="grid place-items-center py-6">
              <Spinner />
            </div>
          ) : (
            shown.map((p) => (
              <label
                key={p.id}
                className="hover:bg-muted flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
              >
                <Checkbox
                  checked={picked.has(p.id)}
                  onCheckedChange={(v) =>
                    setPicked((prev) => {
                      const n = new Set(prev)
                      if (v) n.add(p.id)
                      else n.delete(p.id)
                      return n
                    })
                  }
                />
                {p.name}
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy || loading}>
            {busy && <Spinner size={14} />} Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
