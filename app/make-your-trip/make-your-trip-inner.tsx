'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, Search, Check } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function MakeYourTripInner() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    adults: '2',
    children: '0',
    infants: '0',
  })

  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries())
    if (params.destination) {
      setFormData(prev => ({ ...prev, destination: String(params.destination) }))
    }
  }, [searchParams])

  const handleNext = () => setStep(prev => prev + 1)
  const handlePrev = () => setStep(prev => Math.max(prev - 1, 1))
  const handleSubmit = () => {
    router.push(`/make-your-trip/result?${new URLSearchParams(formData)}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">Plan Your Trip</h1>
          <button onClick={handlePrev} className="hidden sm:inline-flex">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>
      </nav>

      <main className="p-4 sm:p-6 max-w-3xl mx-auto">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Select Destination</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="e.g. Luxor, Cairo, Aswan"
                defaultValue="Luxor"
                onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                className="pl-8 pr-4 py-2 border rounded-md w-full"
              />
            </div>
            <button
              onClick={handleNext}
              className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Next: Dates
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Select Dates</h2>
            <div>
              <label className="block text-sm font-medium mb-1">
                Start date
                <input
                  type="date"
                  defaultValue="2026-12-01"
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full py-2 border rounded-md"
                />
              </label>
              <label className="block text-sm font-medium mb-1">
                End date
                <input
                  type="date"
                  defaultValue="2026-12-07"
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full py-2 border rounded-md"
                />
              </label>
            </div>
            <button onClick={handlePrev} className="hidden sm:flex">
              Prev: Destination
            </button>
            <button
              onClick={handleNext}
              className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Next: Travelers
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Select Travelers</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Adults</label>
                <input
                  type="number"
                  value="2"
                  onChange={(e) => setFormData(prev => ({ ...prev, adults: e.target.value }))}
                  min="0"
                  className="w-full py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Children</label>
                <input
                  type="number"
                  value="0"
                  onChange={(e) => setFormData(prev => ({ ...prev, children: e.target.value }))}
                  min="0"
                  className="w-full py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Infants</label>
                <input
                  type="number"
                  value="0"
                  onChange={(e) => setFormData(prev => ({ ...prev, infants: e.target.value }))}
                  min="0"
                  className="w-full py-2 border rounded-md"
                />
              </div>
            </div>
            <button onClick={handlePrev} className="hidden sm:flex">
              Prev: Dates
            </button>
            <button
              onClick={handleSubmit}
              className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Book Now
            </button>
          </div>
        )}
      </main>
    </div>
  )
}