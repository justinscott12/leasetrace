'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface AuditTrailProps {
  findings: any[]
  statuteReferences: any[]
  threadId?: string
}

export default function AuditTrail({ findings, statuteReferences, threadId }: AuditTrailProps) {
  const [selectedStatute, setSelectedStatute] = useState<any | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleViewSource = async (statuteId: number) => {
    if (!threadId) return
    
    try {
      const response = await fetch(`http://localhost:8000/audit/${threadId}/statute/${statuteId}`)
      if (response.ok) {
        const statute = await response.json()
        setSelectedStatute(statute)
      }
    } catch (error) {
      console.error('Error fetching statute:', error)
    }
  }

  // Group statutes by unique citations (deduplicate)
  const uniqueStatutes = Array.from(
    new Map(statuteReferences.map(s => [s.citation || s.id, s])).values()
  )

  if (statuteReferences.length === 0) {
    return null // Don't show if no statutes
  }

  return (
    <div className="card" data-agent-id="audit-trail-component">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        data-agent-id="audit-trail-header"
      >
        <h3 className="text-lg font-semibold gradient-text" data-agent-id="audit-trail-title">
          Statute References ({uniqueStatutes.length})
        </h3>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            data-agent-id="audit-trail-content"
          >
            <div className="mt-4 space-y-2" data-agent-id="audit-trail-statutes">
              {uniqueStatutes.map((statute, index) => (
                <button
                  key={index}
                  onClick={() => handleViewSource(statute.id || statute.statute_id)}
                  className="btn-secondary text-sm w-full justify-start p-3"
                  data-agent-id={`view-source-button-${index}`}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="flex-1 text-left">{statute.citation || `Statute ${statute.id}`}</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Statute Detail Modal */}
      <AnimatePresence>
        {selectedStatute && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" data-agent-id="statute-modal-overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedStatute(null)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
              data-agent-id="statute-modal-content"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold gradient-text mb-2" data-agent-id="statute-modal-title">
                  {selectedStatute.citation}
                </h3>
                <p className="text-sm text-gray-600" data-agent-id="statute-modal-subtitle">
                  {selectedStatute.title}
                </p>
              </div>

              <div className="prose max-w-none mb-4" data-agent-id="statute-modal-text">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedStatute.text}</p>
              </div>

              <button
                onClick={() => setSelectedStatute(null)}
                className="btn-primary w-full"
                data-agent-id="statute-modal-close"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

