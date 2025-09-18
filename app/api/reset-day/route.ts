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
    if (rpcError) {
      throw new Error(`RPC reset_day_archive failed: ${rpcError.message}`)
    }

    // Fetch archived row for today to report count (supports array or object formats)
    const today = new Date().toISOString().split('T')[0]
    const { data: archiveRow, error: archiveErr } = await supabase
      .from('sign_out_archives')
      .select('data')
      .eq('day', today)
      .maybeSingle()
    if (archiveErr) throw archiveErr
    const count = archiveRow
      ? (Array.isArray((archiveRow as any).data) ? (archiveRow as any).data.length : ((archiveRow as any).data?.records?.length || 0))
      : 0
    return Response.json({ success: true, archived: count })
  } catch (e: any) {
    console.error('reset-day error', e)
    return new Response(JSON.stringify({ error: e.message || 'Unknown error', stack: e.stack }), { status: 500 })
  }
}
