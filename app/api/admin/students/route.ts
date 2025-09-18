import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("students")
      .select(`
        *,
        classes (
          name
        ),
        sign_out_records (
          id,
          signed_out_at,
          signer_name
        )
      `)
      .order("first_name")

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
    }

    return NextResponse.json({ students: data || [] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
