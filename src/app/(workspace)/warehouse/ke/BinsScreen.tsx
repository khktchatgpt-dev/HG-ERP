'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Code,
  Crumb,
  Empty,
  NoticeBar,
  Num,
  Pick,
  Row,
  StatusBar,
  THead,
  Table,
  Tag,
  TextInput,
} from '@/components/kit'
import { TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'

type BinKind = 'store' | 'receiving' | 'blocked' | 'scrap'

type Bin = {
  id: string
  code: string
  name: string | null
  kind: BinKind
  is_active: boolean
  material_count: number
}

const KIND_LABEL: Record<BinKind, string> = {
  store: 'Kệ thật',
  receiving: 'Khu tiếp nhận',
  blocked: 'Kệ hàng khoá',
  scrap: 'Khu phế liệu',
}

const KIND_TONE: Record<BinKind, 'neutral' | 'warn' | 'stop' | 'done'> = {
  store: 'done',
  receiving: 'warn',
  blocked: 'stop',
  scrap: 'neutral',
}

/** Ba khu ảo làm gì — câu này phải đứng cạnh dòng, không nằm trong tài liệu. */
const KIND_ROLE: Record<BinKind, string> = {
  store: '',
  receiving: 'Hàng ở đây = việc "chờ cất"',
  blocked: 'Không tính vào tồn dùng được',
  scrap: 'Đã ra khỏi tồn khi lập phiếu huỷ',
}

export function BinsScreen({ bins, canEdit }: { bins: Bin[]; canEdit: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BinKind>('store')

  const store = bins.filter((b) => b.kind === 'store')
  const virtual = bins.filter((b) => b.kind !== 'store')

  async function create() {
    if (!code.trim()) {
      toast.error('Chưa có mã khu', 'Mã khu hiện trên biển hiệu và trên phiếu in.')
      return
    }
    setBusy(true)
    try {
      await api('/api/dept/warehouse/bins', {
        method: 'POST',
        body: { code: code.trim().toUpperCase(), name: name.trim() || null, kind },
      })
      setCode('')
      setName('')
      setAdding(false)
      router.refresh()
      toast.success('Đã thêm khu')
    } catch (e) {
      toast.error('Không thêm được', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function deactivate(b: Bin) {
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/bins/${b.id}`, {
        method: 'PATCH',
        body: { is_active: false },
      })
      router.refresh()
      toast.success(`Đã ngừng dùng ${b.code}`)
    } catch (e) {
      // Service chặn khi khu còn hàng và trả câu nói rõ còn bao nhiêu mã —
      // bày nguyên câu đó, đừng nuốt nó thành "Có lỗi".
      toast.error('Không ngừng được', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex flex-col">
      <TopProgressBar active={busy} />

      <Crumb path={['Kho', 'Sơ đồ kệ']} view={`${bins.length} khu`} />

      <div className="flex flex-col gap-[13px] px-[var(--gutter)] py-[13px]">
        {store.length === 0 && (
          /*
            Ba khu ảo do migration nạp sẵn, nên màn KHÔNG BAO GIỜ trống hẳn —
            trạng thái đáng nói là "chưa có KỆ THẬT nào", và nó chặn cả bước cất
            hàng. Nói thẳng điều đó thay vì để người dùng tự suy ra.
          */
          <NoticeBar
            tone="warn"
            tag="Chưa khai kệ"
            action={canEdit ? { label: 'Thêm khu đầu tiên', onClick: () => setAdding(true) } : { label: 'Cần quyền Kho' }} // prettier-ignore
          >
            <b>Chưa có kệ thật nào — hàng nhận về sẽ nằm mãi ở khu tiếp nhận.</b> Bắt đầu
            bằng 8–12 khu thô theo đúng biển hiệu ngoài xưởng (NHOM-A, VAI-B, PK-C…),
            không cần đánh tới từng ô. Chia nhỏ về sau chỉ là thêm dòng vào bảng này.
          </NoticeBar>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            {adding ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                    Mã khu
                  </span>
                  <TextInput value={code} onCommit={setCode} placeholder="VD: NHOM-A" />
                </label>
                <label className="flex min-w-[240px] flex-1 flex-col gap-1">
                  <span className="font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                    Tên (để nhớ)
                  </span>
                  <TextInput
                    value={name}
                    onCommit={setName}
                    placeholder="VD: Nhôm hộp và nhôm thanh"
                  />
                </label>
                <Pick
                  label="Loại khu"
                  value={kind}
                  options={[
                    { value: 'store', label: 'Kệ thật' },
                    { value: 'receiving', label: 'Khu tiếp nhận (hệ thống)' },
                    { value: 'blocked', label: 'Kệ hàng khoá (hệ thống)' },
                    { value: 'scrap', label: 'Khu phế liệu (hệ thống)' },
                  ]}
                  onChange={(v) => setKind(v as BinKind)}
                  width={230}
                />
                <Btn primary onClick={() => void create()} disabled={busy}>
                  Lưu khu
                </Btn>
                <Btn onClick={() => setAdding(false)}>Thôi</Btn>
              </>
            ) : (
              <Btn primary onClick={() => setAdding(true)}>
                + Thêm khu
              </Btn>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
          <Table>
            <THead>
              <th>Mã khu</th>
              <th>Tên</th>
              <th>Loại</th>
              <th style={{ textAlign: 'right' }}>Mã đang nằm</th>
              <th>Vai trò trong luồng</th>
              <th />
            </THead>
            <tbody>
              {/* KỆ THẬT trước, KHU ẢO sau: khu ảo là hạ tầng, người dùng không
                  sửa chúng, nên chúng không được chiếm chỗ đầu bảng. */}
              {[...store, ...virtual].map((b) => (
                <Row key={b.id}>
                  <Cell>
                    <Code>{b.code}</Code>
                  </Cell>
                  <Cell grow muted={!b.name}>
                    {b.name ?? '—'}
                  </Cell>
                  <Cell>
                    <Tag tone={KIND_TONE[b.kind]}>{KIND_LABEL[b.kind]}</Tag>
                    {!b.is_active && <Tag tone="neutral">ngừng dùng</Tag>}
                  </Cell>
                  <Cell num>
                    <Num value={String(b.material_count)} zero="dash" />
                  </Cell>
                  <Cell muted>{KIND_ROLE[b.kind]}</Cell>
                  <Cell>
                    {canEdit && b.kind === 'store' && b.is_active && (
                      <Btn
                        disabled={busy || b.material_count > 0}
                        title={
                          b.material_count > 0
                            ? `Khu đang giữ ${b.material_count} mã — chuyển hết sang khu khác rồi mới ngừng được`
                            : undefined
                        }
                        onClick={() => void deactivate(b)}
                      >
                        Ngừng dùng
                      </Btn>
                    )}
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
          {bins.length === 0 && (
            <Empty
              headline="Chưa có khu nào"
              reason="Migration 0193 nạp sẵn ba khu ảo — không thấy chúng nghĩa là migration chưa chạy trên cơ sở dữ liệu này."
              next={<Btn onClick={() => router.refresh()}>Tải lại</Btn>}
            />
          )}
        </div>

        <p className="max-w-[76ch] leading-relaxed text-[var(--fs-sm)] text-[var(--ink-3)]">
          Ba khu <b>ảo</b> không phải chỗ thật nào cả, và không kiểm kê. Hàng ở{' '}
          <span className="num">TIEP-NHAN</span> vừa được đếm lúc nhận; hàng ở{' '}
          <span className="num">KHOA-01</span> đã có lý do khoá ghi rõ số; hàng ở{' '}
          <span className="num">PHE-Z</span> đã ra khỏi tồn. Nhờ chúng mà{' '}
          <b>“chờ cất” chỉ là một câu truy vấn</b> — còn gì đang nằm ở khu tiếp nhận — chứ
          không phải một cờ trạng thái phải nuôi.
        </p>
      </div>

      <StatusBar
        left={[
          <>
            <b>Sơ đồ kệ</b> · {store.length} kệ thật · {virtual.length} khu ảo
          </>,
          'Kho vật tư chính',
        ]}
        right={`${bins.reduce((s, b) => s + b.material_count, 0)} mã đang nằm trong kho`}
      />
    </div>
  )
}
