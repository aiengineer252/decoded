import type { Entry } from '../../types'

export const mcp: Entry = {
  slug: 'model-context-protocol',
  name: 'Model Context Protocol',
  org: 'Anthropic',
  tagline: 'A JSON-RPC wire protocol that moves tool definitions out of your agent framework and behind a process boundary.',
  categories: ['protocol', 'agents', 'tooling'],
  status: 'demo',
  publishedAt: '2026-08-13',
  updatedAt: '2026-08-13',
  reviewedBy: 'AI engineer',
  readingMinutes: 7,
  explainer: {
    beginner:
      'If you want an AI assistant to do something real — read a file, query your database, check the weather — you have to give it a tool. Before this, every framework had its own way of describing tools, so the same function had to be rewritten for each one, and the description handed to the model was a second copy that drifted out of sync with the code. MCP makes a tool a separate small program that speaks one standard message format. Write it once and any compatible app can use it, whatever language it was built in. The model itself never runs anything: it says "I would like to call this", and the host app decides whether that actually happens.',
    practitioner:
      'JSON-RPC 2.0 over stdio or streamable HTTP, with a stateful session opened by an `initialize` capability handshake. Tools are discovered at runtime via `tools/list` rather than compiled in, and `listChanged` lets the set change mid-session — so adding a tool no longer means redeploying the agent. Schemas are derived from your function signature, which removes the drifting second copy. The real architectural gain is the process boundary: the server holds its own dependencies and credentials, so your API keys never enter the agent process or the model context.',
    expert:
      'Judge it as a protocol, not a product — which means benchmarks are a category error here and the factor is weighted near zero for that reason. The meaningful signals are that independent parties implemented clients from the spec alone, and that the spec develops in public. Two things to price honestly: serialisation makes this a poor fit for hot in-loop functions, and a server you did not write describes its own tools to your model, which is a genuine trust boundary rather than a theoretical one. Local stdio servers have been the stable bet; the transport and authorisation stories have both moved since launch, so anything built against remote servers should expect churn.',
  },
  prerequisites: [
    'What tool use / function calling means for an LLM',
    'Roughly what a client-server protocol is',
  ],
  glossary: [
    { term: 'MCP', plain: 'Model Context Protocol. A standard message format for giving AI apps access to tools and data.' },
    { term: 'JSON-RPC', plain: 'A simple convention for calling a function on another program by sending it JSON.' },
    { term: 'stdio', plain: 'Standard input/output — the plainest way two programs on one machine can talk. No port, no network.' },
    { term: 'JSON Schema', plain: 'A machine-readable description of what shape some data should be. Here it describes a tool\'s arguments.' },
    { term: 'host', plain: 'The app the user actually interacts with — an editor or desktop client. It owns the model calls.' },
    { term: 'tool_use block', plain: 'The structured request a model emits when it wants a tool run. It is a request, not an action.' },
  ],
  changelog: [{ date: '2026-08-13', note: 'First published. Benchmarks factor scored neutral and weighted to 5% — a wire protocol makes no numeric claim.' }],
  sources: [
    { kind: 'docs', label: 'modelcontextprotocol.io — specification', url: 'https://modelcontextprotocol.io' },
    { kind: 'repo', label: 'modelcontextprotocol/python-sdk', url: 'https://github.com/modelcontextprotocol/python-sdk' },
    { kind: 'repo', label: 'modelcontextprotocol/servers — reference servers', url: 'https://github.com/modelcontextprotocol/servers' },
    { kind: 'blog', label: 'Anthropic — Introducing MCP', url: 'https://www.anthropic.com/news/model-context-protocol' },
  ],

  architecture: {
    caption:
      'MCP is not a library you import into your agent — it is a process boundary. Everything right of the transport runs in a program your agent did not compile against.',
    nodes: [
      {
        id: 'host',
        label: 'Host app',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'IDE / desktop app / your agent',
        detail:
          'The host owns the conversation and the model calls. It is the only component that talks to the LLM. Crucially it does not know what tools exist until it asks — the tool list is discovered at runtime, not compiled in.',
        code: {
          lang: 'json',
          file: 'claude_desktop_config.json — how a host is told which servers to spawn',
          url: 'https://modelcontextprotocol.io/quickstart/user',
          snippet: `{
  "mcpServers": {
    "weather": {
      "command": "uv",
      "args": ["--directory", "/abs/path/weather", "run", "weather.py"]
    }
  }
}`,
          focus: [4, 5],
        },
      },
      {
        id: 'client',
        label: 'MCP client',
        kind: 'control',
        col: 1,
        row: 0,
        summary: 'one client session per server',
        detail:
          'The host creates one client per server, and each client holds exactly one stateful session. The session opens with an `initialize` handshake that exchanges protocol version and capabilities — this is where a server declares whether it offers tools, resources, prompts, or sampling.',
        code: {
          lang: 'python',
          file: 'mcp python-sdk — opening a client session',
          url: 'https://github.com/modelcontextprotocol/python-sdk',
          snippet: `async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()          # capability handshake
        tools = await session.list_tools()  # runtime discovery
        result = await session.call_tool("get_forecast", {"city": "Pune"})`,
          focus: [3, 4, 5],
        },
      },
      {
        id: 'transport',
        label: 'Transport',
        kind: 'compute',
        col: 2,
        row: 0,
        summary: 'stdio or streamable HTTP',
        detail:
          'Messages are JSON-RPC 2.0 frames. Over stdio the server is a subprocess and frames are newline-delimited on stdin/stdout — which is why a local MCP server needs no port, no auth and no network. Over HTTP the same frames travel as a streamable HTTP session, which is what makes remote servers possible.',
        code: {
          lang: 'json',
          file: 'a tools/call request frame on the wire',
          snippet: `{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_forecast",
    "arguments": { "city": "Pune" }
  }
}`,
          focus: [4, 6],
        },
      },
      {
        id: 'server',
        label: 'MCP server',
        kind: 'compute',
        col: 3,
        row: 0,
        summary: 'decorated handlers, own process',
        detail:
          'The server is an ordinary program. It registers handlers and advertises their JSON Schema. Because it runs in its own process with its own dependencies, a Python server can be consumed by a TypeScript host — the schema is the only shared artifact.',
        code: {
          lang: 'python',
          file: 'weather.py — a complete MCP server',
          url: 'https://modelcontextprotocol.io/quickstart/server',
          snippet: `from mcp.server.fastmcp import FastMCP

mcp = FastMCP("weather")

@mcp.tool()
def get_forecast(city: str) -> str:
    """Get the weather forecast for a city."""
    return _call_weather_api(city)

if __name__ == "__main__":
    mcp.run(transport="stdio")`,
          focus: [5, 6, 7],
        },
      },
      {
        id: 'schema',
        label: 'Schema registry',
        kind: 'store',
        col: 3,
        row: 1,
        summary: 'inferred from type hints',
        detail:
          'FastMCP derives the JSON Schema for each tool from the function signature and docstring. That schema is what the host eventually hands the model — so your Python type hints become the model-facing contract, with no second copy to keep in sync.',
        code: {
          lang: 'json',
          file: 'the tools/list result derived from the function above',
          snippet: `{
  "name": "get_forecast",
  "description": "Get the weather forecast for a city.",
  "inputSchema": {
    "type": "object",
    "properties": { "city": { "type": "string" } },
    "required": ["city"]
  }
}`,
          focus: [4, 5, 6, 7],
        },
      },
      {
        id: 'llm',
        label: 'LLM',
        kind: 'model',
        col: 1,
        row: 1,
        summary: 'chooses the tool, never calls it',
        detail:
          'The model receives the discovered schemas as tool definitions and emits a tool-use request. It never touches the transport. This separation is the security story: the host mediates every call and can refuse one.',
        sourceUrl: 'https://modelcontextprotocol.io/docs/learn/architecture',
      },
      {
        id: 'result',
        label: 'Content blocks',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'text / image / resource refs',
        detail:
          'A tool result is a list of typed content blocks, not a string. That is what lets a tool return an image or a pointer to a resource the host can fetch separately, instead of stuffing everything back into the context window.',
      },
    ],
    edges: [
      { from: 'host', to: 'client' },
      { from: 'client', to: 'transport', label: 'JSON-RPC' },
      { from: 'transport', to: 'server' },
      { from: 'server', to: 'schema', kind: 'dashed' },
      { from: 'server', to: 'result' },
      { from: 'result', to: 'llm', label: 'tool result' },
      { from: 'llm', to: 'host', kind: 'dashed' },
    ],
    flow: ['host', 'client', 'transport', 'server', 'result', 'llm'],
  },

  trace: {
    caption:
      'A real session, frame by frame. Note how little of this the model is involved in — steps 1 to 3 happen before the LLM sees anything.',
    input: {
      type: 'user turn',
      preview: '"What\'s the weather in Pune tomorrow?"',
    },
    steps: [
      {
        id: 's1',
        nodeId: 'client',
        label: 'initialize — capability handshake',
        note: 'Before any tool exists, client and server agree on a protocol version and declare what they support. A server that offers no tools says so here, and the host stops asking.',
        input: { type: 'JSON-RPC request', preview: '{"method": "initialize", "params": {\n  "protocolVersion": "2025-06-18",\n  "capabilities": { "sampling": {} }\n}}' },
        output: {
          type: 'JSON-RPC result',
          preview: '{"result": {\n  "protocolVersion": "2025-06-18",\n  "capabilities": { "tools": { "listChanged": true } },\n  "serverInfo": { "name": "weather", "version": "1.0.0" }\n}}',
        },
        cost: '0 tokens',
      },
      {
        id: 's2',
        nodeId: 'server',
        label: 'tools/list — runtime discovery',
        note: 'The host asks what exists. This is the step that makes MCP different from a plugin system: the answer can change between turns, and `listChanged` lets the server push an update.',
        input: { type: 'JSON-RPC request', preview: '{"method": "tools/list", "params": {}}' },
        output: {
          type: 'Tool[]',
          preview: `[{
  "name": "get_forecast",
  "description": "Get the weather forecast for a city.",
  "inputSchema": {
    "type": "object",
    "properties": {"city": {"type": "string"}},
    "required": ["city"]
  }
}]`,
        },
        cost: '0 tokens',
      },
      {
        id: 's3',
        nodeId: 'host',
        label: 'Host injects schemas into the model request',
        note: 'Only now does the LLM enter. The discovered schemas are placed in the `tools` field of the model call — this is ordinary tool use, and it is the point where MCP stops being special.',
        output: {
          type: 'Messages API request',
          preview: `{
  "model": "claude-opus-5",
  "messages": [{"role": "user", "content": "What's the weather in Pune tomorrow?"}],
  "tools": [{"name": "get_forecast", "input_schema": {...}}]
}`,
          truncated: true,
        },
        cost: '~120 prompt tokens',
      },
      {
        id: 's4',
        nodeId: 'llm',
        label: 'Model emits a tool_use block',
        note: 'The model does not call anything. It returns a structured request and stops, handing control back to the host — which may log it, rewrite it, ask the user, or refuse.',
        output: {
          type: 'content block',
          preview: `{
  "type": "tool_use",
  "id": "toolu_01A...",
  "name": "get_forecast",
  "input": { "city": "Pune" }
}`,
        },
        cost: '~30 output tokens',
      },
      {
        id: 's5',
        nodeId: 'transport',
        label: 'tools/call crosses the process boundary',
        note: 'The host translates the model\'s tool_use into a JSON-RPC frame and writes it to the server\'s stdin. This is the only moment untrusted model output becomes an action, which is exactly why it is one auditable chokepoint.',
        input: { type: 'JSON-RPC request', preview: '{"jsonrpc":"2.0","id":3,"method":"tools/call",\n "params":{"name":"get_forecast","arguments":{"city":"Pune"}}}' },
        output: { type: 'bytes on stdin', preview: '134 bytes, newline-delimited' },
        cost: '< 1 ms',
      },
      {
        id: 's6',
        nodeId: 'server',
        label: 'Handler runs in the server process',
        note: 'Your function executes with your dependencies, your credentials and your network access — none of which the host has. The API key for the weather service lives here and never enters the model context.',
        input: { type: 'kwargs', preview: '{"city": "Pune"}' },
        output: {
          type: 'CallToolResult',
          preview: `{"content": [
  {"type": "text", "text": "Pune, 14 Aug: 29C, 80% humidity, rain likely 6pm."}
], "isError": false}`,
        },
        cost: '210 ms (network)',
      },
      {
        id: 's7',
        nodeId: 'llm',
        label: 'Result returns as a tool_result block',
        note: 'The content blocks are appended to the conversation as a tool_result and the model is called again. From here it is a normal second turn.',
        input: { type: 'content block', preview: '{"type": "tool_result", "tool_use_id": "toolu_01A...",\n "content": "Pune, 14 Aug: 29C, 80% humidity, rain likely 6pm."}' },
        output: { type: 'assistant text', preview: '"Rain is likely in Pune tomorrow evening, around 29C with high humidity — carry something waterproof after 6."' },
        cost: '~90 tokens',
      },
    ],
    result: {
      type: 'assistant turn',
      preview: '"Rain is likely in Pune tomorrow evening, around 29C…"\n\n2 model calls, 1 subprocess round-trip, 0 lines of glue in the host.',
    },
  },

  displacement: {
    replaces: ['per-framework tool adapters', 'bespoke plugin APIs', 'copy-pasted JSON Schemas'],
    doesNotReplace: ['the agent loop', 'function calling', 'auth', 'RAG', 'your framework'],
    before: {
      label: 'Tool bound to one framework, in-process',
      lang: 'python',
      file: 'the shape almost every agent codebase had before',
      snippet: `from langchain_core.tools import tool

@tool
def get_forecast(city: str) -> str:
    """Get the weather forecast for a city."""
    return _call_weather_api(city)

# ...and this same tool, re-declared for the other runtime:
OPENAI_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_forecast",
        "parameters": {"type": "object",
                       "properties": {"city": {"type": "string"}},
                       "required": ["city"]},
    },
}

agent = create_react_agent(llm, tools=[get_forecast])`,
    },
    after: {
      label: 'Tool behind a process boundary, framework-agnostic',
      lang: 'python',
      file: 'weather.py — written once, consumed by any MCP host',
      url: 'https://modelcontextprotocol.io/quickstart/server',
      snippet: `from mcp.server.fastmcp import FastMCP

mcp = FastMCP("weather")

@mcp.tool()
def get_forecast(city: str) -> str:
    """Get the weather forecast for a city."""
    return _call_weather_api(city)

if __name__ == "__main__":
    mcp.run(transport="stdio")`,
    },
    annotations: [
      { side: 'before', lines: [1, 3], note: 'The decorator ties the tool to one framework\'s runtime. Switching frameworks means rewriting it.' },
      { side: 'before', lines: [8, 9, 10, 11, 12, 13, 14, 15, 16], note: 'The schema is duplicated by hand for every other runtime — and drifts from the signature the first time an argument changes.' },
      { side: 'before', lines: [18], note: 'Tools are fixed at construction. Adding one means a redeploy of the agent.' },
      { side: 'after', lines: [5, 6, 7], note: 'Same function body. The schema is derived from the signature, so there is exactly one copy of the truth.' },
      { side: 'after', lines: [10, 11], note: 'It is now a program, not a library object — which is what makes it reusable across hosts and languages.' },
    ],
    whatDisappears: [
      'The N frameworks x M tools rewrite problem — one server serves every host.',
      'Hand-maintained JSON Schema copies that drift from the function signature.',
      'Redeploying your agent to add a tool: `listChanged` updates the set live.',
      'Your agent process needing the tool\'s dependencies, credentials or network reach.',
    ],
    newCosts: [
      'A process to supervise, and a crash surface that is no longer a Python exception.',
      'Serialisation on every call — MCP is not free for hot, chatty, in-loop functions.',
      'A real security boundary to think about: a server you did not write can describe its own tools to your model.',
      'Local stdio servers are trivial; remote HTTP servers drag in auth, which the protocol leaves largely to you.',
    ],
  },

  verdict: {
    score: 80,
    headline:
      'Real, and unusually boring in the way good infrastructure is — it standardises the least interesting part of agent building, which is exactly why it spread.',
    factors: [
      {
        key: 'reproducibility',
        label: 'Can you run it today?',
        score: 0.92,
        weight: 0.28,
        reasoning:
          'The specification, SDKs in several languages, and a repository of reference servers are all public and installable. A working server is roughly ten lines, and the quickstart runs end-to-end without an account.',
        evidence: [
          { claim: 'Full specification published, versioned by date.', url: 'https://modelcontextprotocol.io' },
          { claim: 'Official Python SDK with a complete server implementation.', url: 'https://github.com/modelcontextprotocol/python-sdk' },
          { claim: 'Reference servers (filesystem, git, fetch, and others) published as runnable code.', url: 'https://github.com/modelcontextprotocol/servers' },
        ],
      },
      {
        key: 'benchmarks',
        label: 'Are the numbers real?',
        score: 0.5,
        weight: 0.05,
        reasoning:
          'Not applicable, and scored neutral rather than silently dropped. A wire protocol has no accuracy or throughput claim to verify — treating "no benchmarks" as a failure here would be a category error, so this factor is weighted down to 5%.',
        evidence: [{ claim: 'No performance claims are made by the specification, so there is nothing to reproduce.' }],
      },
      {
        key: 'adoption',
        label: 'Is anyone actually using it?',
        score: 0.85,
        weight: 0.27,
        reasoning:
          'Client support extends well past the originating vendor — IDEs, desktop apps and agent frameworks ship MCP clients, and the public server ecosystem is large enough that most common integrations already exist.',
        evidence: [
          { claim: 'Multiple independent hosts implement MCP clients, including editors and third-party agent frameworks.', url: 'https://modelcontextprotocol.io/clients' },
          { claim: 'A large public directory of community servers exists rather than a handful of vendor demos.', url: 'https://github.com/modelcontextprotocol/servers' },
        ],
      },
      {
        key: 'independence',
        label: 'Has anyone outside verified it?',
        score: 0.8,
        weight: 0.22,
        reasoning:
          'Independent SDK and client implementations exist that were not written by the authoring vendor, which is the meaningful test for a protocol — it means the spec is complete enough to implement from.',
        evidence: [
          { claim: 'Third-party SDKs and clients exist in languages beyond the original reference implementations.', url: 'https://modelcontextprotocol.io/clients' },
          { claim: 'Specification development happens in public with external contributions.', url: 'https://github.com/modelcontextprotocol' },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.6,
        weight: 0.18,
        reasoning:
          'The core (JSON-RPC, tools, resources, prompts) has been stable, but the transport story and the authorisation story have both moved since launch. Anything you build against remote servers should expect churn; local stdio servers have been the safe bet.',
        evidence: [
          { claim: 'Protocol versions are dated and have changed materially, including transport revisions.', url: 'https://modelcontextprotocol.io/specification' },
        ],
      },
    ],
    useIf: [
      'You maintain the same tool across more than one agent runtime or host.',
      'You want tool credentials to live outside your agent process.',
      'Your tool set needs to change without redeploying the agent.',
    ],
    skipIf: [
      'You have one app, one framework and five tools — the boundary costs more than it saves.',
      'Your "tools" are hot in-process functions called dozens of times per turn.',
      'You need remote multi-tenant auth today and cannot absorb spec churn.',
    ],
    wouldChangeMyMind: [
      'A serious, widely-reported security incident traced to third-party server trust would cut adoption and maturity together.',
      'A competing protocol shipping in a majority of hosts would drop independence sharply.',
      'A transport revision that breaks existing servers again would push maturity below 0.5.',
    ],
  },
}
