// TẠM — chạy lương kỳ 2026-09 TRONG BỘ NHỚ theo 3 biến thể luật (không ghi DB). Xoá sau khi dùng.
//   tsx … <out.json> <cu | moi | moi-tile>
//   cu       = hệ số đang lưu trong bản cách tính (K2–K3 133 %, K4–K6 210 %)
//   moi      = K3 (19–22h) 120 %; ngày ca đêm (không giờ hành chính, có giờ 24h–5h) = 2,1 công trọn ca
//   moi-tile = như moi nhưng ca đêm tính tỉ lệ: 2,1 công ÷ 12 giờ × giờ thật của ca
import fs from 'node:fs'
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const i = line.indexOf('=')
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
}
const out = process.argv[2] ?? 'luong-t9.json'
const bienThe = (process.argv[3] ?? 'cu') as 'cu' | 'moi' | 'moi-tile' | 'moi-210'
const thang = '2026-09'
const { gioCongService } = await import('../src/modules/dept/hr/cham-cong/gio-cong.service')
const { db } = await import('../src/server/db')
const { banChotTu } = await import('../src/lib/cham-cong/ky-cong')
const { chamCongRepo } = await import('../src/modules/dept/hr/cham-cong/cham-cong.repo')
const { cachTinhRepo } = await import('../src/modules/dept/hr/cham-cong/cach-tinh.repo')
const { hoSoLuongRepo } = await import('../src/modules/dept/hr/luong/ho-so-luong.repo')
const { bangLuongRepo } = await import('../src/modules/dept/hr/luong/bang-luong.repo')
const { congNhapTayRepo } = await import('../src/modules/dept/hr/cham-cong/cong-nhap-tay.repo')
const { banHieuLuc, CACH_PC_MAC_DINH } = await import('../src/lib/luong/ho-so-luong')
const { congChuan, tinhPhieu } = await import('../src/lib/luong/tinh-luong')
const { congNgay } = await import('../src/lib/cham-cong/ky-gio-cong')
const { khoangTrongKy } = await import('../src/lib/nhan-su/bien-dong')
const { laTangCa, lyDoCua, TEN_LY_DO_THEM } = await import('../src/lib/cham-cong/cong-nhap-tay')

const { data: admin } = await db().from('users').select('*').eq('email', 'admin@hg.com').single()
const g = await gioCongService.bang(admin as never, thang, '2026-10-23')
const ky = { tu: g.tu, den: g.den, banCachTinhId: g.banId! }
const emps = await chamCongRepo.employees()
const khongCham = emps.filter(
  (e) =>
    e.attendance_exempt &&
    !!khoangTrongKy({ hireDate: e.hire_date, leaveDate: e.leave_date }, ky.tu, ky.den),
)
const chot = [
  ...banChotTu(g.nguoi),
  ...khongCham.map((e) => ({
    ma: e.code,
    ten: e.full_name,
    to: e.team,
    ngay: null,
    k: {},
    truaCong: 0,
    tong: 0,
    nghi: null,
    khong: false,
    miem: true,
  })),
]
const [ban, loaiPc, khung, heSo, quyTacBan, leRows, khoan, ts, them, nhapKc] = await Promise.all([
  hoSoLuongRepo.banTatCa(),
  hoSoLuongRepo.loaiPhuCap(),
  cachTinhRepo.khung(ky.banCachTinhId),
  cachTinhRepo.heSo(ky.banCachTinhId),
  cachTinhRepo.dsBan(),
  chamCongRepo.holidays(ky.tu, congNgay(ky.den, 1)),
  bangLuongRepo.khoan(thang),
  cachTinhRepo.thamSoLuong(ky.banCachTinhId),
  congNhapTayRepo.dsThem(thang),
  congNhapTayRepo.ds(thang),
])
const quyTac = quyTacBan.find((b) => b.id === ky.banCachTinhId)!.quyTac
const ngayLe = leRows
  .map((h) => h.holiday_date)
  .filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0)
const le = new Set(ngayLe)
const cc = ts.congChuan ?? congChuan(ky.tu, ky.den, ngayLe)
const rate = new Map(heSo.map((h) => [`${h.loai}|${h.ma}|${h.ngay}`, h.pt]))
if (bienThe !== 'cu') for (const n of ['thuong', 'cn']) rate.set(`frame|K3|${n}`, 120)
const CA_DEM_CONG = 2.1
const CA_DEM_PHUT = 12 * 60
const boiCanh = {
  thang,
  phutMotCong: quyTac.phutMotCong,
  khung: khung.map((k) => ({ ma: k.ma, ten: k.ten, hanhChinh: k.hanhChinh })),
  congChuan: cc,
  loaiNgay: (d: string) =>
    (le.has(d) ? 'le' : new Date(`${d}T00:00:00Z`).getUTCDay() === 0 ? 'cn' : 'thuong') as
      | 'le'
      | 'cn'
      | 'thuong',
  heSoKhung: (ma: string, n: string) => rate.get(`frame|${ma}|${n}`) ?? null,
  heSoNghi: (ma: string) => rate.get(`leave|${ma}|any`) ?? null,
  heSoTrua: quyTac.heSoTrua,
  ptTrua: ts.ptTrua,
  truThue: ts.truThue,
}
const empByCode = new Map(emps.map((e) => [e.code, e]))
const loaiCua = new Map(loaiPc.map((l) => [l.id, l]))
const nhapCua = new Map(nhapKc.map((n) => [n.employeeId, n]))
const themCua = new Map<string, { ten: string; cong: number; tangCa: boolean }[]>()
for (const t of them) {
  const l = lyDoCua(t.lyDo)
  themCua.set(t.employeeId, [
    ...(themCua.get(t.employeeId) ?? []),
    { ten: TEN_LY_DO_THEM[l], cong: t.cong, tangCa: laTangCa(l) },
  ])
}
const theoNguoi = new Map<string, typeof chot>()
for (const c of chot) theoNguoi.set(c.ma, [...(theoNguoi.get(c.ma) ?? []), c])

/** Ngày ca đêm: không có giờ hành chính, có giờ sau 0h (K5 24h–5h). */
const laCaDem = (k: Record<string, number>) => (k.K5 ?? 0) > 0
const KHUNG_TOI = ['K2', 'K3', 'K4', 'K5', 'K6']

const phieu: Record<string, unknown>[] = []
for (const [ma, ds] of theoNguoi) {
  const e = empByCode.get(ma)
  if (!e) continue
  const hs = banHieuLuc(
    ban.filter((b) => b.employeeId === e.id),
    thang,
  )
  const khoang = khoangTrongKy({ hireDate: e.hire_date, leaveDate: e.leave_date }, ky.tu, ky.den)
  const nhapRow = ds.some((x) => x.miem) ? nhapCua.get(e.id) : undefined
  const mien = nhapRow
    ? { cong: nhapRow.cong, tcPhut: nhapRow.tcPhut }
    : ds.some((x) => x.miem)
      ? khoang
        ? khoang.tu === ky.tu && khoang.den === ky.den
          ? true
          : congChuan(khoang.tu, khoang.den, ngayLe)
        : 0
      : false
  const ngays = ds
    .filter((x) => !x.miem && x.ngay)
    .map((x) => ({
      ngay: x.ngay!,
      k: { ...x.k } as Record<string, number>,
      trua: x.truaCong,
      nghi: x.nghi as never,
      khong: x.khong,
    }))
  const themDs = [...(themCua.get(e.id) ?? [])]
  let soDem = 0
  let phutDem = 0
  const phutKhung: Record<string, number> = {}
  const ngayToi = ngays.filter((n) => (n.k.K4 ?? 0) + (n.k.K5 ?? 0) + (n.k.K6 ?? 0) > 0).map((n) => ({ ngay: n.ngay, k: n.k }))
  for (const n of ngays)
    for (const [k, p] of Object.entries(n.k)) phutKhung[k] = (phutKhung[k] ?? 0) + p
  if (bienThe !== 'cu') {
    for (const n of ngays) {
      if (n.khong || !laCaDem(n.k)) continue
      const tong = KHUNG_TOI.reduce((a, k) => a + (n.k[k] ?? 0), 0)
      soDem++
      phutDem += tong
      if (bienThe === 'moi-210') {
        for (const k of KHUNG_TOI) n.k[k] = 0
        n.k.K4 = tong
        continue
      }
      const cong =
        bienThe === 'moi'
          ? CA_DEM_CONG
          : Math.round(((CA_DEM_CONG * tong) / CA_DEM_PHUT) * 100) / 100
      themDs.push({ ten: `Ca đêm ${n.ngay}`, cong, tangCa: true })
      for (const k of KHUNG_TOI) n.k[k] = 0
    }
  }
  const p = tinhPhieu(
    hs
      ? {
          cachTra: hs.cachTra,
          donGia: hs.donGia,
          luongThang: hs.luongThang,
          luongBh: hs.luongBh,
          coBh: hs.coBh,
          npt: hs.npt,
          khauTru10: hs.khauTru10,
          tangCaGio: hs.tangCaGio,
          doanPhi: hs.doanPhi,
          phuCap: Object.entries(hs.phuCap)
            .map(([id, muc]) => ({ id, l: loaiCua.get(id), muc }))
            .filter((x) => x.l)
            .map(({ id, l, muc }) => ({
              ten: l!.ten,
              muc,
              chiuThue: l!.chiuThue,
              theoNgay: l!.theoNgay,
              ...(hs.phuCapCach[id] ?? CACH_PC_MAC_DINH),
            })),
        }
      : {
          cachTra: 'daily' as const,
          donGia: 0,
          luongThang: null,
          luongBh: null,
          coBh: false,
          npt: 0,
          khauTru10: false,
          tangCaGio: null,
          doanPhi: false,
          phuCap: [],
        },
    ngays,
    khoan.filter((k) => k.employeeId === e.id).map((k) => ({ loai: k.loai, tien: k.tien })),
    boiCanh as never,
    mien,
    themDs,
  )
  phieu.push({
    ma,
    ten: e.full_name,
    to: e.team,
    kcc: e.attendance_exempt,
    coHoSo: !!hs,
    cachTra: hs?.cachTra ?? null,
    donGia: hs?.donGia ?? null,
    cong: p.congThuc,
    luongCong: p.luongCong,
    tangCa: p.tangCa,
    phuCap: p.phuCap,
    bhNld: p.bhNld,
    doanPhi: p.doanPhi,
    khoanTru: p.khoanTru,
    tong: p.tong,
    thucLinh: p.thucLinh,
    soDem,
    gioDem: Math.round(phutDem / 6) / 10,
    phutKhung,
    ngayToi,
    van: [
      ...(hs ? [] : ['Chưa có hồ sơ lương']),
      ...p.thieuHeSo.map((t) => 'Thiếu hệ số ' + t),
      ...p.canhBao,
    ],
  })
}
fs.writeFileSync(
  out,
  JSON.stringify(
    { tu: ky.tu, den: ky.den, congChuan: cc, ban: g.ban, bienThe, heSo: [...rate], phieu },
    null,
    1,
  ),
)
console.log(
  JSON.stringify({
    bienThe,
    nguoi: phieu.length,
    coHoSo: phieu.filter((p) => p.coHoSo).length,
    thucLinh: phieu.reduce((s, p) => s + (p.thucLinh as number), 0),
    soDem: phieu.reduce((s, p) => s + (p.soDem as number), 0),
  }),
)
