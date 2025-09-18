import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Helper to get start/end of local day in UTC timestamps
function getTodayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { start, end } = getTodayBounds()

    // Instead of deleting records (which loses audit history), mark any currently open sign-outs today as signed back in now.
    const { error } = await supabase
      .from("sign_out_records")
      .update({ signed_back_in_at: new Date().toISOString() })
      .is("signed_back_in_at", null)
      .gte("signed_out_at", start)
      .lte("signed_out_at", end)

    if (error) {
      console.error("Database error during reset:", error)
      return NextResponse.json({ error: "Failed to reset day" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Day reset: all currently signed-out students have been marked back in.",
    })
  } catch (error) {
    console.error("Reset day error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
