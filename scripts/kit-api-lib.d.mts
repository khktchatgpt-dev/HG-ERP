export type KitApiProp = {
  name: string
  type: string
  optional: boolean
  def: string | null
  doc: string
}
export type KitApiEntry = { file: string; props: KitApiProp[]; extends: string[] }
export function extractKitApi(): Record<string, KitApiEntry>
export const API_JSON: string
