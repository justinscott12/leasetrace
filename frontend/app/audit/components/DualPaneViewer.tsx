'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, AlertCircle, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface DualPaneViewerProps {
  documentText: string
  findings: any[]
  complianceScore: number
  statuteReferences: any[]
}

export default function DualPaneViewer({ 
  documentText, 
  findings, 
  complianceScore,
  statuteReferences 
}: DualPaneViewerProps) {
  const [selectedFinding, setSelectedFinding] = useState<number | null>(null)

  // Sort findings by priority: high -> medium -> low
  const sortedFindings = [...findings].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const aPriority = priorityOrder[(a.risk_level || 'medium').toLowerCase() as keyof typeof priorityOrder] ?? 1
    const bPriority = priorityOrder[(b.risk_level || 'medium').toLowerCase() as keyof typeof priorityOrder] ?? 1
    return aPriority - bPriority
  })

  const getRiskBadge = (riskLevel: string) => {
    const config = {
      low: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle },
      high: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
    }
    const risk = riskLevel.toLowerCase() as keyof typeof config
    const { bg, text, icon: Icon } = config[risk] || config.medium
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        <Icon className="w-3 h-3" />
        {riskLevel}
      </span>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-agent-id="dual-pane-viewer">
      {/* Left Pane: Document */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="card"
        data-agent-id="dual-pane-document"
      >
        <div className="flex items-center justify-between mb-4" data-agent-id="document-header">
          <h3 className="text-lg font-semibold">Document</h3>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded" data-agent-id="zoom-in-button">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded" data-agent-id="zoom-out-button">
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div 
          className="prose max-w-none text-sm bg-gray-50 p-4 rounded-lg max-h-[600px] overflow-y-auto scrollbar-hide"
          data-agent-id="document-content"
        >
          {documentText.split('\n').map((line, index) => {
            const isHighlighted = findings.some(f => 
              f.clause_text && line.includes(f.clause_text.substring(0, 50))
            )
            return (
              <p
                key={index}
                className={isHighlighted ? 'bg-yellow-200 px-2 py-1 rounded' : ''}
                data-agent-id={`document-line-${index}`}
              >
                {line}
              </p>
            )
          })}
        </div>
      </motion.div>

      {/* Right Pane: Analysis */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="card"
        data-agent-id="dual-pane-analysis"
      >
        <div className="mb-4" data-agent-id="analysis-header">
          <h3 className="text-lg font-semibold mb-2">Analysis</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2" data-agent-id="compliance-score-display">
              <span className="text-sm text-gray-600">Compliance Score:</span>
              <span className="text-2xl font-bold gradient-text">
                {(complianceScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-hide" data-agent-id="findings-list">
          {sortedFindings.map((finding, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedFinding === index
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
              onClick={() => setSelectedFinding(index)}
              data-agent-id={`finding-item-${index}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1" data-agent-id={`finding-title-${index}`}>
                    {finding.clause_type || 'Clause'}
                  </h4>
                  {getRiskBadge(finding.risk_level || 'medium')}
                </div>
              </div>
              
              <p className="text-sm text-gray-700 mb-3" data-agent-id={`finding-text-${index}`}>
                {finding.clause_text?.substring(0, 150)}...
              </p>

              {statuteReferences.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200" data-agent-id={`finding-statutes-${index}`}>
                  <p className="text-xs text-gray-500 mb-2">Referenced Statutes:</p>
                  <div className="flex flex-wrap gap-2">
                    {statuteReferences.slice(0, 3).map((statute, sIndex) => (
                      <span
                        key={sIndex}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded"
                        data-agent-id={`statute-badge-${index}-${sIndex}`}
                      >
                        {statute.citation || statute.id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

