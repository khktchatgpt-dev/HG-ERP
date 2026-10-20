'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Empty, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import { moTaDc } from '@/lib/cham-cong/dieu-chinh'
import type { TrangDieuChinh } from '@/modules/dept/hr/cham-cong/dieu-chinh.service'
import { KhungTrang } from './khung-trang'
import { TinhTrang } from './dieu-chinh-sheet'
import { THU, dmy, thu } from './ky-cong.shared'
import { so } from './cham-cong.shared'
import { thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'

/**
 * ĐIỀU CHỈNH CÔNG — hộp duyệt của trưởng phòng Nhân sự (câu 22). Hai ngăn: CHỜ DUYỆT
 * (mọi kỳ — việc chưa xong không được trốn sang tháng trước) và TRONG THÁNG (lịch sử
 * đủ tình trạng). Người có quyền duyệt chọn nhiều dòng rồi duyệt một lượt. Gửi điều
 * chỉnh thì làm ở bảng tổ / trang một người, nơi thấy lượt máy của ngày đó.
 */
export function DieuChinhScreen({
  d,
  thang,
  xem,
}: {
  d: TrangDieuChinh
  thang: string
  xem: 'cho' | 'thang'
}) {
  const router = useRouter()
  const toast = useToast()
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const ds = xem === 'cho' ? d.choDuyet : [...d.trongKy].reverse()
  const coChon = d.quyen.duyet && xem === 'cho'
  // Phiếu mình gửi không tự duyệt được — không cho chọn, nói lý do ngay ở ô chọn.
  const cuaMinh = (x: { guiId?: string | null }) => x.guiId === d.quyen.toi
  const chonDuoc = ds.filter((x) => !cuaMinh(x))
  const tatCa = coChon && chonDuoc.length > 0 && chonDuoc.every((x) => chon.has(x.id))
  const demTT = useMemo(() => {
    const m = { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
    for (const x of d.trongKy) m[x.tinhTrang]++
    return m
  }, [d.trongKy])

  const di = (t: string, x: 'cho' | 'thang') =>
    router.push(`/hr/cham-cong/dieu-chinh?thang=${t}${x === 'thang' ? '&xem=thang' : ''}`)

  async function quyet(viec: 'duyet' | 'tu_choi') {
    const ids = [...chon]
    if (!ids.length) return
    let ghiChu: string | undefined
    if (viec === 'tu_choi') {
      ghiChu = window.prompt(`Lý do từ chối ${ids.length} điều chỉnh`)?.trim()
      if (!ghiChu || ghiChu.length < 2) return
    }
    setBusy(true)
    try {
      const r = await api<{ so: number }>('/api/dept/hr/cham-cong/dieu-chinh/quyet', {
        method: 'POST',
        body: { ids, viec, ghiChu },
      })
      toast.success(`${viec === 'duyet' ? 'Đã duyệt' : 'Đã từ chối'} ${r.so} điều chỉnh`)
      setChon(new Set())
      router.refresh()
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const tab = (x: 'cho' | 'thang', nhan: string, n: number) => (
    <button
      type="button"
      onClick={() => di(thang, x)}
      className={cn(
        'border-b-2 px-3 py-1.5 font-semibold',
        xem === x
          ? 'border-[var(--act)] text-[var(--act-text)]'
          : 'border-transparent text-[var(--ink-2)] hover:text-[var(--ink-1)]',
      )}
    >
      {nhan} <span className="num">{so(n)}</span>
    </button>
  )

  const th =
    'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1.5 text-left font-semibold text-[var(--ink-2)]'
  const td = 'border-b border-[var(--line-faint)] px-2 py-1.5 align-top'

  return (
    <KhungTrang
      ten="Điều chỉnh công"
      thang={xem === 'thang' ? thang : undefined}
      onThang={(t) => di(t, 'thang')}
      facts={[
        { label: 'Chờ duyệt', value: so(d.choDuyet.length) },
        { label: 'Đã duyệt trong tháng', value: so(demTT.approved) },
      ]}
      actions={
        coChon ? (
          <>
            <Btn
              primary
              icon="duyet"
              aria-disabled={!chon.size || busy}
              onClick={() => void quyet('duyet')}
            >
              {`Duyệt ${chon.size ? so(chon.size) : ''} đã chọn`}
            </Btn>
            <Btn aria-disabled={!chon.size || busy} onClick={() => void quyet('tu_choi')}>
              Từ chối
            </Btn>
          </>
        ) : undefined
      }
    >
      <div className="text-k-sm flex items-end gap-1 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)]">
        {tab('cho', 'Chờ duyệt', d.choDuyet.length)}
        {tab(
          'thang',
          `Trong tháng ${thang.slice(5)}/${thang.slice(0, 4)}`,
          d.trongKy.length,
        )}
        <span className="text-k-label ml-auto pb-1.5 text-[var(--ink-3)]">
          {d.quyen.duyet
            ? 'Gửi điều chỉnh ở Bảng giờ công — bấm vào ô của ngày cần sửa'
            : 'Bạn gửi được, chưa duyệt được — người có quyền duyệt sẽ xử lý ở trang này'}
        </span>
      </div>

      {ds.length === 0 ? (
        <div className="flex-1 bg-[var(--surface-card)]">
          <Empty
            headline={
              xem === 'cho'
                ? 'Không có điều chỉnh nào chờ duyệt'
                : 'Tháng này chưa có điều chỉnh'
            }
            reason="Điều chỉnh được gửi từ ô của Bảng giờ công hoặc trang một người."
            next={
              <Btn onClick={() => router.push(`/hr/cham-cong/gio-cong?thang=${thang}`)}>
                Sang Bảng giờ công
              </Btn>
            }
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <table className="text-k-sm w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {coChon && (
                  <th className={cn(th, 'w-8')}>
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={tatCa}
                      onChange={() =>
                        setChon(tatCa ? new Set() : new Set(chonDuoc.map((x) => x.id)))
                      }
                    />
                  </th>
                )}
                <th className={cn(th, 'w-24')}>Ngày</th>
                <th className={th}>Nhân viên</th>
                <th className={th}>Điều chỉnh</th>
                <th className={th}>Lý do · căn cứ</th>
                <th className={cn(th, 'w-36')}>Người gửi</th>
                <th className={cn(th, 'w-40')}>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((x) => {
                const n = d.nguoi[x.ma]
                return (
                  <tr key={x.id} className={cn(chon.has(x.id) && 'bg-[var(--act-wash)]')}>
                    {coChon && (
                      <td className={td}>
                        {cuaMinh(x) ? (
                          <span
                            className="block w-8 text-[var(--ink-3)]"
                            title="Phiếu của bạn — người khác có quyền duyệt phải xử lý"
                          >
                            của bạn
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${n?.ten ?? x.ma} ${x.ngay}`}
                            checked={chon.has(x.id)}
                            onChange={() => {
                              const s = new Set(chon)
                              if (s.has(x.id)) s.delete(x.id)
                              else s.add(x.id)
                              setChon(s)
                            }}
                          />
                        )}
                      </td>
                    )}
                    <td className={cn(td, 'num')}>
                      {dmy(x.ngay)}
                      <span className="block text-[var(--ink-3)]">
                        {THU[thu(x.ngay)]}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="num mr-1.5 text-[var(--ink-3)]">{x.ma}</span>
                      <Link
                        href={`/hr/cham-cong/nguoi/${encodeURIComponent(x.ma)}?thang=${thangCuaNgay(x.ngay)}`}
                        className="text-[var(--act-text)] hover:underline"
                      >
                        {n?.ten ?? '—'}
                      </Link>
                      {n?.to && <span className="block text-[var(--ink-3)]">{n.to}</span>}
                    </td>
                    <td className={cn(td, 'font-semibold')}>{moTaDc(x)}</td>
                    <td className={td}>
                      {x.lyDo}
                      {x.canCu && (
                        <span className="block text-[var(--ink-3)]">{x.canCu}</span>
                      )}
                    </td>
                    <td className={td}>
                      {x.nguoiGui ?? '—'}
                      <span className="num block text-[var(--ink-3)]">
                        {dmy(x.luc.slice(0, 10))}
                      </span>
                    </td>
                    <td className={td}>
                      <TinhTrang d={x} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </KhungTrang>
  )
}
