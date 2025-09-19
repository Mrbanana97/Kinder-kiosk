"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { ALLOWED_CLASS_NAMES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import SignaturePad from "@/components/signature-pad"

interface Class {
  id: string
  name: string
}

interface Student {
  id: string
  first_name: string
  last_name: string
  class_id: string
}

export default function KioskHome() {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [signerName, setSignerName] = useState("")
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<"classes" | "students" | "signer" | "signature" | "success">("classes")
  const [loading, setLoading] = useState(true)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const classesAbortRef = useRef<AbortController | null>(null)
  const studentsAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetchClasses()
    return () => {
      classesAbortRef.current?.abort()
      studentsAbortRef.current?.abort()
    }
  }, [])

  const fetchClasses = async () => {
    try {
      setLoadingClasses(true)
      if (classesAbortRef.current) classesAbortRef.current.abort()
      const controller = new AbortController()
      classesAbortRef.current = controller
      const { data, error } = await supabase.from("classes").select("*").order("name")
      if (error) throw error
      const filtered = (data || []).filter((c) => ALLOWED_CLASS_NAMES.includes(c.name.toUpperCase() as any))
      setClasses(filtered)
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return
      console.error("Error fetching classes:", error)
      setError("Failed to load classes")
    } finally {
      setLoading(false)
      setLoadingClasses(false)
    }
  }

  const fetchStudents = async (classId: string) => {
    try {
      setLoadingStudents(true)
      if (studentsAbortRef.current) studentsAbortRef.current.abort()
      const controller = new AbortController()
      studentsAbortRef.current = controller
      const response = await fetch(`/api/students/${classId}?ts=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load students')
      }
      setStudents(result.students || [])
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return
      console.error('Error fetching students:', error)
      setError('Failed to load students')
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleClassSelect = async (selectedClass: Class) => {
    setSelectedClass(selectedClass)
    setError(null)
    await fetchStudents(selectedClass.id)
    setCurrentStep("students")
  }

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student)
    setError(null)
    setCurrentStep("signer")
  }

  const handleSignerSubmit = () => {
    if (signerName.trim()) {
      setError(null)
      setCurrentStep("signature")
    }
  }

  const handleSignatureChange = (signature: string | null) => {
    setSignatureData(signature)
  }

  const handleCompleteSignOut = async () => {
    if (!selectedStudent || !signerName.trim()) {
      setError("Missing required information")
      return
    }

    if (!signatureData) {
      setError("Please provide a signature before completing sign-out")
      return
    }

    try {
      setLoading(true)
      const response = await fetch("/api/sign-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          signer_name: signerName,
          signature_data: signatureData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to complete sign-out")
      }

      // Show success message and reset
      setError(null)
      setTimeout(() => {
        resetToHome()
      }, 1000)

      // Show success state
      setCurrentStep("success")
    } catch (error) {
      console.error("Sign-out error:", error)
      setError(error instanceof Error ? error.message : "Failed to complete sign-out")
    } finally {
      setLoading(false)
    }
  }

  const resetToHome = () => {
    setSelectedClass(null)
    setSelectedStudent(null)
    setSignerName("")
    setSignatureData(null)
    setCurrentStep("classes")
    setError(null)
  }

  if (loading && currentStep === "classes") {
    return (
      <div className="min-h-screen background-sky-radial flex items-center justify-center">
        <div className="soft-card px-8 py-6 text-lg font-medium text-slate-600">Loading kiosk…</div>
      </div>
    )
  }

  const stepDescription = {
    classes: "Select your child's class to begin",
    students: `Choose ${selectedClass?.name} student`,
    signer: `Who is signing out ${selectedStudent?.first_name} ${selectedStudent?.last_name}?`,
    signature: "Capture the digital signature to finish",
    success: "All set – returning to the welcome screen",
  }[currentStep]

  return (
    <div className="min-h-screen px-6 py-10 md:px-10 lg:px-16 background-sky-radial">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="soft-card flex flex-col gap-6 rounded-[32px] px-8 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
              <img src="/icon-192.png" alt="Kiosk Logo" className="h-9 w-9" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-primary/70">Kindergarten kiosk</p>
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">Sign-Out Station</h1>
              <p className="text-sm md:text-base text-slate-500">{stepDescription}</p>
            </div>
          </div>
          <Button
            onClick={() => (window.location.href = "/admin")}
            className="pill-button bg-primary text-white shadow-[0_12px_20px_rgba(54,92,255,0.3)] hover:bg-primary/90"
          >
            Go to Admin
          </Button>
        </header>

        {error && (
          <div className="soft-card border border-red-100 bg-red-50/80 px-6 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <main className="soft-card rounded-[32px] px-8 py-10">
          {/* Progress dots */}
          <div className="mb-10 flex items-center justify-between gap-3">
            {["classes", "students", "signer", "signature", "success"].map((step) => {
              const index = ["classes", "students", "signer", "signature", "success"].indexOf(step)
              const currentIndex = ["classes", "students", "signer", "signature", "success"].indexOf(currentStep)
              const isActive = step === currentStep
              const isCompleted = currentIndex > index
              return (
                <div key={step} className="flex flex-1 items-center last:flex-none">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-primary text-white shadow-[0_10px_25px_rgba(54,92,255,0.35)]"
                        : isCompleted
                          ? "bg-primary/15 text-primary"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </div>
                  {step !== "success" && (
                    <div className="ml-3 hidden flex-1 border-t border-dashed border-slate-200 sm:block" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Step Content */}
          <div className="space-y-8">
            {currentStep === "classes" && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {loadingClasses && classes.length === 0 && (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="h-32 animate-pulse rounded-[26px] border border-slate-200 bg-slate-100/80" />
                  ))
                )}
                {!loadingClasses && classes.map((classItem) => (
                  <Button
                    key={classItem.id}
                    onClick={() => handleClassSelect(classItem)}
                    className="h-32 rounded-[26px] border border-slate-200 bg-white text-4xl font-semibold text-primary shadow-[0_18px_30px_rgba(54,92,255,0.12)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5"
                    variant="outline"
                  >
                    {classItem.name}
                  </Button>
                ))}
                {classes.length === 0 && !loading && (
                  <div className="col-span-full flex h-32 flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-200 bg-white/70 text-slate-500">
                    No classes available
                  </div>
                )}
              </div>
            )}

            {currentStep === "students" && (
              <div className="space-y-6">
                <Button
                  onClick={resetToHome}
                  className="pill-button border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-primary/40 hover:text-primary"
                  variant="outline"
                >
                  ← Back to Classes
                </Button>

                <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_16px_30px_rgba(54,92,255,0.08)]">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {loadingStudents && students.length === 0 && (
                      [...Array(8)].map((_, i) => (
                        <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80" />
                      ))
                    )}
                    {!loadingStudents && students.map((student) => (
                      <Button
                        key={student.id}
                        onClick={() => handleStudentSelect(student)}
                        className="h-20 rounded-2xl border border-slate-200 bg-white text-base font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                        variant="outline"
                      >
                        {student.first_name} {student.last_name}
                      </Button>
                    ))}
                  </div>
                  {students.length === 0 && !loadingStudents && (
                    <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-slate-500">
                      All students from {selectedClass?.name} are currently signed out.
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === "signer" && (
              <div className="mx-auto max-w-2xl space-y-6">
                <Button
                  onClick={() => setCurrentStep("students")}
                  className="pill-button border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-primary/40 hover:text-primary"
                  variant="outline"
                >
                  ← Back to Students
                </Button>

                <div className="rounded-[28px] border border-slate-200 bg-white/90 p-8 shadow-[0_18px_36px_rgba(54,92,255,0.08)]">
                  <div className="space-y-6 text-center">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-primary/60">Signer details</p>
                      <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                        Signing out {selectedStudent?.first_name} {selectedStudent?.last_name}
                      </h2>
                      <p className="mt-2 text-base text-slate-500">Please type your full name so we can record who completed the pick-up.</p>
                    </div>
                    <div className="space-y-4 text-left">
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Full name"
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-lg font-medium text-slate-800 shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        autoFocus
                      />
                      <Button
                        onClick={handleSignerSubmit}
                        disabled={!signerName.trim()}
                        className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-white shadow-[0_18px_32px_rgba(54,92,255,0.28)] transition-all hover:bg-primary/90 disabled:bg-slate-300 disabled:shadow-none"
                      >
                        Continue to Signature
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "signature" && (
              <div className="mx-auto max-w-4xl space-y-6">
                <Button
                  onClick={() => setCurrentStep("signer")}
                  className="pill-button border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-primary/40 hover:text-primary"
                  variant="outline"
                >
                  ← Back to Signer
                </Button>

                <div className="rounded-[28px] border border-slate-200 bg-white/95 p-10 shadow-[0_22px_40px_rgba(54,92,255,0.1)]">
                  <div className="space-y-8">
                    <div className="text-center">
                      <p className="text-sm uppercase tracking-[0.3em] text-primary/60">Digital signature</p>
                      <h2 className="mt-2 text-3xl font-semibold text-slate-900">Confirm pick-up</h2>
                      <p className="mt-3 text-base text-slate-500">
                        {selectedStudent?.first_name} {selectedStudent?.last_name} • Signed out by {signerName}
                      </p>
                    </div>

                    <div className="flex justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 p-4">
                      <SignaturePad onSignatureChange={handleSignatureChange} width={700} height={300} />
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Button
                        onClick={resetToHome}
                        className="h-12 flex-1 rounded-2xl border border-red-100 bg-red-50 text-base font-semibold text-red-600 hover:bg-red-100"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCompleteSignOut}
                        disabled={loading || !signatureData}
                        className="h-12 flex-1 rounded-2xl bg-emerald-500 text-base font-semibold text-white shadow-[0_18px_32px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-500/90 disabled:bg-slate-300 disabled:shadow-none"
                      >
                        {loading ? "Processing…" : "Complete Sign-Out"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "success" && (
              <div className="mx-auto max-w-xl">
                <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/80 p-10 text-center shadow-[0_20px_40px_rgba(16,185,129,0.15)]">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl text-emerald-500 shadow-[0_10px_20px_rgba(16,185,129,0.25)]">
                    ✓
                  </div>
                  <h2 className="text-3xl font-semibold text-emerald-700">Sign-Out Complete</h2>
                  <p className="mt-3 text-base text-emerald-600">
                    {selectedStudent?.first_name} {selectedStudent?.last_name} is checked out by {signerName}.
                  </p>
                  <p className="mt-2 text-sm text-emerald-500">Returning to the home screen…</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
