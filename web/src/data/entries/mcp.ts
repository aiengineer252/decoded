import type { Entry } from '../../types'

export const mcp: Entry = {
  slug: 'model-context-protocol',
  name: 'Model Context Protocol',
  org: 'Anthropic',
  tagline:
    'Write a tool once as a small separate program that speaks one standard message format, and any AI app can use it — whatever language either side is built in.',
  categories: ['protocol', 'agents', 'tooling'],
  status: 'demo',
  publishedAt: '2026-08-13',
  updatedAt: '2026-09-10',
  reviewedBy: 'AI engineer',
  readingMinutes: 9,
  sources: [
    { kind: 'docs', label: 'modelcontextprotocol.io — specification', url: 'https://modelcontextprotocol.io' },
    { kind: 'repo', label: 'modelcontextprotocol/python-sdk', url: 'https://github.com/modelcontextprotocol/python-sdk' },
    { kind: 'repo', label: 'modelcontextprotocol/servers — reference servers', url: 'https://github.com/modelcontextprotocol/servers' },
    { kind: 'blog', label: 'Anthropic — Introducing MCP', url: 'https://www.anthropic.com/news/model-context-protocol' },
  ],

  problem: {
    before:
      'You want your AI assistant to check the weather, read a file, or query your database. So you write a tool. Then you want it in a second app built on a different framework — and you write it again, in that framework\'s format. The description you hand the model is a hand-copied second version of your function\'s signature that drifts out of date the first time an argument changes. Every app, every framework, every tool: rewrite.',
    insight:
      'Make the tool a tiny separate program that speaks one standard message format. The app discovers what it offers at runtime and asks it to run things; the model only ever says "I would like to call this".',
    payoff:
      'Write a tool once and every compatible app can use it, across languages. Add a tool without redeploying the app. Keep your API keys in the tool\'s process, never in the model\'s context. The trade: a process boundary, and a new trust question about tools you did not write.',
  },

  explainer: {
    beginner:
      'Think of a universal power socket. Before it, every appliance needed its own wall wiring. MCP is the socket for AI tools: a tool is a small standalone program, it plugs into any app that speaks the standard, and the app asks it "what can you do?" when it starts. When the AI decides it wants to use a tool, it does not run anything itself — it says "I\'d like to call get_forecast with city=Pune", and the app decides whether to actually do that, sends the request to the tool program, and hands the answer back. Three things fall out of this. You write a tool once. You can add tools while the app is running. And the tool keeps its own secrets — your weather API key lives in the tool\'s program, and the AI never sees it.',
    practitioner:
      'JSON-RPC 2.0 over stdio or streamable HTTP, with a stateful session opened by an `initialize` capability handshake. Tools are discovered at runtime via `tools/list` rather than compiled in, and `listChanged` lets the set change mid-session — so adding a tool no longer means redeploying the agent. Schemas are derived from your function signature, which removes the drifting second copy. The real architectural gain is the process boundary: the server holds its own dependencies and credentials, so your API keys never enter the agent process or the model context.',
    expert:
      'Judge it as a protocol, not a product — which means benchmarks are a category error here and the factor is weighted near zero for that reason. The meaningful signals are that independent parties implemented clients from the spec alone, and that the spec develops in public. Two things to price honestly: serialisation makes this a poor fit for hot in-loop functions, and a server you did not write describes its own tools to your model, which is a genuine trust boundary rather than a theoretical one. Local stdio servers have been the stable bet; the transport and authorisation stories have both moved since launch, so anything built against remote servers should expect churn.',
  },
  prerequisites: [
    'What tool use / function calling means for an LLM — the model asks for a function to be run, and something else runs it',
    'Roughly what a client-server relationship is',
  ],
  glossary: [
    { term: 'MCP', plain: 'Model Context Protocol. A standard message format for giving AI apps access to tools and data.' },
    { term: 'host', plain: 'The app the user actually interacts with — an editor, a desktop chat client, your agent. It owns the conversation and talks to the model.' },
    { term: 'server', plain: 'The small program that provides tools. Despite the name it usually runs on your own machine as a subprocess.' },
    { term: 'JSON-RPC', plain: 'A simple convention for calling a function on another program by sending it a JSON message like {"method": "tools/call", ...}.' },
    { term: 'stdio', plain: 'Standard input/output — the plainest way two programs on one machine can talk. No port, no network, no auth needed.' },
    { term: 'JSON Schema', plain: 'A machine-readable description of what shape some data should be. Here it describes what arguments a tool accepts.' },
    { term: 'tool_use block', plain: 'The structured request a model emits when it wants a tool run. It is a request — the model itself never runs anything.' },
  ],
  changelog: [
    { date: '2026-09-10', note: 'Rewritten for progressive reading: problem-first opener, plain-language trace, whole-file code with guided walkthroughs.' },
    { date: '2026-08-13', note: 'First published. Benchmarks factor scored neutral and weighted to 5% — a wire protocol makes no numeric claim.' },
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
        summary: 'the app the user talks to; owns the model calls',
        detail:
          'The host owns the conversation and the model calls. It is the only component that talks to the LLM. Crucially it does not know what tools exist until it asks — the tool list is discovered at runtime, not compiled in.',
        plain:
          'The app you are actually using — a chat client, an editor, your own agent. It is the only thing that talks to the AI model. It does not have a built-in list of tools; it asks each tool program what it can do when it starts up.',
        code: {
          lang: 'json',
          file: 'how a host is told which tool programs to launch — claude_desktop_config.json',
          url: 'https://modelcontextprotocol.io/quickstart/user',
          snippet: `{
  "mcpServers": {
    "weather": {
      "command": "uv",
      "args": ["--directory", "/abs/path/weather", "run", "weather.py"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
    }
  }
}`,
          walkthrough: [
            {
              lines: [3, 4, 5],
              title: 'A server is just a command',
              note: 'The host launches this as a subprocess and talks to it over stdin/stdout. There is no port, no URL, no auth — the "server" is a local program, and the transport is the pipe the OS already gave you.',
              plain: 'This is how you plug in a tool: tell the app which program to run. The app starts it and talks to it through its input and output, like piping in a terminal. No network involved.',
            },
            {
              lines: [7, 8, 9],
              title: 'Different language, same socket',
              note: 'The weather server above is Python (via uv); this one is JavaScript (via npx). The host does not care — both speak JSON-RPC over stdio. This is the interoperability claim, and it is real: the schema is the only shared artifact.',
              plain: 'The first tool is written in Python, the second in JavaScript. The app neither knows nor cares — they both speak the same standard. That is the "universal socket" idea made concrete.',
            },
          ],
        },
      },
      {
        id: 'client',
        label: 'MCP client',
        kind: 'control',
        col: 1,
        row: 0,
        summary: 'one session per server: handshake, discover, call',
        detail:
          'The host creates one client per server, and each client holds exactly one stateful session. The session opens with an `initialize` handshake that exchanges protocol version and capabilities — this is where a server declares whether it offers tools, resources, prompts, or sampling.',
        plain:
          'For each tool program the app opens one connection. First they shake hands and agree on what version of the standard they speak. Then the app asks "what tools do you have?" and later "please run this one". That is the whole conversation.',
        code: {
          lang: 'python',
          file: 'a complete client: launch a server, discover its tools, call one (python-sdk)',
          url: 'https://github.com/modelcontextprotocol/python-sdk',
          snippet: `import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # Describe the server as a command to launch — same shape as the host config
    params = StdioServerParameters(command="uv", args=["run", "weather.py"])

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()            # 1. capability handshake

            tools = await session.list_tools()    # 2. runtime discovery
            for t in tools.tools:
                print(t.name, "-", t.description)
                # the inputSchema here is what the host hands to the model

            result = await session.call_tool(     # 3. execute, across the process boundary
                "get_forecast", {"city": "Pune"}
            )
            print(result.content[0].text)

asyncio.run(main())`,
          walkthrough: [
            {
              lines: [6, 7],
              title: 'Point at a program',
              note: 'The server is identified by the command that starts it. The client will spawn this as a subprocess. Nothing about the tool\'s implementation is known yet — not its language, not its dependencies, not what it offers.',
              plain: 'Tell the client which program to launch. At this point it knows nothing about what tools that program provides.',
            },
            {
              lines: [9, 10, 11],
              title: 'Open a session, shake hands',
              note: 'stdio_client spawns the process and hands back its stdin/stdout as a read/write pair. ClientSession wraps them in JSON-RPC. initialize() exchanges protocol versions and capabilities — the server says what kinds of things it can do (tools, resources, prompts) before any of them are listed.',
              plain: 'Start the program, wire up its input and output, and say hello. Both sides confirm which version of the standard they speak and what categories of things the tool program offers.',
            },
            {
              lines: [13, 14, 15, 16],
              title: 'Ask what exists — at runtime',
              note: 'list_tools() returns each tool\'s name, description and JSON Schema. This is the moment MCP differs from a plugin system: the list is fetched, not compiled in, and the server can push a listChanged notification later if it changes. The inputSchema returned here is exactly what the host will pass to the model as a tool definition.',
              plain: 'Ask the program "what can you do?" It answers with a list of tools, each with a description and the arguments it takes. The app did not need to know any of this in advance — and the list can change while the app is running.',
            },
            {
              lines: [18, 19, 20, 21],
              title: 'Call across the boundary',
              note: 'call_tool sends a tools/call JSON-RPC request over stdin and awaits the result on stdout. The function runs in the server process with the server\'s dependencies and credentials. The result is a list of typed content blocks — text here, but images and resource links are also possible.',
              plain: 'Ask the program to run one tool with some arguments. It runs in its own process — with its own libraries and its own secrets — and sends the answer back. The app just passes the answer along.',
            },
          ],
        },
      },
      {
        id: 'transport',
        label: 'Transport',
        kind: 'compute',
        col: 2,
        row: 0,
        summary: 'JSON-RPC frames over stdio (local) or HTTP (remote)',
        detail:
          'Messages are JSON-RPC 2.0 frames. Over stdio the server is a subprocess and frames are newline-delimited on stdin/stdout — which is why a local MCP server needs no port, no auth and no network. Over HTTP the same frames travel as a streamable HTTP session, which is what makes remote servers possible.',
        plain:
          'The messages themselves are small JSON documents: "method: tools/call, params: {...}". Locally they travel through the program\'s input and output pipes — no network at all. For tools running on another machine, the same messages go over HTTP instead.',
        code: {
          lang: 'json',
          file: 'a tools/call request and its response, exactly as they cross the pipe',
          snippet: `{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_forecast",
    "arguments": { "city": "Pune" }
  }
}

{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      { "type": "text", "text": "Pune, 14 Aug: 29C, 80% humidity, rain likely 6pm." }
    ],
    "isError": false
  }
}`,
          walkthrough: [
            {
              lines: [1, 2, 3, 4],
              title: 'The envelope',
              note: 'Every message carries the protocol version, a request id for matching replies, and a method name. This is plain JSON-RPC 2.0 — MCP adds the method names and payload shapes, not a new framing.',
              plain: 'Each message says which version it is, has an ID so the reply can be matched to the request, and names what it wants done. This part is a well-known standard that predates AI entirely.',
            },
            {
              lines: [5, 6, 7, 8],
              title: 'The call, as the model asked for it',
              note: 'The host translated the model\'s tool_use block into this params object. Name and arguments are exactly what the model emitted — this is the single chokepoint where untrusted model output becomes an action, which is why it is worth having exactly one.',
              plain: 'This is the AI\'s request, repackaged: which tool, with which arguments. Every tool call the AI ever makes passes through this one shape, which makes it easy to log, inspect, or refuse.',
            },
            {
              lines: [11, 12, 13, 14, 15, 16, 17, 18, 19],
              title: 'A typed result, not a string',
              note: 'The reply matches by id and returns a list of content blocks. A tool can return text, an image, or a reference to a resource the host fetches separately — which is what keeps large results out of the context window. isError lets a failure be reported without the transport failing.',
              plain: 'The answer comes back with the same ID. It is a list of typed pieces — text here, but tools can also return images or pointers to files. The AI only sees what the app decides to pass along.',
            },
          ],
        },
      },
      {
        id: 'server',
        label: 'MCP server',
        kind: 'compute',
        col: 3,
        row: 0,
        summary: 'your tool code, in its own process, with its own secrets',
        detail:
          'The server is an ordinary program. It registers handlers and advertises their JSON Schema. Because it runs in its own process with its own dependencies, a Python server can be consumed by a TypeScript host — the schema is the only shared artifact.',
        plain:
          'The tool program. Plain code with a decorator on each function you want to expose. It runs separately from the app, so it can use any libraries it likes, and it holds its own API keys — the AI never sees them.',
        code: {
          lang: 'python',
          file: 'weather.py — a complete, runnable MCP server',
          url: 'https://modelcontextprotocol.io/quickstart/server',
          snippet: `import os
import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("weather")

# Lives here, in the server process. Never in the host, never in the model's context.
API_KEY = os.environ["WEATHER_API_KEY"]

@mcp.tool()
async def get_forecast(city: str, days: int = 1) -> str:
    """Get the weather forecast for a city.

    Args:
        city: City name, e.g. "Pune"
        days: How many days ahead, 1-7
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.example-weather.com/forecast",
            params={"q": city, "days": days, "key": API_KEY},
        )
        r.raise_for_status()
        data = r.json()
    return f"{city}: {data['summary']}, {data['temp_c']}C"

@mcp.tool()
def list_supported_cities() -> list[str]:
    """Cities this server can forecast."""
    return ["Pune", "Mumbai", "Delhi", "Bengaluru"]

if __name__ == "__main__":
    mcp.run(transport="stdio")`,
          walkthrough: [
            {
              lines: [7, 8],
              title: 'The secret stays here',
              note: 'The API key is read from the server\'s own environment. Because the server is a separate process, the host never has it and the model never sees it. This is the security property that a framework-embedded tool cannot give you: the credential is on the far side of a process boundary.',
              plain: 'Your weather API key lives in this program\'s environment. The chat app never has it. The AI never sees it. It does not even leave this process.',
            },
            {
              lines: [10, 11, 12, 13, 14, 15, 16, 17],
              title: 'Signature becomes schema',
              note: 'FastMCP derives the tool\'s JSON Schema from the type hints (city: str, days: int = 1) and its description from the docstring. There is no second copy to keep in sync — change the signature and the schema the model sees changes with it. Compare this with hand-maintaining an OpenAI-style function schema alongside the function.',
              plain: 'That decorator turns an ordinary function into a tool. The argument types and the docstring become the description the AI reads. You do not write a separate description file — the function is the description.',
            },
            {
              lines: [18, 19, 20, 21, 22, 23, 24, 25],
              title: 'Ordinary code, ordinary dependencies',
              note: 'The body is unremarkable on purpose: an HTTP call with a library the host may not even have installed. The server\'s virtualenv is its own. Whatever it needs — a database driver, a heavy SDK, a specific Python version — stays out of the agent\'s dependency graph.',
              plain: 'The actual work is just normal code. It uses whatever libraries it wants; the app does not need them installed. That is a big deal when tools have heavy or conflicting dependencies.',
            },
            {
              lines: [27, 28, 29, 30],
              title: 'A second tool, zero extra wiring',
              note: 'Adding a tool is adding a decorated function. The host discovers it on the next tools/list — no registration step, no redeploy of the agent. This is what listChanged makes live.',
              plain: 'Want another tool? Write another function with the decorator. The app finds it automatically next time it asks. No config changes, no redeploy.',
            },
            {
              lines: [32, 33],
              title: 'It is a program, not a library',
              note: 'mcp.run starts the JSON-RPC loop on stdin/stdout. This line is why the tool is reusable across hosts and languages: it is an executable with a standard interface, not an object living inside one framework\'s process.',
              plain: 'This makes it a standalone program that reads requests and writes answers. Any app that speaks the standard can launch it. That is the whole reason it is portable.',
            },
          ],
        },
      },
      {
        id: 'schema',
        label: 'Schema registry',
        kind: 'store',
        col: 3,
        row: 1,
        summary: 'tool descriptions, generated from type hints',
        detail:
          'FastMCP derives the JSON Schema for each tool from the function signature and docstring. That schema is what the host eventually hands the model — so your Python type hints become the model-facing contract, with no second copy to keep in sync.',
        plain:
          'The "menu" the tool program shows the app — each tool\'s name, description, and arguments. It is generated automatically from the function definitions, so it can never drift out of date.',
        code: {
          lang: 'json',
          file: 'what tools/list returns for get_forecast — generated, never hand-written',
          snippet: `{
  "name": "get_forecast",
  "description": "Get the weather forecast for a city.\\n\\nArgs:\\n    city: City name, e.g. \\"Pune\\"\\n    days: How many days ahead, 1-7",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string" },
      "days": { "type": "integer", "default": 1 }
    },
    "required": ["city"]
  }
}`,
          walkthrough: [
            {
              lines: [2, 3],
              title: 'Name and description from the function',
              note: 'The function name becomes the tool name; the docstring becomes the description the model reads when deciding whether to call it. Write the docstring for the model, not for a human reader of the code.',
              plain: 'The tool\'s name is the function\'s name. The description is the docstring. The AI reads this to decide when to use the tool — so write the docstring with the AI in mind.',
            },
            {
              lines: [4, 5, 6, 7, 8, 9, 10, 11],
              title: 'Arguments from type hints',
              note: 'city: str became a required string; days: int = 1 became an optional integer with a default. This is exactly the tool definition the host passes to the model — so the Python signature is the model-facing contract.',
              plain: 'The arguments come straight from the function\'s type hints: city is required text, days is an optional number defaulting to 1. Change the function and this updates itself.',
            },
          ],
        },
      },
      {
        id: 'llm',
        label: 'LLM',
        kind: 'model',
        col: 1,
        row: 1,
        summary: 'picks a tool and emits a request; never runs it',
        detail:
          'The model receives the discovered schemas as tool definitions and emits a tool-use request. It never touches the transport. This separation is the security story: the host mediates every call and can refuse one.',
        plain:
          'The AI sees the menu of tools and, when it wants one, says "I would like to call get_forecast with city=Pune". That is all it does. The app decides whether to actually make the call. The AI never runs code and never talks to the tool program directly.',
        sourceUrl: 'https://modelcontextprotocol.io/docs/learn/architecture',
      },
      {
        id: 'result',
        label: 'Content blocks',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'typed results: text, images, resource links',
        detail:
          'A tool result is a list of typed content blocks, not a string. That is what lets a tool return an image or a pointer to a resource the host can fetch separately, instead of stuffing everything back into the context window.',
        plain:
          'What the tool sends back — a list of typed pieces. Text is the common case, but a tool can return an image, or a link to a big file that the app fetches only if needed. This keeps huge results from clogging the AI\'s memory.',
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
        plain: 'The app launches the weather tool program and they shake hands: "I speak version 2025-06-18; I can offer tools." Nothing about the weather yet — this is just two programs confirming they can understand each other.',
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
        plain: 'The app asks "what can you do?" and gets back the menu: one tool called get_forecast, taking a city name. The app did not know this in advance — and if the tool program adds another tool later, it can announce that too.',
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
        plain: 'Now the AI gets involved. The app sends it the user\'s question plus the menu of available tools. From the AI\'s point of view this is completely ordinary — it does not know or care that the tool came from a separate program.',
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
        plain: 'The AI reads the question, sees a weather tool on the menu, and replies "I want to call get_forecast with city=Pune" — then stops. It has not done anything. The app now decides whether to go ahead.',
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
        plain: 'The app repackages the AI\'s request as a standard message and writes it to the tool program\'s input. This is the single spot where "the AI wants something" turns into "something happens" — so it is the perfect place to log or block.',
        input: { type: 'JSON-RPC request', preview: '{"jsonrpc":"2.0","id":3,"method":"tools/call",\n "params":{"name":"get_forecast","arguments":{"city":"Pune"}}}' },
        output: { type: 'bytes on stdin', preview: '134 bytes, newline-delimited' },
        cost: '< 1 ms',
      },
      {
        id: 's6',
        nodeId: 'server',
        label: 'Handler runs in the server process',
        note: 'Your function executes with your dependencies, your credentials and your network access — none of which the host has. The API key for the weather service lives here and never enters the model context.',
        plain: 'The tool program runs your get_forecast function, using its own weather API key to fetch the forecast. The key never left this program. The AI has no idea it exists.',
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
        plain: 'The forecast text goes back to the AI as the answer to its request. The AI reads it and writes a normal reply to the user. From here on it is an ordinary conversation.',
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
