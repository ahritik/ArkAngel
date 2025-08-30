import express from 'express'
import cors from 'cors'
import { ChatOpenAI } from '@langchain/openai'
import { MCPAgent, MCPClient } from 'mcp-use'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'

const app = express()
const port = Number(process.env.AGENT_PORT || process.env.PORT || 8765)

// Middleware
app.use(cors())
app.use(express.json())

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[sidecar] ${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// Initialize MCP client (shared)
const config = {
  mcpServers: {
    google_workspace: {
      command: "python",
      args: [
        "-m",
        "uv",
        "run",
        "main.py",
        "--",
        "--tools",
        "gmail",
        "drive",
        "calendar",
       // "docs",
        "sheets",
        "chat",
        "forms",
        "slides",
        "tasks",
        "search"
      ],
      cwd: path.join(process.cwd(), "google_workspace_mcp"),
      env: {
        GOOGLE_OAUTH_CLIENT_ID: "139776440447-hitn2mo3v2bof9s2n8ugl8k97a12nrcl.apps.googleusercontent.com",
        GOOGLE_OAUTH_CLIENT_SECRET: "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"
      }
    }
  }
} as const

const client = MCPClient.fromDict(config as any)

function stringifyPreview(value: unknown, maxLen: number = 300): string {
  try {
    const asString = typeof value === 'string' ? value : JSON.stringify(value)
    if (!asString) return ''
    return asString.length > maxLen ? asString.slice(0, maxLen) + '…' : asString
  } catch {
    return '[unserializable]'
  }
}

function getCredentialStoreDir(): string {
  const envDir = process.env.GOOGLE_MCP_CREDENTIALS_DIR
  if (envDir && envDir.trim()) return envDir
  const home = process.env.HOME || process.env.USERPROFILE || ''
  if (home) return path.join(home, '.google_workspace_mcp', 'credentials')
  return path.join(process.cwd(), '.credentials')
}

function readFirstCredentialEmail(): string | null {
  try {
    const dir = getCredentialStoreDir()
    if (!fs.existsSync(dir)) return null
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    if (files.length === 0) return null
    // If there are multiple, prefer a file that looks like an email filename
    const emailLike = files.find(f => f.includes('@')) || files[0]
    const email = emailLike.replace(/\.json$/i, '')
    return email
  } catch {
    return null
  }
}

function readScopesForEmail(email: string): string[] {
  try {
    const dir = getCredentialStoreDir()
    const p = path.join(dir, `${email}.json`)
    if (!fs.existsSync(p)) return []
    const raw = fs.readFileSync(p, 'utf-8')
    const json = JSON.parse(raw)
    const scopes = Array.isArray(json?.scopes) ? json.scopes : []
    return scopes.filter((s: unknown) => typeof s === 'string')
  } catch {
    return []
  }
}

function enhanceSystemPromptWithDateTime(systemPrompt?: string): string {
  const now = new Date()
  const resolvedEmail = readFirstCredentialEmail() || 'unknown'
  const scopes = resolvedEmail !== 'unknown' ? readScopesForEmail(resolvedEmail) : []
  
  const dateTimeInfo = `CURRENT DATE & TIME CONTEXT:
- Current Date: ${now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}
- Current Time: ${now.toLocaleTimeString('en-US', { 
    hour12: true, 
    hour: 'numeric', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- ISO Timestamp: ${now.toISOString()}
- User Google Email: ${resolvedEmail}
- Enabled Google Scopes (${scopes.length}): ${scopes.join(', ')}

IMPORTANT: When working with calendar events, scheduling, or time-sensitive tasks, always consider this current date/time context. The user's computer timezone is ${Intl.DateTimeFormat().resolvedOptions().timeZone}, but calendar events may be in different timezones.

${systemPrompt || 'You are a helpful AI assistant with access to calendar, email, and other productivity tools.'}`

  return dateTimeInfo.trim()
}

// Intelligent question classification for routing
function isPdfQuestion(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  const pdfKeywords = [
    'pdf', 'document', 'file', 'what\'s in', 'content',
    'extract', 'read', 'analyze', 'on page', 'section',
    'in the document', 'from the file'
  ]
  
  return pdfKeywords.some(keyword => lowerMessage.includes(keyword))
}

function createAgent(opts: { providerId?: string; model?: string; apiKey?: string; systemPrompt?: string, disableMCP?: boolean }) {
  const provider = (opts.providerId || 'openai').toLowerCase()
  const model = opts.model || 'gpt-4o-mini'
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Provide it in request body or environment.')
  }
  if (provider !== 'openai') {
    console.warn('[sidecar] Only OpenAI is wired here; using ChatOpenAI with provided key.')
  }
  const llm = new ChatOpenAI({ model, temperature: 0.5, streaming: true, apiKey })
  
  if (opts.disableMCP) {
    // For PDF questions, return just the LLM (no MCP agent at all)
    return { llm, systemPrompt: opts.systemPrompt, isPDFMode: true }
  } else {
    // For action questions, use MCP agent with tools
    const agent = new MCPAgent({ 
      llm: llm as any, 
      client, 
      maxSteps: 20,
      disallowedTools: ["shell", "file_system", "network"] // Block risky tools, keep calendar/gmail
    })
    return { agent, systemPrompt: opts.systemPrompt, isPDFMode: false }
  }
}

class StreamingMCPAgent {
  private agent: MCPAgent
  private streamCallback: (event: any) => void
  private toolStartTimes: Map<string, number[]>

  constructor(agent: MCPAgent, streamCallback: (event: any) => void) {
    this.agent = agent
    this.streamCallback = streamCallback
    this.toolStartTimes = new Map()
  }

  async run(message: string): Promise<string> {
    try {
      const eventStream = this.agent.streamEvents(message)
      let finalText = ''
      let responseStarted = false
      let llmStarted = false
      let llmChars = 0

      for await (const event of eventStream as any) {
        switch (event.event) {
          case 'on_chat_model_start': {
            const inputPreview = stringifyPreview(event.data?.input ?? event.data?.messages)
            console.log('[sidecar] [LLM START]', {
              at: new Date().toISOString(),
              inputPreview
            })
            break
          }
          case 'on_tool_start': {
            const toolName = event.name || event.data?.name || 'unknown_tool'
            const now = Date.now()
            const starts = this.toolStartTimes.get(toolName) || []
            starts.push(now)
            this.toolStartTimes.set(toolName, starts)

            const inputPreview = stringifyPreview(event.data?.input ?? event.data?.inputs)
            console.log(`[sidecar] [MCP TOOL START] ${toolName}`, {
              at: new Date(now).toISOString(),
              inputPreview,
              promptPreview: stringifyPreview(message)
            })
            this.streamCallback({
              type: 'tool_start',
              content: `🔧 ${toolName} started`,
              tool: toolName,
              input: event.data?.input ?? event.data?.inputs ?? null,
              timestamp: new Date().toISOString()
            })
            break
          }
          case 'on_tool_end': {
            const toolName = event.name || event.data?.name || 'unknown_tool'
            const now = Date.now()
            const starts = this.toolStartTimes.get(toolName) || []
            const startedAt = starts.pop()
            if (startedAt !== undefined) this.toolStartTimes.set(toolName, starts)
            const durationMs = startedAt !== undefined ? now - startedAt : undefined

            const outputPreview = stringifyPreview(
              event.data?.output ?? event.data?.result ?? event.data?.observation
            )
            console.log(`[sidecar] [MCP TOOL END] ${toolName}`, {
              at: new Date(now).toISOString(),
              durationMs,
              outputPreview
            })
            this.streamCallback({
              type: 'tool_end',
              content: `✅ ${toolName} completed`,
              tool: toolName,
              output: event.data?.output ?? event.data?.result ?? event.data?.observation ?? null,
              timestamp: new Date().toISOString()
            })
            break
          }
          case 'on_chat_model_stream':
          case 'on_llm_stream': {
            const chunk = event.data?.chunk
            let token = ''
            if (typeof chunk?.content === 'string') {
              token = chunk.content
            } else if (Array.isArray(chunk?.content)) {
              token = chunk.content.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join('')
            } else if (typeof chunk?.text === 'string') {
              token = chunk.text
            }
            if (token) {
              if (!responseStarted) {
                this.streamCallback({
                  type: 'response_start',
                  content: 'Response:',
                  timestamp: new Date().toISOString()
                })
                responseStarted = true
              }
              if (!llmStarted) {
                console.log('[sidecar] [LLM STREAM]', { at: new Date().toISOString() })
                llmStarted = true
              }
              finalText += token
              llmChars += token.length
              try { process.stdout.write(token) } catch {}
              this.streamCallback({
                type: 'token',
                content: token,
                timestamp: new Date().toISOString()
              })
            }
            break
          }
        }
      }

      if (llmStarted) {
        try { process.stdout.write('\n') } catch {}
        console.log('[sidecar] [LLM COMPLETE]', { at: new Date().toISOString(), totalChars: llmChars })
      }
      return finalText.trim()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isGoogleCalendarOAuthError =
        message.includes('OAuth credentials not found') ||
        message.includes('Error loading OAuth keys') ||
        message.includes('google-calendar-mcp')

      if (isGoogleCalendarOAuthError) {
        this.streamCallback({
          type: 'oauth_required',
          provider: 'google_calendar',
          content: 'Google Calendar OAuth is required to use this tool.',
          authUrl: 'https://console.cloud.google.com/apis/credentials',
          timestamp: new Date().toISOString()
        })
      }

      this.streamCallback({
        type: 'error',
        content: 'Error during processing',
        error: message,
        timestamp: new Date().toISOString()
      })
      console.error('[sidecar] Agent error:', message)
      throw error
    }
  }
}

// Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, apiKey, model, providerId, systemPrompt } = req.body || {}

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Derive effective key (body -> header -> env)
    const headerKey = req.header('x-openai-key')
    const effectiveKey = apiKey || headerKey || process.env.OPENAI_API_KEY
    const masked = effectiveKey ? `${String(effectiveKey).slice(0, 3)}***` : 'none'
    console.log('[sidecar] Using API key:', masked)

    console.log('[sidecar] Processing streaming message:', stringifyPreview(message))

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no'
    })

    ;(res as any).flushHeaders?.()

    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`)

    try {
      // CRITICAL DECISION POINT: Detect if this is a PDF question and disable MCP tools accordingly
      const disableMCP = isPdfQuestion(message)
      console.log(`[sidecar] Question type: ${disableMCP ? 'PDF/Document (LLM only)' : 'Action/Tool (MCP enabled)'}`)
      
      const result = createAgent({ 
        apiKey: effectiveKey, 
        model, 
        providerId, 
        systemPrompt,
        disableMCP 
      })
      
      if (result.isPDFMode) {
        // PDF mode: Use LLM streaming with file context
        const { llm, systemPrompt: derivedSystemPrompt } = result
        
        // Add file context if available
        let enhancedSystemPrompt = enhanceSystemPromptWithDateTime(derivedSystemPrompt)
        if (req.body.fileContext && req.body.fileContext.length > 0) {
          const fileContent = req.body.fileContext.join('\n\n---\n\n');
          enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nFile Context:\n\n${fileContent}`;
        }
        
        // Send response start event
        res.write(`data: ${JSON.stringify({ type: 'response_start', content: 'Response:' })}\n\n`)
        
        // Use LLM streaming (word by word)
        const stream = await llm.stream([
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: message }
        ])
        
        // Process each token and send as streaming events
        for await (const chunk of stream) {
          if (chunk.content) {
            res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`)
          }
        }
        
        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'complete', timestamp: new Date().toISOString() })}\n\n`)
        
      } else {
        // Action mode: Use MCP agent with streaming
        const { agent, systemPrompt: derivedSystemPrompt } = result
        const streamingAgent = new StreamingMCPAgent(agent, (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`)
        })
        
        // Use systemPrompt if provided, otherwise just the message
        let enhancedSystemPrompt = enhanceSystemPromptWithDateTime(derivedSystemPrompt)
        
        // Add file context if available
        if (req.body.fileContext && req.body.fileContext.length > 0) {
          const fileContent = req.body.fileContext.join('\n\n---\n\n');
          enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nFile Context:\n\n${fileContent}`;
        }
        
        const finalMessage = `${enhancedSystemPrompt}\n\n${message}`
        await streamingAgent.run(finalMessage)
      }

      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        timestamp: new Date().toISOString()
      })}\n\n`)

    } catch (error) {
      console.error('[sidecar] Streaming error:', error)
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        content: 'Sorry, I encountered an error while processing your request.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`)
    res.end()

  } catch (error) {
    console.error('[sidecar] Stream setup error:', error)
    res.status(500).json({ 
      error: 'Failed to setup streaming',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Non-streaming chat endpoint (fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, apiKey, model, providerId, systemPrompt } = req.body || {}

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const headerKey = req.header('x-openai-key')
    const effectiveKey = apiKey || headerKey || process.env.OPENAI_API_KEY
    const masked = effectiveKey ? `${String(effectiveKey).slice(0, 3)}***` : 'none'
    console.log('[sidecar] Using API key:', masked)

    console.log('[sidecar] Processing message:', stringifyPreview(message))

    // Same intelligent routing logic
    const disableMCP = isPdfQuestion(message)
    console.log(`[sidecar] Question type: ${disableMCP ? 'PDF/Document (LLM only)' : 'Action/Tool (MCP enabled)'}`)
    
    const result = createAgent({ 
      apiKey: effectiveKey, 
      model, 
      providerId, 
      systemPrompt,
      disableMCP 
    })
    
    let response: string
    
    if (result.isPDFMode) {
      // PDF mode: Use LLM streaming and collect full response
      const { llm, systemPrompt: derivedSystemPrompt } = result
      
      // Add file context if available
      let enhancedSystemPrompt = enhanceSystemPromptWithDateTime(derivedSystemPrompt)
      if (req.body.fileContext && req.body.fileContext.length > 0) {
        const fileContent = req.body.fileContext.join('\n\n---\n\n');
        enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nFile Context:\n\n${fileContent}`;
      }
      
      // Use LLM streaming and collect all tokens
      const stream = await llm.stream([
        { role: "system", content: enhancedSystemPrompt },
        { role: "user", content: message }
      ])
      
      let fullResponse = ''
      for await (const chunk of stream) {
        if (chunk.content) {
          fullResponse += chunk.content
        }
      }
      
      response = fullResponse
    } else {
      // Action mode: Use MCP agent
      const { agent, systemPrompt: derivedSystemPrompt } = result
      
      let enhancedSystemPrompt = enhanceSystemPromptWithDateTime(derivedSystemPrompt)
      
      // Add file context if available
      if (req.body.fileContext && req.body.fileContext.length > 0) {
        const fileContent = req.body.fileContext.join('\n\n---\n\n');
        enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nFile Context:\n\n${fileContent}`;
      }
      
      const finalMessage = `${enhancedSystemPrompt}\n\n${message}`
      response = await agent.run(finalMessage)
    }

    res.json({ 
      success: true, 
      response: response,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[sidecar] Chat error:', error)
    const msg = error instanceof Error ? error.message : String(error)

    res.status(500).json({ 
      error: 'Failed to process message',
      details: msg
    })
  }
})

// Health check endpoint
app.get('/api/health', (_req, res) => {
  console.log('[sidecar] Health check')
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Get available MCP tools
app.get('/api/tools', async (_req, res) => {
  try {
    res.json({ 
      tools: [
        { name: 'playwright', description: 'Web automation and testing tools' }
      ]
    })
  } catch (error) {
    console.error('[sidecar] Tools error:', error)
    res.status(500).json({ error: 'Failed to get tools' })
  }
})

app.listen(port, () => {
  console.log(`🚀 MCP Chat Server running on http://localhost:${port}`)
  console.log(`📡 API endpoints:`)
  console.log(`   POST /api/chat/stream - Send messages to MCP agent (streaming)`) 
  console.log(`   POST /api/chat - Send messages to MCP agent (non-streaming)`) 
  console.log(`   GET  /api/health - Health check`) 
  console.log(`   GET  /api/tools - List available MCP tools`)
  try {
    const servers = Object.keys((config as any).mcpServers || {})
    console.log(`🧩 MCP servers configured: ${servers.join(', ') || '(none)'}`)
  } catch {}
}) 