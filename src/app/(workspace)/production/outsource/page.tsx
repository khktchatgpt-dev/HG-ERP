import { EntryWorkbench } from '../entry/EntryWorkbench'
import { canRecordHere, loadRunningLsx } from '../entry/shared'

/** Menu "Gia công ngoài" — sổ giao/nhận hàng gia công, chọn lệnh tại chỗ. */
export default async function OutsourceEntryPage() {
  const [lsxList, canRecord] = await Promise.all([loadRunningLsx(), canRecordHere()])

  return (
    <EntryWorkbench
      kind="outsource"
      title="Gia công ngoài"
      description="Chọn lệnh → ghi giao/nhận hàng gia công (TTP, Vinh…). Nhiều lệnh chạy song song thì đổi lệnh ngay tại đây."
      lsxList={lsxList}
      canRecord={canRecord}
    />
  )
}
