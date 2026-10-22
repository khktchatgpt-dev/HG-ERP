'use client'

import { useRouter } from 'next/navigation'
import { Btn } from '@/components/kit'
import { useKyCong } from './useKyCong'
import { KhungTrang } from './khung-trang'
import { CoMat } from './co-mat'
import { so } from './cham-cong.shared'
import type { KyCong } from './ky-cong.shared'

/**
 * TRANG CÓ MẶT THEO TỔ (tách trang 17/10/2026) — "tổ nào đi đủ, ngày nào vắng nhiều?".
 * Bấm ô xem ai có mặt / không quẹt; "Xem lượt quẹt" sang trang Lượt quẹt lọc sẵn.
 */
export function CoMatScreen({ k }: { k: KyCong }) {
  const d = useKyCong(k)
  const router = useRouter()
  return (
    <KhungTrang
      ten="Có mặt theo tổ"
      thang={k.thang}
      khoang={{ tu: k.tu, den: k.den }}
      onThang={d.xemThang}
      facts={[
        {
          label: 'Người trong kỳ',
          value: `${so(k.du.nhanSu.length + k.du.daNghi.length)}${k.du.daNghi.length ? ` · ${k.du.daNghi.length} nghỉ giữa kỳ` : ''}`,
        },
      ]}
      actions={
        <Btn
          icon="excel"
          onClick={() =>
            window.location.assign(
              `/api/dept/hr/cham-cong/du-lieu/excel?tu=${k.tu}&den=${k.den}`,
            )
          }
        >
          Xuất Excel
        </Btn>
      }
    >
      <CoMat
        k={k}
        onMoNguoi={d.moNguoi}
        onXemLuot={(ngay, boPhan) =>
          router.push(
            `/hr/cham-cong/luot?thang=${k.thang}&ngay=${ngay}${boPhan ? `&bo-phan=${encodeURIComponent(boPhan)}` : ''}`,
          )
        }
      />
    </KhungTrang>
  )
}
