import type { KyCong } from '@/modules/dept/hr/cham-cong/cham-cong.service'

export type { KyCong }

/** Năm bước của một kỳ công, theo thứ tự làm việc của Nhân sự. Id là chữ trên URL (`?buoc=`). */
export const BUOC_IDS = ['du-lieu', 'nhan-vien', 'xu-ly', 'bang-cong', 'chot'] as const
export type BuocId = (typeof BUOC_IDS)[number]

export type TrangThaiBuoc = 'xong' | 'luu-y' | 'vuong' | 'chua'

export type Buoc = {
  id: BuocId
  so: number
  ten: string
  /** Một dòng tình trạng dưới tên bước — đếm bằng đúng dữ liệu bước đó bày. */
  tinhTrang: string
  trangThai: TrangThaiBuoc
}

const so = (n: number) => n.toLocaleString('vi-VN')

/** Số ngày của kỳ đã qua tính tới hôm nay (kỳ tương lai = 0, kỳ đã qua = cả kỳ). */
export function ngayDaQua(k: Pick<KyCong, 'tu' | 'den' | 'homNay'>): number {
  if (k.homNay < k.tu) return 0
  const cuoi = k.homNay < k.den ? k.homNay : k.den
  return Math.round((Date.parse(cuoi) - Date.parse(k.tu)) / 86400_000) + 1
}

/**
 * Tình trạng 5 bước. Bước ①–② đếm từ dữ liệu thật; ③–⑤ chưa dựng (bản vẽ vòng 3:
 * dựng lần lượt, mỗi lượt một bước) nên nói thẳng "sắp có", không bịa số.
 */
export function cacBuoc(k: KyCong): Buoc[] {
  const tongLuot = k.du.theoNgay.reduce(
    (s, n) => s + Object.values(n.theoMay).reduce((a, b) => a + b, 0),
    0,
  )
  const coDuLieu = k.du.theoNgay.filter((n) => Object.keys(n.theoMay).length > 0)
  const daQua = ngayDaQua(k)
  const ngayCuoiCo = coDuLieu.at(-1)?.ngay ?? ''
  // "Đủ" = có lượt tới ngày gần nhất đã qua (hôm qua, hoặc cuối kỳ nếu kỳ đã qua).
  // Không đòi mọi ngày có lượt: ngày lễ / chủ nhật nghỉ không ai quẹt là bình thường.
  const moc = k.homNay <= k.den ? truocMotNgay(k.homNay) : k.den
  const du: TrangThaiBuoc =
    coDuLieu.length === 0 ? 'chua' : ngayCuoiCo >= moc ? 'xong' : 'luu-y'
  const nguoi = new Set(k.du.dong.filter((r) => r.daGhep).map((r) => r.ma)).size
  return [
    {
      id: 'du-lieu',
      so: 1,
      ten: 'Dữ liệu',
      tinhTrang:
        coDuLieu.length === 0
          ? 'chưa lấy về'
          : `${so(tongLuot)} lượt · ${coDuLieu.length}/${daQua} ngày có lượt`,
      trangThai: du,
    },
    {
      id: 'nhan-vien',
      so: 2,
      ten: 'Nhân viên & ca',
      tinhTrang: nguoi
        ? `${so(nguoi)} người${k.du.maCanXem ? ` · ${k.du.maCanXem} mã cần xem` : ''}`
        : 'chưa có ai',
      trangThai: nguoi === 0 ? 'chua' : k.du.maCanXem ? 'luu-y' : 'xong',
    },
    { id: 'xu-ly', so: 3, ten: 'Cần xử lý', tinhTrang: 'sắp có', trangThai: 'chua' },
    { id: 'bang-cong', so: 4, ten: 'Bảng công', tinhTrang: 'sắp có', trangThai: 'chua' },
    { id: 'chot', so: 5, ten: 'Chốt kỳ', tinhTrang: 'sắp có', trangThai: 'chua' },
  ]
}

function truocMotNgay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function doiThang(t: string, buoc: number): string {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + buoc, 1)).toISOString().slice(0, 7)
}

export const thangVn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`
export const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const
export const thu = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
