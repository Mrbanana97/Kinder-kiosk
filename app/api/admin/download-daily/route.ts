import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Get today's date range
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Fetch today's sign-out records with student and class information
    const { data: records, error } = await supabase
      .from("sign_out_records")
      .select(`
        id,
        signer_name,
        signed_out_at,
        signed_back_in_at,
        students (
          first_name,
          last_name,
          classes (
            name
          )
        )
      `)
      .gte("signed_out_at", startOfDay.toISOString())
      .lt("signed_out_at", endOfDay.toISOString())
      .order("signed_out_at", { ascending: false })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 })
    }

    // Convert to CSV format
    const csvHeaders = ["Student Name", "Class", "Signed Out By", "Sign-Out Time"]

    const csvRows = records.map((record: any) => [
      `${record.students.first_name} ${record.students.last_name}`,
      record.students.classes.name,
      record.signer_name,
      new Date(record.signed_out_at).toLocaleString(),
    ])

    // Create CSV content
    const csvContent = [csvHeaders.join(","), ...csvRows.map((row) => row.map((field) => `"${field}"`).join(","))].join(
      "\n",
    )

    // Create filename with today's date
    const filename = `kindergarten-signouts-${today.toISOString().split("T")[0]}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error generating daily report:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
