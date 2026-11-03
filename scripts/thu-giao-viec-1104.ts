/**
 * THỬ THẬT luồng phân công việc (04/11/2026) trên DB thật, qua ĐÚNG các hàm máy chủ
 * mà màn gọi. Người giao = Quản trị viên, người nhận = Tài khoản kiểm thử 0130 — không
 * ai là người thật nên chuông không làm phiền ai. Cuối kịch bản XOÁ SẠCH việc thử
 * (tệp trên Storage + dòng; chuông / bình luận / vết đi theo FK cascade).
 *
 * Chạy: npx tsx --conditions=react-server scripts/thu-giao-viec-1104.ts
 */
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
}

const GIVER = 'a233fa28-2b90-4d0d-b348-432479ce92da' // Trần Đại Việt (admin, Kỹ thuật)
const TAKER = '2d47facc-c8ce-43ec-b5bc-6c9435825bc8' // Quản trị viên
const SALE = '6e439884-8bc1-4d89-860f-e5a109613154' // Nguyễn Võ Nam Việt — CHỈ kiểm quyền, không ghi

const out: string[] = []
const ok = (s: string) => out.push(`  ĐẠT   ${s}`)
const bad = (s: string) => out.push(`  TRƯỢT ${s}`)
const note = (s: string) => out.push(`  ·     ${s}`)
const check = (cond: unknown, s: string) => (cond ? ok(s) : bad(s))

async function main() {
  const { usersRepo } = await import('@/modules/core/users/users.repo')
  const { tasksService } = await import('@/modules/workflow/tasks/tasks.service')
  const { filesService } = await import('@/modules/core/files/files.service')
  const { db } = await import('@/server/db')
  const { createHash } = await import('node:crypto')

  const giver = (await usersRepo.findById(GIVER))!
  const taker = (await usersRepo.findById(TAKER))!
  const sale = (await usersRepo.findById(SALE))!
  const chuong = async (who: string, taskId: string) => {
    const { data } = await db()
      .from('notifications')
      .select('type, payload, user_id')
      .eq('task_id', taskId)
      .eq('user_id', who)
      .order('created_at')
    return (data ?? []) as { type: string; payload: Record<string, unknown> }[]
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  let taskId: string | null = null
  try {
    out.push('1 · GIAO VIỆC')
    const task = await tasksService.create(giver, {
      title: '[THỬ 04/11] Kiểm tra luồng giao việc',
      description: 'Việc thử của Claude — sẽ xoá ngay sau khi thử.',
      assignee_id: TAKER,
      due_date: '2026-11-10T16:59:59.999Z',
      priority: 'urgent',
    })
    taskId = task.id
    check(
      task.status === 'todo' && task.kind === 'assigned',
      `tạo ${task.task_code} · trạng thái Chưa làm`,
    )
    await sleep(400)
    const c1 = await chuong(TAKER, task.id)
    check(
      c1.some((n) => n.type === 'assigned'),
      'người nhận có chuông "được giao việc"',
    )

    out.push(
      '2 · TỆP ĐÍNH KÈM (người NHẬN tải lên — trước đây chỉ quản lý đã giao mới đính được)',
    )
    const buf = Buffer.from(
      '%PDF-1.4\n% thu giao viec\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    )
    const init = await filesService.initUpload(taker, {
      filename: 'thu-ban-ve.pdf',
      mime_type: 'application/pdf',
      size_bytes: buf.byteLength,
      bucket: 'attachments',
      doc_type: null,
      parent: { kind: 'task', id: task.id },
    } as never)
    const put = await fetch(init.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      body: buf,
    })
    check(put.ok, `đẩy tệp lên kho (HTTP ${put.status})`)
    await filesService.finalize(
      taker,
      init.fileId,
      createHash('sha256').update(buf).digest('hex'),
    )
    const files = await filesService.listForTask(giver, task.id)
    check(
      files.length === 1 && files[0].owner_name === taker.name,
      `người GIAO thấy tệp "${files[0]?.filename}" của ${files[0]?.owner_name}`,
    )
    check(
      files[0] && !files[0].can_delete === false,
      'sếp xoá được tệp người khác tải (can_delete)',
    )
    const sales = await filesService.listForTask(taker, task.id)
    check(sales[0]?.can_delete === true, 'người tải xoá được tệp của mình')

    out.push('3 · NGƯỜI NHẬN LÀM')
    await tasksService.changeStatus(taker, task.id, 'in_progress')
    const t3 = await tasksService.get(giver, task.id)
    check(t3.status === 'in_progress', 'Bắt đầu → Đang làm')
    await tasksService.addComment(taker, task.id, {
      body: 'Đang làm, mai xong.',
      kind: 'comment',
    })
    await sleep(400)
    note(`chuông người giao sau khi bắt đầu + trao đổi: ${(await chuong(GIVER, task.id)).map((n) => n.type).join(', ') || '(không có)'}`) // prettier-ignore

    out.push('3b · NGƯỜI GIAO SỬA VIỆC khi đang làm')
    const bd = await tasksService.givenBoard(giver)
    check(bd?.items.find((x) => x.id === task.id)?.can_edit === true, 'dòng việc trên "Việc tôi giao" có cờ sửa được')
    const truoc = (await chuong(TAKER, task.id)).length
    const r = await tasksService.edit(giver, task.id, {
      title: '[THỬ 04/11] Kiểm tra luồng giao việc (đã sửa)',
      due_date: '2026-11-12T16:59:59.999Z',
      priority: 'normal',
    })
    note(`dòng thay đổi: ${r.changes.join(' | ')}`)
    check(r.changes.length === 3, 'kể lại đủ 3 thay đổi (tên, hạn, mức)')
    const cm = await tasksService.listComments(giver, task.id)
    check(cm.some((c) => c.kind === 'system' && c.body.includes('Đổi hạn: 10/11/2026 → 12/11/2026')), 'Trao đổi có dòng hệ thống "Đổi hạn 10/11 → 12/11"')
    await sleep(400)
    check((await chuong(TAKER, task.id)).length > truoc, 'người nhận có chuông khi việc bị sửa')
    const lai = await tasksService.edit(giver, task.id, { priority: 'normal' })
    check(lai.changes.length === 0, 'gửi lại y nguyên thì không ghi gì')
    try {
      await tasksService.edit({ ...taker, role: 'employee' }, task.id, { title: 'người nhận sửa' })
      bad('người nhận (nhân viên) sửa được việc')
    } catch (e) {
      ok(`người nhận (nhân viên) không sửa được: "${(e as Error).message}"`)
    }

    out.push('4 · BÁO HOÀN THÀNH — người giao có biết không?')
    try {
      await tasksService.submit(taker, task.id, '   ')
      bad('báo hoàn thành không có câu kết quả vẫn lọt')
    } catch {
      ok('báo hoàn thành bắt một câu kết quả')
    }
    await tasksService.submit(taker, task.id, 'Đã làm xong bản vẽ, gửi kèm tệp.')
    await sleep(400)
    const c4 = await chuong(GIVER, task.id)
    const sub = c4.find((n) => n.type === 'submitted')
    check(sub, 'người GIAO có chuông "đã báo hoàn thành"')
    check(
      sub?.payload?.reason === 'Đã làm xong bản vẽ, gửi kèm tệp.',
      'chuông kèm nguyên câu kết quả',
    )
    check(
      (await tasksService.get(giver, task.id)).status === 'submitted',
      'trạng thái Chờ duyệt (chưa phải Xong)',
    )

    out.push('5 · NGƯỜI GIAO TRẢ LẠI rồi DUYỆT')
    await tasksService.reject(giver, task.id, 'Thiếu trang 2, bổ sung.')
    await sleep(400)
    check(
      (await chuong(TAKER, task.id)).some((n) => n.type === 'rejected'),
      'người nhận có chuông "bị trả lại" kèm lý do',
    )
    await tasksService.submit(taker, task.id, 'Đã bổ sung trang 2.')
    await tasksService.approve(giver, task.id)
    await sleep(400)
    const t5 = await tasksService.get(giver, task.id)
    check(
      t5.status === 'done' && !!t5.completed_at,
      'Duyệt Đạt → Xong, có ngày hoàn thành',
    )
    check(
      (await chuong(TAKER, task.id)).some((n) => n.type === 'approved'),
      'người nhận có chuông "đã duyệt"',
    )
    try {
      await filesService.initUpload(taker, {
        filename: 'sau-khi-xong.pdf',
        mime_type: 'application/pdf',
        size_bytes: 10,
        bucket: 'attachments',
        doc_type: null,
        parent: { kind: 'task', id: task.id },
      } as never)
      bad('việc đã xong vẫn đính thêm tệp được')
    } catch (e) {
      ok(`việc đã xong khoá thêm tệp: "${(e as Error).message}"`)
    }

    out.push('6 · SỬA VIỆC KHI ĐÃ XONG + LUẬT SỬA')
    try {
      await tasksService.edit(giver, task.id, { title: '[THỬ] sửa sau khi xong' })
      bad('việc đã xong vẫn sửa được')
    } catch (e) {
      ok(`việc đã xong khoá sửa: "${(e as Error).message}"`)
    }
    const { taskEditBlock } = await import('@/lib/task-flow')
    const t6 = { ...(await tasksService.get(giver, task.id)), status: 'in_progress' as const }
    const saleGiao = { ...t6, assigner_id: sale.id }
    note(`luật sửa (việc đang làm): sếp ${taskEditBlock(t6, giver) === null} · nhân viên Bán Hàng đã giao ${taskEditBlock(saleGiao, { id: sale.id, role: 'employee', workspace: 'sales' }) === null} · người nhận ${taskEditBlock(t6, { id: TAKER, role: 'employee' }) === null}`)

    out.push('7 · QUYỀN BÁN HÀNG (chỉ đọc + thử bị chặn, KHÔNG tạo việc)')
    check(await tasksService.canGive(sale), 'nhân viên Bán Hàng có nút Giao việc')
    const ds = await tasksService.assignees(sale)
    const phong = [
      ...new Set(ds.filter((p) => p.id !== sale.id).map((p) => p.department)),
    ]
    check(phong.every((p) => p === 'Kỹ Thuật' || p === 'Cung Ứng - Mua Hàng'), `danh sách người nhận của Sale chỉ gồm: ${phong.join(', ')} (${ds.length - 1} người)`) // prettier-ignore
    try {
      await tasksService.create(sale, {
        title: '[THỬ] Sale giao ngoài phòng',
        assignee_id: TAKER,
      })
      bad('Sale giao được cho người ngoài Kỹ thuật / Cung ứng')
    } catch (e) {
      ok(`Sale giao ngoài hai phòng bị chặn: "${(e as Error).message}"`)
    }
  } finally {
    if (taskId) {
      out.push('8 · DỌN')
      const { data: f } = await db()
        .from('files')
        .select('id, bucket, path')
        .eq('task_id', taskId)
      for (const r of (f ?? []) as { id: string; bucket: string; path: string }[]) {
        await db().storage.from(r.bucket).remove([r.path])
      }
      await db().from('files').delete().eq('task_id', taskId)
      const { error } = await db().from('tasks').delete().eq('id', taskId)
      const { count } = await db().from('notifications').select('id', { count: 'exact', head: true }).eq('task_id', taskId) // prettier-ignore
      check(
        !error && (count ?? 0) === 0,
        `đã xoá việc thử, ${f?.length ?? 0} tệp và mọi chuông của nó`,
      )
    }
    console.log(out.join('\n'))
  }
}

main().catch((e) => {
  console.log(out.join('\n'))
  console.error('LỖI', e)
  process.exit(1)
})
