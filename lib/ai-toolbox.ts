/**
 * AI Useful Toolbox: a curated list of external tools, shown on the home page (#ai-toolbox).
 * Edit this file to add, remove or reword tools. URLs are plain links (no tracking parameters).
 */

export const TOOLBOX_TITLE = "AI Useful Toolbox";
export const TOOLBOX_SUBTITLE = "Practical tools to evaluate, benchmark, monitor and improve AI systems.";

export const TOOL_CATEGORIES = [
  {
    id: "evaluation",
    filter: "Evaluation",
    title: "Evaluate your application",
    note: "These tools overlap. Choose a platform for tracing and experiment management, then add specialized evaluators where needed.",
  },
  {
    id: "monitoring",
    filter: "Monitoring",
    title: "Speed, load & production monitoring",
    note: "Monitoring shows what happened; evaluation determines whether the behavior was good enough. You generally need both.",
  },
  {
    id: "benchmarks",
    filter: "Benchmarks",
    title: "Model comparisons & benchmarks",
    note: "Use benchmarks to shortlist models, then validate them against your own data, tasks, languages and deployment conditions.",
  },
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]["id"];

export interface Tool {
  name: string;
  url: string;
  purpose: string;
  category: ToolCategory;
}

export const TOOLS: Tool[] = [
  // Evaluate your application
  { category: "evaluation", name: "Scikit-learn metrics", url: "https://scikit-learn.org/stable/api/sklearn.metrics.html", purpose: "Calculate classification, regression, ranking and clustering metrics." },
  { category: "evaluation", name: "MLflow", url: "https://mlflow.org/", purpose: "Track experiments and compare predictive models or GenAI evaluations." },
  { category: "evaluation", name: "Langfuse", url: "https://langfuse.com/docs/evaluation/overview", purpose: "Trace requests, inspect prompts and tool calls, evaluate outputs, and track latency and cost." },
  { category: "evaluation", name: "LangSmith", url: "https://www.langchain.com/langsmith/evaluation", purpose: "Evaluate LLM and agent workflows with datasets, experiments, human review and automated judges." },
  { category: "evaluation", name: "Arize Phoenix", url: "https://arize.com/phoenix/", purpose: "Trace and evaluate LLM applications, retrieval and agents." },
  { category: "evaluation", name: "Ragas", url: "https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/", purpose: "Measure RAG retrieval, faithfulness, relevance and tool use." },
  { category: "evaluation", name: "DeepEval", url: "https://deepeval.com/docs/introduction", purpose: "Write repeatable LLM and agent quality tests, including CI/CD checks." },
  { category: "evaluation", name: "Promptfoo", url: "https://www.promptfoo.dev/docs/intro/", purpose: "Compare prompts and models, test outputs, and run security and red-team evaluations." },
  { category: "evaluation", name: "Evidently", url: "https://www.evidentlyai.com/", purpose: "Evaluate and monitor data quality, drift, ML and LLM behavior." },
  // Speed, load & production monitoring
  { category: "monitoring", name: "vLLM benchmarking", url: "https://docs.vllm.ai/en/latest/cli/bench/serve/", purpose: "Benchmark LLM serving latency and throughput under load." },
  { category: "monitoring", name: "OpenTelemetry", url: "https://opentelemetry.io/docs/", purpose: "Instrument requests with traces, metrics and logs." },
  { category: "monitoring", name: "Prometheus", url: "https://prometheus.io/docs/introduction/overview/", purpose: "Collect operational metrics and trigger alerts." },
  { category: "monitoring", name: "Grafana", url: "https://grafana.com/docs/grafana/latest/", purpose: "Visualize latency, failures, resource usage and application metrics." },
  // Model comparisons & benchmarks
  { category: "benchmarks", name: "Artificial Analysis", url: "https://artificialanalysis.ai/", purpose: "Compare model capabilities, speed and cost." },
  { category: "benchmarks", name: "Arena leaderboard", url: "https://arena.ai/leaderboard", purpose: "Explore human preference and comparative model rankings." },
  { category: "benchmarks", name: "SWE-bench", url: "https://www.swebench.com/", purpose: "Compare coding systems’ ability to resolve real software issues." },
  { category: "benchmarks", name: "MTEB leaderboard", url: "https://huggingface.co/spaces/mteb/leaderboard", purpose: "Compare embedding-model performance." },
  { category: "benchmarks", name: "MLPerf Inference", url: "https://mlcommons.org/benchmarks/inference-datacenter/", purpose: "Compare inference-system performance under defined benchmark conditions." },
  { category: "benchmarks", name: "LM Evaluation Harness", url: "https://github.com/EleutherAI/lm-evaluation-harness", purpose: "Run standardized language-model evaluations yourself." },
];

/** Tools matching the category filter ("All" or a category's filter label) and the search text (name or purpose). */
export function filterTools(tools: Tool[], filter: string, query: string): Tool[] {
  const q = query.trim().toLowerCase();
  const cat = TOOL_CATEGORIES.find((c) => c.filter === filter)?.id;
  return tools.filter(
    (t) => (filter === "All" || t.category === cat) && (!q || t.name.toLowerCase().includes(q) || t.purpose.toLowerCase().includes(q)),
  );
}
