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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-medium text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <img src="/icon-192.png" alt="Kiosk Logo" className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Kindergarten Sign-Out</h1>
              <p className="text-base text-gray-600">
                {currentStep === "classes" && "Select your child's class"}
                {currentStep === "students" && `Select student from ${selectedClass?.name}`}
                {currentStep === "signer" && `Sign out ${selectedStudent?.first_name} ${selectedStudent?.last_name}`}
                {currentStep === "signature" && "Please sign below"}
                {currentStep === "success" && "Sign-out completed successfully!"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => (window.location.href = "/admin")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Admin
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Class Selection */}
        {currentStep === "classes" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
              {loadingClasses && classes.length === 0 && (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 md:h-40 lg:h-48 border-2 border-gray-200 rounded-xl flex items-center justify-center animate-pulse bg-gray-100" />
                ))
              )}
              {!loadingClasses && classes.map((classItem) => (
                <Button
                  key={classItem.id}
                  onClick={() => handleClassSelect(classItem)}
                  className="h-32 md:h-40 lg:h-48 text-4xl md:text-5xl lg:text-6xl font-bold bg-white hover:bg-blue-50 text-blue-600 border-2 border-gray-200 hover:border-blue-300 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  variant="outline"
                >
                  {classItem.name}
                </Button>
              ))}
            </div>
            {classes.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-lg text-gray-500">No classes available</p>
              </div>
            )}
          </div>
        )}

        {/* Student Selection */}
        {currentStep === "students" && (
          <div className="space-y-6">
            <Button
              onClick={resetToHome}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              variant="outline"
            >
              ← Back to Classes
            </Button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {loadingStudents && students.length === 0 && (
                  [...Array(8)].map((_, i) => (
                    <div key={i} className="h-20 border border-gray-200 rounded-lg animate-pulse bg-gray-100" />
                  ))
                )}
                {!loadingStudents && students.map((student) => (
                  <Button
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className="h-20 text-lg font-medium bg-white hover:bg-green-50 text-green-700 border border-gray-200 hover:border-green-300 rounded-lg transition-all duration-200"
                    variant="outline"
                  >
                    {student.first_name} {student.last_name}
                  </Button>
                ))}
              </div>
              {students.length === 0 && !loadingStudents && !loading && (
                <div className="text-center py-12">
                  <p className="text-lg text-gray-500">
                    All students from {selectedClass?.name} are currently signed out
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signer Name Input */}
        {currentStep === "signer" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Button
              onClick={() => setCurrentStep("students")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              variant="outline"
            >
              ← Back to Students
            </Button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Signing out: {selectedStudent?.first_name} {selectedStudent?.last_name}
                  </h2>
                  <p className="text-base text-gray-600">Please enter your full name</p>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full h-12 px-4 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                  />
                  <Button
                    onClick={handleSignerSubmit}
                    disabled={!signerName.trim()}
                    className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-lg"
                  >
                    Continue to Signature
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signature Step */}
        {currentStep === "signature" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <Button
              onClick={() => setCurrentStep("signer")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              variant="outline"
            >
              ← Back
            </Button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Digital Signature Required</h2>
                  <div className="text-base text-gray-600 space-y-1">
                    <p>
                      Student: {selectedStudent?.first_name} {selectedStudent?.last_name}
                    </p>
                    <p>Signed out by: {signerName}</p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <SignaturePad onSignatureChange={handleSignatureChange} width={700} height={300} />
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={resetToHome}
                    className="flex-1 h-12 text-base font-medium bg-red-600 hover:bg-red-700 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCompleteSignOut}
                    disabled={loading || !signatureData}
                    className="flex-1 h-12 text-base font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-lg"
                  >
                    {loading ? "Processing..." : "Complete Sign-Out"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {currentStep === "success" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-lg shadow-sm p-8">
              <div className="text-center space-y-4">
                <div className="text-4xl text-green-600 mb-4">✓</div>
                <h2 className="text-2xl font-bold text-green-800">Sign-Out Complete!</h2>
                <div className="text-base text-green-700 space-y-1">
                  <p>
                    {selectedStudent?.first_name} {selectedStudent?.last_name} has been signed out by {signerName}
                  </p>
                  <p className="text-sm">Returning to home screen...</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
