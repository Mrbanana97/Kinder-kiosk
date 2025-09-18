"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
          <div className="space-y-2">
            <div
              className="flex items-center space-x-2 p-2 cursor-pointer"
              onClick={() => (window.location.href = "/")}
            >
              <img src="/icon-192.png" alt="Kiosk Logo" className="w-8 h-8" />
              <span className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">Kiosk Admin</span>
            </div>
            <nav className="space-y-1 mt-8">
              <Link href="/admin?tab=records" className="block">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                >
                  📋 Sign-Out Records
                </Button>
              </Link>
              <Link href="/admin?tab=students" className="block">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                >
                  👥 Student Status
                </Button>
              </Link>
              <Button variant="default" className="w-full justify-start text-left">
                ⚙️ Manage Students
              </Button>
              <Button
                variant="ghost"
                onClick={() => (window.location.href = "/")}
                className="w-full justify-start text-left"
              >
                🏠 Back to Kiosk
              </Button>
            </nav>
          </div>
        </div>

        <div className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
              <span>🏠 Home</span>
              <span>/</span>
              <span>Dashboard</span>
              <span>/</span>
              <span className="text-blue-600 font-medium">Manage Students</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Students</h1>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Add Single Student */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Add Single Student</h3>
                <p className="text-sm text-gray-600 mt-1">Add a new student to the system</p>
              </div>
              <div className="p-6 space-y-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Class</option>
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
                  className="w-full h-10 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg"
                >
                  {loading ? "Adding..." : "Add Student"}
                </Button>
              </div>
            </div>

            {/* CSV Upload */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">CSV Upload</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Format: Lastname, Firstname, class, subclass (one per line)
                  <br />
                  Example: Sturn, Ava, K, B (creates class "KB")
                  <br />
                  <span className="text-xs text-orange-600">Note: Class names are limited to 10 characters</span>
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  {csvFile && (
                    <p className="text-sm text-green-600">
                      Selected: {csvFile.name}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleCsvUpload}
                  disabled={loading || !csvFile}
                  className="w-full h-10 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg"
                >
                  {loading ? "Uploading..." : "Upload Students"}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">All Students ({students.length})</h3>
                <p className="text-sm text-gray-600 mt-1">Complete list of enrolled students</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Student</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Class</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Created</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[...Array(6)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-40" /></td>
                        <td className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                        <td className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                        <td className="px-6 py-3"><div className="h-8 bg-gray-200 rounded w-16" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">No students found</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Student</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Class</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Created</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-900 font-medium">{student.first_name} {student.last_name}</td>
                        <td className="px-6 py-3 text-gray-600">{(student as any).classes?.name || 'Unknown'}</td>
                        <td className="px-6 py-3 text-gray-500">
                          {new Date(student.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3">
                          <Button
                            onClick={() => handleDeleteStudent(student.id, `${student.first_name} ${student.last_name}`)}
                            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
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
        </div>
      </div>
    </div>
  )
}
