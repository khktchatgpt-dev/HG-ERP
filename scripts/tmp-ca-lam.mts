// TẠM — phân loại ca làm và trường hợp đi làm từ lượt MÁY của một kỳ (đọc DB, không ghi). Xoá sau khi dùng.
//   tsx … <thang YYYY-MM> <asOf YYYY-MM-DD> <out.json>
import fs from 'node:fs'
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const i = line.indexOf('=')
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
}
const thang = process.argv[2] ?? '2026-09'
const asOf = process.argv[3] ?? '2026-10-23'
const out = process.argv[4] ?? `ca-lam-${thang}.json`
const { gioCongService } = await import('../src/modules/dept/hr/cham-cong/gio-cong.service')
const { db } = await import('../src/server/db')
const { chamCongRepo } = await import('../src/modules/dept/hr/cham-cong/cham-cong.repo')
const { congNgay } = await import('../src/lib/cham-cong/ky-gio-cong')

const { data: admin } = await db().from('users').select('*').eq('email', 'admin@hg.com').single()
const g = await gioCongService.bang(admin as never, thang, asOf)
const leRows = await chamCongRepo.holidays(g.tu, congNgay(g.den, 1))
const le = new Set(leRows.map((h) => h.holiday_date))
const h = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${m >= 1440 ? '(+1)' : ''}`
const bVao = (m: number) =>
  m < 300 ? 'trước 5h' : m < 420 ? '5h–7h' : m <= 450 ? '7h–7h30' : m < 660 ? '7h30–11h' : m < 780 ? '11h–13h' : m < 960 ? '13h–16h' : m < 1080 ? '16h–18h' : m < 1320 ? '18h–22h' : 'từ 22h'
const bRa = (m: number) =>
  m < 660 ? 'trước 11h' : m < 720 ? '11h–12h' : m < 960 ? '12h–16h' : m <= 990 ? '16h–16h30' : m < 1140 ? '16h30–19h' : m < 1260 ? '19h–21h' : m < 1320 ? '21h–22h' : m < 1440 ? '22h–24h' : m < 1740 ? '0h–5h hôm sau' : m < 1860 ? '5h–7h hôm sau' : 'sau 7h hôm sau'
type Dong = {
  ma: string; to: string | null; ngay: string; loaiNgay: 'thuong' | 'cn' | 'le'; soLuot: number
  vao: number | null; ra: number | null; ca: string; truongHop: string[]; gio: number; quaDem: boolean
}
const ds: Dong[] = []
let khongLuot = 0
for (const n of g.nguoi) {
  for (const x of n.ngay) {
    if (x.ngay > asOf) continue
    const dow = new Date(`${x.ngay}T00:00:00Z`).getUTCDay()
    const loaiNgay = le.has(x.ngay) ? 'le' : dow === 0 ? 'cn' : 'thuong'
    if (!x.luot.length) { if (loaiNgay === 'thuong' && !x.nghi) khongLuot++; continue }
    const th: string[] = []
    if (loaiNgay === 'cn') th.push('làm Chủ nhật')
    if (loaiNgay === 'le') th.push('làm ngày lễ')
    if (x.nghi) th.push(`có đơn nghỉ (${x.nghi})`)
    if (x.daSua) th.push('có điều chỉnh')
    let ca = ''
    let vao: number | null = null, ra: number | null = null
    if (!x.doan) {
      ca = x.luot[0] < 300 ? 'chỉ 1 lượt — rạng sáng (lượt ra ca đêm lẻ)' : x.luot[0] < 780 ? 'chỉ 1 lượt — buổi sáng (quên quẹt ra)' : 'chỉ 1 lượt — chiều / tối (quên quẹt vào)'
      th.push('1 lượt, không tính được')
    } else {
      vao = x.doan[0].vao
      ra = x.doan[x.doan.length - 1].ra
      if (x.luot.length === 3) th.push('3 lượt (lẻ một lượt giữa)')
      if (x.luot.length >= 4) th.push('ra ngoài giữa chừng (4+ lượt)')
      if (x.luot.length >= 6) th.push('6+ lượt')
      if (x.quaDem) th.push('qua 0h')
      if (x.xuyenTrua) th.push('có mặt xuyên trưa')
      if (x.trua > 0) th.push('đã tick làm trưa')
      if (vao < 300) th.push('vào trước 5h')
      else if (vao < 420) th.push('đến sớm 5h–7h')
      else if (vao > 450 && vao < 660) th.push('đi trễ sau 7h30')
      const k = x.k ?? {}
      const coHc = (k.K1 ?? 0) > 0
      const coDem = (k.K5 ?? 0) + (k.K6 ?? 0) > 0 || ra >= 1440
      if (coHc && coDem) th.push('sáng + đêm cùng ngày')
      if (ra - vao > 16 * 60) th.push('đoạn làm > 16 giờ')
      // Nhãn ca
      if (vao >= 960 && ra >= 1440) ca = 'Ca đêm (vào từ 16h, ra sau 0h)'
      else if (vao < 660 && ra >= 1440) ca = 'Ca dài (vào sáng, ra sáng hôm sau)'
      else if (vao >= 960) ca = 'Ca tối (vào từ 16h, ra trước 0h)'
      else if (vao >= 780) ca = 'Chiều muộn (vào 13h–16h)'
      else if (vao >= 660) ca = ra >= 960 ? 'Nửa ngày chiều' : 'Ngắn buổi trưa'
      else if (ra < 660) ca = 'Về trước 11h'
      else if (ra < 780) ca = 'Nửa ngày sáng (ra 11h–13h)'
      else if (ra < 960) ca = 'Về sớm (ra 13h–16h)'
      else if (ra <= 990) ca = 'Hành chính 7h–16h'
      else if (ra < 1140) ca = 'HC + tăng ca đến 16h30–19h'
      else if (ra < 1260) ca = 'HC + tăng ca đến 19h–21h'
      else if (ra < 1320) ca = 'HC + tăng ca đến 21h–22h'
      else ca = 'HC + tăng ca đến 22h–24h'
      if (vao > 450 && vao < 660 && ra >= 960) ca += ' — đi trễ'
    }
    ds.push({ ma: n.ma, to: n.boPhan, ngay: x.ngay, loaiNgay, soLuot: x.luot.length, vao, ra, ca, truongHop: th, gio: Math.round(((x.k ? Object.values(x.k).reduce((a, b) => a + b, 0) : 0) / 60) * 10) / 10, quaDem: x.quaDem })
  }
}
fs.writeFileSync(out, JSON.stringify({ thang, tu: g.tu, den: g.den, asOf, nguoi: g.nguoi.length, khongLuot, ds }, null, 0))
const tong = ds.length
const pct = (n: number) => `${((100 * n) / tong).toFixed(1)} %`
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
console.log(`Kỳ ${thang}: ${g.tu} → ${g.den} (đến ${asOf}) · ${g.nguoi.length} người · ${tong} ngày-người có lượt · ${khongLuot} ngày thường không lượt không đơn`)
console.log('\n== CA LÀM (theo lượt đầu / lượt cuối)')
const byCa = new Map<string, Dong[]>()
for (const d of ds) byCa.set(d.ca, [...(byCa.get(d.ca) ?? []), d])
for (const [ca, a] of [...byCa].sort((x, y) => y[1].length - x[1].length)) {
  const vao = med(a.filter((d) => d.vao != null).map((d) => d.vao!)), ra = med(a.filter((d) => d.ra != null).map((d) => d.ra!))
  const nguoi = new Set(a.map((d) => d.ma)).size
  const to = [...a.reduce((m, d) => m.set(d.to ?? '?', (m.get(d.to ?? '?') ?? 0) + 1), new Map<string, number>())].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([t, n]) => `${t} ${n}`).join(', ')
  console.log(String(a.length).padStart(5), pct(a.length).padStart(7), String(nguoi).padStart(3) + ' người', ca.padEnd(46), vao != null ? `vào ~${h(vao)}` : '', ra != null ? `ra ~${h(ra)}` : '', '|', to)
}
console.log('\n== TRƯỜNG HỢP ĐI LÀM (một ngày có thể dính nhiều)')
const byTh = new Map<string, Dong[]>()
for (const d of ds) for (const t of d.truongHop) byTh.set(t, [...(byTh.get(t) ?? []), d])
for (const [t, a] of [...byTh].sort((x, y) => y[1].length - x[1].length)) {
  const to = [...a.reduce((m, d) => m.set(d.to ?? '?', (m.get(d.to ?? '?') ?? 0) + 1), new Map<string, number>())].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([t2, n]) => `${t2} ${n}`).join(', ')
  console.log(String(a.length).padStart(5), pct(a.length).padStart(7), String(new Set(a.map((d) => d.ma)).size).padStart(3) + ' người', t.padEnd(42), '|', to)
}
console.log('\n== SỐ LƯỢT / NGÀY')
const byLuot = new Map<number, number>()
for (const d of ds) byLuot.set(Math.min(d.soLuot, 6), (byLuot.get(Math.min(d.soLuot, 6)) ?? 0) + 1)
console.log([...byLuot].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}${n === 6 ? '+' : ''} lượt: ${c} (${pct(c)})`).join(' · '))
console.log('\n== GIỜ VÀO × GIỜ RA (ngày tính được)')
const grid = new Map<string, number>()
for (const d of ds) if (d.vao != null) grid.set(`${bVao(d.vao)} → ${bRa(d.ra!)}`, (grid.get(`${bVao(d.vao)} → ${bRa(d.ra!)}`) ?? 0) + 1)
for (const [k, c] of [...grid].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(String(c).padStart(5), pct(c).padStart(7), k)
