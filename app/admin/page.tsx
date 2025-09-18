"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

interface SignOutRecord {
  id: string
  student_id: string
  signer_name: string
  signature_data: string | null
  signed_out_at: string
  students: {
    first_name: string
    last_name: string
    classes: {
      name: string
    }
  }
}

interface Student {
  id: string
  first_name: string
  last_name: string
  classes: {
    name: string
  }
  sign_out_records: Array<{
    id: string
    signed_out_at: string
    signer_name: string
  }>
}

export default function AdminDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [records, setRecords] = useState<SignOutRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  // Derive active tab from the URL (?tab=students|records) with a state mirror for immediate UI reactivity
  const initialTab = (searchParams.get("tab") === "students" ? "students" : "records") as "records" | "students"
  const [activeTab, setActiveTab] = useState<"records" | "students">(initialTab)
  const [loading, setLoading] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Keep state in sync if user changes the tab param manually (back/forward nav)
  useEffect(() => {
    const urlTab = searchParams.get("tab")
    const nextTab: "records" | "students" = urlTab === "students" ? "students" : "records"
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [searchParams, activeTab])

  useEffect(() => {
    if (activeTab === "records") {
      fetchRecords()
    } else {
      fetchStudents()
    }
  }, [activeTab])

  const handleSelectTab = (tab: "records" | "students") => {
    // Optimistically update state
    setActiveTab(tab)
    // Update the URL (replace to avoid history stack bloat when simply switching tabs)
    router.replace(`/admin?tab=${tab}`)
  }

  const recordsAbortRef = useRef<AbortController | null>(null)
  const studentsAbortRef = useRef<AbortController | null>(null)

  const fetchRecords = async () => {
    try {
      setLoading(true)
      setLoadingRecords(true)
      // Abort previous in-flight
      if (recordsAbortRef.current) {
        recordsAbortRef.current.abort()
      }
      const controller = new AbortController()
      recordsAbortRef.current = controller
      const response = await fetch(`/api/admin/records?ts=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch records")
      }

      setRecords(data.records)
    } catch (error) {
      console.error("Error fetching records:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch records")
    } finally {
      setLoading(false)
      setLoadingRecords(false)
    }
  }

  const fetchStudents = async () => {
    try {
      setLoading(true)
      setLoadingStudents(true)
      if (studentsAbortRef.current) {
        studentsAbortRef.current.abort()
      }
      const controller = new AbortController()
      studentsAbortRef.current = controller
      const response = await fetch(`/api/admin/students?ts=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch students")
      }

      setStudents(data.students)
    } catch (error) {
      console.error("Error fetching students:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch students")
    } finally {
      setLoading(false)
      setLoadingStudents(false)
    }
  }

  const downloadDailyData = async () => {
    try {
      const response = await fetch("/api/admin/download-daily")

      if (!response.ok) {
        throw new Error("Failed to download data")
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get("content-disposition")
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : `kindergarten-signouts-${new Date().toISOString().split("T")[0]}.csv`

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error downloading data:", error)
      setError("Failed to download daily data")
    }
  }

  const handleResetDay = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/reset-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to reset day")
      }

      // Refresh data after reset
      if (activeTab === "records") {
        await fetchRecords()
      } else {
        await fetchStudents()
      }

      setShowResetConfirm(false)
      setError(null)
    } catch (error) {
      console.error("Reset day error:", error)
      setError(error instanceof Error ? error.message : "Failed to reset day")
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStudentStatus = (student: Student) => {
    const hasActiveRecord = student.sign_out_records.length > 0
    return hasActiveRecord ? "signed-out" : "present"
  }

  const getCurrentlySignedOutStudents = () => {
    return students.filter((student) => getStudentStatus(student) === "signed-out")
  }

  const getTodaysRecords = () => {
    const today = new Date().toDateString()
    return records.filter((record) => new Date(record.signed_out_at).toDateString() === today)
  }

  if (loading && records.length === 0 && students.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-medium text-gray-600">Loading...</div>
      </div>
    )
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
              <Button
                aria-current={activeTab === "records"}
                variant={activeTab === "records" ? "default" : "ghost"}
                onClick={() => handleSelectTab("records")}
                className="w-full justify-start text-left"
              >
                📋 Sign-Out Records
              </Button>
              <Button
                aria-current={activeTab === "students"}
                variant={activeTab === "students" ? "default" : "ghost"}
                onClick={() => handleSelectTab("students")}
                className="w-full justify-start text-left"
              >
                👥 Student Status
              </Button>
              <Link href="/admin/students" className="block">
                <Button variant="ghost" className="w-full justify-start text-left">
                  ⚙️ Manage Students
                </Button>
              </Link>
              <Link href="/" className="block">
                <Button variant="ghost" className="w-full justify-start text-left">
                  🏠 Back to Kiosk
                </Button>
              </Link>
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
              <span className="text-blue-600 font-medium">{activeTab === "records" ? "Records" : "Students"}</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {activeTab === "records" ? "Sign-Out Records" : "Student Status"}
                </h1>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowResetConfirm(true)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
                  variant="outline"
                >
                  🔄 Reset Day
                </Button>
                <Button
                  onClick={downloadDailyData}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
                  variant="outline"
                >
                  📥 Export
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Currently Signed Out</p>
                    <p className="text-2xl font-bold text-gray-900">{getCurrentlySignedOutStudents().length}</p>
                  </div>
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 text-sm">👥</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Today's Sign-Outs</p>
                    <p className="text-2xl font-bold text-gray-900">{getTodaysRecords().length}</p>
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-sm">📋</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Students</p>
                    <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                  </div>
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-sm">🎓</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Records</p>
                    <p className="text-2xl font-bold text-gray-900">{records.length}</p>
                  </div>
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 text-sm">📊</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {activeTab === "records" && (
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Student</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Class</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Signed Out By</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Sign-Out Time</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Signature</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loadingRecords && records.length === 0 && (
                        [...Array(6)].map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                            <td className="p-4"><div className="h-8 bg-gray-200 rounded w-16" /></td>
                          </tr>
                        ))
                      )}
                      {records.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="p-4 text-sm text-gray-900">
                            {record.students.first_name} {record.students.last_name}
                          </td>
                          <td className="p-4 text-sm text-gray-600">{record.students.classes.name}</td>
                          <td className="p-4 text-sm text-gray-600">{record.signer_name}</td>
                          <td className="p-4 text-sm text-gray-600">{formatDateTime(record.signed_out_at)}</td>
                          <td className="p-4">
                            {record.signature_data ? (
                              <div className="w-16 h-10 relative group cursor-pointer" onClick={() => setSelectedSignature(record.signature_data)}>
                                <img
                                  src={record.signature_data}
                                  alt="Signature thumbnail"
                                  className="w-full h-full object-contain border border-gray-200 rounded bg-white group-hover:border-blue-400 transition-colors"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded transition-colors" />
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {records.length === 0 && <div className="text-center py-12 text-gray-500">No records found</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "students" && (
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Student</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Class</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Last Sign-Out</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Total Sign-Outs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loadingStudents && students.length === 0 && (
                        [...Array(6)].map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-40" /></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                            <td className="p-4"><div className="h-5 bg-gray-200 rounded w-16" /></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-10" /></td>
                          </tr>
                        ))
                      )}
                      {students.map((student) => {
                        const status = getStudentStatus(student)
                        const lastRecord = student.sign_out_records[0]
                        return (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="p-4 text-sm text-gray-900">
                              {student.first_name} {student.last_name}
                            </td>
                            <td className="p-4 text-sm text-gray-600">{student.classes.name}</td>
                            <td className="p-4">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  status === "present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}
                              >
                                {status === "present" ? "Present" : "Signed Out"}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {lastRecord ? formatDateTime(lastRecord.signed_out_at) : "Never signed out"}
                            </td>
                            <td className="p-4 text-sm text-gray-600">{student.sign_out_records.length}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {students.length === 0 && <div className="text-center py-12 text-gray-500">No students found</div>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-4">
            <div className="text-center space-y-4">
              <div className="text-3xl text-orange-600">⚠️</div>
              <h3 className="text-xl font-bold text-gray-900">Reset Day Confirmation</h3>
              <p className="text-gray-600">
                This will allow all students to be signed out again today. Are you sure you want to reset the day?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetDay}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
                >
                  {loading ? "Resetting..." : "Reset Day"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSignature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl max-h-[80vh] overflow-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Digital Signature</h3>
              <Button
                onClick={() => setSelectedSignature(null)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                variant="outline"
              >
                Close
              </Button>
            </div>
            <img
              src={selectedSignature || "/placeholder.svg"}
              alt="Digital Signature"
              className="max-w-full h-auto border border-gray-200 rounded"
            />
          </div>
        </div>
      )}
    </div>
  )
}
