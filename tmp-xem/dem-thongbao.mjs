import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const { data, error } = await sb.from('notifications').select('id,type,user_id,payload,created_at').gte('created_at','2026-11-10T06:00:00Z').order('created_at')
if (error) { console.log(error); process.exit(1) }
const hit = data.filter(n => JSON.stringify(n.payload).includes('TEST-E2E') || JSON.stringify(n.payload).includes('b9f29a0d') || JSON.stringify(n.payload).includes('a3c51cdd'))
console.log('today total', data.length, '| TEST-related', hit.length)
for (const n of hit) console.log(n.id, n.type, JSON.stringify(n.payload).slice(0,120))
if (process.argv[2] === '--xoa' && hit.length) {
  const { error: e2, count } = await sb.from('notifications').delete({count:'exact'}).in('id', hit.map(n=>n.id))
  console.log(e2 ?? `xoá ${count} thông báo`)
}
