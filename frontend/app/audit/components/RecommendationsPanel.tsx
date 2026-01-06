'use client'

import { motion } from 'framer-motion'
import { Lightbulb, Plus, AlertCircle, CheckCircle } from 'lucide-react'

interface RecommendationsPanelProps {
  recommendations: string[]
  missingClauses: string[]
  complianceScore: number
}

export default function RecommendationsPanel({ 
  recommendations, 
  missingClauses,
  complianceScore 
}: RecommendationsPanelProps) {
  const hasRecommendations = recommendations && recommendations.length > 0
  const hasMissingClauses = missingClauses && missingClauses.length > 0

  if (!hasRecommendations && !hasMissingClauses) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      data-agent-id="recommendations-panel"
    >
      <div className="flex items-center gap-3 mb-4" data-agent-id="recommendations-header">
        <Lightbulb className="w-6 h-6 text-primary-600" />
        <h3 className="text-lg font-semibold gradient-text">
          Document Improvement Recommendations
        </h3>
      </div>

      <p className="text-sm text-gray-600 mb-4" data-agent-id="recommendations-description">
        Use these recommendations to protect your property and avoid costly lease violations. 
        Each suggestion is based on Florida Chapter 83 (landlord-tenant law) and helps ensure your lease is legally compliant.
      </p>

      {/* Missing Clauses Section */}
      {hasMissingClauses && (
        <div className="mb-6" data-agent-id="missing-clauses-section">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Missing Clauses to Add (Landlord Protection)</h4>
          </div>
          <div className="space-y-3">
            {missingClauses.map((clause, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                data-agent-id={`missing-clause-${index}`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 flex-1">{clause}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {hasRecommendations && (
        <div data-agent-id="recommendations-section">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold text-gray-900">Actionable Fixes (Compliance Issues)</h4>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (missingClauses?.length || 0) * 0.1 + index * 0.1 }}
                className="p-4 bg-orange-50 border border-orange-200 rounded-lg"
                data-agent-id={`recommendation-${index}`}
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 flex-1">{rec}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Potential */}
      {complianceScore < 0.8 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg" data-agent-id="improvement-potential">
          <p className="text-sm text-green-800">
            <strong>Improvement Potential:</strong> Implementing these recommendations could 
            improve your compliance score from {(complianceScore * 100).toFixed(0)}% to 80%+.
          </p>
        </div>
      )}
    </motion.div>
  )
}

