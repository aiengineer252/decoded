/**
 * A deliberately small syntax highlighter.
 *
 * Reasons for not pulling in Shiki/Prism: every code block on this site needs
 * per-line gutters, per-line annotations, diff shading and a focus dimmer, and
 * wiring that through a third-party renderer costs more than the ~120 lines
 * below. It only needs to handle python / typescript / json / bash.
 */

export type TokenType =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'func'
  | 'type'
  | 'punct'
  | 'attr'

export interface Token {
  type: TokenType
  value: string
}

export type Lang = 'python' | 'typescript' | 'json' | 'bash' | 'text'

const KEYWORDS: Record<string, string[]> = {
  python: [
    'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not',
    'and', 'or', 'import', 'from', 'as', 'with', 'yield', 'await', 'async',
    'try', 'except', 'finally', 'raise', 'lambda', 'pass', 'None', 'True',
    'False', 'self', 'assert', 'del', 'global', 'break', 'continue',
  ],
  typescript: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'of', 'in', 'new', 'class', 'extends', 'implements', 'interface', 'type',
    'import', 'from', 'export', 'default', 'async', 'await', 'try', 'catch',
    'finally', 'throw', 'null', 'undefined', 'true', 'false', 'this', 'as',
  ],
  bash: ['curl', 'cd', 'export', 'echo', 'pip', 'npm', 'uv', 'python', 'git', 'if', 'then', 'fi'],
  json: ['true', 'false', 'null'],
  text: [],
}

const COMMENT_START: Record<string, string> = {
  python: '#',
  bash: '#',
  typescript: '//',
  json: '',
  text: '',
}

/** Tokenize a single line. Line-scoped on purpose — no multiline strings. */
export function tokenizeLine(line: string, lang: Lang): Token[] {
  const tokens: Token[] = []
  const keywords = new Set(KEYWORDS[lang] ?? [])
  const commentMark = COMMENT_START[lang]

  let i = 0
  let buffer = ''

  const flush = () => {
    if (!buffer) return
    if (keywords.has(buffer)) tokens.push({ type: 'keyword', value: buffer })
    else if (/^\d[\d_.eE+-]*$/.test(buffer)) tokens.push({ type: 'number', value: buffer })
    else if (/^[A-Z][A-Za-z0-9_]*$/.test(buffer)) tokens.push({ type: 'type', value: buffer })
    else tokens.push({ type: 'plain', value: buffer })
    buffer = ''
  }

  while (i < line.length) {
    const rest = line.slice(i)

    // comment to end of line
    if (commentMark && rest.startsWith(commentMark)) {
      flush()
      tokens.push({ type: 'comment', value: rest })
      break
    }

    const ch = line[i]

    // strings
    if (ch === '"' || ch === "'" || ch === '`') {
      flush()
      let j = i + 1
      while (j < line.length && (line[j] !== ch || line[j - 1] === '\\')) j++
      const value = line.slice(i, Math.min(j + 1, line.length))
      // A JSON key is a string immediately followed by a colon.
      const after = line.slice(j + 1).trimStart()
      tokens.push({ type: after.startsWith(':') && lang === 'json' ? 'attr' : 'string', value })
      i = j + 1
      continue
    }

    // identifier / number characters
    if (/[A-Za-z0-9_$.]/.test(ch)) {
      buffer += ch
      i++
      continue
    }

    flush()

    // a name directly followed by "(" is a call
    if (ch === '(' && tokens.length) {
      const prev = tokens[tokens.length - 1]
      if (prev.type === 'plain' || prev.type === 'type') prev.type = 'func'
    }

    tokens.push({ type: /[{}()[\],;:=<>+\-*/%|&!?]/.test(ch) ? 'punct' : 'plain', value: ch })
    i++
  }
  flush()
  return tokens
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: 'text-[var(--code-plain)]',
  keyword: 'text-[var(--code-keyword)]',
  string: 'text-[var(--code-string)]',
  comment: 'text-[var(--code-comment)] italic',
  number: 'text-[var(--code-number)]',
  func: 'text-[var(--code-func)]',
  type: 'text-[var(--code-type)]',
  punct: 'text-[var(--code-punct)]',
  attr: 'text-[var(--code-attr)]',
}
