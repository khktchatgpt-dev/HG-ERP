// Sinh lại bảng thuộc tính của kit: `npm run kit:api`. Xem scripts/kit-api-lib.mjs.
import fs from 'node:fs'
import { API_JSON, extractKitApi } from './kit-api-lib.mjs'

const api = extractKitApi()
fs.writeFileSync(API_JSON, JSON.stringify(api, null, 2) + '\n')
const n = Object.keys(api).length
const p = Object.values(api).reduce((a, c) => a + c.props.length, 0)
console.log(`kit-api.json: ${n} thành phần, ${p} thuộc tính`)
