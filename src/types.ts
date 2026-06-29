export const EPSILON = "ε";

export type SymbolToken = string;

export interface Production {
  left: string;
  right: SymbolToken[];
}

export interface Grammar {
  start: string;
  productions: Production[];
}

export interface Transition {
  from: string;
  input: string | null;
  pop: string;
  to: string;
  push: string[];
}

export interface PDA {
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  startState: string;
  bottomSymbol: string;
  transitions: Transition[];
}

export interface TraceSet {
  id: string;
  label: string;
  values: string[];
}

export interface TraceStep {
  title: string;
  description: string;
  sets?: TraceSet[];
  grammar?: Grammar;
  text?: string;
}

export interface RunResult {
  title: string;
  steps: TraceStep[];
  finalGrammar: Grammar;
}
