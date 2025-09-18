import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { ALLOWED_CLASS_NAMES } from "@/lib/constants"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("classes").select("*").order("name")

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 })
    }

    return NextResponse.json({ classes: data || [] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 })
    }

    const trimmedName = String(name).trim().toUpperCase()
    if (!ALLOWED_CLASS_NAMES.includes(trimmedName as any)) {
      return NextResponse.json(
        { error: `Invalid class name. Allowed: ${ALLOWED_CLASS_NAMES.join(", ")}` },
        { status: 400 },
      )
    }

    const supabase = await createClient()

  const { data, error } = await supabase.from("classes").insert([{ name: trimmedName }]).select()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to create class" }, { status: 500 })
    }

    return NextResponse.json({ class: data?.[0] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
