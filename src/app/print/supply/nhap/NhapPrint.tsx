'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { docBanXemTruoc } from '@/lib/po-print-nhap'
import { PoPrintSheet } from '../PoPrintSheet'

type Props = Parameters<typeof PoPrintSheet>[0]

/** Tab in của bản đang gõ: đọc bản gõ → server dựng như trang in chi tiết → vẽ. */
export function NhapPrint() {
  const k = useSearchParams().get('k') ?? ''
  const [d, setD] = useState<Props | null>(null)
  const [loi, setLoi] = useState<string | null>(null)

  useEffect(() => {
    const input = docBanXemTruoc(k)
    if (!input) {
      const t = setTimeout(() => setLoi('Không đọc được bản đang gõ — bấm "Xem trước" lại từ màn soạn đơn.'), 0) // prettier-ignore
      return () => clearTimeout(t)
    }
    let gone = false
    api<Props>('/api/dept/supply/pos/print-preview', { method: 'POST', body: input })
      .then((r) => !gone && setD(r))
      .catch((e) => !gone && setLoi(apiErrorText(e)))
    return () => {
      gone = true
    }
  }, [k])

  if (loi) return <p className="p-6 text-[13px] text-black">{loi}</p>
  if (!d) return <p className="p-6 text-[13px] text-black">Đang dựng phiếu…</p>
  return (
    <>
      <p className="mx-auto max-w-4xl bg-amber-50 px-6 py-1.5 text-[12px] text-amber-900 print:hidden">
        Bản xem trước từ đơn ĐANG SỬA — chưa lưu. Lưu đơn rồi in từ chi tiết đơn để có bản
        chính thức (kèm Xuất Excel).
      </p>
      <PoPrintSheet
        company={d.company}
        tpl={d.tpl}
        shipments={d.shipments}
        po={d.po}
        supplier={d.supplier}
        lines={d.lines}
      />
    </>
  )
}
