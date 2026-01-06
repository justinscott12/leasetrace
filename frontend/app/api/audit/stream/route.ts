import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get('thread_id')
  
  if (!threadId) {
    return new Response('Missing thread_id', { status: 400 })
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Poll FastAPI backend for trace updates
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:8000/audit/${threadId}/trace`)
          if (response.ok) {
            const data = await response.json()
            const event = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(event))
          }
        } catch (error) {
          console.error('Error polling trace:', error)
        }
      }, 1000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

