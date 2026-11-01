"use client";

import { useEffect, useRef, useState } from "react";
import { LuMessageCircle, LuSend, LuSquare, LuX } from "react-icons/lu";
import RichText from "@/components/ui/RichText";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What is Dzoan's experience with agentic AI?",
  "Which projects can I try live?",
  "Is Dzoan open to remote roles?",
  "How can I contact Dzoan?",
];

/** Floating recruiter chat. Answers stream from /api/chat (Claude, grounded in the published portfolio). */
export default function ChatWidget({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstName = name.split(" ")[0] || name;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const question = text.trim().slice(0, 2000);
    if (!question || streaming) return;
    setError("");
    setInput("");
    // Drop empty turns (an answer stopped before its first word) — the API rejects them.
    const history: Msg[] = [...messages.filter((m) => m.content.trim()), { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-11) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The assistant is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setMessages(history);
      } else {
        setMessages((prev) => prev.filter((m) => m.content.trim()));
      }
    } finally {
      setStreaming(false);
      abort.current = null;
    }
  }

  return (
    <>
      {!open && (
        <button type="button" className="chat-launcher" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <LuMessageCircle aria-hidden /> Ask about {firstName}
        </button>
      )}
      {open && (
        <section className="chat-panel" role="dialog" aria-label={`Chat about ${name}`}>
          <header className="chat-head">
            <div>
              <strong>Ask about {firstName}</strong>
              <span>AI assistant · answers from this portfolio</span>
            </div>
            <button
              type="button"
              className="chat-close"
              onClick={() => {
                abort.current?.abort();
                setOpen(false);
              }}
              aria-label="Close chat"
            >
              <LuX aria-hidden />
            </button>
          </header>

          <div className="chat-messages" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-intro">
                <p>
                  Hi! I can answer questions about {name}’s experience, projects, skills and availability. What would you like to know?
                </p>
                <ul>
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => send(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === "assistant" ? (
                  m.content ? <RichText text={m.content} /> : <span className="chat-typing" aria-label="Thinking">●●●</span>
                ) : (
                  <p>{m.content}</p>
                )}
              </div>
            ))}
            {error && <p className="chat-error" role="alert">{error}</p>}
          </div>

          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="chat-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              maxLength={2000}
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            {streaming ? (
              <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop answer">
                <LuSquare aria-hidden />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Send question">
                <LuSend aria-hidden />
              </button>
            )}
          </form>
          <p className="chat-note">AI can make mistakes — please confirm important details with {firstName}.</p>
        </section>
      )}
    </>
  );
}
