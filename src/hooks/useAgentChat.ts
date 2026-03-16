import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { wsClient } from "@/lib/ws";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export function useAgentChat(agentId: string, conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Load existing messages via tRPC
  const messagesQuery = trpc.agentChat.getMessages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );

  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(
        messagesQuery.data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content || "",
          created_at: m.createdAt?.toISOString?.() ?? String(m.createdAt),
        }))
      );
    }
  }, [messagesQuery.data]);

  // WebSocket connection for live messages
  useEffect(() => {
    if (!agentId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to agent conversation channel
      if (conversationId) {
        ws.send(JSON.stringify({ type: "subscribe", channel: `agent:${conversationId}` }));
      }
    };
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.data?.type === "message" || data.channel?.startsWith("agent:")) {
          const msgData = data.data || data;
          setMessages((prev) => {
            const newMsg: ChatMessage = {
              id: msgData.id || crypto.randomUUID(),
              role: msgData.role || "assistant",
              content: msgData.content,
              created_at: new Date().toISOString(),
            };
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (msgData.role === "assistant") setIsLoading(false);
        }
      } catch {
        // Invalid message
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [agentId, conversationId]);

  const sendMessageMutation = trpc.agentChat.sendMessage.useMutation();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) return;

      setIsLoading(true);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Send via tRPC (persists to DB), agent response comes via WebSocket
      sendMessageMutation.mutate({ conversationId, content });
    },
    [conversationId, sendMessageMutation]
  );

  return { messages, sendMessage, isConnected, isLoading };
}
