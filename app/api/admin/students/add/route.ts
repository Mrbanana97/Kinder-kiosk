import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { students } = body // Array of student objects

    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ error: "Invalid students data" }, { status: 400 })
    }

    // Validate each student has required fields
    for (const student of students) {
      if (!student.first_name || !student.last_name || !student.class_id) {
        return NextResponse.json(
          {
            error: "Each student must have first_name, last_name, and class_id",
          },
          { status: 400 },
        )
      }
    }

    const { data, error } = await supabase.from("students").insert(students).select()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to add students" }, { status: 500 })
    }

    return NextResponse.json({
      message: `Successfully added ${data.length} students`,
      students: data,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
