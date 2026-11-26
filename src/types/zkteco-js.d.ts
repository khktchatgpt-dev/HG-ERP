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
    /** Kênh TCP nội bộ — `zk.ts` dùng để đọc log TỪNG KHỐI (xem `docLogTungKhoi`). */
    ztcp?: {
      socket: import('node:net').Socket | null
      sessionId: number
      replyId: number
      freeData(): Promise<unknown>
      requestData(buf: Buffer): Promise<Buffer>
      sendChunkRequest(start: number, size: number): Promise<void>
    }
  }
}

declare module 'zkteco-js/src/helper/command.js' {
  export const COMMANDS: Record<string, number>
  export const REQUEST_DATA: Record<string, Buffer>
  export const MAX_CHUNK: number
}

declare module 'zkteco-js/src/helper/utils.js' {
  const utils: {
    decodeUserData72: (b: Buffer) => Record<string, unknown>
    decodeRecordData40: (b: Buffer) => Record<string, unknown>
    createTCPHeader: (
      command: number,
      sessionId: number,
      replyId: number,
      data: Buffer,
    ) => Buffer
  }
  export default utils
}
