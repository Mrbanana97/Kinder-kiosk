import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { student_id, signer_name, signature_data } = await request.json()

    if (!student_id || !signer_name) {
      return NextResponse.json({ error: "Student ID and signer name are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if student is already signed out (not signed back in)
    const { data: existingRecord } = await supabase
      .from("sign_out_records")
      .select("*")
      .eq("student_id", student_id)
      .is("signed_back_in_at", null)
      .single()

    if (existingRecord) {
      return NextResponse.json({ error: "Student is already signed out" }, { status: 400 })
    }

    // Create new sign-out record
    const { data, error } = await supabase
      .from("sign_out_records")
      .insert({
        student_id,
        signer_name,
        signature_data,
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to create sign-out record" }, { status: 500 })
    }

    return NextResponse.json({ success: true, record: data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
