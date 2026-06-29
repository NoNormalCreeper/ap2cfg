# ap2cfg

面向“上下文无关文法与下推自动机”课程设计的静态 Web 转换工具。

## 功能

- 解析教材格式的上下文无关文法。
- 消除 CFG 中的 `ε` 产生式、单产生式和无用符号。
- 解析教材格式的 PDA 定义与转移函数。
- 将 PDA 转换为等价 CFG，并继续执行 CFG 化简。
- 展示每个算法阶段的中间结果，方便截图写实验报告。

## 运行

```bash
npm install
npm run dev
```

构建静态网页包：

```bash
npm run build
```

构建结果在 `dist/`，可作为“可执行程序”随源码一起提交。

## 输入格式

CFG 支持教材格式：

```text
S→a|bA|B|ccD
A→abB|ε
B→aA
C→ddC
D→ddd
```

也支持等价的 ASCII 箭头：

```text
S -> a | bA | B | ccD
```

非终结符规则：

- 单个大写字母，如 `S`、`A`、`B`。
- 尖括号变量，如 `<q0,B,q1>`。
- 无空格连续大写字母按多个单字符非终结符切分，如 `AB` 表示 `A B`。

PDA 支持讲义格式，`PDA M=...` 和 `M=...` 都可以识别：

```text
设PDA M＝（{q0,q1},{a,b},{B,z0},δ,q0,z0,Φ）
δ定义为：δ（q0,b,z0）={( q0,Bz0)}
          δ（q0,b,B）={( q0,BB)}
          δ（q0,a,B）={( q1,ε)}
```

本工具覆盖空栈接受 PDA，并支持弹栈、压 1 个栈符号、压 2 个栈符号的转移。超过 2 个压栈符号会提示超出本实验工具范围。

PDA 转 CFG 的中间步骤会使用标准变量 `<p,A,q>`；最终输出会把这些变量重命名为 `S`、`A`、`B` 等普通非终结符。

## 设计思路

程序以文本输入为唯一事实来源：

```text
教材格式输入
  -> Normalizer 字符归一化
  -> Parser / Validator 格式解析与合法性检查
  -> Grammar / PDA 内部对象
  -> 核心转换算法
  -> TraceStep 中间过程记录
  -> Formatter 规范文本输出
```

UI 使用 Vite、TypeScript、Preact + TSX、Tailwind CSS、daisyUI 和 lucide-preact。Parser、CFG 化简、PDA 转 CFG 均为手写实现，便于在实验报告中说明核心算法。

样例统一维护在 `src/samples.ts` 的 `SAMPLE_CASES` 中。页面下拉选择和自动化测试都读取同一份纯文本 `source`，新增样例时只需要补一个 `SampleCase`。

## 验证

```bash
npm run check
npm run test
npm run build
```

测试覆盖：

- 作业 CFG 样例解析与化简。
- 邻接大写非终结符切分。
- 作业 PDA 样例解析。
- PDA 转 CFG 后继续化简。
- 超出支持范围的 PDA 转移报错。
