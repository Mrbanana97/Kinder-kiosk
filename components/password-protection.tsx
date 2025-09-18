"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface PasswordProtectionProps {
  children: React.ReactNode
}

export default function PasswordProtection({ children }: PasswordProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const KIOSK_PASSWORD = "0000"

  useEffect(() => {
    // Check if user is already authenticated
    const authStatus = sessionStorage.getItem("kiosk-authenticated")
    if (authStatus === "true") {
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (password === KIOSK_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem("kiosk-authenticated", "true")
      setError("")
    } else {
      setError("Incorrect password. Please try again.")
      setPassword("")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem("kiosk-authenticated")
    setPassword("")
    setError("")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-medium text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <img src="/icon-192.png" alt="Kiosk Logo" className="w-16 h-16 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Kindergarten Kiosk</h1>
              <p className="text-gray-600">Please enter the password to access the system</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-12 px-4 text-lg text-center border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none tracking-widest"
                  autoFocus
                  maxLength={10}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={!password.trim()}
                className="w-full h-12 text-lg font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-lg"
              >
                Access Kiosk
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-500">Authorized personnel only</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 z-50 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium opacity-20 hover:opacity-100 transition-opacity"
        title="Logout"
      >
        🔒 Logout
      </button>
      {children}
    </div>
  )
}
