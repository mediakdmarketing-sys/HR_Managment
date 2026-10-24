import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { askAssistant } from "../api/aiApi";
import ChatMarkdown from "./ChatMarkdown";

const STORAGE_KEY = "hr-ai-chat";
const SUGGESTIONS = [
  "How much did we spend this month?",
  "Who is on leave today?",
  "How many employees are in each department?",
  "Who joined in the last 30 days?",
];

// Each page renders its own layout, so the conversation is kept in sessionStorage to
// survive moving between pages (cleared when the browser tab closes).
const loadChat = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    return { open: Boolean(saved.open), messages: Array.isArray(saved.messages) ? saved.messages : [] };
  } catch {
    return { open: false, messages: [] };
  }
};

const saveChat = (chat) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
  } catch {
    // The chat still works for this page without storage.
  }
};

// Floating HR assistant (bottom right) that answers questions about the portal's data.
function AiAssistant() {
  const [initial] = useState(loadChat);
  const [isOpen, setIsOpen] = useState(initial.open);
  const [messages, setMessages] = useState(initial.messages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    saveChat({ open: isOpen, messages });
  }, [isOpen, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const send = async (text) => {
    const question = text.trim();
    if (!question || isThinking) return;
    const next = [...messages, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setError("");
    setIsThinking(true);
    try {
      const response = await askAssistant(next.slice(-12));
      setMessages([...next, { role: "assistant", text: response.data.data.reply }]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to reach the AI assistant. Please try again.");
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      {isOpen && (
        <section
          className="fixed inset-x-4 bottom-24 z-[70] flex max-h-[min(36rem,calc(100dvh-8rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 sm:inset-x-auto sm:right-6 sm:w-[24rem]"
          aria-label="HR AI assistant"
        >
          <header className="flex items-center gap-3 bg-linear-to-r from-slate-900 to-teal-700 px-4 py-3 text-white">
            <div className="grid h-9 w-9 place-content-center rounded-full bg-white/15">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">HR Assistant</p>
              <p className="text-xs text-slate-300">Ask about employees, leave, expenses or payroll</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setError("");
                }}
                disabled={isThinking}
                className="rounded-lg p-1.5 text-slate-200 hover:bg-white/15 hover:text-white"
                aria-label="Start a new chat"
                title="New chat"
              >
                <RotateCcw size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-200 hover:bg-white/15 hover:text-white"
              aria-label="Close assistant"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 text-sm">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-content-center rounded-full bg-teal-700 text-white">
                    <Bot size={15} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200/70">
                    Hi! I can answer questions about your employees, leave requests, expenses and payroll, or
                    explain how to use the portal. Try one of these:
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-9">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-teal-700 transition hover:bg-teal-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-teal-700 px-3 py-2 text-white">
                    {message.text}
                  </p>
                </div>
              ) : (
                <div key={index} className="flex gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-content-center rounded-full bg-teal-700 text-white">
                    <Bot size={15} />
                  </div>
                  <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200/70">
                    <ChatMarkdown text={message.text} />
                  </div>
                </div>
              ),
            )}

            {isThinking && (
              <div className="flex items-center gap-2 pl-9 text-xs text-slate-500">
                <Loader2 className="animate-spin" size={14} /> Thinking...
              </div>
            )}
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask a question..."
              className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-teal-700 text-white transition hover:bg-teal-800 disabled:opacity-40"
              aria-label="Send"
            >
              <SendHorizontal size={18} />
            </button>
          </form>
          <p className="bg-white px-3 pb-2 text-center text-[11px] text-slate-400">
            AI answers can be wrong. Check important figures in the portal.
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-6 right-6 z-[70] grid h-14 w-14 place-content-center rounded-full bg-linear-to-br from-slate-800 to-teal-600 text-white shadow-lg shadow-teal-900/30 transition hover:scale-105"
        aria-label={isOpen ? "Close HR assistant" : "Open HR assistant"}
        title="HR Assistant"
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>
    </>
  );
}

export default AiAssistant;
