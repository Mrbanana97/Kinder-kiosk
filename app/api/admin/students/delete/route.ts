import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function DELETE(request: NextRequest) {
  try {
    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    console.log("[v0] API: Starting delete process for student:", studentId)

    const supabase = createServiceRoleClient()

    // First, delete any related sign-out records
    console.log("[v0] API: Deleting sign-out records for student:", studentId)
    const { error: signOutError } = await supabase.from("sign_out_records").delete().eq("student_id", studentId)

    if (signOutError) {
      console.error("[v0] API: Error deleting sign-out records:", signOutError)
      return NextResponse.json({ error: `Failed to delete sign-out records: ${signOutError.message}` }, { status: 500 })
    }

    // Then delete the student
    console.log("[v0] API: Deleting student:", studentId)
    const { error: studentError, data: deletedStudent } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId)
      .select()

    if (studentError) {
      console.error("[v0] API: Error deleting student:", studentError)
      return NextResponse.json({ error: `Failed to delete student: ${studentError.message}` }, { status: 500 })
    }

    if (!deletedStudent || deletedStudent.length === 0) {
      console.log("[v0] API: No student was deleted - checking if student exists")
      const { data: existingStudent } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("id", studentId)
        .single()

      if (existingStudent) {
        return NextResponse.json(
          { error: "Student exists but could not be deleted - check permissions" },
          { status: 500 },
        )
      } else {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
    }

    console.log("[v0] API: Student successfully deleted:", deletedStudent)
    return NextResponse.json({ success: true, deletedStudent })
  } catch (error) {
    console.error("[v0] API: Error in delete process:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete student",
      },
      { status: 500 },
    )
  }
}
