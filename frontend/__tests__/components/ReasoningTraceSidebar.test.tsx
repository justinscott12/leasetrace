import { render, screen } from '@testing-library/react'
import ReasoningTraceSidebar from '@/app/audit/components/ReasoningTraceSidebar'

describe('ReasoningTraceSidebar', () => {
  it('renders trace events', () => {
    const traceEvents = [
      {
        timestamp: '08:12:01',
        type: 'node',
        message: 'Extractor -> Pulled 14 clauses',
        status: 'success',
      },
    ]

    render(<ReasoningTraceSidebar traceEvents={traceEvents} />)
    
    expect(screen.getByText(/Reasoning Trace/i)).toBeInTheDocument()
    expect(screen.getByText(/Extractor/i)).toBeInTheDocument()
  })

  it('displays current state when no events', () => {
    const currentState = {
      current_node: 'extract_clauses',
    }

    render(<ReasoningTraceSidebar traceEvents={[]} currentState={currentState} />)
    
    expect(screen.getByText(/extract_clauses/i)).toBeInTheDocument()
  })
})

