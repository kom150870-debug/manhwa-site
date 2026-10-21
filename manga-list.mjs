import { createClient } from '@supabase/supabase-js';
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
export default async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response(JSON.stringify({ error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify.' }), { status: 503, headers });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from('manga').select('id,slug,title_mn,title_en,description_mn,description_en,cover_url,genres,created_at').eq('is_published', true).order('created_at', { ascending: false }).limit(50);
  if (error) return new Response(JSON.stringify({ error: 'Unable to load manga catalogue.' }), { status: 500, headers });
  return new Response(JSON.stringify({ manga: data ?? [] }), { status: 200, headers });
};
