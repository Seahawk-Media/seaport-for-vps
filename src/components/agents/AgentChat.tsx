import { useEffect, useRef } from "react";
import { useAgentChat } from "@/hooks/useAgentChat";
import { AgentChatMessage } from "./AgentChatMessage";
import { AgentChatInput } from "./AgentChatInput";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface AgentChatProps {
  agentId: string;
  agentName: string;
  conversationId: string | null;
}

export function AgentChat({ agentId, agentName, conversationId }: AgentChatProps) {
  const { messages, sendMessage, isConnected, isLoading } = useAgentChat(agentId, conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{agentName}</h3>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <AgentChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.created_at}
          />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <AgentChatInput onSend={sendMessage} disabled={!isConnected} />
    </div>
  );
}
