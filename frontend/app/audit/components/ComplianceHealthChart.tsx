'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { motion } from 'framer-motion'
import { TrendingUp, Activity } from 'lucide-react'

interface ComplianceHealthChartProps {
  complianceScore: number
}

export default function ComplianceHealthChart({ complianceScore }: ComplianceHealthChartProps) {
  // For a single audit, show just the current score
  // In production, this would fetch historical audits from the API
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const chartData = [
    { date: currentDate, score: complianceScore },
  ]

  // Determine score color based on compliance level
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return '#10b981' // green
    if (score >= 0.6) return '#f59e0b' // yellow
    return '#ef4444' // red
  }

  const scoreColor = getScoreColor(complianceScore)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card chart-container"
      data-agent-id="compliance-health-chart"
    >
      <div className="flex items-center justify-between mb-6" data-agent-id="chart-header">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary-600" />
          <h3 className="text-lg font-semibold gradient-text">Compliance Score</h3>
        </div>
        <div className="flex items-center gap-2" data-agent-id="current-score">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: scoreColor }}
          />
          <span className="text-2xl font-bold gradient-text">
            {(complianceScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Show a simple bar/indicator instead of a line chart for single audit */}
      <div className="space-y-4" data-agent-id="score-indicator">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Current Audit</span>
          <span className="font-semibold" style={{ color: scoreColor }}>
            {(complianceScore * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${complianceScore * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: scoreColor }}
            data-agent-id="score-bar"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Note about historical data */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200" data-agent-id="chart-note">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> This shows the compliance score for the current audit. 
          Historical trends will appear when multiple audits are tracked for the same document or client.
        </p>
      </div>
    </motion.div>
  )
}

