// Khai kiểu tối thiểu cho `zkteco-js@1.7.1` (thư viện không kèm .d.ts) — chỉ phần
// `src/modules/dept/hr/cham-cong/zk.ts` dùng.
declare module 'zkteco-js' {
  export default class Zkteco {
    constructor(ip: string, port: number, timeout: number, inport: number)
    connectionType: 'tcp' | 'udp' | null
    createSocket(cbErr?: (e: unknown) => void, cbClose?: () => void): Promise<boolean>
    getInfo(): Promise<{ userCounts: number; logCounts: number; logCapacity: number }>
    getSerialNumber(): Promise<string>
    getUsers(): Promise<{
      data: { userId: string; name: string; cardno: number; role: number }[]
    }>
    getAttendances(): Promise<{
      data: { user_id: string; record_time: string; type: number; state: number }[]
    }>
    disconnect(): Promise<void>
  }
}

declare module 'zkteco-js/src/helper/utils.js' {
  const utils: {
    decodeUserData72: (b: Buffer) => Record<string, unknown>
    decodeRecordData40: (b: Buffer) => Record<string, unknown>
  }
  export default utils
}
