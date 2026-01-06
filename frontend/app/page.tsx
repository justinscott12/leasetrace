'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, ArrowRight } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-redirect to audit page after 2 seconds
    const timer = setTimeout(() => {
      router.push('/audit')
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center" data-agent-id="home-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto px-4"
        data-agent-id="home-content"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="mb-8"
          data-agent-id="home-logo"
        >
          <FileText className="w-24 h-24 mx-auto text-primary-600 mb-4" />
          <h1 className="text-5xl font-bold gradient-text mb-4" data-agent-id="home-title">
            LegalTrace
          </h1>
          <p className="text-xl text-gray-600 mb-2" data-agent-id="home-subtitle">
            Commercial Lease Compliance for Florida Property Managers
          </p>
          <p className="text-gray-500" data-agent-id="home-description">
            Ensure your lease agreements comply with Florida Chapter 83 to avoid costly violations
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
          data-agent-id="home-actions"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/audit')}
            className="btn-primary text-lg px-8 py-4"
            data-agent-id="home-cta-button"
          >
            Check Lease Compliance
            <ArrowRight className="w-5 h-5 ml-2 inline" />
          </motion.button>
          
          <p className="text-sm text-gray-400 mt-4" data-agent-id="home-redirect-notice">
            Redirecting to audit page...
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

