"use client";

import { useState } from "react";
import { Bot, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = { role: "user" | "assistant"; content: string };

export function AiConcierge() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola, soy Mar. Puedo ayudarte con el menú, inventario, usuarios, mesas y configuración.",
    },
  ]);

  async function send() {
    const clean = message.trim();
    if (!clean || loading) return;
    const history = [...messages, { role: "user" as const, content: clean }];
    setMessages(history);
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          page: pathname,
          history: messages.slice(-10),
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer ?? data.error ?? "No pude responder ahora.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "No pude conectar con el asistente. Intenta de nuevo.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
      {open && (
        <section className="mb-3 flex h-[min(620px,75vh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
          <header className="flex items-center gap-3 bg-slate-950 px-5 py-4 text-white">
            <span className="grid size-9 place-items-center rounded-xl bg-teal-400/15 text-teal-300">
              <Sparkles className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">Mar · Copiloto</p>
              <p className="text-xs text-white/50">Impulsado por OpenAI</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X />
            </Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4">
            {messages.map((item, index) => (
              <div
                key={index}
                className={
                  item.role === "user"
                    ? "ml-10 rounded-2xl rounded-br-md bg-teal-900 px-4 py-3 text-sm leading-6 text-white"
                    : "mr-7 rounded-2xl rounded-bl-md border bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
                }
              >
                {item.content}
              </div>
            ))}
            {loading && (
              <div className="mr-24 flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-400">
                <LoaderCircle className="size-4 animate-spin" /> Pensando…
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t bg-white p-3">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder="Pregunta o pide ayuda…"
              className="rounded-xl"
            />
            <Button
              size="icon"
              onClick={() => void send()}
              disabled={loading || !message.trim()}
              className="shrink-0 rounded-xl bg-teal-900 hover:bg-teal-800"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </section>
      )}
      <Button
        onClick={() => setOpen((value) => !value)}
        className="ml-auto size-14 rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-950/25 hover:-translate-y-0.5 hover:bg-teal-950"
      >
        <Bot className="size-6" />
        <span className="sr-only">Abrir copiloto</span>
      </Button>
    </div>
  );
}
