'use client'

import {
  chiaCaDon,
  donChiaTheoLenh,
  needShares,
  tuChiaDong,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-lsx-chia'
import type { Line } from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { Need } from './soan-don'

/**
 * NHU CẦU LỆNH + CHIA SL CHO TỪNG LỆNH của màn đơn mua (tách khỏi `useDonChungTu`
 * 10/10/2026 — file đó giữ trần dòng cũ, không được dài thêm).
 *
 *  · Nạp nhu cầu của CẢ BỘ lệnh (chính + phụ), gộp ở server — cộng từng lệnh ở
 *    client sẽ trừ tồn hai lần. Chỉ nạp khi đang soạn.
 *  · Đơn gộp nhiều lệnh: đổi SL đặt là chia lại (`sauSua`), gỡ lệnh là dọn phần
 *    chia, nút "Chia theo nhu cầu" chia lại cả đơn. Toán ở `po-lsx-chia`.
 */
export function useNhuCauLenh({
  poId,
  drafting,
  editing,
  header,
  lsxs,
  lines,
  setLines,
}: {
  /** Đơn đang sửa — loại khỏi "đã đặt" để nhu cầu từng lệnh không bị chính nó che. */
  poId: string | null
  drafting: boolean
  editing: boolean
  header: PoHeader
  lsxs: { id: string; code: string }[]
  lines: Line[]
  setLines: Dispatch<SetStateAction<Line[]>>
}) {
  const toast = useToast()
  const [needs, setNeeds] = useState<Need[]>([])
  const [needsLoading, setNeedsLoading] = useState(false)

  const lsxsOfPo = useMemo(
    () => (header.poType === 'lsx' ? [header.lsxId, ...header.extraLsxIds].filter(Boolean).flatMap((id) => { const l = lsxs.find((x) => x.id === id); return l ? [{ id: l.id, code: l.code }] : [] }) : []), // prettier-ignore
    [header.poType, header.lsxId, header.extraLsxIds, lsxs],
  )
  const nhieuLenh = lsxsOfPo.length > 1
  const mainLsxId = header.poType === 'lsx' && header.lsxId ? header.lsxId : null
  const needsOf = (materialId: string) =>
    needShares(needs.find((n) => n.material_id === materialId)?.by_lsx)

  /** Sau một lượt sửa dòng `i`: đổi SL đặt ở đơn gộp thì chia lại cho từng lệnh. */
  const sauSua = (next: Line[], i: number, part: Partial<Line>): Line[] => {
    if (!('qty' in part) || !nhieuLenh) return next
    const sp = tuChiaDong(next, i, needsOf(next[i].material_id), mainLsxId)
    return next.map((l, k) => (k === i ? { ...l, lsx_split: sp } : l))
  }

  /** Nút "Chia theo nhu cầu" — `chiTrong`: chỉ điền dòng chưa chia. */
  const chiaTheoNhuCau = (chiTrong: boolean) => {
    const next = chiaCaDon(lines, needsOf, mainLsxId, chiTrong)
    const daChia = next.filter((l, k) => l !== lines[k]).length
    const conTrong = next.filter((l) => Number(l.qty) > 0 && !Object.values(l.lsx_split ?? {}).some((v) => Number(v) > 0)).length // prettier-ignore
    setLines(next)
    if (conTrong > 0)
      toast.info(`Đã chia ${daChia} dòng — ${conTrong} dòng chưa chia được`, 'Lệnh chưa có định mức cho mã đó nên máy không biết mỗi lệnh cần bao nhiêu. Bấm ô "Chia lệnh" của dòng để gõ số cho từng lệnh.') // prettier-ignore
    else toast.success(`Đã chia ${daChia} dòng theo nhu cầu từng lệnh`)
  }

  // Gỡ / đổi lệnh của đơn → dọn phần chia cho khớp bộ lệnh mới (lệnh bị gỡ mất
  // phần, phần còn lại chia lại theo tỉ lệ; còn một lệnh thì bỏ chia).
  const lsxKey = lsxsOfPo.map((x) => x.id).join(',')
  useEffect(() => {
    if (!editing) return
    const ids = lsxKey ? lsxKey.split(',') : []
    const t = setTimeout(() => setLines((ls) => donChiaTheoLenh(ls, ids)), 0)
    return () => clearTimeout(t)
  }, [editing, lsxKey, setLines])

  useEffect(() => {
    // Soạn nháp: luôn nạp. Sửa đơn đã duyệt: chỉ khi gộp nhiều lệnh — để chia lệnh.
    const can = drafting || (editing && header.extraLsxIds.length > 0)
    if (!can || header.poType !== 'lsx' || !header.lsxId) {
      const t = setTimeout(() => setNeeds([]), 0)
      return () => clearTimeout(t)
    }
    let gone = false
    const t = setTimeout(() => setNeedsLoading(true), 0)
    const qs =
      header.extraLsxIds.length > 0
        ? `&extra_lsx_ids=${header.extraLsxIds.join(',')}`
        : ''
    const ex = poId ? `&exclude_po_id=${poId}` : ''
    api<{ needs: Need[] }>(
      `/api/dept/supply/needs?production_order_id=${header.lsxId}${qs}${ex}`,
    )
      .then((d) => !gone && setNeeds(d.needs))
      .catch(
        (e) => !gone && toast.error('Không tải được nhu cầu của lệnh', apiErrorText(e)),
      )
      .finally(() => !gone && setNeedsLoading(false))
    return () => {
      gone = true
      clearTimeout(t)
    }
    // toast ổn định theo provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafting, editing, poId, header.poType, header.lsxId, header.extraLsxIds])

  return {
    needs,
    setNeeds,
    needsLoading,
    setNeedsLoading,
    lsxsOfPo,
    nhieuLenh,
    sauSua,
    chiaTheoNhuCau,
  } as const
}
