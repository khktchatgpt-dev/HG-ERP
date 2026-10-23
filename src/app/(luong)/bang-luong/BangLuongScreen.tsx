'use client'

/**
 * BẢNG LƯƠNG — B5, bản vẽ duyệt 18/10/2026 (artifact LYnr4EvN…, Q1–Q8 theo đề xuất).
 * Câu hỏi của màn: "kỳ này mỗi người thực lĩnh bao nhiêu, vì sao ra số đó, đã được duyệt để
 * chuyển khoản chưa?".
 *
 * Khuôn D (chứng từ): vòng đời + người giữ + điều kiện gửi duyệt + phiếu có phép tính nguyên
 * văn (nguyên tắc 6). Chép SAP payroll control record + Odoo payslip batch.
 */

import {
  Btn,
  DocMenu,
  DocMenuPanel,
  Empty,
  HolderBar,
  Menu,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  StatusTrack,
  Tag,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { useBangLuong, type BangLuongCtx } from './useBangLuong'
import {
  congKy,
  kyVn,
  lucVn,
  so,
  TEN_TT,
  tong,
  type BangLuongTrang,
  type MucBl,
} from './bang-luong.shared'
import { NganBang } from './ngan-bang'
import { NganKhoan } from './ngan-khoan'
import { NganKhongCham } from './ngan-khong-cham'
import { NganBhThue, NganChuyenKhoan, NganThoiGian } from './ngan-khac'
import { HopBangLuong } from './hop-bang'

export function BangLuongScreen({ b, muc }: { b: BangLuongTrang; muc: MucBl }) {
  const d = useBangLuong(b, muc)
  const tl = tong(b.phieu, (p) => p.thucLinh)
  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Lương · Bảng lương"
        title={
          <span className="flex items-center gap-1.5">
            <Btn
              icon="truoc"
              aria-label="Kỳ trước"
              onClick={() => d.di(congKy(b.thang, -1))}
            >
              {''}
            </Btn>
            Kỳ {kyVn(b.thang)}
            <Btn icon="sau" aria-label="Kỳ sau" onClick={() => d.di(congKy(b.thang, 1))}>
              {''}
            </Btn>
          </span>
        }
        status={
          d.tt ? (
            <Tag tone={d.tt === 'paid' || d.tt === 'approved' ? 'done' : 'warn'}>
              {TEN_TT[d.tt]}
            </Tag>
          ) : (
            <Tag>Chưa tính</Tag>
          )
        }
        facts={[
          ...(b.ky
            ? [
                {
                  label: '',
                  value: `${b.ky.tu.slice(8)}/${b.ky.tu.slice(5, 7)} → ${b.ky.den.slice(8)}/${b.ky.den.slice(5, 7)}`,
                },
              ]
            : []),
          { label: 'Công chuẩn', value: b.congChuan != null ? String(b.congChuan) : '—' },
          { label: 'Người', value: so(b.phieu.length) },
          { label: 'Tổng thu nhập', value: so(tong(b.phieu, (p) => p.tong)) },
          { label: 'Thực lĩnh', value: so(tl) },
          ...(b.bang?.lanTinh
            ? [
                {
                  label: 'Tính lần',
                  value: `${b.bang.lanTinh} · ${lucVn(b.bang.tinhLuc)}`,
                },
              ]
            : []),
        ]}
        actions={<HanhDong d={d} />}
      />
      {d.daTinh && (
        <div className="flex flex-wrap items-center gap-x-6 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
          <StatusTrack
            label="Vòng đời bảng lương"
            steps={['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã chi']}
            at={
              d.tt === 'paid' ? 3 : d.tt === 'approved' ? 2 : d.tt === 'submitted' ? 1 : 0
            }
            tone={d.tt === 'paid' ? 'done' : d.tt === 'submitted' ? 'wait' : 'run'}
          />
          <NguoiGiu d={d} />
        </div>
      )}
      {d.nhap && d.daTinh && <DaiDieuKien d={d} />}
      <ThanhBao d={d} />
      {!b.ky ? (
        <Empty
          headline={`Kỳ ${kyVn(b.thang)} chưa được Nhân sự đặt khoảng ngày`}
          reason="Bảng lương bám theo kỳ công: chưa có kỳ thì chưa biết ai làm trong kỳ, chưa nhập khoản hay công được."
          next={<Btn href={`/hr/cham-cong/ky?thang=${b.thang}`}>Mở Kỳ công</Btn>}
        />
      ) : (
        // Kỳ đã đặt là mở hai ngăn nhập (Khoản theo kỳ, Không chấm công) — Kế toán nhập TRƯỚC khi
        // Nhân sự chốt / trước khi tính, để lần tính đầu đã đủ số (chủ dự án 23/10/2026). Các ngăn
        // đọc phiếu (BH & thuế, chuyển khoản, dòng thời gian) chỉ hiện khi đã tính.
        <DocMenu
          label="Nội dung bảng lương"
          value={d.muc}
          onValueChange={(v) => d.setMuc(v as MucBl)}
          items={[
            {
              id: 'bang',
              label: 'Bảng lương',
              icon: 'tien',
              signal: d.daTinh ? { text: so(b.phieu.length) } : undefined,
            },
            {
              id: 'khoan',
              label: 'Khoản theo kỳ',
              icon: 'ghiChu',
              signal: b.khoan.length ? { text: String(b.khoan.length) } : undefined,
            },
            {
              id: 'khong-cham',
              label: 'Không chấm công',
              icon: 'sua',
              signal: b.khongCham.length
                ? {
                    text: `${b.khongCham.filter((x) => x.cong != null).length}/${b.khongCham.length}`,
                  }
                : undefined,
            },
            ...(d.daTinh
              ? [
                  { id: 'bh-thue', label: 'Bảo hiểm & thuế', icon: 'so' as const },
                  { id: 'chuyen-khoan', label: 'Chuyển khoản', icon: 'gui' as const },
                  { id: 'dong-thoi-gian', label: 'Dòng thời gian', icon: 'lichSu' as const },
                ]
              : []),
          ]}
        >
          <DocMenuPanel value="bang">
            {b.ky.trangThai !== 'closed' ? (
              <Empty
                headline={`Kỳ công ${kyVn(b.thang)} chưa chốt`}
                reason="Bảng lương tính từ bản chốt của kỳ công — chưa chốt thì chưa có giờ chính thức để tính. Chốt xong hệ thống tự tính bảng nháp."
                next={
                  <span className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-[var(--ink-2)]">
                      Trong lúc chờ: nhập Khoản theo kỳ và công người không chấm công ở hai ngăn bên.
                    </span>
                    <Btn href={`/hr/cham-cong/ky?thang=${b.thang}`}>Mở Kỳ công</Btn>
                  </span>
                }
              />
            ) : !d.daTinh ? (
              <Empty
                headline="Chưa tính bảng lương kỳ này"
                reason="Kỳ công đã chốt. Bấm Tính để lập phiếu lương từ bản chốt × hồ sơ lương × hệ số; khoản theo kỳ và công người không chấm công đã nhập được tính luôn."
                next={
                  <Btn primary icon="lamMoi" busy={d.busy === 'tinh'} onClick={d.tinh}>
                    Tính bảng lương
                  </Btn>
                }
              />
            ) : (
              <NganBang d={d} />
            )}
          </DocMenuPanel>
          <DocMenuPanel value="khoan">
            <NganKhoan d={d} />
          </DocMenuPanel>
          <DocMenuPanel value="khong-cham">
            <NganKhongCham d={d} />
          </DocMenuPanel>
          <DocMenuPanel value="bh-thue">
            <NganBhThue d={d} />
          </DocMenuPanel>
          <DocMenuPanel value="chuyen-khoan">
            <NganChuyenKhoan d={d} />
          </DocMenuPanel>
          <DocMenuPanel value="dong-thoi-gian">
            <NganThoiGian d={d} />
          </DocMenuPanel>
        </DocMenu>
      )}
      <HopBangLuong d={d} />
    </ScreenFrame>
  )
}

function NguoiGiu({ d }: { d: BangLuongCtx }) {
  const bang = d.b.bang!
  if (d.tt === 'submitted')
    return (
      <HolderBar
        inline
        who="Kế toán trưởng"
        what="duyệt hoặc trả lại bảng lương"
        age={lucVn(bang.guiLuc)}
      />
    )
  if (d.tt === 'approved')
    return (
      <HolderBar
        inline
        who="Tài Chính Kế Toán"
        what="chuyển khoản rồi đánh dấu đã chi"
        age={lucVn(bang.duyetLuc)}
      />
    )
  if (d.tt === 'paid')
    return (
      <HolderBar
        inline
        who="—"
        what={`đã chi ${lucVn(bang.chiLuc)} · ${bang.chiBoi ?? ''}`}
      />
    )
  return (
    <HolderBar
      inline
      who="Tài Chính Kế Toán"
      what={
        d.vuong.length
          ? `gỡ ${d.vuong.length} điều kiện rồi gửi Kế toán trưởng`
          : 'gửi Kế toán trưởng duyệt'
      }
      age={lucVn(bang.tinhLuc)}
    />
  )
}

function DaiDieuKien({ d }: { d: BangLuongCtx }) {
  return (
    <div className="grid grid-cols-6 border-b border-[var(--line)] bg-[var(--surface-card)]">
      {d.b.dieuKien.map((x) => (
        <div
          key={x.ma}
          className="text-k-sm border-r border-[var(--line-faint)] px-[var(--gutter)] py-1.5 last:border-r-0"
        >
          <span className="text-[var(--ink-2)]">{x.ten}</span>
          <b
            className={cn(
              'text-k-body num block font-semibold',
              // Tên người thiếu phiếu dài → xuống dòng trong ô, không cắt.
              x.ma === 'du_nguoi' && !x.ok && 'text-k-sm whitespace-normal',
              x.ok ? 'text-[var(--done)]' : 'text-[var(--stop)]',
            )}
          >
            {x.ok ? '✓ ' : ''}
            {x.chiTiet}
          </b>
        </div>
      ))}
    </div>
  )
}

function ThanhBao({ d }: { d: BangLuongCtx }) {
  const { b } = d
  if (d.tt === 'draft' && b.bang?.lyDoTraLai)
    return (
      <NoticeBar tone="warn" tag="Bị trả lại">
        Kế toán trưởng trả lại: “{b.bang.lyDoTraLai}”. Sửa ở nguồn, Tính lại, rồi gửi lại.
      </NoticeBar>
    )
  if (b.canTinhLai)
    return (
      <NoticeBar
        tone="warn"
        tag="Cần tính lại"
        action={b.quyen.chay ? { label: 'Tính lại', onClick: d.tinh } : undefined}
      >
        Kỳ công được chốt lại hoặc khoản theo kỳ đổi sau lần tính {b.bang?.lanTinh} — số
        đang bày chưa khớp nguồn.
      </NoticeBar>
    )
  // Lần tính mới nhất do HỆ THỐNG chạy lúc Nhân sự chốt công (luồng duyệt 21/10/2026).
  if (d.tt === 'draft' && b.bang?.lanTinh && !b.bang.tinhBoi)
    return (
      <NoticeBar tone="neutral" tag="Tính tự động">
        Hệ thống tính từ kỳ công chốt lúc {lucVn(b.ky?.chotLuc ?? b.bang.tinhLuc)}
        {b.ky?.nguoiChot ? ` (Nhân sự: ${b.ky.nguoiChot})` : ''}. Kiểm tra, sửa hồ sơ
        lương hoặc thêm khoản theo kỳ rồi bấm Tính lại trước khi gửi duyệt.
      </NoticeBar>
    )
  if (d.tt === 'paid')
    return (
      <NoticeBar tone="neutral" tag="Đã chi">
        Bảng lương đã chi — không sửa nữa. Sai sót ghi khoản Truy lĩnh / Truy thu ở kỳ
        sau.
      </NoticeBar>
    )
  return null
}

function HanhDong({ d }: { d: BangLuongCtx }) {
  const { b } = d
  const q = b.quyen
  const ke = 'Tài Chính Kế Toán'
  const excel = (
    <Btn icon="excel" href={`/api/dept/hr/luong/bang/${b.thang}/excel`}>
      Xuất Excel
    </Btn>
  )
  if (!d.daTinh) return null
  if (d.nhap)
    return (
      <>
        <Btn
          icon="lamMoi"
          busy={d.busy === 'tinh'}
          blockedBy={q.chay ? undefined : ke}
          onClick={d.tinh}
        >
          Tính lại
        </Btn>
        {excel}
        <Btn
          primary
          icon="gui"
          blockedBy={q.chay ? undefined : ke}
          aria-disabled={d.vuong.length > 0}
          onClick={() => !d.vuong.length && d.setHop('gui')}
        >
          Gửi duyệt
        </Btn>
      </>
    )
  if (d.tt === 'submitted')
    return (
      <>
        {excel}
        {q.duyet && (
          <Btn primary icon="duyet" onClick={() => d.setHop('quyet')}>
            Duyệt / trả lại
          </Btn>
        )}
        <Menu
          ariaLabel="Thêm tác vụ"
          items={[
            { label: 'Rút về nháp', onClick: d.rut, blockedBy: q.chay ? undefined : ke },
          ]}
        />
      </>
    )
  if (d.tt === 'approved')
    return (
      <>
        {excel}
        <Btn
          primary
          icon="xong"
          blockedBy={q.chay ? undefined : ke}
          onClick={() => d.setHop('chi')}
        >
          Đánh dấu đã chi
        </Btn>
        <Menu
          ariaLabel="Thêm tác vụ"
          items={[
            {
              label: 'Rút về nháp để sửa',
              onClick: () => d.setHop('mo_lai'),
              blockedBy: q.chay ? undefined : ke,
            },
          ]}
        />
      </>
    )
  return excel
}
