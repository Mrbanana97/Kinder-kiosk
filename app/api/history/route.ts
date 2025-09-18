import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('sign_out_archives')
      .select('day, created_at')
      .order('day', { ascending: false })
    if (error) throw error
    return Response.json({ days: data })
  } catch (e: any) {
    // If table missing (Postgres undefined_table), return empty list gracefully
    if (e?.message?.includes("sign_out_archives")) {
      return Response.json({ days: [], note: 'Archive table missing. Run scripts/006_create_sign_out_archives.sql in Supabase.' })
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
