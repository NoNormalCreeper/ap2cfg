import "./style.css";
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { Clipboard, Eraser, FileText, Monitor, Moon, Play, RotateCcw, Sun } from "lucide-preact";
import { convertPdaAndSimplify, simplifyGrammar } from "./core";
import { formatGrammar, formatInlineSymbols, formatSet } from "./format";
import { parseGrammar, parsePDA } from "./parser";
import { firstSampleFor, getSample, samplesFor } from "./samples";
import type { RunResult, TraceSet, TraceStep } from "./types";

type Mode = "cfg" | "pda";
type ThemePreference = "system" | "light" | "dark";

interface ValidationState {
  valid: boolean;
  message: string;
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app");

render(<App />, app);

function App() {
  const [mode, setMode] = useState<Mode>("cfg");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const initialSample = firstSampleFor("cfg");
  const [selectedSampleId, setSelectedSampleId] = useState(initialSample.id);
  const [loadedSampleId, setLoadedSampleId] = useState(initialSample.id);
  const [inputText, setInputText] = useState(initialSample.source);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState("");
  const [copyDone, setCopyDone] = useState(false);

  const validation = useMemo(() => validateInput(mode, inputText), [mode, inputText]);
  const availableSamples = useMemo(() => samplesFor(mode), [mode]);
  const loadedSample = loadedSampleId ? getSample(loadedSampleId) : null;
  const selectedSample = getSample(selectedSampleId);
  const canRestoreSample = loadedSample !== null && inputText !== loadedSample.source;
  const finalOutput = result ? formatGrammar(result.finalGrammar) : "";

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = theme === "light" ? "corporate" : "business";
    }
  }, [theme]);

  function clearResult(): void {
    setResult(null);
    setRunError("");
    setCopyDone(false);
  }

  function switchMode(nextMode: Mode): void {
    const nextSample = firstSampleFor(nextMode);
    setMode(nextMode);
    setSelectedSampleId(nextSample.id);
    setLoadedSampleId(nextSample.id);
    setInputText(nextSample.source);
    clearResult();
  }

  function loadSample(): void {
    setLoadedSampleId(selectedSample.id);
    setInputText(selectedSample.source);
    clearResult();
  }

  function clearInput(): void {
    setInputText("");
    setLoadedSampleId("");
    clearResult();
  }

  function restoreSample(): void {
    if (!loadedSample) return;
    setSelectedSampleId(loadedSample.id);
    setInputText(loadedSample.source);
    clearResult();
  }

  function runConversion(): void {
    if (!validation.valid) return;
    try {
      setResult(mode === "cfg" ? simplifyGrammar(parseGrammar(inputText)) : convertPdaAndSimplify(parsePDA(inputText)));
      setRunError("");
    } catch (error) {
      setResult(null);
      setRunError(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyResult(): Promise<void> {
    if (!finalOutput) return;
    await navigator.clipboard.writeText(finalOutput);
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 800);
  }

  return (
    <div className="min-h-screen bg-base-200">
      <header className="border-b border-base-300 bg-base-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-2xl font-semibold tooltip tooltip-bottom" data-tip="条条大路通 CFG!">ALL Paths to CFG!</h1>
            <p className="text-sm text-base-content/65">上下文无关文法与下推自动机转换实验</p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost"
            aria-label={`当前主题：${themeLabel(theme)}`}
            title={`当前主题：${themeLabel(theme)}`}
            onClick={() => setTheme(nextTheme(theme))}
          >
            <ThemeIcon theme={theme} />
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" className="tabs tabs-box">
                <button
                  type="button"
                  role="tab"
                  className={`tab ${mode === "cfg" ? "tab-active" : ""}`}
                  onClick={() => switchMode("cfg")}
                >
                  CFG 化简
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`tab ${mode === "pda" ? "tab-active" : ""}`}
                  onClick={() => switchMode("pda")}
                >
                  PDA 转 CFG
                </button>
              </div>
            </div>

            <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-base-content/75">样例</span>
                <span className="select w-full">
                  <select
                    value={selectedSampleId}
                    onChange={(event) => setSelectedSampleId(event.currentTarget.value)}
                  >
                    {availableSamples.map((sample) => (
                      <option key={sample.id} value={sample.id}>
                        {sample.title}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <button
                type="button"
                className="btn btn-outline"
                aria-label="加载选中样例"
                title="加载选中样例"
                onClick={loadSample}
              >
                <FileText className="size-4" />
                加载
              </button>
              <button
                type="button"
                className="btn btn-outline"
                aria-label="恢复已加载样例"
                title="恢复已加载样例"
                disabled={!canRestoreSample}
                onClick={restoreSample}
              >
                <RotateCcw className="size-4" />
                恢复样例
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="清空输入"
                title="清空输入"
                onClick={clearInput}
              >
                <Eraser className="size-4" />
                清空
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 text-sm text-base-content/70">
              <span>{selectedSample.description}</span>
              {selectedSample.tags.map((tag) => (
                <span key={tag} className="badge badge-ghost badge-sm">
                  {tag}
                </span>
              ))}
            </div>

            <div>
              <div className="mb-2">
                <span className="text-sm font-medium text-base-content/75">
                  {mode === "cfg" ? "CFG 输入" : "PDA 输入"}
                </span>
              </div>
              <textarea
                value={inputText}
                className="textarea textarea-bordered min-h-[430px] resize-y font-mono text-sm leading-6"
                onInput={(event) => {
                  setInputText(event.currentTarget.value);
                  clearResult();
                }}
              />
              <div className={`mt-2 text-sm ${validation.valid ? "text-success" : "text-error"}`}>
                {validation.message}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                aria-label="运行转换"
                title="运行转换"
                disabled={!validation.valid}
                onClick={runConversion}
              >
                <Play className="size-4" />
                运行转换
              </button>
            </div>
          </div>
        </section>

        <OutputPanel result={result} runError={runError} copyDone={copyDone} onCopy={copyResult} />
      </main>
    </div>
  );
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === "light") return <Sun className="size-4" />;
  if (theme === "dark") return <Moon className="size-4" />;
  return <Monitor className="size-4" />;
}

function themeLabel(theme: ThemePreference): string {
  if (theme === "light") return "浅色";
  if (theme === "dark") return "深色";
  return "跟随系统";
}

function nextTheme(theme: ThemePreference): ThemePreference {
  if (theme === "system") return "light";
  if (theme === "light") return "dark";
  return "system";
}

function OutputPanel(props: {
  result: RunResult | null;
  runError: string;
  copyDone: boolean;
  onCopy: () => void;
}) {
  const finalOutput = props.result ? formatGrammar(props.result.finalGrammar) : "";

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="card-title text-xl">转换结果</h2>
          </div>
          <button
            type="button"
            className={`btn btn-sm btn-outline ${props.copyDone ? "btn-success" : ""}`}
            aria-label="复制最终结果"
            title="复制最终结果"
            disabled={!props.result}
            onClick={props.onCopy}
          >
            <Clipboard className="size-4" />
            复制结果
          </button>
        </div>

        <div className="space-y-3">
          {props.runError ? <div className="alert alert-error">{props.runError}</div> : null}

          {!props.runError && !props.result ? (
            <div className="rounded-box border border-dashed border-base-300 p-8 text-center text-base-content/60">
              加载样例或输入内容后，点击运行转换。
            </div>
          ) : null}

          {props.result ? (
            <>
              <div className="alert alert-success">{props.result.title}</div>
              {props.result.steps.map((step) => (
                <StepView key={step.title} step={step} />
              ))}
              <div className="rounded-box border border-base-300 bg-base-200 p-4">
                <h3 className="mb-2 font-semibold">最终输出</h3>
                <pre className="overflow-auto whitespace-pre-wrap font-mono text-sm leading-6">{finalOutput}</pre>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StepView({ step }: { step: TraceStep }) {
  return (
    <details className="collapse collapse-arrow border border-base-300 bg-base-100" open>
      <summary className="collapse-title font-medium">{step.title}</summary>
      <div className="collapse-content space-y-3">
        <p className="text-sm text-base-content/70">{step.description}</p>

        {step.sets ? (
          <div className="grid gap-3 text-sm">
            {step.sets.map((set) => (
              <SetView key={set.id} set={set} />
            ))}
          </div>
        ) : null}

        {step.text ? (
          <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-base-200 p-3 font-mono text-sm">
            {step.text}
          </pre>
        ) : null}

        {step.grammar ? (
          <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-base-200 p-3 font-mono text-sm leading-6">
            {formatGrammar(step.grammar)}
          </pre>
        ) : null}
      </div>
    </details>
  );
}

function SetView({ set }: { set: TraceSet }) {
  return (
    <div className="grid gap-2 border-b border-base-300 pb-2 last:border-b-0 sm:grid-cols-[max-content_minmax(0,1fr)]">
      <div className="whitespace-nowrap font-medium text-base-content/75">{formatInlineSymbols(set.label)}</div>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {set.values.length === 0 ? (
          <code className="font-mono text-base-content/60">{formatSet(set.values)}</code>
        ) : (
          set.values.map((value) => (
            <code key={value} className="whitespace-nowrap rounded border border-base-300 px-1.5 py-0.5 font-mono text-xs">
              {formatInlineSymbols(value)}
            </code>
          ))
        )}
      </div>
    </div>
  );
}

function validateInput(mode: Mode, inputText: string): ValidationState {
  try {
    mode === "cfg" ? parseGrammar(inputText) : parsePDA(inputText);
    return { valid: true, message: "输入有效。" };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : String(error) };
  }
}
