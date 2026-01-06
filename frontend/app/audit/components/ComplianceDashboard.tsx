'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, TrendingUp, TrendingDown, Download, Calendar, AlertCircle } from 'lucide-react'

interface AuditHistory {
  thread_id: string
  document_name: string
  compliance_score: number
  timestamp: string
  status: 'completed' | 'processing' | 'error'
  recommendations_count?: number
  missing_clauses_count?: number
}

interface ComplianceDashboardProps {
  onSelectAudit: (threadId: string) => void
  onExport: (threadId: string) => void
}

export default function ComplianceDashboard({ onSelectAudit, onExport }: ComplianceDashboardProps) {
  const [auditHistory, setAuditHistory] = useState<AuditHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load audit history from localStorage (in production, this would be from API)
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem('legaltrace_audit_history')
        if (stored) {
          const history = JSON.parse(stored)
          setAuditHistory(history.sort((a: AuditHistory, b: AuditHistory) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          ))
        }
      } catch (error) {
        console.error('Failed to load audit history:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadHistory()
  }, [])

  const averageScore = auditHistory.length > 0
    ? auditHistory.reduce((sum, audit) => sum + audit.compliance_score, 0) / auditHistory.length
    : 0

  const recentAudits = auditHistory.slice(0, 10)

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (auditHistory.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card text-center py-12"
        data-agent-id="empty-dashboard"
      >
        <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Audit History</h3>
        <p className="text-gray-600">
          Your lease compliance audits will appear here
        </p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6" data-agent-id="compliance-dashboard">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          data-agent-id="total-audits-stat"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Audits</p>
              <p className="text-2xl font-bold text-gray-900">{auditHistory.length}</p>
            </div>
            <FileText className="w-8 h-8 text-primary-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
          data-agent-id="average-score-stat"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Compliance</p>
              <p className="text-2xl font-bold text-gray-900">
                {(averageScore * 100).toFixed(0)}%
              </p>
            </div>
            {averageScore >= 0.7 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-orange-600" />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
          data-agent-id="low-compliance-stat"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Needs Attention</p>
              <p className="text-2xl font-bold text-gray-900">
                {auditHistory.filter(a => a.compliance_score < 0.7).length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
        </motion.div>
      </div>

      {/* Audit History Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
        data-agent-id="audit-history-table"
      >
        <h3 className="text-lg font-semibold mb-4 gradient-text">Recent Audits</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Lease</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Compliance</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Issues</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentAudits.map((audit, index) => (
                <motion.tr
                  key={audit.thread_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  data-agent-id={`audit-row-${audit.thread_id}`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {audit.document_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        audit.compliance_score >= 0.8 ? 'bg-green-500' :
                        audit.compliance_score >= 0.6 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">
                        {(audit.compliance_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(audit.timestamp).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600">
                      {((audit.recommendations_count || 0) + (audit.missing_clauses_count || 0))} issues
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelectAudit(audit.thread_id)}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        data-agent-id={`view-audit-${audit.thread_id}`}
                      >
                        View
                      </button>
                      <button
                        onClick={() => onExport(audit.thread_id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        data-agent-id={`export-audit-${audit.thread_id}`}
                      >
                        <Download className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

