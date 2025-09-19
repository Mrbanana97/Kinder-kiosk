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

const NAVIGATION = [
  { id: 'records' as const, label: 'Records', icon: 'records' as const },
  { id: 'students' as const, label: 'Students', icon: 'students' as const },
  { id: 'history' as const, label: 'History', icon: 'history' as const },
]

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
      <div className="min-h-screen background-sky-radial flex items-center justify-center">
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
          {historyDays.map((d) => (
            <li key={d.day} className="flex items-center justify-between px-4 py-2">
              <span className="text-sm font-medium text-slate-600">{d.day}</span>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-[0_6px_12px_rgba(54,92,255,0.18)] transition hover:border-primary/40 hover:bg-primary/20"
                href={`/admin/history/${d.day}`}
              >
                <AppIcon name="history" size={14} />
                View
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const renderRecordsSection = () => (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_22px_45px_rgba(54,92,255,0.08)]">
        <div className="overflow-x-auto px-4 py-3 md:px-5 md:py-4">
          <table className="min-w-full border-separate border-spacing-0 text-sm text-slate-600">
            <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left first:rounded-tl-[28px]">Student</th>
                <th className="px-6 py-4 text-left">Class</th>
                <th className="px-6 py-4 text-left">Signed By</th>
                <th className="px-6 py-4 text-left">Signed Out</th>
                <th className="px-6 py-4 text-left">Signed Back In</th>
                <th className="px-6 py-4 text-left last:rounded-tr-[28px]">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRecords && records.length === 0
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, cellIdx) => (
                        <td key={cellIdx} className="px-6 py-4">
                          <div className="h-4 w-full rounded-full bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : records.map((record) => {
                    const studentInfo = (record as any).student || (record as any).students || null
                    const studentName = studentInfo ? `${studentInfo.first_name} ${studentInfo.last_name}` : 'Unknown'
                    const classLabel =
                      (studentInfo && (studentInfo as any).classes?.name) ||
                      (studentInfo && (studentInfo as any).class_name) ||
                      studentInfo?.class_id ||
                      '—'
                    const signatureSrc = (record as any).signature_data || (record as any).signature_url || null
                    const signedOut = formatDateTime(record.signed_out_at)
                    const signedIn = record.signed_back_in_at ? formatDateTime(record.signed_back_in_at) : '—'
                    return (
                      <tr key={record.id} className="transition-colors hover:bg-primary/5">
                        <td className="px-6 py-4 font-medium text-slate-900">{studentName}</td>
                        <td className="px-6 py-4 text-slate-500">{classLabel}</td>
                        <td className="px-6 py-4 text-slate-500">{record.signer_name || '—'}</td>
                        <td className="px-6 py-4 text-slate-600">{signedOut}</td>
                        <td className="px-6 py-4 text-slate-600">{signedIn}</td>
                        <td className="px-6 py-4">
                          {signatureSrc ? (
                            <Button
                              onClick={() => setSelectedSignature(signatureSrc)}
                              className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                              variant="outline"
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
        {!loadingRecords && records.length === 0 && (
          <div className="px-5 py-8 text-center text-slate-500">No sign-outs recorded today.</div>
        )}
      </div>
    </div>
  )

  const renderStudentsSection = () => (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_32px_rgba(54,92,255,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary/60">Roster Filters</p>
            <h3 className="text-lg font-semibold text-slate-900">Refine the student list</h3>
            <p className="text-sm text-slate-500">Choose a class, status, or sort preference to tailor the roster.</p>
          </div>
          <Button
            variant="outline"
            className="pill-button border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
            onClick={() => {
              setFilterClass('ALL')
              setFilterStatus('ALL')
              setSortBy('name')
            }}
          >
            Reset Filters
          </Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Class</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All</option>
              <option value="KA">KA</option>
              <option value="KB">KB</option>
              <option value="KC">KC</option>
              <option value="KD">KD</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All</option>
              <option value="Present">Present</option>
              <option value="Signed Out">Signed Out</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="name">Name</option>
              <option value="class">Class</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_22px_45px_rgba(54,92,255,0.08)]">
        <div className="overflow-x-auto px-4 py-3 md:px-5 md:py-4">
          <table className="min-w-full border-separate border-spacing-0 text-sm text-slate-600">
            <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left first:rounded-tl-[28px]">Student</th>
                <th className="px-6 py-4 text-left">Class</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-left">Last Signed Out</th>
                <th className="px-6 py-4 text-left last:rounded-tr-[28px]">Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingStudents && students.length === 0
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {Array.from({ length: 5 }).map((__, cellIdx) => (
                        <td key={cellIdx} className="px-6 py-4">
                          <div className="h-4 w-full rounded-full bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filteredStudents.map((student) => {
                    const status = getStudentStatus(student)
                    const todays = student.sign_out_records
                    const lastRecord = todays[0]
                    return (
                      <tr key={student.id} className="transition-colors hover:bg-primary/5">
                        <td className="px-6 py-4 font-medium text-slate-900">{student.first_name} {student.last_name}</td>
                        <td className="px-6 py-4 text-slate-500">{student.classes.name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              status === 'Present'
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-rose-100 text-rose-600'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{lastRecord ? formatDateTime(lastRecord.signed_out_at) : 'Never signed out'}</td>
                        <td className="px-6 py-4 text-slate-500">{todays.length}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
        {!loadingStudents && filteredStudents.length === 0 && (
          <div className="px-5 py-8 text-center text-slate-500">No students match the current filters.</div>
        )}
      </div>
    </div>
  )

  const renderHistorySection = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadingHistory && historyDays.length === 0
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-32 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100/70" />
            ))
          : historyDays.map((day) => (
              <div
                key={day.day}
                className="rounded-[24px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_36px_rgba(54,92,255,0.08)] transition hover:-translate-y-1 hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{day.day}</p>
                    <p className="text-xs text-slate-500">Created {new Date(day.created_at).toLocaleString()}</p>
                  </div>
                  <Link
                    href={`/admin/history/${day.day}`}
                    className="pill-button border border-primary/20 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
      </div>
      {!loadingHistory && historyDays.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 px-6 py-10 text-center text-slate-500">
          No history archives yet. Reset the day to create your first archive snapshot.
        </div>
      )}
    </div>
  )

  const metricCards = [
    {
      label: 'Currently Signed Out',
      value: loadingStudents ? '—' : getCurrentlySignedOutStudents().length,
      icon: 'metricSignedOut' as const,
      badgeBg: 'bg-rose-100/80',
      badgeText: 'text-rose-500',
    },
    {
      label: "Today's Sign-Outs",
      value: loadingRecords ? '—' : getTodaysRecords().length,
      icon: 'metricTodays' as const,
      badgeBg: 'bg-blue-100/80',
      badgeText: 'text-blue-500',
    },
    {
      label: 'Total Students',
      value: loadingStudents ? '—' : students.length,
      icon: 'metricStudents' as const,
      badgeBg: 'bg-emerald-100/80',
      badgeText: 'text-emerald-600',
    },
    {
      label: 'History Days',
      value: loadingHistory ? '—' : historyDays.length,
      icon: 'metricRecords' as const,
      badgeBg: 'bg-purple-100/80',
      badgeText: 'text-purple-600',
    },
  ]

  const activeNav = NAVIGATION.find((item) => item.id === activeTab)

  return (
    <>
    <div className="min-h-screen px-6 py-8 md:px-12 lg:px-16 background-sky-radial">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 lg:flex-row">
        <aside className="soft-card hidden w-full max-w-xs flex-col gap-4 rounded-[28px] px-4 py-5 sm:px-5 sm:py-6 lg:sticky lg:top-10 lg:flex lg:h-fit lg:w-64 lg:gap-6 lg:self-start">
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
            {NAVIGATION.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => handleSelectTab(item.id)}
                className={`flex w-full items-center gap-4 rounded-[20px] px-4 py-3 text-sm font-semibold transition-all ${
                  activeTab === item.id
                    ? 'bg-primary text-white shadow-[0_12px_24px_rgba(54,92,255,0.22)]'
                    : 'bg-white/70 text-slate-500 hover:bg-primary/10 hover:text-primary'
                }`}
              >
                <AppIcon name={item.icon} size={18} />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </nav>

          <Link
            href="/admin/students"
            aria-label="Manage students"
            className="mt-4 flex w-full items-center gap-3 rounded-[20px] bg-white/70 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-primary/10 hover:text-primary"
          >
            <AppIcon name="manageStudents" size={18} />
            Manage students
          </Link>
        </aside>

        <div className="flex flex-1 flex-col gap-8">
          <header className="soft-card rounded-[32px] py-5">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary/60">Dashboard · {activeNav?.label}</p>
                  <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">Kiosk Admin Overview</h1>
                  <p className="mt-2 text-sm text-slate-500">Monitor daily sign-outs, student statuses, and archive history from one place.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {activeTab !== 'history' && (
                    <Button
                      onClick={() => setShowResetConfirm(true)}
                      className="pill-button border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
                      variant="outline"
                    >
                      <AppIcon name="reset" size={16} />
                      Reset Day
                    </Button>
                  )}
                  <Button
                    onClick={downloadDailyData}
                    className="pill-button bg-primary text-white shadow-[0_12px_24px_rgba(54,92,255,0.26)] hover:bg-primary/90"
                  >
                    <AppIcon name="export" size={16} />
                    Export CSV
                  </Button>
                </div>
              </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-[0_10px_18px_rgba(54,92,255,0.06)]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${card.badgeBg} ${card.badgeText}`}>
                      <AppIcon name={card.icon} size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">{card.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {error && (
              <div className="rounded-[24px] border border-rose-100 bg-rose-50/80 px-6 py-4 text-sm text-rose-600 shadow-[0_10px_24px_rgba(244,63,94,0.1)]">
                {error}
              </div>
            )}

            <section className="soft-card rounded-[32px] py-6">
              {activeTab === 'records' && renderRecordsSection()}
              {activeTab === 'students' && renderStudentsSection()}
              {activeTab === 'history' && renderHistorySection()}
            </section>
          </div>
        </div>
      </div>

      {selectedSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="soft-card mx-4 max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[32px] py-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Digital Signature</h3>
              <Button
                onClick={() => setSelectedSignature(null)}
                className="pill-button border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
                variant="outline"
              >
                Close
              </Button>
            </div>
            <div className="max-h-[65vh] overflow-auto rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <img
                src={selectedSignature || '/placeholder.svg'}
                alt="Digital Signature"
                className="mx-auto h-auto max-h-[55vh] w-full rounded-[16px] border border-slate-200 bg-white object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md">
            <div className="soft-card rounded-[28px] bg-white px-6 py-6 shadow-[0_24px_45px_rgba(15,23,42,0.12)]">
              <h3 className="text-xl font-semibold text-slate-900">Archive & Reset Day</h3>
              <p className="mt-2 text-sm text-slate-500">
                This will archive all current sign-outs into history and mark every student as present.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  className="pill-button flex-1 border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="pill-button flex-1 bg-primary text-white shadow-[0_12px_24px_rgba(54,92,255,0.26)] hover:bg-primary/90"
                  disabled={resetting}
                  onClick={async () => {
                    setResetting(true)
                    try {
                      const res = await fetch('/api/reset-day', { method: 'POST' })
                      const j = await res.json()
                      if (!res.ok) throw new Error(j.error || 'Reset failed')
                      await fetchRecords()
                      await fetchStudents()
                      await fetchHistory()
                      setStudents((prev) => prev.map((s) => ({ ...s, sign_out_records: [] })))
                      setSuccessMsg(`Day archived (${j.archived}) and statuses reset.`)
                      setShowResetConfirm(false)
                    } catch (e: any) {
                      setErrorMsg(e.message)
                    } finally {
                      setResetting(false)
                    }
                  }}
                >
                  {resetting ? 'Resetting…' : 'Confirm Reset'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="fixed bottom-6 right-6 cursor-pointer rounded-full border border-emerald-100 bg-white px-6 py-3 text-sm font-medium text-emerald-600 shadow-[0_12px_32px_rgba(16,185,129,0.18)]"
          onClick={() => setSuccessMsg(null)}
        >
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          role="status"
          className="fixed bottom-6 right-6 cursor-pointer rounded-full border border-rose-100 bg-white px-6 py-3 text-sm font-medium text-rose-600 shadow-[0_12px_32px_rgba(244,63,94,0.18)]"
          onClick={() => setErrorMsg(null)}
        >
          {errorMsg}
        </div>
      )}
    </>
  )
}
