export type SampleKind = "cfg" | "pda";

export interface SampleCase {
  id: string;
  kind: SampleKind;
  title: string;
  description: string;
  tags: string[];
  source: string;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "assignment-cfg",
    kind: "cfg",
    title: "作业 CFG 样例",
    description: "包含 ε 产生式、单产生式和无用符号 C。",
    tags: ["ε", "单产生式", "无用符号"],
    source: `S→a|bA|B|ccD
A→abB|ε
B→aA
C→ddC
D→ddd`,
  },
  {
    id: "nullable-cfg",
    kind: "cfg",
    title: "Nullable 变量样例",
    description: "A 和 B 都可推出 ε，用来观察 nullable 集合和 ε 消除。",
    tags: ["ε", "nullable", "开始符号"],
    source: `S→AB|c
A→a|ε
B→b|ε`,
  },
  {
    id: "unit-chain-cfg",
    kind: "cfg",
    title: "单产生式链样例",
    description: "S、A、B 之间形成单产生式链，C 是不可达符号。",
    tags: ["单产生式", "闭包", "不可达"],
    source: `S→A|b
A→B
B→c
C→dC|d`,
  },
  {
    id: "useless-symbol-cfg",
    kind: "cfg",
    title: "无用符号样例",
    description: "A 可达但不可生成，C 可生成但不可达。",
    tags: ["无用符号", "可生成", "可达"],
    source: `S→aA|bB
A→aA
B→b
C→c`,
  },
  {
    id: "clean-recursive-cfg",
    kind: "cfg",
    title: "递归文法样例",
    description: "一个基本递归文法，主要用于对照无需大量化简的情况。",
    tags: ["递归", "对照"],
    source: `S→aSb|c`,
  },
  {
    id: "assignment-pda",
    kind: "pda",
    title: "作业 PDA 样例",
    description: "讲义给定的空栈接受 PDA。",
    tags: ["PDA", "空栈接受", "讲义格式"],
    source: `设PDA M＝（{q0,q1},{a,b},{B,z0},δ,q0,z0,Φ）
δ定义为：δ（q0,b,z0）={(q0, Bz0)}
          δ（q0,b,B）={(q0, BB)}
          δ（q0,a,B）={(q1, ε)}
          δ（q1,a,B）={(q1, ε)}
          δ（q1,ε,B）={(q1, ε)}
          δ（q1,ε,z0）={(q1, ε)}`,
  },
  {
    id: "anbn-pda",
    kind: "pda",
    title: "a^n b^n PDA 样例",
    description: "读入 a 时压栈，读入 b 时弹栈，最后空栈接受。",
    tags: ["PDA", "a^n b^n", "空栈接受"],
    source: `M＝（{q0,q1},{a,b},{A,z0},δ,q0,z0,Φ）
δ定义为：δ（q0,a,z0）={(q0, Az0)}
          δ（q0,a,A）={(q0, AA)}
          δ（q0,b,A）={(q1, ε)}
          δ（q1,b,A）={(q1, ε)}
          δ（q1,ε,z0）={(q1, ε)}`,
  },
  {
    id: "parentheses-pda",
    kind: "pda",
    title: "括号匹配 PDA 样例",
    description: "用 l 表示左括号、r 表示右括号，压栈和弹栈模拟括号配对。",
    tags: ["PDA", "括号匹配", "空栈接受"],
    source: `M＝（{q},{l,r},{P,z0},δ,q,z0,Φ）
δ定义为：δ（q,l,z0）={(q, Pz0)}
          δ（q,l,P）={(q, PP)}
          δ（q,r,P）={(q, ε)}
          δ（q,ε,z0）={(q, ε)}`,
  },
];

export function samplesFor(kind: SampleKind): SampleCase[] {
  return SAMPLE_CASES.filter((sample) => sample.kind === kind);
}

export function getSample(id: string): SampleCase {
  const sample = SAMPLE_CASES.find((item) => item.id === id);
  if (!sample) throw new Error(`unknown sample: ${id}`);
  return sample;
}

export function firstSampleFor(kind: SampleKind): SampleCase {
  const sample = samplesFor(kind)[0];
  if (!sample) throw new Error(`no sample for kind: ${kind}`);
  return sample;
}
