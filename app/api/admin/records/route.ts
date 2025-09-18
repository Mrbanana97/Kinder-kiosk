import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Define today window (UTC)
    const now = new Date()
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

    // 1. Fetch sign-out records (no joins)
    const { data: records, error: recErr } = await supabase
      .from("sign_out_records")
      .select("id, student_id, signed_out_at, signed_back_in_at, signer_name, signature_data, signature_url")
      .gte("signed_out_at", dayStart.toISOString())
      .lt("signed_out_at", dayEnd.toISOString())
      .order("signed_out_at", { ascending: false })

    if (recErr) {
      console.error("sign_out_records query error:", recErr)
      return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 })
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ records: [] })
    }

    // 2. Fetch needed students in one batch
    const studentIds = Array.from(new Set(records.map(r => r.student_id)))
    const { data: students, error: stuErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, class_id")
      .in("id", studentIds)

    if (stuErr) {
      console.error("students batch query error:", stuErr)
      return NextResponse.json({ error: "Failed to fetch related students" }, { status: 500 })
    }

    // 3. Fetch classes for mapping (optional optimization: only needed ids)
    const classIds = Array.from(new Set((students || []).map(s => s.class_id).filter(Boolean)))
    let classesMap: Record<string, string> = {}
    if (classIds.length) {
      const { data: classes, error: classErr } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds)
      if (classErr) {
        console.warn("classes query error (non-fatal):", classErr)
      } else {
        classesMap = Object.fromEntries((classes || []).map(c => [c.id, c.name]))
      }
    }

    const studentMap = Object.fromEntries(
      (students || []).map(s => [s.id, { first_name: s.first_name, last_name: s.last_name, class_id: s.class_id, class_name: s.class_id ? classesMap[s.class_id] : null }])
    )

    const enriched = records.map(r => ({
      ...r,
      student: studentMap[r.student_id] || null
    }))

    return NextResponse.json({ records: enriched })
  } catch (e: any) {
    console.error("API error (records GET outer):", e)
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
  }
}
