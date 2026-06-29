import { EPSILON, type Grammar, type PDA, type Production, type Transition } from "./types";
import { isNonTerminal, productionKey } from "./format";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export function normalizeInput(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[｛]/g, "{")
    .replace(/[｝]/g, "}")
    .replace(/[，]/g, ",")
    .replace(/[：]/g, ":")
    .replace(/[＝]/g, "=")
    .replace(/[∅]/g, "Φ")
    .replace(/lambda|Λ|ϵ|ε/gi, EPSILON)
    .replace(/->|=>|→/g, "->");
}

export function parseGrammar(input: string): Grammar {
  const text = normalizeInput(input);
  const productions: Production[] = [];
  const seen = new Set<string>();
  let start = "";

  for (const [index, rawLine] of text.split("\n").entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split("->");
    if (parts.length !== 2) {
      throw new ParseError(`第 ${index + 1} 行缺少唯一的产生式箭头 ->。`);
    }

    const left = parts[0].trim();
    if (!isNonTerminal(left)) {
      throw new ParseError(`第 ${index + 1} 行左部 "${left}" 不是合法非终结符。`);
    }
    if (!start) start = left;

    for (const alternative of parts[1].split("|")) {
      const production = { left, right: parseGrammarRight(alternative.trim()) };
      const key = productionKey(production);
      if (!seen.has(key)) {
        seen.add(key);
        productions.push(production);
      }
    }
  }

  if (!start) throw new ParseError("没有读取到任何产生式。");
  validateGrammar({ start, productions });
  return { start, productions };
}

export function parseGrammarRight(input: string): string[] {
  if (!input || input === EPSILON) return [];
  const symbols: string[] = [];

  for (let index = 0; index < input.length; ) {
    const char = input[index] ?? "";
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "<") {
      const end = input.indexOf(">", index + 1);
      if (end < 0) throw new ParseError(`非终结符 "${input.slice(index)}" 缺少 >。`);
      symbols.push(input.slice(index, end + 1));
      index = end + 1;
      continue;
    }

    if (char === "'" || char === '"') {
      const end = input.indexOf(char, index + 1);
      if (end < 0) throw new ParseError(`字符串符号 ${input.slice(index)} 缺少结束引号。`);
      symbols.push(input.slice(index + 1, end));
      index = end + 1;
      continue;
    }

    if (/[A-Z]/.test(char)) {
      const digits = input.slice(index + 1).match(/^[0-9]+/)?.[0] ?? "";
      symbols.push(char + digits);
      index += 1 + digits.length;
    } else {
      symbols.push(char);
      index += 1;
    }
  }

  return symbols;
}

function validateGrammar(grammar: Grammar): void {
  const leftSymbols = new Set(grammar.productions.map((production) => production.left));
  for (const production of grammar.productions) {
    for (const symbol of production.right) {
      if (isNonTerminal(symbol) && !leftSymbols.has(symbol)) {
        throw new ParseError(`非终结符 ${symbol} 被使用但没有对应产生式左部。`);
      }
    }
  }
}

export function parsePDA(input: string): PDA {
  const text = normalizeInput(input);
  const header = text.match(
    /(?:PDA\s*)?M\s*=\s*\(\s*\{([^}]*)\}\s*,\s*\{([^}]*)\}\s*,\s*\{([^}]*)\}\s*,\s*δ\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*(?:Φ|empty)\s*\)/,
  );

  if (!header) {
    throw new ParseError("没有识别到 PDA 定义，请使用讲义中的 M=({状态},{输入},{栈},δ,初态,栈底,Φ) 格式。");
  }

  const states = parseList(header[1] ?? "");
  const inputAlphabet = parseList(header[2] ?? "");
  const stackAlphabet = parseList(header[3] ?? "");
  const startState = (header[4] ?? "").trim();
  const bottomSymbol = (header[5] ?? "").trim();
  const transitions = parseTransitions(text, stackAlphabet);

  const pda: PDA = {
    states,
    inputAlphabet,
    stackAlphabet,
    startState,
    bottomSymbol,
    transitions,
  };
  validatePDA(pda);
  return pda;
}

function parseList(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTransitions(text: string, stackAlphabet: string[]): Transition[] {
  const transitions: Transition[] = [];
  const pattern =
    /δ\s*\(\s*([^,\s)]+)\s*,\s*([^,\s)]+)\s*,\s*([^,\s)]+)\s*\)\s*=\s*\{\s*\(\s*([^,\s)]+)\s*,\s*([^)}]+?)\s*\)\s*\}/g;

  for (const match of text.matchAll(pattern)) {
    const inputSymbol = (match[2] ?? "").trim();
    transitions.push({
      from: (match[1] ?? "").trim(),
      input: inputSymbol === EPSILON ? null : inputSymbol,
      pop: (match[3] ?? "").trim(),
      to: (match[4] ?? "").trim(),
      push: splitStackSymbols((match[5] ?? "").trim(), stackAlphabet),
    });
  }

  if (transitions.length === 0) {
    throw new ParseError("没有识别到 PDA 转移函数 δ(...)={(...)}。");
  }
  return transitions;
}

function splitStackSymbols(input: string, stackAlphabet: string[]): string[] {
  const compact = input.replace(/\s+/g, "");
  if (!compact || compact === EPSILON) return [];

  const symbols = [...stackAlphabet].sort((a, b) => b.length - a.length);
  const result: string[] = [];
  for (let index = 0; index < compact.length; ) {
    const matched = symbols.find((symbol) => compact.startsWith(symbol, index));
    if (!matched) {
      throw new ParseError(`压栈串 "${input}" 无法按栈字母表 {${stackAlphabet.join(",")}} 切分。`);
    }
    result.push(matched);
    index += matched.length;
  }
  return result;
}

function validatePDA(pda: PDA): void {
  if (!pda.states.includes(pda.startState)) {
    throw new ParseError(`初始状态 ${pda.startState} 未在状态集中声明。`);
  }
  if (!pda.stackAlphabet.includes(pda.bottomSymbol)) {
    throw new ParseError(`栈底符号 ${pda.bottomSymbol} 未在栈字母表中声明。`);
  }

  for (const transition of pda.transitions) {
    if (!pda.states.includes(transition.from)) {
      throw new ParseError(`转移中的状态 ${transition.from} 未声明。`);
    }
    if (!pda.states.includes(transition.to)) {
      throw new ParseError(`转移中的状态 ${transition.to} 未声明。`);
    }
    if (transition.input !== null && !pda.inputAlphabet.includes(transition.input)) {
      throw new ParseError(`输入符号 ${transition.input} 未在输入字母表中声明。`);
    }
    if (!pda.stackAlphabet.includes(transition.pop)) {
      throw new ParseError(`待弹出栈符号 ${transition.pop} 未在栈字母表中声明。`);
    }
    if (transition.push.length > 2) {
      throw new ParseError(`转移 ${transition.from},${transition.input ?? EPSILON},${transition.pop} 的压栈长度超过 2，超出本实验工具范围。`);
    }
  }
}
