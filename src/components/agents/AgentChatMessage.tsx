import { cn } from "@/lib/utils";

interface AgentChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export function AgentChatMessage({ role, content, timestamp }: AgentChatMessageProps) {
  return (
    <div
      className={cn(
        "flex w-full mb-4",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <p className="text-xs opacity-60 mt-1">
          {new Date(timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
