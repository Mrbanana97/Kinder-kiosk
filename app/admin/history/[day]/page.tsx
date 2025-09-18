import { createClient } from '@/lib/supabase/server'

interface ArchiveRow { id: string; student_id: string; signed_out_at: string; signed_back_in_at: string | null; signature_url: string | null; student?: { first_name: string; last_name: string; class_id: string } }

export default async function HistoryDayPage({ params }: { params: { day: string } }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sign_out_archives')
    .select('day, data, created_at')
    .eq('day', params.day)
    .single()
  if (error || !data) {
    return <div className="p-8">Archive not found.</div>
  }
  const rows: ArchiveRow[] = data.data || []
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">History for {data.day}</h1>
      <div className="overflow-auto border rounded bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2 font-medium">Student</th>
              <th className="p-2 font-medium">Class</th>
              <th className="p-2 font-medium">Signed Out</th>
              <th className="p-2 font-medium">Signed Back In</th>
              <th className="p-2 font-medium">Signature</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.student ? r.student.first_name + ' ' + r.student.last_name : r.student_id}</td>
                <td className="p-2">{r.student?.class_id || '—'}</td>
                <td className="p-2">{new Date(r.signed_out_at).toLocaleString()}</td>
                <td className="p-2">{r.signed_back_in_at ? new Date(r.signed_back_in_at).toLocaleString() : '—'}</td>
                <td className="p-2">{r.signature_url ? <img src={r.signature_url} alt="sig" className="h-8 object-contain border rounded" /> : '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={5}>No records archived.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
