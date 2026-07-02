import { describe, it, expect, beforeEach, vi } from 'vitest'
import { on, emit, _resetForTests } from './bus'

describe('event bus', () => {
  beforeEach(() => _resetForTests())

  it('handler nhận đúng event khi emit', async () => {
    const spy = vi.fn()
    on('task.created', spy)
    await emit({
      name: 'task.created',
      task_id: 't1',
      title: 'X',
      assigner_id: 'a',
      assignee_id: 'b',
      kind: 'assigned',
    })
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0][0]).toMatchObject({ name: 'task.created', task_id: 't1' })
  })

  it('nhiều handler cùng event đều chạy', async () => {
    const s1 = vi.fn()
    const s2 = vi.fn()
    on('task.approved', s1)
    on('task.approved', s2)
    await emit({
      name: 'task.approved',
      task_id: 't1',
      title: 'X',
      approved_by: 'a',
      assignee_id: 'b',
    })
    expect(s1).toHaveBeenCalledOnce()
    expect(s2).toHaveBeenCalledOnce()
  })

  it('handler throw không làm emit throw', async () => {
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    on('task.rejected', bad)
    on('task.rejected', good)
    await expect(
      emit({
        name: 'task.rejected',
        task_id: 't1',
        title: 'X',
        rejected_by: 'a',
        assignee_id: 'b',
        reason: 'r',
      }),
    ).resolves.toBeUndefined()
    expect(bad).toHaveBeenCalledOnce()
    expect(good).toHaveBeenCalledOnce() // handler khác vẫn chạy
  })

  it('không có handler thì no-op', async () => {
    await expect(
      emit({
        name: 'task.submitted',
        task_id: 't1',
        title: 'X',
        submitted_by: 'a',
        assigner_id: 'b',
      }),
    ).resolves.toBeUndefined()
  })

  it('unsubscribe function xoá handler', async () => {
    const spy = vi.fn()
    const off = on('task.created', spy)
    off()
    await emit({
      name: 'task.created',
      task_id: 't1',
      title: 'X',
      assigner_id: 'a',
      assignee_id: 'b',
      kind: 'assigned',
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('handler chỉ nhận event đúng name', async () => {
    const createdSpy = vi.fn()
    const approvedSpy = vi.fn()
    on('task.created', createdSpy)
    on('task.approved', approvedSpy)
    await emit({
      name: 'task.created',
      task_id: 't1',
      title: 'X',
      assigner_id: 'a',
      assignee_id: 'b',
      kind: 'self',
    })
    expect(createdSpy).toHaveBeenCalledOnce()
    expect(approvedSpy).not.toHaveBeenCalled()
  })
})
