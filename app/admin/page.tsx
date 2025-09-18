"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AppIcon } from "@/components/icons"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

interface SignOutRecord {
  id: string
  student_id: string
  signed_out_at: string
  signed_back_in_at: string | null
  signature_url?: string | null
  student?: { first_name: string; last_name: string; class_id: string }
  // sometimes API may return 'students' (legacy shape) with nested classes
  students?: { first_name: string; last_name: string; class_id?: string; classes?: { name: string } }
}

interface Student {
  id: string
  first_name: string
  last_name: string
  classes: { name: string }
  sign_out_records: Array<{ id: string; signed_out_at: string; signer_name: string }>
}

type AdminTab = 'records' | 'students' | 'history'

interface HistoryDay {
  day: string
  created_at: string
}

const TABS = ['records','students','history'] as const

export default function AdminDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [records, setRecords] = useState<SignOutRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [historyDays, setHistoryDays] = useState<Array<{ day: string; created_at: string }>>([])
  // Derive active tab from the URL (?tab=students|records|history) with a state mirror for immediate UI reactivity
  const initialTabParam = searchParams.get('tab')
  const initialTab = (initialTabParam === 'students' ? 'students' : initialTabParam === 'history' ? 'history' : 'records') as 'records' | 'students' | 'history'
  const [activeTab, setActiveTab] = useState<'records' | 'students' | 'history'>(initialTab)
  const [loading, setLoading] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Status filter UI state
  const [filterClass, setFilterClass] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'name' | 'class' | 'status'>('name')

  // Keep state in sync if user changes the tab param manually (back/forward nav)
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    const nextTab: 'records' | 'students' | 'history' = urlTab === 'students' ? 'students' : urlTab === 'history' ? 'history' : 'records'
    if (nextTab !== activeTab) setActiveTab(nextTab)
  }, [searchParams, activeTab])

  const recordsAbortRef = useRef<AbortController | null>(null)
  const studentsAbortRef = useRef<AbortController | null>(null)

  const fetchRecords = async () => {
    try {
      setLoading(true)
      setLoadingRecords(true)
      if (recordsAbortRef.current) recordsAbortRef.current.abort()
      const controller = new AbortController()
      recordsAbortRef.current = controller
      const response = await fetch(`/api/admin/records?ts=${Date.now()}`, { cache: 'no-store', signal: controller.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch records')
      const normalized: SignOutRecord[] = (data.records || []).map((r: any) => {
        if (!r.student && r.students) {
          return {
            ...r,
            student: {
              first_name: r.students.first_name,
              last_name: r.students.last_name,
              class_id: r.students.class_id || r.students.classes?.name || 'Unknown'
            }
          }
        }
        return r
      })
      setRecords(normalized)
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Error fetching records:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch records')
    } finally {
      setLoading(false)
      setLoadingRecords(false)
    }
  }

  const fetchStudents = async () => {
    try {
      setLoading(true)
      setLoadingStudents(true)
      if (studentsAbortRef.current) studentsAbortRef.current.abort()
      const controller = new AbortController()
      studentsAbortRef.current = controller
      const response = await fetch(`/api/admin/students?ts=${Date.now()}`, { cache: 'no-store', signal: controller.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch students')
      const todayStr = new Date().toDateString()
      const normalized = (data.students || []).map((s: Student) => ({
        ...s,
        sign_out_records: (s.sign_out_records || []).filter(r => new Date(r.signed_out_at).toDateString() === todayStr)
      }))
      setStudents(normalized)
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Error fetching students:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch students')
    } finally {
      setLoading(false)
      setLoadingStudents(false)
    }
  }

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setLoadingHistory(true)
      const res = await fetch(`/api/history?ts=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to fetch history')
      setHistoryDays(j.days || [])
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      console.error('Error fetching history:', e)
      setError(e.message)
    } finally {
      setLoading(false)
      setLoadingHistory(false)
    }
  }, [])

  // Consolidated effect for tab data loading (replaces previous two effects)
  useEffect(() => {
    if (activeTab === 'records') fetchRecords()
    else if (activeTab === 'students') fetchStudents()
    else fetchHistory()
  }, [activeTab, fetchHistory])

  const handleSelectTab = (tab: 'records' | 'students' | 'history') => {
    setActiveTab(tab)
    router.replace(`/admin?tab=${tab}`)
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const todayStr = new Date().toDateString()
  const getStudentStatus = (student: Student) => {
    const today = new Date().toDateString()
    const hasOpenToday = student.sign_out_records.some(r => new Date(r.signed_out_at).toDateString() === today && !(r as any).signed_back_in_at)
    return hasOpenToday ? 'Signed Out' : 'Present'
  }
  const getCurrentlySignedOutStudents = () => students.filter(s => getStudentStatus(s) === 'Signed Out')
  const getTodaysRecords = () => {
    const today = new Date().toDateString()
    return records.filter((record) => new Date(record.signed_out_at).toDateString() === today)
  }

  // Derived and memoized values for filtered and sorted students list
  const filteredStudents = useMemo(() => {
    let list = [...students]
    if (filterClass !== 'ALL') list = list.filter(s => s.classes.name === filterClass)
    if (filterStatus !== 'ALL') list = list.filter(s => getStudentStatus(s) === filterStatus)
    if (sortBy === 'name') list.sort((a,b)=> (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
    else if (sortBy === 'class') list.sort((a,b)=> a.classes.name.localeCompare(b.classes.name) || (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
    else if (sortBy === 'status') list.sort((a,b)=> getStudentStatus(a).localeCompare(getStudentStatus(b)) || (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
    return list
  }, [students, filterClass, filterStatus, sortBy])

  if (loading && records.length === 0 && students.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-medium text-gray-600">Loading...</div>
      </div>
    )
  }

  function HistoryList() {
    return (
      <div className="mt-4">
        {loadingHistory && <div className="text-sm text-gray-500">Loading history…</div>}
        {!loadingHistory && !historyDays.length && <div className="text-sm text-gray-500">No archives yet.</div>}
        <ul className="divide-y border rounded bg-white">
          {historyDays.map(d => (
            <li key={d.day} className="flex items-center justify-between px-4 py-2">
              <span>{d.day}</span>
              <a className="text-blue-600 hover:underline text-sm" href={`/admin/history/${d.day}`}>View</a>
            </li>
          ))}
        </ul>
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
                className="w-full justify-start text-left gap-2"
              >
                <AppIcon name="records" size={18} className="text-current" />
                <span>Sign-Out Records</span>
              </Button>
              <Button
                aria-current={activeTab === "students"}
                variant={activeTab === "students" ? "default" : "ghost"}
                onClick={() => handleSelectTab("students")}
                className="w-full justify-start text-left gap-2"
              >
                <AppIcon name="students" size={18} />
                <span>Student Status</span>
              </Button>
              <Button
                aria-current={activeTab === "history"}
                variant={activeTab === "history" ? "default" : "ghost"}
                onClick={() => handleSelectTab("history")}
                className="w-full justify-start text-left gap-2"
              >
                <AppIcon name="history" size={18} />
                <span>History</span>
              </Button>
              <Link href="/admin/students" className="block">
                <Button variant="ghost" className="w-full justify-start text-left gap-2">
                  <AppIcon name="manageStudents" size={18} />
                  <span>Manage Students</span>
                </Button>
              </Link>
              <Link href="/" className="block">
                <Button variant="ghost" className="w-full justify-start text-left gap-2">
                  <AppIcon name="home" size={18} />
                  <span>Back to Kiosk</span>
                </Button>
              </Link>
            </nav>
          </div>
        </div>

        <div className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
              <span className="inline-flex items-center gap-1 text-gray-600"><AppIcon name="breadcrumbHome" size={14} /> Home</span>
              <span>/</span>
              <span>Dashboard</span>
              <span>/</span>
              <span className="text-blue-600 font-medium">{activeTab === "records" ? "Records" : activeTab === "students" ? "Students" : "History"}</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {activeTab === "records" ? "Sign-Out Records" : activeTab === "students" ? "Student Status" : "History"}
                </h1>
              </div>
              <div className="flex gap-3">
                {activeTab !== 'history' && (
                  <Button onClick={() => setShowResetConfirm(true)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium gap-2" variant="outline">
                    <AppIcon name="reset" size={18} />
                    <span>Reset Day</span>
                  </Button>
                )}
                <Button
                  onClick={downloadDailyData}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium gap-2"
                  variant="outline"
                >
                  <AppIcon name="export" size={18} />
                  <span>Export</span>
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
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600"><AppIcon name="metricSignedOut" size={18} /></div>
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
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"><AppIcon name="metricTodays" size={18} /></div>
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
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600"><AppIcon name="metricStudents" size={18} /></div>
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
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600"><AppIcon name="metricRecords" size={18} /></div>
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
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Sign-Out Time</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Sign-Back In Time</th>
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
                      {records.map(record => {
                        const s = record.student || record.students
                        const hasClasses = (obj: any): obj is { classes: { name: string } } => !!obj && typeof obj === 'object' && 'classes' in obj && obj.classes && typeof obj.classes.name === 'string'
                        const studentName = s ? `${s.first_name} ${s.last_name}` : 'Unknown'
                        const classLabel = s?.class_id || (hasClasses(s) ? s.classes.name : '—')
                        const signatureSrc = (record as any).signature_data || record.signature_url || null
                        return (
                          <tr key={record.id} className="border-b last:border-none">
                            <td className="p-4 text-sm text-gray-700">{studentName}</td>
                            <td className="p-4 text-sm text-gray-600">{classLabel}</td>
                            <td className="p-4 text-sm text-gray-600">{new Date(record.signed_out_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                            <td className="p-4 text-sm text-gray-600">{record.signed_back_in_at ? new Date(record.signed_back_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                            <td className="p-4">
                              {signatureSrc ? (
                                <div className="w-16 h-10 relative group cursor-pointer" onClick={() => setSelectedSignature(signatureSrc!)}>
                                  <img src={signatureSrc} alt="Signature" className="object-contain w-full h-full border rounded group-hover:border-blue-500" />
                                </div>
                              ) : <span className="text-xs text-gray-400">None</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {records.length === 0 && <div className="text-center py-12 text-gray-500">No records found</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "students" && (
            <>
              <div className="mb-4 flex flex-wrap gap-3 items-end">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-600 mb-1">Class</label>
                  <select value={filterClass} onChange={e=>setFilterClass(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white">
                    <option value="ALL">All</option>
                    <option value="KA">KA</option>
                    <option value="KB">KB</option>
                    <option value="KC">KC</option>
                    <option value="KD">KD</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white">
                    <option value="ALL">All</option>
                    <option value="Present">Present</option>
                    <option value="Signed Out">Signed Out</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-600 mb-1">Sort By</label>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="border rounded px-2 py-1 text-sm bg-white">
                    <option value="name">Name</option>
                    <option value="class">Class</option>
                    <option value="status">Status</option>
                  </select>
                </div>
                <Button variant="outline" className="h-8 px-3 text-xs" onClick={()=>{setFilterClass('ALL');setFilterStatus('ALL');setSortBy('name')}}>Reset Filters</Button>
              </div>
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
                              <td className="p-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                              <td className="p-4"><div className="h-4 bg-gray-200 rounded w-10" /></td>
                            </tr>
                          ))
                        )}
                        {filteredStudents.map((student) => {
                          const status = getStudentStatus(student)
                          const todays = student.sign_out_records
                          const lastRecord = todays[0]
                          return (
                            <tr key={student.id} className="hover:bg-gray-50">
                              <td className="p-4 text-sm text-gray-900">{student.first_name} {student.last_name}</td>
                              <td className="p-4 text-sm text-gray-600">{student.classes.name}</td>
                              <td className="p-4">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{status}</span>
                              </td>
                              <td className="p-4 text-sm text-gray-600">{lastRecord ? formatDateTime(lastRecord.signed_out_at) : 'Never signed out'}</td>
                              <td className="p-4 text-sm text-gray-600">{todays.length}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {students.length === 0 && <div className="text-center py-12 text-gray-500">No students found</div>}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'history' && (
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Day</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Created</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loadingHistory && historyDays.length === 0 && (
                        [...Array(5)].map((_,i)=>(
                          <tr key={i} className="animate-pulse">
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-32"/></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-48"/></td>
                            <td className="p-4"><div className="h-8 bg-gray-200 rounded w-20"/></td>
                          </tr>
                        ))
                      )}
                      {historyDays.map(d => (
                        <tr key={d.day} className="hover:bg-gray-50">
                          <td className="p-4 text-sm text-gray-900">{d.day}</td>
                          <td className="p-4 text-sm text-gray-600">{new Date(d.created_at).toLocaleString()}</td>
                          <td className="p-4 text-sm">
                            <Link href={`/admin/history/${d.day}`} className="text-blue-600 hover:underline">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!loadingHistory && historyDays.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No history archives yet</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-4 w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset Day</h3>
            <p className="text-sm text-gray-600 mb-4">Archive all of today's sign-outs to History and set every student back to Present?</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={()=>setShowResetConfirm(false)}>Cancel</Button>
              <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" disabled={resetting} onClick={async()=>{ setResetting(true); try { const res = await fetch('/api/reset-day',{method:'POST'}); const j= await res.json(); if(!res.ok) throw new Error(j.error||'Reset failed'); await fetchRecords(); await fetchStudents(); await fetchHistory(); setStudents(prev=>prev.map(s=>({...s, sign_out_records:[]}))); setSuccessMsg(`Day archived (${j.archived}) and statuses reset.`); setShowResetConfirm(false);} catch(e:any){ setErrorMsg(e.message);} finally { setResetting(false);} }}> {resetting? 'Resetting...' : 'Confirm'} </Button>
            </div>
          </div>
        </div>
      )}

      {successMsg && (<div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow" onClick={()=>setSuccessMsg(null)}>{successMsg}</div>)}
      {errorMsg && (<div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded shadow" onClick={()=>setErrorMsg(null)}>{errorMsg}</div>)}
    </div>
  )
}
