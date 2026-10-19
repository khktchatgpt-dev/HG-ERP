'use client'

import { useState } from 'react'
import {
  Btn,
  Loading,
  NumInput,
  Pick,
  TextInput,
  Tick,
} from '@/components/kit'
import { TEN_CACH_TRA, type CachTra } from '@/lib/luong/ho-so-luong'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import type { HoSoLuongCtx } from './useHoSoLuong'
import { congKy, docTien, kyVn, lucVn, so, tienVn } from './luong.shared'

const TEN_TRUONG = {
  bank_account: 'Số tài khoản',
  national_id: 'CCCD',
  tax_code: 'MST',
} as const

/** Ngăn hồ sơ một người: bản lương (sửa / thêm bản từ kỳ), lịch sử, chi trả + định danh. */
export function NganNguoi({ d }: { d: HoSoLuongCtx }) {
  const x = d.dongChon
  if (!x) return null
  return (
    <aside className="text-k-sm w-[360px] shrink-0 overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)]">
      <div className="flex items-start gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-k-label font-semibold tracking-wide text-[var(--ink-3)] uppercase">
            Hồ sơ lương · {x.ma}
          </div>
          <div className="text-k-body font-semibold">{x.ten}</div>
          <div className="text-[var(--ink-3)]">{x.to ?? '(chưa có tổ)'}</div>
        </div>
        <Btn icon="huy" aria-label="Đóng hồ sơ" onClick={d.dongLai}>
          {''}
        </Btn>
      </div>
      {!d.chiTiet ? <Loading /> : <NoiDung d={d} />}
    </aside>
  )
}

function NoiDung({ d }: { d: HoSoLuongCtx }) {
  const x = d.dongChon!
  const ct = d.chiTiet!
  const b = x.ban
  const kyMoi =
    d.h.kyChotCuoi && d.h.thang <= d.h.kyChotCuoi ? congKy(d.h.kyChotCuoi, 1) : d.h.thang
  const [tuKy, setTuKy] = useState(b && !x.khoa ? b.tuKy : kyMoi)
  const [cachTra, setCachTra] = useState<CachTra>(
    b?.cachTra ?? (x.khongCham ? 'monthly' : 'daily'),
  )
  const [donGia, setDonGia] = useState(tienVn(b?.donGia))
  const [luongThang, setLuongThang] = useState(tienVn(b?.luongThang))
  const [luongBh, setLuongBh] = useState(tienVn(b?.luongBh))
  const [coBh, setCoBh] = useState(b?.coBh ?? true)
  const [npt, setNpt] = useState(String(b?.npt ?? 0))
  const [khauTru10, setKhauTru10] = useState(b?.khauTru10 ?? false)
  const [ghiChu, setGhiChu] = useState(b?.ghiChu ?? '')
  const [phuCap, setPhuCap] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(b?.phuCap ?? {}).map(([k, v]) => [k, tienVn(v)])),
  )
  const kyChon = [0, 1, 2].map((n) => congKy(kyMoi, n))
  if (b && !x.khoa && !kyChon.includes(b.tuKy)) kyChon.unshift(b.tuKy)

  const tien = (s: string) => docTien(s)
  const loi =
    cachTra === 'daily' && tien(donGia) == null
      ? 'Nhập đơn giá một công'
      : cachTra === 'monthly' && tien(luongThang) == null
        ? 'Nhập lương tháng'
        : [donGia, luongThang, luongBh, ...Object.values(phuCap)].some(
              (s) => tien(s) === undefined,
            )
          ? 'Có ô số tiền gõ sai'
          : null

  async function luu() {
    if (loi) return
    const ok = await d.goi(
      'ban',
      {
        viec: 'ban',
        employeeId: x.employeeId,
        tuKy,
        cachTra,
        donGia: cachTra === 'daily' ? tien(donGia) : null,
        luongThang: cachTra === 'monthly' ? tien(luongThang) : null,
        luongBh: coBh ? (tien(luongBh) ?? null) : null,
        coBh,
        npt: Math.max(0, Math.round(Number(npt) || 0)),
        khauTru10,
        ghiChu: ghiChu.trim() || null,
        phuCap: Object.fromEntries(
          Object.entries(phuCap)
            .map(([k, v]) => [k, tien(v) ?? 0] as const)
            .filter(([, v]) => v > 0),
        ),
      },
      `Đã lưu hồ sơ lương ${x.ma} từ kỳ ${kyVn(tuKy)}`,
    )
    if (ok) await d.sauGhi()
  }

  const loaiDung = d.h.loaiPhuCap.filter((l) => l.dangDung || phuCap[l.id])
  return (
    <>
      <section className="space-y-2 border-b border-[var(--line)] px-4 py-3">
        {x.khoa && b && (
          <p className="m-0 text-[var(--ink-3)]">
            Bản từ kỳ {kyVn(b.tuKy)} đã dùng cho kỳ đã chốt — chỉ thêm bản mới từ kỳ{' '}
            {kyVn(kyMoi)}.
          </p>
        )}
        <div className="grid grid-cols-[120px_1fr] items-center gap-x-2 gap-y-1.5">
          <span className="text-[var(--ink-3)]">Áp từ kỳ</span>
          <Pick
            label="Áp từ kỳ"
            width={190}
            value={tuKy}
            onChange={setTuKy}
            options={kyChon.map((k) => ({
              value: k,
              label: `Kỳ ${kyVn(k)}${b && b.tuKy === k ? ' · sửa bản này' : ' · bản mới'}`,
            }))}
          />
          <span className="text-[var(--ink-3)]">Cách trả</span>
          <Pick
            label="Cách trả"
            width={190}
            value={cachTra}
            onChange={(v) => setCachTra(v as CachTra)}
            options={(['daily', 'monthly'] as const).map((c) => ({
              value: c,
              label: TEN_CACH_TRA[c],
            }))}
          />
          {cachTra === 'daily' ? (
            <>
              <span className="text-[var(--ink-3)]">Đơn giá / công</span>
              <NumInput
                aria-label="Đơn giá một công"
                value={donGia}
                onCommit={setDonGia}
                className={OSO}
              />
            </>
          ) : (
            <>
              <span className="text-[var(--ink-3)]">Lương tháng</span>
              <NumInput
                aria-label="Lương tháng"
                value={luongThang}
                onCommit={setLuongThang}
                className={OSO}
              />
            </>
          )}
          <span className="text-[var(--ink-3)]">Tham gia BH</span>
          <Tick label="Có đóng BHXH · BHYT · BHTN" checked={coBh} onChange={setCoBh} />
          {coBh && (
            <>
              <span className="text-[var(--ink-3)]">Lương đóng BH</span>
              <NumInput
                aria-label="Lương đóng bảo hiểm"
                value={luongBh}
                onCommit={setLuongBh}
                className={OSO}
              />
            </>
          )}
          <span className="text-[var(--ink-3)]">Người phụ thuộc</span>
          <NumInput
            aria-label="Số người phụ thuộc"
            value={npt}
            onCommit={setNpt}
            className="w-16 border border-[var(--line)] px-1.5 py-0.5"
          />
          <span className="text-[var(--ink-3)]">Thuế TNCN</span>
          <Tick
            label="Khấu trừ thẳng 10 % (thời vụ, HĐ dưới 3 tháng)"
            checked={khauTru10}
            onChange={setKhauTru10}
          />
          {loaiDung.map((l) => (
            <PhuCapO
              key={l.id}
              ten={l.ten}
              value={phuCap[l.id] ?? ''}
              onCommit={(v) => setPhuCap((p) => ({ ...p, [l.id]: v }))}
            />
          ))}
          <span className="text-[var(--ink-3)]">Ghi chú</span>
          <TextInput label="Ghi chú" value={ghiChu} onCommit={setGhiChu} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Btn
            primary
            icon="luuNhap"
            busy={d.busy === 'ban'}
            aria-disabled={!!loi}
            onClick={luu}
          >
            {b && b.tuKy === tuKy ? 'Lưu bản này' : `Lưu bản từ kỳ ${kyVn(tuKy)}`}
          </Btn>
          {loi && <span className="text-[var(--ink-3)]">{loi}</span>}
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-4 py-3">
        <h4 className="text-k-label m-0 mb-1.5 font-semibold tracking-wide text-[var(--ink-3)] uppercase">
          Lịch sử
        </h4>
        {ct.lichSu.length ? (
          <ul className="m-0 list-none space-y-1 p-0">
            {ct.lichSu.map((l) => (
              <li key={l.id} className="flex gap-2">
                <span className="num w-20 shrink-0">kỳ {kyVn(l.tuKy)}</span>
                <span className="num">
                  {l.cachTra === 'daily'
                    ? `${so(l.donGia ?? 0)} /công`
                    : `${so(l.luongThang ?? 0)} /tháng`}
                </span>
                <span className="ml-auto text-[var(--ink-3)]">
                  {l.nguon ?? ''}
                  {l.khoa ? ' · đã chốt' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[var(--ink-3)]">
            Chưa có bản nào — nhập ở trên, hoặc Nạp từ Excel.
          </p>
        )}
      </section>

      <ChiTra d={d} />
    </>
  )
}

const OSO = 'w-36 border border-[var(--line)] px-1.5 py-0.5'

function PhuCapO({
  ten,
  value,
  onCommit,
}: {
  ten: string
  value: string
  onCommit: (v: string) => void
}) {
  return (
    <>
      <span className="text-[var(--ink-3)]">{ten}</span>
      <NumInput
        aria-label={`Phụ cấp ${ten}`}
        value={value}
        onCommit={onCommit}
        className={OSO}
      />
    </>
  )
}

function ChiTra({ d }: { d: HoSoLuongCtx }) {
  const x = d.dongChon!
  const r = d.chiTiet!.rieng
  const [nganHang, setNganHang] = useState(r.nganHang ?? '')
  const [stk, setStk] = useState('')
  const [cccd, setCccd] = useState('')
  const [mst, setMst] = useState('')
  const [hien, setHien] = useState<
    Partial<Record<keyof typeof TEN_TRUONG, string | null>>
  >({})

  async function xem(t: keyof typeof TEN_TRUONG) {
    const res = await d.goi<{ gia: string | null }>('hien', {
      viec: 'hien',
      employeeId: x.employeeId,
      truong: t,
    })
    if (res) setHien((h) => ({ ...h, [t]: res.gia }))
  }
  async function luu() {
    const ok = await d.goi(
      'rieng',
      {
        viec: 'rieng',
        employeeId: x.employeeId,
        nganHang,
        ...(stk.trim() && { stk: stk.replace(/[\s.-]/g, '') }),
        ...(cccd.trim() && { cccd: cccd.replace(/\D/g, '') }),
        ...(mst.trim() && { mst: mst.replace(/\D/g, '') }),
      },
      `Đã lưu chi trả & định danh ${x.ma}`,
    )
    if (ok) await d.sauGhi()
  }
  const o = (
    t: keyof typeof TEN_TRUONG,
    che: string | null,
    val: string,
    set: (v: string) => void,
  ) => (
    <>
      <span className="text-[var(--ink-3)]">{TEN_TRUONG[t]}</span>
      <span className="space-y-1">
        <span className="flex items-center gap-1.5">
          <span className="num">
            {hien[t] !== undefined ? (hien[t] ?? '—') : (che ?? 'chưa có')}
          </span>
          {che && hien[t] === undefined && (
            <Btn onClick={() => xem(t)} busy={d.busy === 'hien'}>
              Hiện
            </Btn>
          )}
        </span>
        <TextInput
          label={`${TEN_TRUONG[t]} mới`}
          mono
          value={val}
          onCommit={set}
          placeholder={che ? 'gõ để thay' : 'nhập'}
        />
      </span>
    </>
  )
  return (
    <section className="px-4 py-3">
      <h4 className="text-k-label m-0 mb-1.5 font-semibold tracking-wide text-[var(--ink-3)] uppercase">
        Chi trả và định danh
      </h4>
      <div className="grid grid-cols-[120px_1fr] items-start gap-x-2 gap-y-2">
        <span className="text-[var(--ink-3)]">Ngân hàng</span>
        <TextInput
          label="Ngân hàng"
          value={nganHang}
          onCommit={setNganHang}
          placeholder="VD: BIDV"
        />
        {o('bank_account', r.stk, stk, setStk)}
        {o('national_id', r.cccd, cccd, setCccd)}
        {o('tax_code', r.mst, mst, setMst)}
        <span className="text-[var(--ink-3)]">Ngày vào làm</span>
        <span className="num">
          {r.ngayVao ? ngayVn(r.ngayVao) : '—'}{' '}
          <span className="text-k-label text-[var(--ink-3)]">sửa ở Hồ sơ nhân viên</span>
        </span>
      </div>
      <div className="mt-2">
        <Btn icon="luuNhap" busy={d.busy === 'rieng'} onClick={luu}>
          Lưu chi trả & định danh
        </Btn>
      </div>
      {d.chiTiet!.lanXem.length > 0 && (
        <p className="text-k-label mt-2 mb-0 text-[var(--ink-3)]">
          Đã xem số thật:{' '}
          {d
            .chiTiet!.lanXem.slice(0, 3)
            .map(
              (l) =>
                `${l.boi ?? '—'} ${lucVn(l.luc)} (${TEN_TRUONG[l.truong as keyof typeof TEN_TRUONG] ?? l.truong})`,
            )
            .join(' · ')}
        </p>
      )}
    </section>
  )
}
