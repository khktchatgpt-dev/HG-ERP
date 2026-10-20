'use client'

import type { ReactNode } from 'react'
import { NumInput, Pick, TextInput } from '@/components/kit'
import { cn } from '@/lib/utils'
import { gioKhung, thamSoTuBan, type QuyTac } from '@/lib/cham-cong/cach-tinh'
import { lamTronRa, lamTronVao } from '@/lib/cham-cong/gio-khung'
import { docGio, hhmm } from './cach-tinh.shared'
import { SEC, TD, TH } from './ngan-he-so'
import type { CachTinhCtx } from './useCachTinh'

/** Giờ gõ vào ('HH:MM') → phút tính từ 0h NGÀY BẮT ĐẦU ca: trước giờ vào ca hành chính là hôm sau. */
function phutCa(v: number, moc: number, laDen: boolean): number {
  if (v === 1440) return 1440
  return v < moc || (laDen && v === moc) ? v + 1440 : v
}

const so = (s: string) => {
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function NganQuyTac({ d }: { d: CachTinhCtx }) {
  const sua = d.suaQuyTacDuoc
  const q = d.quyTac
  const moc = d.khung.find((k) => k.hanhChinh)?.tu ?? 420
  const t = thamSoTuBan(d.khung, q)
  const loiCua = new Map(d.loiKhung.map((l) => [l.ma, l.loi]))
  const vd = (vao: number) => gioKhung(lamTronVao(vao, t))
  const vr = (ra: number) => gioKhung(lamTronRa(ra, t))

  const oGio = (ten: string, v: number, onPhut: (p: number) => void) =>
    sua ? (
      <TextInput
        label={ten}
        mono
        value={hhmm(v)}
        onCommit={(s) => {
          const p = docGio(s)
          if (p != null) onPhut(p)
        }}
      />
    ) : (
      <span className="num">{hhmm(v)}</span>
    )
  const oSo = (ten: string, v: number, don: string, on: (n: number) => void) =>
    sua ? (
      <span className="inline-flex items-center gap-1">
        <NumInput
          aria-label={ten}
          value={String(v).replace('.', ',')}
          onCommit={(s) => {
            const n = so(s)
            if (n != null && n >= 0) on(n)
          }}
          className="w-16 border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-0.5"
        />
        <span className="text-[var(--ink-3)]">{don}</span>
      </span>
    ) : (
      <span className="num">
        {String(v).replace('.', ',')} {don}
      </span>
    )
  const oChon = (
    ten: string,
    v: string,
    opts: { value: string; label: string }[],
    on: (v: string) => void,
  ) =>
    sua ? (
      <Pick label={ten} width={170} value={v} onChange={on} options={opts} />
    ) : (
      <span>{opts.find((o) => o.value === v)?.label}</span>
    )
  const coKhong = [
    { value: 'co', label: 'Có' },
    { value: 'khong', label: 'Không' },
  ]

  const dong: { ten: string; o: ReactNode; vd?: string }[] = [
    {
      ten: 'Nghỉ trưa không tính giờ',
      o: (
        <span className="inline-flex items-center gap-1">
          {oGio('Nghỉ trưa từ', q.truaTu, (p) => d.doiQuyTac({ truaTu: p }))}–
          {oGio('Nghỉ trưa đến', q.truaDen, (p) => d.doiQuyTac({ truaDen: p }))}
        </span>
      ),
      vd: `vào 06:58, ra 16:00 → ${(t.khung[0].den - t.khung[0].tu - (q.truaDen - q.truaTu)) / 60} giờ hành chính`,
    },
    {
      ten: 'Ân hạn vào trễ (vẫn tính từ giờ vào ca)',
      o: oSo('Ân hạn', q.anHanPhut, 'phút', (n) =>
        d.doiQuyTac({ anHanPhut: Math.round(n) }),
      ),
      vd: `vào ${hhmm(moc + 25)} → ${vd(moc + 25)} · vào ${hhmm(moc + q.anHanPhut + 1)} → ${vd(moc + q.anHanPhut + 1)}`,
    },
    {
      ten: 'Tính giờ đến sớm trước ca',
      o: oChon('Tính giờ đến sớm', q.tinhDenSom ? 'co' : 'khong', coKhong, (v) =>
        d.doiQuyTac({ tinhDenSom: v === 'co' }),
      ),
      vd: `vào 05:40 → ${vd(340)}`,
    },
    {
      ten: 'Làm tròn giờ ra',
      o: oChon(
        'Làm tròn giờ ra',
        q.lamTronRaKieu,
        [
          { value: 'bac_thang', label: 'Bậc thang nửa giờ' },
          { value: 'xuong_30', label: 'Xuống 30 phút theo khung' },
        ],
        (v) => d.doiQuyTac({ lamTronRaKieu: v as QuyTac['lamTronRaKieu'] }),
      ),
      vd:
        q.lamTronRaKieu === 'bac_thang'
          ? `ra 18:15 → ${vr(1095)} · 18:35 → ${vr(1115)} · 18:52 → ${vr(1132)}`
          : 'giờ ra giữ thực tế; khung có "Bỏ phần lố" mất phần dưới 30 phút (2 giờ 52 → 2 giờ 30)',
    },
    ...(q.lamTronRaKieu === 'bac_thang'
      ? [
          {
            ten: 'Bậc thang: lẻ từ … phút tính nửa giờ, từ … phút tính đủ giờ',
            o: (
              <span className="inline-flex items-center gap-2">
                {oSo('Mốc nửa giờ', q.nguongNuaGio, '', (n) =>
                  d.doiQuyTac({ nguongNuaGio: Math.round(n) }),
                )}
                {oSo('Mốc đủ giờ', q.nguongDuGio, 'phút', (n) =>
                  d.doiQuyTac({ nguongDuGio: Math.round(n) }),
                )}
              </span>
            ),
            vd: `lẻ 0–${q.nguongNuaGio - 1} → bỏ · ${q.nguongNuaGio}–${q.nguongDuGio - 1} → 30 phút · ${q.nguongDuGio}–59 → 1 giờ`,
          },
        ]
      : []),
    {
      ten: 'Làm tròn giờ vào buổi chiều (sau nghỉ trưa)',
      o: oChon(
        'Làm tròn vào buổi chiều',
        q.lamTronVaoChieu ? 'co' : 'khong',
        coKhong,
        (v) => d.doiQuyTac({ lamTronVaoChieu: v === 'co' }),
      ),
      vd: `vào 13:12 → ${vd(792)}`,
    },
    {
      ten: 'Lượt trước giờ này thuộc ca đêm hôm trước',
      o: oGio('Ca đêm đến', q.caDemDen, (p) => d.doiQuyTac({ caDemDen: p })),
      vd: 'vào 22:00, ra 03:10 hôm sau → một ca, ghi vào ngày vào',
    },
    {
      ten: 'Số giờ = 1 công',
      o: oSo('Số giờ một công', q.phutMotCong / 60, 'giờ', (n) =>
        d.doiQuyTac({ phutMotCong: Math.round(n * 60) }),
      ),
      vd: `11 giờ → ${(660 / q.phutMotCong).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} công`,
    },
    {
      ten: 'Hệ số làm trưa (sổ tick của tổ trưởng)',
      o: oSo('Hệ số làm trưa', q.heSoTrua, '×', (n) => d.doiQuyTac({ heSoTrua: n })),
      vd: `tick 60 phút → +${(60 * q.heSoTrua) / 60} giờ vào khung hành chính`,
    },
    {
      ten: 'Tick "x" không ghi số phút thì lấy',
      o: oSo('Phút tick mặc định', q.phutTruaMacDinh, 'phút', (n) =>
        d.doiQuyTac({ phutTruaMacDinh: Math.round(n) }),
      ),
    },
    {
      ten: 'Lượt bấm lặp trong … phút gộp làm một',
      o: <span className="num">2 phút</span>,
      vd: 'cố định, không sửa',
    },
  ]

  return (
    <div className="min-h-0 overflow-auto">
      <div className={SEC}>
        <h3 className="text-k-body font-semibold">Sáu khung giờ</h3>
        <span className="text-k-sm text-[var(--ink-3)]">
          giờ trước {hhmm(moc)} là của hôm sau (ghi (+1)) · Hành Chính Nhân Sự sửa
        </span>
      </div>
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(TH, 'w-14')}>Khung</th>
            <th className={TH}>Tên</th>
            <th className={TH} style={{ width: 120 }}>
              Từ
            </th>
            <th className={TH} style={{ width: 120 }}>
              Đến
            </th>
            <th className={TH} style={{ width: 130 }}>
              Bỏ phần lố
            </th>
            <th className={TH}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {d.khung.map((k) => {
            const loi = loiCua.get(k.ma)
            return (
              <tr key={k.ma} className={cn(loi && 'bg-[var(--stop-wash)]')}>
                <td className={cn(TD, 'num font-semibold text-[var(--act-text)]')}>
                  {k.ma}
                </td>
                <td className={TD}>
                  {sua ? (
                    <TextInput
                      label={`Tên ${k.ma}`}
                      value={k.ten}
                      onCommit={(v) => v.trim() && d.doiKhung(k.ma, { ten: v.trim() })}
                    />
                  ) : (
                    k.ten
                  )}
                </td>
                {(['tu', 'den'] as const).map((f) => (
                  <td key={f} className={TD}>
                    {sua ? (
                      <span className="inline-flex items-center gap-1">
                        <TextInput
                          label={`${f === 'tu' ? 'Từ' : 'Đến'} ${k.ma}`}
                          mono
                          value={hhmm(k[f])}
                          onCommit={(s) => {
                            const p = docGio(s)
                            if (p == null) return
                            d.doiKhung(k.ma, {
                              [f]:
                                k.hanhChinh && f === 'tu'
                                  ? p
                                  : phutCa(p, moc, f === 'den'),
                            })
                          }}
                        />
                        {k[f] > 1440 && (
                          <span className="text-k-label text-[var(--ink-3)]">(+1)</span>
                        )}
                      </span>
                    ) : (
                      <span className="num">{gioKhung(k[f], f === 'tu')}</span>
                    )}
                  </td>
                ))}
                <td className={TD}>
                  {k.hanhChinh ? (
                    <span className="text-[var(--ink-3)]">Không (giờ thực tế)</span>
                  ) : sua ? (
                    <Pick
                      label={`Bỏ phần lố ${k.ma}`}
                      width={90}
                      value={k.boPhanLo ? 'co' : 'khong'}
                      onChange={(v) => d.doiKhung(k.ma, { boPhanLo: v === 'co' })}
                      options={coKhong}
                    />
                  ) : k.boPhanLo ? (
                    'Có'
                  ) : (
                    'Không'
                  )}
                </td>
                <td
                  className={cn(TD, loi ? 'text-[var(--stop)]' : 'text-[var(--ink-3)]')}
                >
                  {loi ??
                    (k.hanhChinh
                      ? 'khung hành chính: trừ nghỉ trưa, nhận giờ làm trưa'
                      : '')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-k-sm border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
        Các khung phải nối liền đủ 24 giờ, không hở, không chồng — hở hoặc chồng thì chưa
        áp dụng được. &quot;Bỏ phần lố&quot; chỉ có tác dụng khi làm tròn giờ ra theo kiểu
        xuống 30 phút.
      </p>

      <div className={SEC}>
        <h3 className="text-k-body font-semibold">Quy tắc</h3>
        <span className="text-k-sm text-[var(--ink-3)]">
          cột Ví dụ tính bằng chính quy tắc đang nhập
        </span>
        {d.loiQuyTac && (
          <span className="text-k-sm text-[var(--stop)]">{d.loiQuyTac}</span>
        )}
      </div>
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={TH}>Quy tắc</th>
            <th className={TH} style={{ width: 260 }}>
              Giá trị
            </th>
            <th className={TH}>Ví dụ</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((r) => (
            <tr key={r.ten}>
              <td className={TD}>{r.ten}</td>
              <td className={TD}>{r.o}</td>
              <td
                className={cn(TD, 'num text-[var(--ink-3)]')}
                style={{ textAlign: 'left' }}
              >
                {r.vd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
