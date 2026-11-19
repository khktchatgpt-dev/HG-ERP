import type { KetQuaGhi, XemDanSo } from '@/modules/dept/production/dan-so.service'

/**
 * GHI TỪNG ĐỢT NHỎ của Dán sổ Excel (bản vẽ 19/11/2026, bước 1): một yêu cầu ghi cả tờ lớn
 * mất vài phút và có thể bị ngắt (giới hạn thời gian trên Vercel), nên màn ghi mỗi lần vài
 * ngày rồi gộp kết quả. Thuần, không chạm DB.
 */

/** Các ngày có ô SẼ GHI trong bản xem trước, tăng dần. */
export function ngayCanGhi(xem: Pick<XemDanSo, 'dong'> | null): string[] {
  const s = new Set<string>()
  for (const d of xem?.dong ?? []) {
    for (const [iso, o] of Object.entries(d.o)) if (o.tt === 'ghi') s.add(iso)
  }
  return [...s].sort()
}

/** Chia danh sách ngày thành các đợt `co` ngày, giữ thứ tự. */
export function chiaDot<T>(ds: T[], co: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < ds.length; i += co) out.push(ds.slice(i, i + co))
  return out
}

/** Gộp kết quả các đợt: phiếu nối nhau; theo mã SP gộp theo (mã, đợt) với số chi tiết là HỢP id. */
export function gopKetQua(parts: KetQuaGhi[]): KetQuaGhi {
  const cuoi = parts[parts.length - 1]
  const ma = new Map<string, KetQuaGhi['theo_ma'][number]>()
  const ids = new Map<string, Set<string>>()
  for (const p of parts) {
    for (const m of p.theo_ma) {
      const k = `${m.ma}|${m.dot}|${m.ten}`
      const g = ma.get(k) ?? { ...m, tong: 0, moi: 0, so_ct: 0, ct_ids: [] }
      g.tong += m.tong
      g.moi += m.moi
      ma.set(k, g)
      const u = ids.get(k) ?? new Set<string>()
      for (const id of m.ct_ids) u.add(id)
      ids.set(k, u)
    }
  }
  for (const [k, g] of ma) {
    g.ct_ids = [...(ids.get(k) ?? [])]
    g.so_ct = g.ct_ids.length
  }
  return {
    ghi_boi: cuoi?.ghi_boi ?? '',
    luc: cuoi?.luc ?? new Date().toISOString(),
    theo_ma: [...ma.values()],
    phieu: parts.flatMap((p) => p.phieu),
    moi_tao: parts.reduce((a, p) => a + p.moi_tao, 0),
    canh_bao: [...new Set(parts.flatMap((p) => p.canh_bao))],
  }
}
