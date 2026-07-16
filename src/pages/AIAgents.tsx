import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageFooter } from "@/components/PageFooter";
import { AgentConnectButtons } from "@/components/AgentConnectButtons";

const AIAgents = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "AI Agents — Mera Rashan";
    const desc =
      "Connect Mera Rashan to AI agents like Claude and ChatGPT via MCP.";
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
    return () => {
      document.title = prevTitle;
      if (prevDesc !== null) meta!.setAttribute("content", prevDesc);
    };
  }, []);

  return (
    <div className="min-h-screen pb-16">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-white/10 -ml-2 mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 opacity-90" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">AI Agents</h1>
            <p className="text-xs opacity-80 truncate">
              Connect Claude, ChatGPT and other AI agents to Mera Rashan
            </p>
          </div>
        </div>
      </header>

      <main className="px-5 -mt-3 space-y-4">
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <AgentConnectButtons />
        </Card>
        <div className="text-center">
          <Button variant="link" size="sm" onClick={() => navigate("/agent-integrations")}>
            View MCP server &amp; OAuth details
          </Button>
        </div>
      </main>
      <PageFooter />
    </div>
  );
};

export default AIAgents;
