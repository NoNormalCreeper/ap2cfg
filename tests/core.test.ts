import { describe, expect, it } from "vitest";
import { convertPdaAndSimplify, pdaToGrammar, simplifyGrammar } from "../src/core";
import { formatGrammar } from "../src/format";
import { parseGrammar, parsePDA } from "../src/parser";
import { getSample, SAMPLE_CASES } from "../src/samples";

const CFG_SAMPLE = getSample("assignment-cfg").source;
const PDA_SAMPLE = getSample("assignment-pda").source;

describe("CFG parser and simplifier", () => {
  it("runs every CFG sample fixture", () => {
    const samples = SAMPLE_CASES.filter((sample) => sample.kind === "cfg");
    expect(samples.length).toBeGreaterThan(1);

    for (const sample of samples) {
      const result = simplifyGrammar(parseGrammar(sample.source));
      expect(result.finalGrammar.productions.length, sample.id).toBeGreaterThan(0);
    }
  });

  it("parses the assignment grammar and removes epsilon, unit, and useless productions", () => {
    const grammar = parseGrammar(CFG_SAMPLE);
    const result = simplifyGrammar(grammar);
    const output = formatGrammar(result.finalGrammar);

    expect(grammar.start).toBe("S");
    expect(result.steps[0]?.title).toBe("解析结果");
    expect(result.steps[0]?.sets?.find((set) => set.id === "nonterminals")?.values).toEqual([
      "A",
      "B",
      "C",
      "D",
      "S",
    ]);
    expect(result.steps[0]?.sets?.find((set) => set.id === "terminals")?.values).toEqual(["a", "b", "c", "d"]);
    expect(output).not.toContain("C ->");
    expect(result.finalGrammar.productions.some((production) => production.right.length === 0)).toBe(false);
    expect(
      result.finalGrammar.productions.some(
        (production) => production.right.length === 1 && /^[A-Z]$/.test(production.right[0] ?? ""),
      ),
    ).toBe(false);
  });

  it("splits adjacent uppercase symbols as separate nonterminals", () => {
    const grammar = parseGrammar("S -> AB\nA -> a\nB -> b");
    expect(grammar.productions[0]?.right).toEqual(["A", "B"]);
  });

  it("keeps generated numbered nonterminals as one symbol when spaced", () => {
    const grammar = parseGrammar("S -> a A1\nA1 -> b");
    expect(grammar.productions[0]?.right).toEqual(["a", "A1"]);
  });
});

describe("PDA parser and converter", () => {
  it("runs every PDA sample fixture", () => {
    const samples = SAMPLE_CASES.filter((sample) => sample.kind === "pda");
    expect(samples.length).toBeGreaterThan(1);

    for (const sample of samples) {
      const result = convertPdaAndSimplify(parsePDA(sample.source));
      expect(result.finalGrammar.productions.length, sample.id).toBeGreaterThan(0);
      expect(formatGrammar(result.finalGrammar), sample.id).not.toMatch(/<[^<>]+>/);
    }
  });

  it("parses the assignment PDA in textbook format", () => {
    const pda = parsePDA(PDA_SAMPLE);

    expect(pda.states).toEqual(["q0", "q1"]);
    expect(pda.transitions).toHaveLength(6);
    expect(pda.transitions[0]?.push).toEqual(["B", "z0"]);
  });

  it("parses PDA headers written as M=(...) without the PDA prefix", () => {
    const pda = parsePDA(PDA_SAMPLE.replace("设PDA M", "M"));
    expect(pda.startState).toBe("q0");
  });

  it("converts the assignment PDA to CFG and runs CFG simplification", () => {
    const pda = parsePDA(PDA_SAMPLE);
    const converted = pdaToGrammar(pda);
    const result = convertPdaAndSimplify(pda);
    const finalOutput = formatGrammar(result.finalGrammar);

    expect(formatGrammar(converted.grammar)).toContain("S -> <q0, z0, q0>");
    expect(formatGrammar(converted.grammar)).not.toMatch(/<[^<>]*,[^ <>]/);
    expect(result.finalGrammar.productions.length).toBeGreaterThan(0);
    expect(finalOutput).not.toMatch(/<[^<>]+>/);
  });

  it("rejects transitions outside the supported push length", () => {
    const bad = PDA_SAMPLE.replace("Bz0", "Bz0B");
    expect(() => parsePDA(bad)).toThrow(/压栈长度超过 2/);
  });
});
