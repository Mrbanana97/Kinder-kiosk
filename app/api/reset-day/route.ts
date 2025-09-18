import { createClient } from '@/lib/supabase/server'

// Helper to get start/end of local day in UTC timestamps
function getTodayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function POST() {
  const supabase = await createClient()
  try {
    // Call database function that archives and clears records atomically
    const { error: rpcError } = await supabase.rpc('reset_day_archive')
    if (rpcError) throw rpcError

    // Fetch archived row for today to report count
    const today = new Date().toISOString().split('T')[0]
    const { data: archiveRow, error: archiveErr } = await supabase
      .from('sign_out_archives')
      .select('data')
      .eq('day', today)
      .single()
    if (archiveErr) throw archiveErr

    const count = Array.isArray(archiveRow?.data) ? archiveRow.data.length : (archiveRow?.data?.records?.length || 0)
    return Response.json({ success: true, archived: count })
  } catch (e: any) {
    console.error('reset-day error', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
