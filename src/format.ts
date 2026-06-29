import { EPSILON, type Grammar, type Production } from "./types";

export function isNonTerminal(symbol: string): boolean {
  return /^[A-Z](?:[0-9]+)?$/.test(symbol) || /^<[^<>]+>$/.test(symbol);
}

export function productionKey(production: Production): string {
  return `${production.left}->${production.right.join("\u0001")}`;
}

export function sortStrings(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

export function formatInlineSymbols(text: string): string {
  return text.replace(/<([^<>]+)>/g, (_, content: string) => {
    const normalized = content.split(",").map((part) => part.trim()).join(", ");
    return `<${normalized}>`;
  });
}

export function formatSymbols(symbols: string[]): string {
  if (symbols.length === 0) return EPSILON;
  const compact = symbols.every((symbol) => /^[A-Za-z0-9]$/.test(symbol) && symbol.length === 1);
  const formatted = symbols.map(formatInlineSymbols);
  return compact ? formatted.join("") : formatted.join(" ");
}

export function formatGrammar(grammar: Grammar): string {
  const groups = new Map<string, string[]>();

  for (const production of grammar.productions) {
    const left = formatInlineSymbols(production.left);
    const right = formatSymbols(production.right);
    const values = groups.get(left) ?? [];
    if (!values.includes(right)) values.push(right);
    groups.set(left, values);
  }

  const leftOrder = [
    formatInlineSymbols(grammar.start),
    ...[...groups.keys()].filter((left) => left !== formatInlineSymbols(grammar.start)),
  ];

  return leftOrder
    .filter((left, index, all) => all.indexOf(left) === index && groups.has(left))
    .map((left) => `${left} -> ${(groups.get(left) ?? []).join(" | ")}`)
    .join("\n");
}

export function formatSet(values: string[]): string {
  return `{ ${values.length === 0 ? "∅" : values.map(formatInlineSymbols).join(", ")} }`;
}
