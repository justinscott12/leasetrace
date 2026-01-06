'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Clock, CheckCircle, AlertCircle, Loader2, Code, Wrench, Brain } from 'lucide-react'

interface TraceEvent {
  timestamp: string
  type: 'node' | 'tool' | 'agent'
  message: string
  status?: 'success' | 'error' | 'loading'
}

interface ReasoningTraceSidebarProps {
  traceEvents: TraceEvent[]
  currentState?: any
}

export default function ReasoningTraceSidebar({ traceEvents, currentState }: ReasoningTraceSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new events arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [traceEvents])

  const getIcon = (type: string, status?: string) => {
    if (status === 'loading') return <Loader2 className="w-4 h-4 animate-spin" />
    if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />
    if (type === 'node') return <Code className="w-4 h-4 text-blue-500" />
    if (type === 'tool') return <Wrench className="w-4 h-4 text-purple-500" />
    if (type === 'agent') return <Brain className="w-4 h-4 text-green-500" />
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  const formatTimestamp = () => {
    const now = new Date()
    return now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="card h-[calc(100vh-8rem)] flex flex-col" data-agent-id="reasoning-trace-sidebar">
      <div className="flex items-center justify-between mb-4" data-agent-id="trace-header">
        <h3 className="text-lg font-semibold gradient-text">Reasoning Trace</h3>
        <Clock className="w-5 h-5 text-gray-400" />
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide space-y-2"
        data-agent-id="trace-events-container"
      >
        {traceEvents.length === 0 && currentState?.current_node && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
            data-agent-id={`trace-event-${currentState.current_node}`}
          >
            {/* Only show loading if node is actually processing, not if audit is complete */}
            {currentState.current_node === 'human_review' || 
             (currentState.compliance_score !== undefined && currentState.compliance_score > 0) ? (
              getIcon('node', 'success')
            ) : (
              getIcon('node', 'loading')
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono gradient-text">{formatTimestamp()}</span>
                <span className="text-xs font-medium text-blue-600">Node</span>
              </div>
              <p className="text-sm text-gray-700">
                {currentState.current_node} → {
                  currentState.current_node === 'human_review' || 
                  (currentState.compliance_score !== undefined && currentState.compliance_score > 0) 
                    ? 'Completed' 
                    : 'Processing...'
                }
              </p>
            </div>
          </motion.div>
        )}

        {traceEvents.map((event, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            data-agent-id={`trace-event-${index}`}
          >
            {getIcon(event.type, event.status)}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono gradient-text">{event.timestamp}</span>
                <span className="text-xs font-medium capitalize text-primary-600">{event.type}</span>
              </div>
              <p className="text-sm text-gray-700">{event.message}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

