import { EPSILON, type Grammar, type PDA, type Production, type RunResult, type TraceStep } from "./types";
import { formatGrammar, formatInlineSymbols, isNonTerminal, productionKey, sortStrings } from "./format";

export function simplifyGrammar(grammar: Grammar): RunResult {
  const parsedStep = describeParsedGrammar(grammar);
  const epsilonResult = eliminateEpsilon(grammar);
  const unitResult = eliminateUnit(epsilonResult.grammar);
  const uselessResult = eliminateUseless(unitResult.grammar);

  return {
    title: "CFG 化简结果",
    steps: [parsedStep, epsilonResult.step, unitResult.step, uselessResult.step],
    finalGrammar: uselessResult.grammar,
  };
}

function describeParsedGrammar(grammar: Grammar): TraceStep {
  const nonterminals = getNonTerminals(grammar);
  return {
    title: "解析结果",
    description: "输入 CFG 的解析结果",
    sets: [
      traceSet("startSymbol", "开始符号 S", [grammar.start]),
      traceSet("nonterminals", "非终结符 N", sortStrings(nonterminals)),
      traceSet("terminals", "终结符 T", sortStrings(getTerminals(grammar, nonterminals))),
      traceSet("productionCount", "产生式数量 |P|", [String(grammar.productions.length)]),
    ],
    grammar,
  };
}

export function pdaToGrammar(pda: PDA): { grammar: Grammar; step: TraceStep } {
  const productions: Production[] = [];
  const seen = new Set<string>();
  const start = "S";

  for (const state of pda.states) {
    addProduction(productions, seen, { left: start, right: [variable(pda.startState, pda.bottomSymbol, state)] });
  }

  for (const transition of pda.transitions) {
    if (transition.push.length === 0) {
      addProduction(productions, seen, {
        left: variable(transition.from, transition.pop, transition.to),
        right: inputPrefix(transition.input),
      });
      continue;
    }

    if (transition.push.length === 1) {
      const [top] = transition.push;
      for (const end of pda.states) {
        addProduction(productions, seen, {
          left: variable(transition.from, transition.pop, end),
          right: [...inputPrefix(transition.input), variable(transition.to, top, end)],
        });
      }
      continue;
    }

    const [first, second] = transition.push;
    for (const middle of pda.states) {
      for (const end of pda.states) {
        addProduction(productions, seen, {
          left: variable(transition.from, transition.pop, end),
          right: [
            ...inputPrefix(transition.input),
            variable(transition.to, first, middle),
            variable(middle, second, end),
          ],
        });
      }
    }
  }

  const grammar = { start, productions };
  return {
    grammar,
    step: {
      title: "PDA 转换为等价 CFG",
      description: "使用变量 <p, A, q> 表示从状态 p、栈顶 A 出发，读入某串后到达状态 q 并弹出 A。",
      sets: [
        traceSet("states", "状态集 Q", pda.states),
        traceSet("inputAlphabet", "输入字母表 Σ", pda.inputAlphabet),
        traceSet("stackAlphabet", "栈字母表 Γ", pda.stackAlphabet),
      ],
      grammar,
    },
  };
}

export function convertPdaAndSimplify(pda: PDA): RunResult {
  const converted = pdaToGrammar(pda);
  const simplified = simplifyGrammar(converted.grammar);
  const renamed = renameNonTerminals(simplified.finalGrammar);

  return {
    title: "PDA 转 CFG 并化简结果",
    steps: [converted.step, ...simplified.steps, renamed.step],
    finalGrammar: renamed.grammar,
  };
}

function renameNonTerminals(grammar: Grammar): { grammar: Grammar; step: TraceStep } {
  const nonterminals = sortStrings(getNonTerminals(grammar)).filter((symbol) => symbol !== grammar.start);
  const mapping = new Map<string, string>([[grammar.start, "S"]]);
  let index = 0;

  for (const symbol of nonterminals) {
    mapping.set(symbol, nextVariableName(index));
    index += 1;
  }

  const renamed: Grammar = {
    start: mapping.get(grammar.start) ?? "S",
    productions: grammar.productions.map((production) => ({
      left: mapping.get(production.left) ?? production.left,
      right: production.right.map((symbol) => mapping.get(symbol) ?? symbol),
    })),
  };

  return {
    grammar: renamed,
    step: {
      title: "重命名非终结符",
      description: "将 PDA 构造产生的 <p, A, q> 变量重命名为普通非终结符",
      sets: [
        traceSet("renamingMap", "重命名映射", [...mapping.entries()].map(([from, to]) => `${from} => ${to}`)),
      ],
      grammar: renamed,
    },
  };
}

function nextVariableName(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRTUVWXYZ";
  const round = Math.floor(index / letters.length);
  const letter = letters[index % letters.length] ?? "A";
  return round === 0 ? letter : `${letter}${round}`;
}

function eliminateEpsilon(grammar: Grammar): { grammar: Grammar; step: TraceStep } {
  const nonterminals = getNonTerminals(grammar);
  const nullable = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const production of grammar.productions) {
      const canBeEmpty =
        production.right.length === 0 ||
        production.right.every((symbol) => nullable.has(symbol));
      if (canBeEmpty && !nullable.has(production.left)) {
        nullable.add(production.left);
        changed = true;
      }
    }
  }

  const productions: Production[] = [];
  const seen = new Set<string>();
  for (const production of grammar.productions) {
    if (production.right.length === 0) continue;

    const nullablePositions = production.right
      .map((symbol, index) => ({ symbol, index }))
      .filter(({ symbol }) => nullable.has(symbol));
    const variants = omitNullableVariants(production.right, nullablePositions.map(({ index }) => index));

    for (const right of variants) {
      if (right.length === 0 && production.left !== grammar.start) continue;
      addProduction(productions, seen, { left: production.left, right });
    }
  }

  if (nullable.has(grammar.start)) {
    addProduction(productions, seen, { left: grammar.start, right: [] });
  }

  const result = removeUnusedLeftOrder({ start: grammar.start, productions }, nonterminals);
  return {
    grammar: result,
    step: {
      title: "消除 ε 产生式",
      description: "先计算 nullable 集合，再为含 nullable 符号的右部补充省略组合。",
      sets: [traceSet("nullableVariables", "Nullable 变量", sortStrings(nullable))],
      grammar: result,
    },
  };
}

function eliminateUnit(grammar: Grammar): { grammar: Grammar; step: TraceStep } {
  const nonterminals = getNonTerminals(grammar);
  const unitMap = new Map<string, Set<string>>();
  for (const nonterminal of nonterminals) unitMap.set(nonterminal, new Set([nonterminal]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const production of grammar.productions) {
      if (!isUnitProduction(production, nonterminals)) continue;
      const fromSet = unitMap.get(production.left);
      const toSet = unitMap.get(production.right[0] ?? "");
      if (!fromSet || !toSet) continue;
      for (const item of toSet) {
        if (!fromSet.has(item)) {
          fromSet.add(item);
          changed = true;
        }
      }
    }
  }

  const productions: Production[] = [];
  const seen = new Set<string>();
  for (const left of nonterminals) {
    for (const target of unitMap.get(left) ?? []) {
      for (const production of grammar.productions) {
        if (production.left !== target || isUnitProduction(production, nonterminals)) continue;
        addProduction(productions, seen, { left, right: production.right });
      }
    }
  }

  const result = { start: grammar.start, productions };
  const closureSets = [...unitMap.entries()].map(([key, value]) =>
    traceSet(`unitClosure:${key}`, `${formatInlineSymbols(key)} 的单产生式闭包`, sortStrings(value)),
  );

  return {
    grammar: result,
    step: {
      title: "消除单产生式",
      description: "计算 A => B 的单产生式闭包，并用闭包内非单产生式替换。",
      sets: closureSets,
      grammar: result,
    },
  };
}

function eliminateUseless(grammar: Grammar): { grammar: Grammar; step: TraceStep } {
  const nonterminals = getNonTerminals(grammar);
  const generating = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const production of grammar.productions) {
      const rightGenerates = production.right.every(
        (symbol) => !nonterminals.has(symbol) || generating.has(symbol),
      );
      if (rightGenerates && !generating.has(production.left)) {
        generating.add(production.left);
        changed = true;
      }
    }
  }

  const generativeProductions = grammar.productions.filter(
    (production) =>
      generating.has(production.left) &&
      production.right.every((symbol) => !nonterminals.has(symbol) || generating.has(symbol)),
  );

  const reachable = new Set<string>([grammar.start]);
  changed = true;
  while (changed) {
    changed = false;
    for (const production of generativeProductions) {
      if (!reachable.has(production.left)) continue;
      for (const symbol of production.right) {
        if (nonterminals.has(symbol) && !reachable.has(symbol)) {
          reachable.add(symbol);
          changed = true;
        }
      }
    }
  }

  const productions = generativeProductions.filter(
    (production) =>
      reachable.has(production.left) &&
      production.right.every((symbol) => !nonterminals.has(symbol) || reachable.has(symbol)),
  );

  const result = { start: grammar.start, productions };
  return {
    grammar: result,
    step: {
      title: "消除无用符号",
      description: "先删除不可生成符号，再删除从开始符号不可达的符号。",
      sets: [
        traceSet("generatingVariables", "可生成变量", sortStrings(generating)),
        traceSet("reachableVariables", "可达变量", sortStrings(reachable)),
      ],
      grammar: result,
    },
  };
}

function omitNullableVariants(right: string[], nullablePositions: number[]): string[][] {
  const variants: string[][] = [];
  const count = 1 << nullablePositions.length;

  for (let mask = 0; mask < count; mask += 1) {
    const omitted = new Set<number>();
    nullablePositions.forEach((position, bit) => {
      if ((mask & (1 << bit)) !== 0) omitted.add(position);
    });
    variants.push(right.filter((_, index) => !omitted.has(index)));
  }

  return variants;
}

function isUnitProduction(production: Production, nonterminals: Set<string>): boolean {
  return production.right.length === 1 && nonterminals.has(production.right[0] ?? "");
}

function getNonTerminals(grammar: Grammar): Set<string> {
  const symbols = new Set<string>();
  for (const production of grammar.productions) {
    symbols.add(production.left);
    for (const symbol of production.right) {
      if (isNonTerminal(symbol)) symbols.add(symbol);
    }
  }
  return symbols;
}

function getTerminals(grammar: Grammar, nonterminals = getNonTerminals(grammar)): Set<string> {
  const symbols = new Set<string>();
  for (const production of grammar.productions) {
    for (const symbol of production.right) {
      if (!nonterminals.has(symbol)) symbols.add(symbol);
    }
  }
  return symbols;
}

function traceSet(id: string, label: string, values: string[]) {
  return { id, label, values };
}

function addProduction(productions: Production[], seen: Set<string>, production: Production): void {
  const key = productionKey(production);
  if (seen.has(key)) return;
  seen.add(key);
  productions.push(production);
}

function inputPrefix(input: string | null): string[] {
  return input === null ? [] : [input];
}

function variable(stateFrom: string, stack: string, stateTo: string): string {
  return `<${stateFrom},${stack},${stateTo}>`;
}

function removeUnusedLeftOrder(grammar: Grammar, oldNonTerminals: Set<string>): Grammar {
  if (grammar.productions.length > 0) return grammar;
  const fallback = oldNonTerminals.has(grammar.start) ? [{ left: grammar.start, right: [] }] : [];
  return { start: grammar.start, productions: fallback };
}

export function describeGrammar(grammar: Grammar): string {
  return formatGrammar(grammar);
}

export { EPSILON };
