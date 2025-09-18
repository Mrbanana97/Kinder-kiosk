import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: { day: string } }) {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('sign_out_archives')
      .select('day, data, created_at')
      .eq('day', params.day)
      .single()
    if (error) throw error
    // Normalize: data may be array or object with records
    const normalized = data?.data && Array.isArray(data.data)
      ? { ...data, data: { day: data.day, records: data.data } }
      : data
    return Response.json({ archive: normalized })
  } catch (e: any) {
    if (e?.message?.includes('sign_out_archives')) {
      return new Response(JSON.stringify({ error: 'Archive table not found. Execute scripts/006_create_sign_out_archives.sql.' }), { status: 404 })
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 404 })
  }
}
