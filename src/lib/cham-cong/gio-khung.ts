/**
 * GIỜ THEO KHUNG — luật tính công THẬT của phòng Nhân sự (chủ dự án gửi 17/10/2026:
 * "Thống kê giờ theo khung T9-2026 - Tổ sơn sắt.xlsx", tờ "Khung giờ & hệ số").
 * Hàm thuần, không chạm DB. Luật tạm theo ca của 12/10 đã gỡ 18/10/2026.
 *
 * Kiểm bằng chính file đó: chạy trên lượt thô của máy, khớp 241/241 ngày có giờ máy
 * của Tổ sơn sắt kỳ 25/08 → 25/09/2026 (`gio-khung.test.ts`, fixture ẩn danh).
 *
 * Quy tắc (mọi con số là THAM SỐ, đổi được — `ThamSoKhung`):
 *   1. Lượt bấm lặp trong 2 phút gộp làm một; giờ cắt về PHÚT (Excel không giữ giây).
 *   2. Ca đêm: lượt trước 5:00 mà hôm trước còn lẻ lượt → thuộc ca hôm trước (cùng hai
 *      trường hợp mở rộng ở `laLuotRaQuaDem`); ca ghi vào NGÀY BẮT ĐẦU, giờ qua 0h tính
 *      tiếp (24:00 = 1440 phút).
 *   3. 1 lượt → không tính được (0 giờ, cần bổ sung). 2–3 lượt → lượt đầu đến lượt
 *      cuối. 4+ lượt → từng cặp, bỏ khoảng ra ngoài giữa chừng.
 *   4. Giờ vào: 5:00–7:00 kéo về 7:00 (không tính đến sớm); 7:00–7:30 (ân hạn) → 7:00;
 *      vào chiều 11:00–16:00 làm tròn bậc thang theo số phút làm tới đầu giờ sau.
 *   5. Giờ ra: bậc thang trong nửa giờ — phút lẻ < 20 → bỏ; 20–49 → 30; ≥ 50 → đủ giờ.
 *   6. Giờ mỗi khung = phần giao của đoạn làm với khung; khung hành chính trừ phần
 *      giao với giờ nghỉ trưa. Công = giờ ÷ 8.
 *   7. Làm trưa (sổ tay tổ trưởng): số phút × hệ số trưa ÷ 60 cộng vào khung hành chính.
 */

export type Khung = {
  /** Mã khung ('K1'…'K6') — K1 là ca hành chính. */
  ma: string
  ten: string
  /** Phút tính từ 0h NGÀY BẮT ĐẦU ca; qua 0h thì > 1440 (5:00 hôm sau = 1740). */
  tu: number
  den: number
  /** Kiểu làm tròn 'xuong_30': phần lố dưới 30 phút của khung này bị bỏ (file Excel cột G). */
  boPhanLo?: boolean
}

/**
 * 'bac_thang' — giờ ra làm tròn bậc thang theo nửa giờ (file tổ Sơn sắt 17/10/2026).
 * 'xuong_30' — giờ ra giữ thực tế; mỗi khung có `boPhanLo` làm tròn XUỐNG bội số 30 phút
 * (file TẤT CẢ CÁC TỔ 15/10/2026). Chọn theo bản cách tính (B2, câu Q2).
 */
export type KieuLamTronRa = 'bac_thang' | 'xuong_30'

export type ThamSoKhung = {
  khung: Khung[]
  /** Mã khung hành chính — khung bị trừ nghỉ trưa và nhận giờ làm trưa. */
  khungHanhChinh: string
  truaTu: number
  truaDen: number
  /** Vào trễ trong ngần này phút sau giờ vào ca hành chính vẫn tính từ giờ vào ca. */
  anHanPhut: number
  /** Bậc thang: phút lẻ trong nửa giờ từ mốc này → tính 30 phút. */
  nguongNuaGio: number
  /** Bậc thang: phút lẻ từ mốc này → tính đủ 1 giờ. */
  nguongDuGio: number
  /** Mặc định 'bac_thang'. */
  lamTronRaKieu?: KieuLamTronRa
  /** true = giờ vào buổi chiều (từ giờ nghỉ trưa tới hết khung hành chính) cũng làm tròn bậc thang. */
  lamTronVaoChieu: boolean
  /**
   * true = bậc thang giờ vào kéo tiếp qua buổi tối (vào ca đêm 20:43 → 21:00, 20:35 → 20:30 —
   * cách sổ Nhân sự T9/2026 tính). Mặc định tắt: chỉ tới hết khung hành chính.
   */
  lamTronVaoToi?: boolean
  /** false = vào từ `denSomTu` tới giờ vào ca bị kéo về giờ vào ca (không tính giờ đến sớm). */
  tinhDenSom: boolean
  denSomTu: number
  /** Lượt sớm hơn mốc này mà hôm trước còn lẻ lượt → thuộc ca đêm hôm trước. */
  caDemDen: number
  /** Giờ vào ca thường làm của người đang ghép (phút); thiếu = đầu khung hành chính. */
  gioVaoCa?: number
  phutMotCong: number
  heSoTrua: number
  /** Ô tick làm trưa chỉ ghi "x" thì lấy ngần này phút. */
  phutTruaMacDinh: number
}

const h = (gio: number, phut = 0) => gio * 60 + phut

/** Đúng các ô xanh C12–C19, C30–C31 của tờ "Khung giờ & hệ số" (T9/2026). */
export const THAM_SO_MAC_DINH: ThamSoKhung = {
  khung: [
    { ma: 'K1', ten: 'Ca hành chính', tu: h(7), den: h(16), boPhanLo: false },
    { ma: 'K2', ten: '16h – 19h', tu: h(16), den: h(19), boPhanLo: true },
    { ma: 'K3', ten: '19h – 22h', tu: h(19), den: h(22), boPhanLo: true },
    { ma: 'K4', ten: '22h – 24h', tu: h(22), den: h(24), boPhanLo: true },
    { ma: 'K5', ten: '24h – 5h', tu: h(24), den: h(29), boPhanLo: true },
    { ma: 'K6', ten: '5h – 7h', tu: h(29), den: h(31), boPhanLo: true },
  ],
  khungHanhChinh: 'K1',
  truaTu: h(11),
  truaDen: h(12),
  anHanPhut: 30,
  nguongNuaGio: 20,
  nguongDuGio: 50,
  lamTronRaKieu: 'bac_thang',
  lamTronVaoChieu: true,
  lamTronVaoToi: false,
  tinhDenSom: false,
  denSomTu: h(5),
  caDemDen: h(5),
  phutMotCong: 480,
  heSoTrua: 2,
  phutTruaMacDinh: 60,
}

export const GOP_LAP_PHUT = 2

/** 'HH:mm' / 'HH:mm:ss' → phút trong ngày (bỏ giây). */
export function phutCua(gio: string): number {
  return Number(gio.slice(0, 2)) * 60 + Number(gio.slice(3, 5))
}

/** Phút (có thể ≥ 1440) → 'HH:mm', qua 0h ghi kèm '(+1)'. */
export function gioCua(phut: number): string {
  const ngay = Math.floor(phut / 1440)
  const m = phut - ngay * 1440
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return ngay > 0 ? `${s}(+${ngay})` : s
}

/** Bậc thang cho giờ RA: phút lẻ trong giờ < 20 → :00; 20–49 → :30; ≥ 50 → giờ sau. */
export function lamTronRa(phut: number, t: ThamSoKhung = THAM_SO_MAC_DINH): number {
  if (t.lamTronRaKieu === 'xuong_30') return phut
  const gio = Math.floor(phut / 60)
  const le = phut - gio * 60
  if (le < t.nguongNuaGio) return gio * 60
  if (le < t.nguongDuGio) return gio * 60 + 30
  return gio * 60 + 60
}

/** Giờ vào sau khi áp đến sớm / ân hạn / bậc thang buổi chiều. */
export function lamTronVao(phut: number, t: ThamSoKhung = THAM_SO_MAC_DINH): number {
  const hc = t.khung.find((k) => k.ma === t.khungHanhChinh)
  if (!hc || phut >= 1440) return phut
  if (!t.tinhDenSom && phut >= t.denSomTu && phut < hc.tu) return hc.tu
  if (phut >= hc.tu && phut <= hc.tu + t.anHanPhut) return hc.tu
  if (t.lamTronVaoChieu && phut >= t.truaTu && phut < (t.lamTronVaoToi ? 1440 : hc.den)) {
    const gio = Math.floor(phut / 60)
    const lam = 60 - (phut - gio * 60)
    if (lam === 60) return phut
    if (lam >= t.nguongDuGio) return gio * 60
    if (lam >= t.nguongNuaGio) return gio * 60 + 30
    return gio * 60 + 60
  }
  return phut
}

export type DoanLam = {
  /** Phút từ 0h ngày bắt đầu ca — giờ máy ghi. */
  vao: number
  ra: number
  /** Sau làm tròn / ân hạn — giờ dùng để tính. */
  vaoTinh: number
  raTinh: number
}

/** Lượt (phút từ 0h ngày bắt đầu, đã gộp lặp + gắn ca đêm) → các đoạn làm; 1 lượt = null. */
export function catDoan(
  luot: number[],
  t: ThamSoKhung = THAM_SO_MAC_DINH,
): DoanLam[] | null {
  if (luot.length < 2) return null
  const cap: [number, number][] =
    luot.length <= 3
      ? [[luot[0], luot[luot.length - 1]]]
      : Array.from({ length: Math.floor(luot.length / 2) }, (_, i) => [
          luot[2 * i],
          luot[2 * i + 1],
        ])
  return cap.map(([vao, ra]) => ({
    vao,
    ra,
    vaoTinh: lamTronVao(vao, t),
    raTinh: lamTronRa(ra, t),
  }))
}

export type GioNgay = {
  /** Phút theo từng khung (mã khung → phút), CHƯA cộng làm trưa. */
  theoKhung: Record<string, number>
  /** Phút làm trưa đã quy đổi (phút × hệ số), cộng vào khung hành chính. */
  truaQuyDoi: number
  /** Tổng phút mọi khung + làm trưa. */
  tong: number
}

/** Giờ theo khung của một ngày làm. `phutTrua` = số phút làm trưa đã duyệt (0 nếu không). */
export function tinhGioNgay(
  doan: DoanLam[],
  phutTrua = 0,
  t: ThamSoKhung = THAM_SO_MAC_DINH,
): GioNgay {
  const theoKhung: Record<string, number> = Object.fromEntries(
    t.khung.map((k) => [k.ma, 0]),
  )
  for (const d of doan) {
    if (d.raTinh <= d.vaoTinh) continue
    for (const k of t.khung) {
      let giao = Math.max(0, Math.min(d.raTinh, k.den) - Math.max(d.vaoTinh, k.tu))
      if (k.ma === t.khungHanhChinh) {
        giao -= Math.max(0, Math.min(d.raTinh, t.truaDen) - Math.max(d.vaoTinh, t.truaTu))
      }
      theoKhung[k.ma] += Math.max(0, giao)
    }
  }
  if (t.lamTronRaKieu === 'xuong_30')
    for (const k of t.khung)
      if (k.boPhanLo) theoKhung[k.ma] = Math.floor(theoKhung[k.ma] / 30) * 30
  const truaQuyDoi = phutTrua * t.heSoTrua
  const tong = Object.values(theoKhung).reduce((a, b) => a + b, 0) + truaQuyDoi
  return { theoKhung, truaQuyDoi, tong }
}

/** Có mặt xuyên trưa (đoạn làm phủ trọn giờ nghỉ trưa) — ứng viên duyệt làm trưa. */
export function xuyenTrua(
  doan: DoanLam[] | null,
  t: ThamSoKhung = THAM_SO_MAC_DINH,
): boolean {
  return !!doan?.some((d) => d.vaoTinh <= t.truaTu && d.raTinh >= t.truaDen)
}

export type NgayLam = {
  /** Ngày BẮT ĐẦU ca, 'YYYY-MM-DD'. */
  ngay: string
  /** Lượt đã gộp lặp, phút từ 0h ngày bắt đầu (lượt ca đêm hôm sau > 1440). */
  luot: number[]
  /** true = có lượt hôm sau (trước 5:00) được gắn vào ca đêm của ngày này. */
  quaDem: boolean
  doan: DoanLam[] | null
}

const ngayPhut = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 60000
const isoNgay = (phutTuyetDoi: number) =>
  new Date(phutTuyetDoi * 60000).toISOString().slice(0, 10)

/** Ca dài (vào sáng, ra sáng hôm sau) phải kéo ít nhất ngần này phút mới được ghép. */
export const CA_DAI_TU_PHUT = 20 * 60

/**
 * Lượt đầu hôm nay (`hom[0]`) có phải lượt RA của ca hôm trước (`truoc`, đang lẻ lượt)?
 * Ba trường hợp — đối chiếu sổ Nhân sự T9/2026 (21/10/2026, 6 người Tổ Phôi / Cơ Điện):
 *   1. Tới `caDemDen` (5:00), GỒM đúng mốc: luật gốc, luôn ghép. Sổ Nhân sự gõ giờ ra ca
 *      đêm là 05:00 tròn (625 ngày 10/09); để "< 5:00" thì lượt đó thành ca 05:00 → 06:38.
 *   2. CA ĐÊM — lượt cuối hôm trước từ hết giờ hành chính (16:00) trở đi, lượt hôm nay sớm
 *      hơn giờ vào ca 1 tiếng (6:00). Mã 105 vào 20:43 ra 05:08 / 05:26: mốc 5:00 cứng làm
 *      lượt ra thành lượt vào hôm sau rồi kéo lệch cả tuần. Chặn ở 6:00 vì người làm ngày
 *      gần như không quẹt trước giờ đó — quên quẹt vào một tối không kéo dây chuyền.
 *   3. CA DÀI — lượt cuối hôm trước là lượt vào buổi sáng, lượt hôm nay trước giờ vào ca và
 *      cách nó ≥ 20 giờ (mã 529: 07:05 → 06:20 hôm sau). Bỏ lượt đó đi thì hôm nay phải còn
 *      CHẴN lượt, ít nhất 2 — không thì đó là người quên quẹt ra hôm qua, lượt sáng nay
 *      là lượt vào (hai ngày liền chỉ một lượt 06:55 KHÔNG thành ca 24 giờ). Lượt vào phải
 *      là lượt sáng thường (từ 6:00) và ca không quá 24 giờ: lượt RA ca đêm đứng lẻ (05:03,
 *      05:32 — thiếu lượt vào tối trước) không được hiểu thành lượt vào một ca 25 giờ.
 */
function laLuotRaQuaDem(
  truoc: number[],
  hom: number[],
  goc: number,
  t: ThamSoKhung,
): boolean {
  const p = hom[0] - goc
  if (p <= t.caDemDen) return true
  const hc = t.khung.find((k) => k.ma === t.khungHanhChinh)
  if (!hc) return false
  const vaoCa = t.gioVaoCa ?? hc.tu
  const cuoi = truoc[truoc.length - 1] - (goc - 1440)
  if (cuoi >= hc.den && p < vaoCa - 60) return true
  return (
    cuoi >= vaoCa - 60 &&
    cuoi < t.truaTu &&
    p < vaoCa &&
    p < cuoi &&
    p + 1440 - cuoi >= CA_DAI_TU_PHUT &&
    hom.length >= 3 &&
    (hom.length - 1) % 2 === 0
  )
}

/**
 * Lượt thô của MỘT người ('YYYY-MM-DD HH:mm[:ss]', giờ tường VN, mọi máy) → ngày làm.
 * Gộp lặp < 2 phút, gắn lượt sáng sớm vào ca đêm hôm trước, cắt đoạn làm.
 */
export function ghepNgayLam(
  luotTho: string[],
  t: ThamSoKhung = THAM_SO_MAC_DINH,
): NgayLam[] {
  const tuyet = [
    ...new Set(luotTho.map((s) => ngayPhut(s.slice(0, 10)) + phutCua(s.slice(11)))),
  ].sort((a, b) => a - b)
  const gop: number[] = []
  for (const m of tuyet)
    if (!gop.length || m - gop[gop.length - 1] >= GOP_LAP_PHUT) gop.push(m)

  const theoNgay = new Map<string, number[]>()
  for (const m of gop) {
    const d = isoNgay(m)
    theoNgay.set(d, [...(theoNgay.get(d) ?? []), m])
  }
  const ngays = [...theoNgay.keys()].sort()
  const quaDem = new Set<string>()
  for (let i = 1; i < ngays.length; i++) {
    const hom = theoNgay.get(ngays[i])!
    const truoc = theoNgay.get(ngays[i - 1])!
    const goc = ngayPhut(ngays[i])
    const lienNgay = ngayPhut(ngays[i - 1]) === goc - 1440
    if (
      lienNgay &&
      truoc.length % 2 === 1 &&
      hom.length &&
      laLuotRaQuaDem(truoc, hom, goc, t)
    ) {
      truoc.push(hom.shift()!)
      quaDem.add(ngays[i - 1])
    }
  }
  const out: NgayLam[] = []
  for (const d of ngays) {
    const goc = ngayPhut(d)
    const luot = theoNgay.get(d)!.map((m) => m - goc)
    if (!luot.length) continue
    out.push({ ngay: d, luot, quaDem: quaDem.has(d), doan: catDoan(luot, t) })
  }
  return out
}

/** Phút → giờ, 2 lẻ (đúng cách Excel làm tròn từng ô). */
export const gio2 = (phut: number) => Math.round((phut / 60) * 100) / 100

/** Phút → công (giờ ÷ 8), 2 lẻ. */
export const cong2 = (phut: number, t: ThamSoKhung = THAM_SO_MAC_DINH) =>
  Math.round((phut / t.phutMotCong) * 100) / 100
