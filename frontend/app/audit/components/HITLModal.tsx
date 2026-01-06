'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Edit, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface HITLModalProps {
  threadId: string
  findings: any[]
  onClose: () => void
  onAction: (action: 'approve' | 'edit' | 'retry', feedback?: string) => void
}

export default function HITLModal({ threadId, findings, onClose, onAction }: HITLModalProps) {
  const [editFeedback, setEditFeedback] = useState('')
  const [showEditInput, setShowEditInput] = useState(false)

  // Sort findings by risk: high → medium → low
  const sortedFindings = [...findings].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const aPriority = priorityOrder[(a.risk_level || 'medium').toLowerCase() as keyof typeof priorityOrder] ?? 1
    const bPriority = priorityOrder[(b.risk_level || 'medium').toLowerCase() as keyof typeof priorityOrder] ?? 1
    return aPriority - bPriority
  })

  const handleApprove = () => {
    onAction('approve')
    toast.success('Audit approved - findings accepted')
  }

  const handleEdit = () => {
    if (showEditInput && editFeedback.trim()) {
      onAction('edit', editFeedback)
      toast.success('Feedback submitted - analysis will be updated')
    } else {
      setShowEditInput(true)
    }
  }

  const handleRetry = () => {
    onAction('retry', editFeedback || 'Please re-analyze with corrected context')
    toast.success('Re-analyzing with improved context...')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center" data-agent-id="hitl-modal-overlay">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-6"
          data-agent-id="hitl-modal-content"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            data-agent-id="hitl-modal-close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold gradient-text mb-2" data-agent-id="hitl-modal-title">
              Human Review Required
            </h2>
            <p className="text-gray-600 mb-2" data-agent-id="hitl-modal-description">
              The agent has identified potential compliance issues. Review the findings below and choose an action.
            </p>
            <p className="text-sm text-gray-500" data-agent-id="hitl-modal-note">
              <strong>Note:</strong> This reviews the agent's analysis, not the source document. To edit the document itself, use your document editor.
            </p>
          </div>

          <div className="mb-6 space-y-4 max-h-96 overflow-y-auto scrollbar-hide" data-agent-id="hitl-findings-list">
            {sortedFindings.map((finding, index) => (
              <div
                key={index}
                className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                data-agent-id={`hitl-finding-${index}`}
              >
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {finding.clause_type || 'Clause'} - {finding.risk_level || 'Medium'} Risk
                </p>
                <p className="text-sm text-gray-700">{finding.clause_text?.substring(0, 200)}...</p>
              </div>
            ))}
          </div>

          {showEditInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6"
              data-agent-id="hitl-edit-input"
            >
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Edit Feedback
              </label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="Provide your correction or additional context..."
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                data-agent-id="hitl-feedback-textarea"
              />
            </motion.div>
          )}

          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg" data-agent-id="hitl-action-info">
              <p className="text-xs text-blue-800 font-medium mb-1">What do these actions do?</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>Approve:</strong> Accept the audit results as-is and mark as complete</li>
                <li>• <strong>Edit:</strong> Provide feedback to correct the agent's analysis (doesn't edit the document)</li>
                <li>• <strong>Re-try:</strong> Request the agent to re-analyze with improved context</li>
              </ul>
            </div>

            <div className="flex gap-4" data-agent-id="hitl-action-buttons">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                className="btn-primary flex-1"
                data-agent-id="hitl-approve-button"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Approve
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEdit}
                className="btn-secondary flex-1"
                data-agent-id="hitl-edit-button"
              >
                <Edit className="w-5 h-5 mr-2" />
                {showEditInput ? 'Submit Feedback' : 'Provide Feedback'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetry}
                className="btn-ghost flex-1"
                data-agent-id="hitl-retry-button"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Re-analyze
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

