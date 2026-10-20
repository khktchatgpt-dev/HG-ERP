'use client'

import { HopLyDo } from './huy-phieu'

/**
 * CHỐT XONG phiếu đề nghị còn dòng thiếu mà không mua nữa (0238 · Q14) — bắt
 * lý do; phiếu khoá ở Xong, dòng thiếu ghi "chốt thiếu". Không nhập thêm được.
 */
export function ChotPhieuSheet({
  id,
  code,
  thieu,
  onClose,
  onDone,
}: {
  id: string
  code: string
  /** Các dòng còn thiếu, đã viết sẵn ("Que hàn 2.5 còn 5 kg") — để người chốt thấy mình bỏ gì. */
  thieu: string[]
  onClose: () => void
  onDone: (bao: string) => void
}) {
  return (
    <HopLyDo
      title={`Chốt xong ${code}`}
      subtitle="Chốt rồi thì không nhập thêm theo phiếu này nữa — mua tiếp thì lập phiếu đề nghị mới."
      route={`/api/dept/warehouse/de-nghi/${id}/chot`}
      nhanNut="Chốt xong"
      nhanO="Lý do chốt xong"
      placeholder="VD: tiệm hết hàng, không mua nữa · đã dùng hàng tồn thay"
      truoc={
        thieu.length > 0 ? (
          <div className="kh-ds">
            {thieu.map((t) => (
              <div key={t} style={{ gridTemplateColumns: '1fr' }}>
                {t}
              </div>
            ))}
          </div>
        ) : (
          <span className="kh-mut">Chưa nhập dòng nào.</span>
        )
      }
      onClose={onClose}
      onDone={() =>
        onDone(`Đã chốt ${code} — phiếu sang Xong, dòng thiếu ghi "chốt thiếu".`)
      }
    />
  )
}
