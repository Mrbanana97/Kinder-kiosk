"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { AppIcon } from "@/components/icons"
import { ALLOWED_CLASS_NAMES } from "@/lib/constants"

interface Class {
  id: string
  name: string
}

interface Student {
  id: string
  first_name: string
  last_name: string
  class_id: string
  created_at: string
}

export default function StudentManagement() {
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form states
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [selectedClassId, setSelectedClassId] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)

  const supabase = createClient()

  const navLinks = [
    { id: 'records' as const, href: '/admin?tab=records', icon: 'records' as const, label: 'Records' },
    { id: 'students' as const, href: '/admin?tab=students', icon: 'students' as const, label: 'Students' },
    { id: 'history' as const, href: '/admin?tab=history', icon: 'history' as const, label: 'History' },
  ]

  useEffect(() => {
    fetchClasses()
    fetchStudents()
  }, [])

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase.from("classes").select("*").order("name")
      if (error) throw error
      setClasses(data || [])
    } catch (error) {
      console.error("Error fetching classes:", error)
      setError("Failed to load classes")
    }
  }

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          classes(name)
        `)
        .order("last_name")

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error("Error fetching students:", error)
      setError("Failed to load students")
    } finally {
      setLoading(false)
    }
  }

  const handleAddSingleStudent = async () => {
    if (!firstName.trim() || !lastName.trim() || !selectedClassId) {
      setError("Please fill in all fields")
      return
    }

    try {
      setLoading(true)
      const response = await fetch("/api/admin/students/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: [
            {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              class_id: selectedClassId,
            },
          ],
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      setSuccess("Student added successfully!")
      setFirstName("")
      setLastName("")
      setSelectedClassId("")
      fetchStudents()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add student")
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setCsvFile(file)
    }
  }

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setError("Please select a CSV file")
      return
    }

    try {
      setLoading(true)
      const text = await csvFile.text()
      const lines = text.trim().split("\n")
      const students = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const [lastName, firstName, classPart, subClass] = line.split(",").map((s) => s.trim())

        if (!lastName || !firstName || !classPart) {
          throw new Error(`Invalid data on line ${i + 1}: ${line}`)
        }

        // Combine class and subclass to form the full class name (e.g., "K" + "B" = "KB")
        // Limit to 10 characters to match database constraint
        let className = subClass ? `${classPart}${subClass}` : classPart
        console.log(`Original className: "${className}" (${className.length} chars)`)
        if (className.length > 10) {
          className = className.substring(0, 10)
          console.log(`Truncated className: "${className}" (${className.length} chars)`)
        }

        // Enforce allowed class whitelist
    if (!ALLOWED_CLASS_NAMES.includes(className.toUpperCase() as any)) {
          throw new Error(
      `Class "${className}" is not allowed. Allowed classes: ${ALLOWED_CLASS_NAMES.join(", ")}`,
          )
        }

        // Find class by name (case-insensitive)
        let classObj = classes.find((c) => c.name.toLowerCase() === className.toLowerCase())
        
        // If class doesn't exist, create it
  if (!classObj) {
          try {
            const response = await fetch("/api/classes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: className }),
            })
            
            if (response.ok) {
              const result = await response.json()
              classObj = result.class
              // Add to local classes array
              if (classObj) {
                setClasses(prev => [...prev, classObj as Class])
              }
            } else {
              throw new Error(`Failed to create class "${className}"`)
            }
          } catch (error) {
            throw new Error(`Class "${className}" not found and could not be created on line ${i + 1}. Available classes: ${classes.map(c => c.name).join(', ')}`)
          }
        }

        students.push({
          first_name: firstName,
          last_name: lastName,
          class_id: classObj!.id,
        })
      }

      const response = await fetch("/api/admin/students/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      setSuccess(`Successfully added ${students.length} students!`)
      setCsvFile(null)
      fetchStudents()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to upload students")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    // Use a more CSP-friendly confirmation
    const confirmed = window.confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)
    if (!confirmed) {
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      console.log("[v0] Starting delete process for student:", studentId, studentName)

      const response = await fetch("/api/admin/students/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete student")
      }

      console.log("[v0] Student successfully deleted via API")

      // Optimistically remove from UI and avoid immediate refetch to prevent stale data flash
      setStudents((prevStudents) => prevStudents.filter((s) => s.id !== studentId))
      setSuccess(`Student ${studentName} deleted successfully!`)
    } catch (error) {
      console.error("[v0] Error in delete process:", error)
      setError(error instanceof Error ? error.message : "Failed to delete student")
      setSuccess(null)
    } finally {
      setLoading(false)
    }
  }

  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeTab = (() => {
    if (pathname === '/admin/students') return 'students'
    const tabParam = searchParams?.get('tab')
    if (tabParam === 'students' || tabParam === 'history') return tabParam
    return 'records'
  })()

  return (
    <div className="min-h-screen px-6 py-10 md:px-10 lg:px-16 background-sky-radial">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-8 lg:flex-row">
        <aside className="soft-card hidden w-full max-w-xs flex-col gap-4 rounded-[28px] px-5 py-6 sm:px-6 sm:py-8 lg:sticky lg:top-10 lg:flex lg:h-fit lg:w-64 lg:gap-6 lg:self-start">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (window.location.href = '/')}
              aria-label="Back to kiosk"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_12px_24px_rgba(54,92,255,0.32)] transition hover:scale-[1.03]"
            >
              <AppIcon name="breadcrumbHome" size={18} />
            </button>
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/60">Back</p>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="text-sm font-semibold text-slate-700 hover:text-primary"
              >
                Return to kiosk
              </button>
            </div>
          </div>

          <nav className="mt-6 flex w-full flex-col gap-2 rounded-[24px] border border-slate-200 bg-white/80 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            {navLinks.map((link) => {
              const isActive = activeTab === link.id
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  aria-label={link.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-4 rounded-[20px] px-4 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-[0_12px_24px_rgba(54,92,255,0.22)]'
                      : 'bg-white/70 text-slate-500 hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <AppIcon name={link.icon} size={18} />
                  <span className="text-sm">{link.label}</span>
                </Link>
              )
            })}
          </nav>

          <Link
            href="/admin/students"
            aria-label="Manage students"
            aria-current="page"
            className="mt-4 flex w-full items-center gap-3 rounded-[20px] bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(54,92,255,0.22)]"
          >
            <AppIcon name="manageStudents" size={18} />
            Manage students
          </Link>
        </aside>

        <main className="flex flex-1 flex-col gap-8">
            <header className="soft-card rounded-[32px] px-8 py-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary/60">Admin · Manage Students</p>
                  <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">Roster Management</h1>
                  <p className="mt-2 text-sm text-slate-500">Add individual students, import rosters, and curate the current class list.</p>
                </div>
                <Button
                  asChild
                  className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(54,92,255,0.2)] transition hover:bg-primary/90"
                >
                  <Link href="/admin?tab=records">Back to Dashboard</Link>
                </Button>
              </div>
            </header>

            {error && (
              <div className="rounded-[24px] border border-rose-100 bg-rose-50/80 px-6 py-4 text-sm text-rose-600 shadow-[0_10px_24px_rgba(244,63,94,0.1)]">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/80 px-6 py-4 text-sm text-emerald-600 shadow-[0_10px_24px_rgba(16,185,129,0.1)]">
                {success}
              </div>
            )}

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="soft-card rounded-[28px] p-8">
                <h3 className="text-xl font-semibold text-slate-900">Add Single Student</h3>
                <p className="mt-2 text-sm text-slate-500">Perfect for quick additions or last-minute enrollments.</p>
                <div className="mt-6 space-y-4">
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select class</option>
                    {classes
                      .filter((c) => ALLOWED_CLASS_NAMES.includes(c.name.toUpperCase() as any))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                  </select>
                  <Button
                    onClick={handleAddSingleStudent}
                    disabled={loading}
                    className="h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-white shadow-[0_18px_32px_rgba(54,92,255,0.28)] hover:bg-primary/90 disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {loading ? 'Adding…' : 'Add Student'}
                  </Button>
                </div>
              </div>

              <div className="soft-card rounded-[28px] p-8">
                <h3 className="text-xl font-semibold text-slate-900">Bulk Upload via CSV</h3>
                <p className="mt-2 text-sm text-slate-500">Upload a spreadsheet export to add multiple students at once.</p>
                <div className="mt-6 space-y-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
                  />
                  <Button
                    onClick={handleCsvUpload}
                    disabled={loading || !csvFile}
                    className="h-12 w-full rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(16,185,129,0.25)] hover:bg-emerald-500/90 disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {loading ? 'Uploading…' : 'Upload CSV'}
                  </Button>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-600">
                    <p className="font-semibold text-slate-700">CSV format tips</p>
                    <ul className="mt-2 space-y-2">
                      <li>Header: <code className="rounded bg-white px-2 py-1">Last Name, First Name, Class, Subclass</code></li>
                      <li>Row example: <code className="rounded bg-white px-2 py-1">Doe, Jane, K, B</code></li>
                      <li>Allowed classes: {ALLOWED_CLASS_NAMES.join(', ')}.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="soft-card rounded-[32px] p-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Current Students</h3>
                  <p className="text-sm text-slate-500">{students.length} active records</p>
                </div>
                <Button
                  variant="outline"
                  onClick={fetchStudents}
                  className="pill-button border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
                >
                  Refresh list
                </Button>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <div className="overflow-x-auto">
                  {loading ? (
                    <table className="min-w-full text-sm text-slate-600">
                      <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-6 py-4 text-left">Student</th>
                          <th className="px-6 py-4 text-left">Class</th>
                          <th className="px-6 py-4 text-left">Created</th>
                          <th className="px-6 py-4 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse">
                            {Array.from({ length: 4 }).map((__, cIdx) => (
                              <td key={cIdx} className="px-6 py-4">
                                <div className="h-4 w-full rounded-full bg-slate-100" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : students.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-500">No students found. Add a student to get started.</div>
                  ) : (
                    <table className="min-w-full text-sm text-slate-600">
                      <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-6 py-4 text-left">Student</th>
                          <th className="px-6 py-4 text-left">Class</th>
                          <th className="px-6 py-4 text-left">Created</th>
                          <th className="px-6 py-4 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((student) => (
                          <tr key={student.id} className="transition-colors hover:bg-primary/5">
                            <td className="px-6 py-4 font-medium text-slate-900">{student.first_name} {student.last_name}</td>
                            <td className="px-6 py-4 text-slate-500">{(student as any).classes?.name || 'Unknown'}</td>
                            <td className="px-6 py-4 text-slate-500">{new Date(student.created_at).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                              <Button
                                onClick={() => handleDeleteStudent(student.id, `${student.first_name} ${student.last_name}`)}
                                className="rounded-full bg-rose-500 px-4 py-1 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(244,63,94,0.18)] hover:bg-rose-500/90"
                                size="sm"
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
  )

}
