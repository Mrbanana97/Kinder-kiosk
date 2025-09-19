import { createServiceRoleClient } from '@/lib/supabase/service-role'

type SignOutRecordRow = {
  id: string
  student_id: string
  signer_name: string
  signature_data: string | null
  signature_url?: string | null
  signed_out_at: string
  signed_back_in_at: string | null
  students?: {
    first_name: string
    last_name: string
    class_id: string | null
    classes?: { name: string | null } | null
  } | null
}

function getTodayIsoDate() {
  return new Date().toISOString().split('T')[0]
}

async function getArchivedCount(supabase: ReturnType<typeof createServiceRoleClient>, day: string) {
  const { data, error } = await supabase
    .from('sign_out_archives')
    .select('data')
    .eq('day', day)
    .maybeSingle()
  if (error) {
    if (error.message?.includes('sign_out_archives')) {
      throw new Error('Archive table missing. Run scripts/006_create_sign_out_archives.sql in Supabase.')
    }
    throw new Error(`Failed to load archive summary: ${error.message}`)
  }
  if (!data) return 0
  const payload: any = (data as any).data
  if (!payload) return 0
  if (Array.isArray(payload)) return payload.length
  if (Array.isArray(payload.records)) return payload.records.length
  return 0
}

async function fallbackArchive(supabase: ReturnType<typeof createServiceRoleClient>, day: string, rpcError?: { message?: string }) {
  const { data: rows, error: fetchErr } = await supabase
    .from('sign_out_records')
    .select(
      `id, student_id, signer_name, signature_data, signature_url, signed_out_at, signed_back_in_at,
       students:students(first_name, last_name, class_id, classes:classes(name))`
    )
    .order('signed_out_at', { ascending: true })
  if (fetchErr) {
    if (fetchErr.message?.includes('sign_out_records')) {
      throw new Error('Sign-out records table missing. Run scripts/001_create_tables.sql in Supabase.')
    }
    throw new Error(`Failed to fetch sign-out records: ${fetchErr.message}`)
  }

  const sourceRows = (rows ?? []) as unknown as SignOutRecordRow[]

  if (!sourceRows.length) {
    return 0
  }

  const archiveRecords = sourceRows.map(row => ({
    id: row.id,
    student_id: row.student_id,
    signer_name: row.signer_name,
    signature_data: row.signature_data,
    signature_url: row.signature_url || null,
    signed_out_at: row.signed_out_at,
    signed_back_in_at: row.signed_back_in_at,
    student: row.students
      ? {
          first_name: row.students.first_name,
          last_name: row.students.last_name,
          class_id: row.students.classes?.name || row.students.class_id || null,
        }
      : null,
  }))

  const idsToDelete = archiveRecords.map(r => r.id)
  const archivePayload = { day, records: archiveRecords }

  const attemptDeleteLiveRecords = async () => {
    if (!idsToDelete.length) return
    const { error: deleteErr } = await supabase.from('sign_out_records').delete().in('id', idsToDelete)
    if (deleteErr) throw new Error(`Failed to clear sign-out records: ${deleteErr.message}`)
  }

  const { error: upsertErr } = await supabase
    .from('sign_out_archives')
    .upsert({ day, data: archivePayload }, { onConflict: 'day', ignoreDuplicates: false })

  if (!upsertErr) {
    await attemptDeleteLiveRecords()
    return archiveRecords.length
  }

  const message = upsertErr.message || ''
  if (message.includes('sign_out_archives')) {
    throw new Error('Archive table missing. Run scripts/006_create_sign_out_archives.sql in Supabase.')
  }

  if (message.includes('no unique or exclusion constraint')) {
    const { error: insertErr } = await supabase.from('sign_out_archives').insert({ day, data: archivePayload })
    if (insertErr) {
      if (insertErr.message?.includes('null value') || insertErr.message?.includes('not-null')) {
        // Fall through to legacy insert path below
      } else {
        throw new Error(`Failed to store archive (insert fallback): ${insertErr.message}`)
      }
    } else {
      await attemptDeleteLiveRecords()
      return archiveRecords.length
    }
  }

  if (!message.includes('null value') && !message.includes('not-null') && !message.includes('archive_day')) {
    throw new Error(`Failed to store archive: ${message}`)
  }

  // Legacy schema pathway: populate required columns with a representative row
  const primaryRow = sourceRows[0]
  const legacyInsert = {
    day,
    archive_day: day,
    data: archivePayload,
    student_id: primaryRow.student_id,
    signer_name: primaryRow.signer_name,
    signature_data: primaryRow.signature_data,
    signature_url: primaryRow.signature_url ?? null,
    signed_out_at: primaryRow.signed_out_at,
    signed_back_in_at: primaryRow.signed_back_in_at,
    archived_at: new Date().toISOString(),
  }

  const deleteFilters = [
    supabase.from('sign_out_archives').delete().eq('day', day),
    supabase.from('sign_out_archives').delete().eq('archive_day', day),
  ]
  for (const deletion of deleteFilters) {
    const { error } = await deletion
    if (error && !error.message?.includes('column')) {
      throw new Error(`Failed to prepare archive slot: ${error.message}`)
    }
    if (!error) break
  }

  const { error: legacyInsertErr } = await supabase.from('sign_out_archives').insert(legacyInsert)
  if (legacyInsertErr) {
    const prefix = rpcError?.message ? `Reset function failed (${rpcError.message}). ` : ''
    throw new Error(`${prefix}Legacy archive insert failed: ${legacyInsertErr.message}`)
  }

  await attemptDeleteLiveRecords()
  return archiveRecords.length
}

export async function POST(): Promise<Response> {
  try {
    const supabase = createServiceRoleClient()
    const today = getTodayIsoDate()

    const { error: rpcError } = await supabase.rpc('reset_day_archive')

    let count: number
    if (rpcError) {
      console.warn('reset_day_archive RPC failed; using fallback archive path', rpcError)
      count = await fallbackArchive(supabase, today, rpcError)
    } else {
      try {
        count = await getArchivedCount(supabase, today)
      } catch (summaryErr: any) {
        console.warn('reset-day summary lookup failed; using fallback archive path', summaryErr)
        count = await fallbackArchive(supabase, today)
      }
    }

    return Response.json({ success: true, archived: count })
  } catch (e: any) {
    console.error('reset-day error', e)
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), { status: 500 })
  }
}
