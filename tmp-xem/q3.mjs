import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const [table, col, val, sel] = process.argv.slice(2)
const { data, error } = await sb.from(table).select(sel || '*').eq(col, val).limit(100)
if (error) console.log(error); else { console.log('rows:', data.length); for (const r of data) console.log(JSON.stringify(r)) }
