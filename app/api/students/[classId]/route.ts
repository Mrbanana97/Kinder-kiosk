import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const { classId } = await params
    const supabase = await createClient()

    const { data: allStudents, error: studentsError } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", classId)
      .order("first_name")

    if (studentsError) {
      console.error("Database error:", studentsError)
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
    }

    // Get students who are currently signed out (not signed back in)
    const { data: signedOutStudents, error: signOutError } = await supabase
      .from("sign_out_records")
      .select("student_id")
      .is("signed_back_in_at", null)

    if (signOutError) {
      console.error("Database error:", signOutError)
      return NextResponse.json({ error: "Failed to fetch sign-out records" }, { status: 500 })
    }

    // Filter out students who are currently signed out
    const signedOutStudentIds = new Set(signedOutStudents?.map((record) => record.student_id) || [])
    const availableStudents = allStudents?.filter((student) => !signedOutStudentIds.has(student.id)) || []

    return NextResponse.json({ students: availableStudents })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
