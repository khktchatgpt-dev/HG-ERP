import { ngay, type HangVeRow } from '@/lib/kho-hang-ve'

/**
 * Cột "Đợt · xe tới": đợt kế tiếp đứng trước (thứ thủ kho chờ), đợt đã nhập
 * trước hạn đi sau, gọn một dòng — câu đầy đủ ở `title` và trong hộp đơn.
 * (Tách khỏi HangVeScreen 27/10/2026 khi màn chạm trần 800 dòng.)
 */
export function DotCell({
  r,
  today,
  hep,
}: {
  r: HangVeRow
  today: string
  hep: boolean
}) {
  const d = r.dot
  if (!d) return <span className="kh-mut">chưa chia đợt</span>
  const truoc = d.da_nhap_truoc.join(', ')
  const cau = [
    d.ke_tiep
      ? `Đợt kế tiếp: đợt ${d.ke_tiep.seq}/${d.so_dot}, hẹn ${ngay(d.ke_tiep.date, today)}${d.ke_tiep.arrived ? ', NCC báo xe đã tới' : ''}.`
      : 'Không còn đợt nào đang chờ.',
    truoc ? `Đợt ${truoc} hẹn trước đó nhưng hàng đã nhập đủ — không phải chờ xe.` : '',
  ].join(' ')
  return (
    <span title={cau}>
      {d.ke_tiep ? (
        <span className="kh-num">
          {hep ? '' : 'Đợt '}
          {d.ke_tiep.seq}/{d.so_dot} · {ngay(d.ke_tiep.date, today)}
        </span>
      ) : (
        !truoc && <span className="kh-mut">hết đợt đã hẹn</span>
      )}
      {d.ke_tiep?.arrived && <span className="kh-warn"> · {hep ? 'tới' : 'đã tới'}</span>}
      {truoc && (
        <span className="kh-ok">
          {d.ke_tiep ? ' · ' : ''}
          {hep ? `✓đ${truoc}` : `đợt ${truoc} đã về`}
        </span>
      )}
    </span>
  )
}
