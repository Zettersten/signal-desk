import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const executable = process.argv[2]
if (!executable) throw new Error('Pass the compiled research worker path.')
const token = 'signal-desk-local-fixture'
let calls = 0
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(req) {
    if (new URL(req.url).pathname !== '/v1/chat/completions')
      return new Response('not found', { status: 404 })
    assert.equal(req.headers.get('authorization'), `Bearer ${token}`)
    const body = (await req.json()) as {
      model: string
      messages: unknown[]
      stream?: boolean
      tool_choice?: string
      tools?: { function?: { name?: string } }[]
    }
    assert.equal(body.model, 'signal-test')
    assert(
      !body.tools?.length || body.tool_choice === 'none',
      `Unexpected tools: ${body.tools?.map((tool) => tool.function?.name).join(', ')}`,
    )
    assert(JSON.stringify(body.messages).includes('Evaluation evidence'))
    calls++
    const content = 'Evidence review: verify commercial developments at the primary source [s1] [s2].'
    const core = { id: 'fixture', created: 100, model: 'signal-test' }
    if (!body.stream)
      return Response.json({
        ...core,
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 14, total_tokens: 34 },
      })
    const chunk = (delta: object, finish_reason: string | null) =>
      `data: ${JSON.stringify({ ...core, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason }] })}\n\n`
    return new Response(
      `${chunk({ role: 'assistant', content }, null)}${chunk({}, 'stop')}data: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  },
})

try {
  const child = Bun.spawn([resolve(executable)], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
  const timeout = setTimeout(() => child.kill(), 35_000)
  child.stdin.write(
    JSON.stringify({
      endpoint: `http://127.0.0.1:${server.port}/v1`,
      model: 'signal-test',
      token,
      objective: 'Compare commercial positioning',
      audience: 'Strategy',
      mode: 'Strategic brief',
      records: [
        { id: 's1', title: 'Evaluation evidence one' },
        { id: 's2', title: 'Evaluation evidence two' },
      ],
    }),
  )
  child.stdin.end()
  const output = await child.stdout.text()
  const code = await child.exited
  clearTimeout(timeout)
  assert.equal(code, 0, `Expected research worker to succeed after ${calls} inference requests`)
  const brief = JSON.parse(output) as { title: string; text: string }
  assert.equal(brief.title, 'Competitive landscape brief')
  assert(brief.text.includes('Evidence review'))
  assert.equal(calls, 2, 'Strategic brief should audit evidence before drafting')
  console.log('Embedded OpenCode verified against the loopback inference fixture.')
} finally {
  await server.stop(true)
}
