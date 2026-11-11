import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const [table, ...rest] = process.argv.slice(2)
const sel = rest[0] || '*'
const filt = rest[1]
let q = sb.from(table).select(sel).limit(20)
if (filt) { const [k,v] = filt.split('='); q = q.ilike(k, v) }
const { data, error } = await q
console.log(error ?? JSON.stringify(data, null, 1))
