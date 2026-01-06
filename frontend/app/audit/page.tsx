'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import HITLModal from './components/HITLModal'
import DualPaneViewer from './components/DualPaneViewer'
import AuditTrail from './components/AuditTrail'
import ComplianceHealthChart from './components/ComplianceHealthChart'
import RecommendationsPanel from './components/RecommendationsPanel'
import DocumentUpload from './components/DocumentUpload'
import BulkUpload from './components/BulkUpload'
import ComplianceDashboard from './components/ComplianceDashboard'
import { FileText, Activity, RefreshCw, Edit, Plus, Upload, BarChart3 } from 'lucide-react'

interface AuditState {
  thread_id?: string
  status?: string
  compliance_score?: number
  compliance_analysis?: string
  recommendations?: string[]
  missing_clauses?: string[]
  extracted_findings?: any[]
  statute_references?: any[]
  current_node?: string
}

type ViewMode = 'upload' | 'bulk' | 'dashboard'

export default function AuditPage() {
  const [auditState, setAuditState] = useState<AuditState | null>(null)
  const [showHITLModal, setShowHITLModal] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [viewMode, setViewMode] = useState<ViewMode>('upload')

  // Check backend status on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:8000/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        })
        if (response.ok) {
          setBackendStatus('online')
        } else {
          setBackendStatus('offline')
        }
      } catch (error) {
        setBackendStatus('offline')
      }
    }
    checkBackend()
  }, [])

  const saveAuditToHistory = (state: AuditState, documentName: string = 'Lease Agreement') => {
    try {
      const auditHistory = JSON.parse(localStorage.getItem('legaltrace_audit_history') || '[]')
      auditHistory.unshift({
        thread_id: state.thread_id,
        document_name: documentName,
        compliance_score: state.compliance_score || 0,
        timestamp: new Date().toISOString(),
        status: 'completed',
        recommendations_count: state.recommendations?.length || 0,
        missing_clauses_count: state.missing_clauses?.length || 0,
      })
      // Keep only last 50 audits
      localStorage.setItem('legaltrace_audit_history', JSON.stringify(auditHistory.slice(0, 50)))
    } catch (error) {
      console.error('Failed to save audit history:', error)
    }
  }

  const handleAuditStart = async (documentText: string, documentName?: string) => {
    try {
      const formData = new FormData()
      formData.append('document_text', documentText)

      const response = await fetch('http://localhost:8000/audit', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to start audit: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      const newState = { ...data.state, thread_id: data.thread_id }
      setAuditState(newState)
      
      // Save to history when complete
      if (data.state?.compliance_score !== undefined) {
        saveAuditToHistory(newState, documentName || 'Lease Agreement')
      }
      
      // Check if audit completed successfully
      const isComplete = data.status === 'completed' || 
                        data.state?.current_node === 'human_review' ||
                        (data.state?.compliance_score !== undefined && data.state.compliance_score > 0)
      
      if (isComplete) {
        // Audit is done, no need to poll
        if (data.state?.current_node === 'human_review') {
          setShowHITLModal(true)
        }
        return
      }
      
      // Start polling for trace updates only if audit is still running
      if (data.thread_id && data.status !== 'completed') {
        pollTrace(data.thread_id)
      }
    } catch (error) {
      console.error('Error starting audit:', error)
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        toast.error('Backend server is not running. Please start it first.')
        setBackendStatus('offline')
      } else {
        toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const pollTrace = async (threadId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/audit/${threadId}/trace`)
        if (response.ok) {
          const data = await response.json()
          
          // Only update state if trace has actual data (not empty)
          if (data.current_state && Object.keys(data.current_state).length > 0) {
            setAuditState((prevState) => ({
              ...prevState,
              ...data.current_state, // Merge with previous state to avoid losing data
            }))
            
            // Check if human review is needed
            if (data.current_state?.current_node === 'human_review') {
              setShowHITLModal(true)
              clearInterval(interval)
            }
            
            // Check if audit is complete
            if (data.current_state?.compliance_score !== undefined) {
              // Save to history when complete
              const completedState = { ...data.current_state, thread_id: auditState?.thread_id || threadId }
              saveAuditToHistory(completedState)
              clearInterval(interval)
            }
            
            // Stop polling if audit has progressed beyond initial nodes
            if (data.current_state?.current_node && 
                data.current_state.current_node !== 'critique_analysis' &&
                data.current_state.current_node !== 'analyze_compliance' &&
                data.current_state.current_node !== 'plan_retrieval' &&
                data.current_state.current_node !== 'extract_clauses' &&
                data.current_state.current_node !== 'human_review') {
              // Audit has progressed beyond initial nodes, stop polling after a delay
              setTimeout(() => clearInterval(interval), 2000)
            }
          }
        }
      } catch (error) {
        console.error('Error polling trace:', error)
        // Stop polling on repeated errors
        clearInterval(interval)
      }
    }, 1000) // Poll every second
    
    // Stop polling after 2 minutes max
    setTimeout(() => clearInterval(interval), 120000)
  }

  const handleReAnalyze = async (threadId: string) => {
    try {
      toast.loading('Re-analyzing audit...', { id: 'reanalyze' })
      const response = await fetch(`http://localhost:8000/audit/${threadId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'retry',
          user_feedback: 'Please re-analyze with improved context and more thorough statute matching'
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to re-analyze')
      }
      
      const data = await response.json()
      setAuditState(data.state)
      toast.success('Re-analysis started', { id: 'reanalyze' })
      
      // Start polling for updates
      if (data.thread_id) {
        pollTrace(data.thread_id)
      }
    } catch (error) {
      toast.error('Failed to re-analyze', { id: 'reanalyze' })
      console.error('Error re-analyzing:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" data-agent-id="audit-page">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50" data-agent-id="audit-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold gradient-text" data-agent-id="audit-title">
              LegalTrace
              <span className="text-sm font-normal text-gray-600 ml-2">Commercial Lease Compliance</span>
            </h1>
            <div className="flex items-center gap-4">
              {auditState?.compliance_score !== undefined && (
                <div className="flex items-center gap-2" data-agent-id="audit-compliance-badge">
                  <Activity className="w-5 h-5 text-primary-600" />
                  <span className="text-sm font-medium">
                    Compliance: {(auditState.compliance_score * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {!auditState && (
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1 bg-gray-50">
                  <button
                    onClick={() => setViewMode('upload')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      viewMode === 'upload' 
                        ? 'bg-white text-primary-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    data-agent-id="view-mode-upload"
                  >
                    <Upload className="w-4 h-4 inline mr-1.5" />
                    Single
                  </button>
                  <button
                    onClick={() => setViewMode('bulk')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      viewMode === 'bulk' 
                        ? 'bg-white text-primary-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    data-agent-id="view-mode-bulk"
                  >
                    Bulk
                  </button>
                  <button
                    onClick={() => setViewMode('dashboard')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      viewMode === 'dashboard' 
                        ? 'bg-white text-primary-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    data-agent-id="view-mode-dashboard"
                  >
                    <BarChart3 className="w-4 h-4 inline mr-1.5" />
                    Dashboard
                  </button>
                </div>
              )}
              {auditState && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setAuditState(null)
                    setShowHITLModal(false)
                    setViewMode('upload')
                    toast.success('Ready for new audit')
                  }}
                  className="btn-primary flex items-center gap-2"
                  data-agent-id="new-audit-button"
                >
                  <Plus className="w-4 h-4" />
                  New Audit
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-agent-id="audit-main">
        <div className="space-y-6" data-agent-id="audit-content-area">
            {backendStatus === 'offline' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-yellow-50 border-yellow-200"
                data-agent-id="backend-offline-warning"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <h3 className="font-semibold text-yellow-800">Backend Server Offline</h3>
                </div>
                <p className="text-sm text-yellow-700 mb-4">
                  The backend API server is not running. Please start it to use the audit system.
                </p>
                <div className="bg-white p-4 rounded-lg border border-yellow-200">
                  <p className="text-xs font-mono text-gray-700 mb-2">To start the backend:</p>
                  <code className="text-xs block bg-gray-100 p-2 rounded mb-2">
                    cd backend && uvicorn backend.api.main:app --reload
                  </code>
                  <p className="text-xs text-gray-600">Or use the start script:</p>
                  <code className="text-xs block bg-gray-100 p-2 rounded">
                    ./scripts/start-backend.sh
                  </code>
                </div>
              </motion.div>
            )}
            {!auditState && backendStatus === 'online' ? (
              <>
                {viewMode === 'upload' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    data-agent-id="audit-upload-section"
                  >
                    <DocumentUpload onUpload={(text) => handleAuditStart(text)} />
                  </motion.div>
                )}
                {viewMode === 'bulk' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    data-agent-id="bulk-upload-section"
                  >
                    <BulkUpload onUpload={async (documents) => {
                      // Process first document for now (bulk processing can be added later)
                      if (documents.length > 0) {
                        await handleAuditStart(documents[0].text, documents[0].name)
                        if (documents.length > 1) {
                          toast.info(`Processing first lease. ${documents.length - 1} more in queue.`)
                        }
                      }
                    }} />
                  </motion.div>
                )}
                {viewMode === 'dashboard' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-agent-id="dashboard-section"
                  >
                    <ComplianceDashboard
                      onSelectAudit={(threadId) => {
                        toast.info('Loading audit...')
                        // In production, fetch audit by thread_id from API
                        console.log('Load audit:', threadId)
                      }}
                      onExport={(threadId) => {
                        // Export functionality
                        toast.success('Exporting compliance report...')
                        console.log('Export audit:', threadId)
                      }}
                    />
                  </motion.div>
                )}
              </>
            ) : !auditState ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                data-agent-id="audit-upload-section"
              >
                <DocumentUpload onUpload={(text) => handleAuditStart(text)} />
              </motion.div>
            ) : (
              <>
                {/* Dual-Pane Viewer */}
                <DualPaneViewer 
                  documentText={auditState.document_text || ''}
                  findings={auditState.extracted_findings || []}
                  complianceScore={auditState.compliance_score || 0}
                  statuteReferences={auditState.statute_references || []}
                />

                {/* Recommendations Panel - Bridge Gaps in Document */}
                {(auditState.recommendations?.length > 0 || auditState.missing_clauses?.length > 0) && (
                  <RecommendationsPanel
                    recommendations={auditState.recommendations || []}
                    missingClauses={auditState.missing_clauses || []}
                    complianceScore={auditState.compliance_score || 0}
                  />
                )}

                {/* Post-Audit Actions */}
                {auditState.compliance_score !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    data-agent-id="post-audit-actions"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold gradient-text">Improve Audit</h3>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setAuditState(null)
                          setShowHITLModal(false)
                          toast.success('Ready for new audit')
                        }}
                        className="btn-secondary flex items-center gap-2"
                        data-agent-id="new-audit-button-inline"
                      >
                        <Plus className="w-4 h-4" />
                        New Audit
                      </motion.button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Not satisfied with the results? Request a re-analysis or provide feedback to improve the audit.
                    </p>
                    <div className="flex gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (auditState.thread_id) {
                            handleReAnalyze(auditState.thread_id)
                          }
                        }}
                        className="btn-primary flex-1"
                        data-agent-id="re-analyze-button"
                      >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Request Re-Analysis
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowHITLModal(true)}
                        className="btn-secondary flex-1"
                        data-agent-id="provide-feedback-button"
                      >
                        <Edit className="w-5 h-5 mr-2" />
                        Provide Feedback
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Compliance Health Chart */}
                <ComplianceHealthChart 
                  complianceScore={auditState.compliance_score || 0}
                />

                {/* Audit Trail - Collapsible Statute References */}
                <AuditTrail 
                  findings={auditState.extracted_findings || []}
                  statuteReferences={auditState.statute_references || []}
                  threadId={auditState.thread_id}
                />
              </>
            )}
          </div>
      </main>

      {/* HITL Modal */}
      {showHITLModal && auditState?.thread_id && (
        <HITLModal
          threadId={auditState.thread_id}
          findings={auditState.extracted_findings || []}
          onClose={() => setShowHITLModal(false)}
          onAction={async (action, feedback) => {
            try {
              // Use retry endpoint for retry action, approve endpoint for others
              const endpoint = action === 'retry' 
                ? `http://localhost:8000/audit/${auditState.thread_id}/retry`
                : `http://localhost:8000/audit/${auditState.thread_id}/approve`
              
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, user_feedback: feedback }),
              })
              
              if (!response.ok) {
                throw new Error('Failed to process action')
              }
              
              const data = await response.json()
              setAuditState(data.state)
              setShowHITLModal(false)
              
              // If retry, start polling for updates
              if (action === 'retry' && data.thread_id) {
                pollTrace(data.thread_id)
              }
            } catch (error) {
              toast.error(`Failed to ${action} audit`)
              console.error('Error processing action:', error)
            }
          }}
        />
      )}
    </div>
  )
}

