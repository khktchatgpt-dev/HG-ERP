'use client'

/**
 * CÁCH TÍNH CÔNG — B2, bản vẽ duyệt 18/10/2026 (artifact 8RcgbbGE…, Q1–Q6 theo đề xuất).
 * Câu hỏi của màn: "kỳ này công được tính theo luật nào, mỗi giờ ở mỗi khung trả bao
 * nhiêu phần trăm?".
 *
 * Danh mục CÓ PHIÊN BẢN (không phải chứng từ — không vòng duyệt): dải bản dưới tiêu đề,
 * mỗi bản nháp → áp dụng từ kỳ X. Bản đã áp dụng chỉ xem; muốn đổi thì chép thành bản mới.
 * Chép cách SAP giữ bảng thông số theo "valid from" và Dynamics giữ pay agreement có
 * hiệu lực — đổi luật không làm đổi kết quả của kỳ đã qua.
 */

import {
  Btn,
  Consequence,
  DocMenu,
  DocMenuPanel,
  Menu,
  NoticeBar,
  Pick,
  ScreenFrame,
  ScreenHeader,
  Sheet,
  SheetActions,
  Tag,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { kyCuaThang } from '@/lib/cham-cong/ky-gio-cong'
import { congKy, kyVn, lucVn, type CachTinhTrang, type Muc } from './cach-tinh.shared'
import { useCachTinh, type CachTinhCtx } from './useCachTinh'
import { NganHeSo } from './ngan-he-so'
import { NganQuyTac } from './ngan-quy-tac'
import { NganTheoTo, NganLichSu } from './ngan-to-lich-su'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function CachTinhScreen({ c, muc }: { c: CachTinhTrang; muc: Muc }) {
  const d = useCachTinh(c, muc)
  const k = kyCuaThang(c.kyHienTai)
  const dangDung = c.ban.find(
    (b) => b.tinhTrang === 'ap_dung' && b.tuKy && b.tuKy <= c.kyHienTai,
  )
  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Chấm công"
        title="Cách tính công"
        facts={[
          {
            label: 'Kỳ đang mở',
            value: `${kyVn(c.kyHienTai)} (${dmy(k.tu)} → ${dmy(k.den)})`,
          },
          {
            label: 'Kỳ này dùng',
            value: dangDung ? `Bản ${dangDung.so}` : 'số mặc định',
          },
          {
            label: 'Sửa lần cuối',
            value: `${c.xem.nguoiSua ?? c.xem.nguoiTao ?? 'hệ thống'} · ${lucVn(c.xem.suaLuc)}`,
          },
        ]}
        actions={<HanhDong d={d} />}
      />
      <DaiBan d={d} />
      <ThanhBao d={d} />
      <DocMenu
        label="Nội dung cách tính"
        value={d.muc}
        onValueChange={(v) => d.setMuc(v as Muc)}
        items={[
          {
            id: 'he-so',
            label: 'Hệ số lương',
            icon: 'tien',
            signal: d.duoiChuaLyDo.length
              ? { text: `${d.duoiChuaLyDo.length} dưới luật`, tone: 'warn' }
              : d.oTrong
                ? { text: `${d.oTrong} ô trống` }
                : undefined,
          },
          {
            id: 'quy-tac',
            label: 'Quy tắc khung giờ',
            icon: 'hen',
            signal:
              d.loiKhung.length || d.loiQuyTac
                ? { text: 'có lỗi', tone: 'stop' }
                : undefined,
          },
          {
            id: 'theo-to',
            label: 'Cách tính theo tổ',
            icon: 'cot',
            signal: { text: String(c.to.length) },
          },
          { id: 'lich-su', label: 'Lịch sử', icon: 'lichSu' },
        ]}
      >
        <DocMenuPanel value="he-so">
          <NganHeSo d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="quy-tac">
          <NganQuyTac d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="theo-to">
          <NganTheoTo d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="lich-su">
          <NganLichSu d={d} />
        </DocMenuPanel>
      </DocMenu>
      <Sheet
        open={d.moHuy}
        onClose={() => d.setMoHuy(false)}
        title={`Huỷ Bản ${c.xem.so} (nháp)?`}
        stakes="nang"
        footer={
          <SheetActions
            stakes="nang"
            onCancel={() => d.setMoHuy(false)}
            onConfirm={d.huyNhap}
            confirmLabel="Huỷ bản nháp"
            cancelLabel="Giữ lại"
            busy={d.busy === 'huy'}
          />
        }
      >
        <Consequence>
          Mất hẳn mọi hệ số, khung giờ và quy tắc đã nhập trong Bản {c.xem.so}. Bản này
          chưa áp dụng cho kỳ nào nên số trên Bảng công không đổi.
        </Consequence>
      </Sheet>
    </ScreenFrame>
  )
}

function HanhDong({ d }: { d: CachTinhCtx }) {
  const { c } = d
  const coQuyen = c.quyen.heSo || c.quyen.quyTac
  const khongQuyen = 'Tài Chính Kế Toán / Hành Chính Nhân Sự'
  if (!d.nhap)
    return (
      <>
        <Btn
          icon="saoChep"
          busy={d.busy === 'tao'}
          blockedBy={coQuyen ? undefined : khongQuyen}
          onClick={d.taoBanMoi}
        >
          Tạo bản mới từ bản này
        </Btn>
        <Menu
          ariaLabel="Thêm tác vụ"
          items={[
            {
              label: 'Rút về nháp',
              onClick: d.rutVeNhap,
              blockedBy: coQuyen ? undefined : khongQuyen,
              why:
                c.xem.tuKy && c.xem.tuKy < c.kyHienTai
                  ? `Bản đã dùng cho kỳ ${kyVn(c.xem.tuKy)} — chỉ rút được bản bắt đầu từ kỳ đang mở`
                  : undefined,
              disabled: !!c.xem.tuKy && c.xem.tuKy < c.kyHienTai,
            },
          ]}
        />
      </>
    )
  const kyChon = [0, 1, 2].map((n) => congKy(c.kyHienTai, n))
  return (
    <>
      <Btn
        icon="luuNhap"
        busy={d.busy === 'luu'}
        blockedBy={coQuyen ? undefined : khongQuyen}
        onClick={d.coSua ? d.luuNhap : undefined}
        aria-disabled={!d.coSua}
      >
        Lưu nháp
      </Btn>
      <Pick
        label="Áp dụng từ kỳ"
        width={130}
        value={d.tuKy}
        onChange={d.setTuKy}
        options={kyChon.map((k) => {
          const trung = c.ban.find((b) => b.tuKy === k)
          return {
            value: k,
            label: `Kỳ ${kyVn(k)}${trung ? ` · đã có Bản ${trung.so}` : ''}`,
            disabled: !!trung,
          }
        })}
      />
      <Btn
        primary
        icon="duyet"
        busy={d.busy === 'ap'}
        blockedBy={coQuyen ? undefined : khongQuyen}
        aria-disabled={!!d.chan}
        onClick={d.chan ? () => d.setMuc(d.chan!.muc) : d.apDung}
      >
        Áp dụng từ kỳ {kyVn(d.tuKy)}
      </Btn>
      <Menu
        ariaLabel="Thêm tác vụ"
        items={[
          { label: 'Tạo bản mới từ bản này', onClick: d.taoBanMoi },
          {
            label: 'Huỷ bản nháp',
            danger: true,
            onClick: () => d.setMoHuy(true),
            blockedBy: coQuyen ? undefined : khongQuyen,
          },
        ]}
      />
    </>
  )
}

/** Dải bản: bấm để xem; màu chấm theo vòng đời (nháp · đang áp dụng · đã dùng). */
function DaiBan({ d }: { d: CachTinhCtx }) {
  const { c } = d
  return (
    <div className="flex overflow-x-auto border-b border-[var(--line)] bg-[var(--surface-card)] px-3">
      {c.ban.map((b) => {
        const on = b.id === c.xem.id
        const tag =
          b.tinhTrang === 'nhap' ? (
            <Tag tone="warn">nháp</Tag>
          ) : b.tinhTrang === 'ap_dung' ? (
            <Tag tone="done">
              {b.tuKy! > c.kyHienTai ? 'sắp áp dụng' : 'đang áp dụng'}
            </Tag>
          ) : (
            <Tag>đã dùng</Tag>
          )
        return (
          <button
            key={b.id}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() => !on && d.xemBan(b.id)}
            className={cn(
              'text-k-sm flex shrink-0 items-center gap-2 border-r border-[var(--line-soft,var(--line))] px-3.5 py-1.5',
              on
                ? 'bg-[var(--act-wash)] font-semibold text-[var(--act-text)] shadow-[inset_0_-2px_0_var(--act)]'
                : 'text-[var(--ink-2)] hover:bg-[var(--surface-hover)]',
            )}
          >
            Bản {b.so}
            <span className="num text-k-label">
              {b.tuKy ? `từ kỳ ${kyVn(b.tuKy)}` : ''}
            </span>
            {tag}
          </button>
        )
      })}
    </div>
  )
}

/** Một dải: chặn (đỏ) > cảnh báo (vàng) > chỉ xem. */
function ThanhBao({ d }: { d: CachTinhCtx }) {
  const { c } = d
  if (d.nhap && d.coSua)
    return (
      <NoticeBar
        tone="warn"
        tag="Chưa lưu"
        action={{ label: 'Lưu nháp', onClick: d.luuNhap }}
      >
        Có thay đổi chưa lưu ở Bản {c.xem.so} — rời trang là mất; chưa áp dụng được tới
        khi lưu.
      </NoticeBar>
    )
  if (d.nhap && d.chan && !d.coSua)
    return (
      <NoticeBar
        tone="stop"
        tag="Chưa áp dụng được"
        action={{ label: 'Tới chỗ cần sửa', onClick: () => d.setMuc(d.chan!.muc) }}
      >
        {d.chan.cau}.
      </NoticeBar>
    )
  if (d.nhap && d.oTrong > 0)
    return (
      <NoticeBar
        tone="warn"
        tag="Ô trống"
        action={{ label: 'Tới bảng hệ số', onClick: () => d.setMuc('he-so') }}
      >
        Bản {c.xem.so} còn {d.oTrong} ô hệ số chưa nhập. Áp dụng vẫn được; ô trống sẽ tính
        0 đồng trên bảng lương.
      </NoticeBar>
    )
  if (!d.nhap)
    return (
      <NoticeBar tone="neutral" tag="Chỉ xem">
        Bản {c.xem.so} đã áp dụng từ kỳ {kyVn(c.xem.tuKy!)} nên không sửa trực tiếp — chép
        thành bản mới để đổi từ kỳ sau.
      </NoticeBar>
    )
  return null
}
