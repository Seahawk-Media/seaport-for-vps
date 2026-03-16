import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  // Load existing messages
  useEffect(() => {
    if (!conversationId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("agent_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as ChatMessage[]);
    };

    loadMessages();
  }, [conversationId]);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`agent_messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.role === "assistant") setIsLoading(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // WebSocket connection to agent bridge
  useEffect(() => {
    if (!agentId) return;

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/agent-ws/chat?token=${session.access_token}&agent_id=${agentId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: data.role,
              content: data.content,
              created_at: new Date().toISOString(),
            },
          ]);
          setIsLoading(false);
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [agentId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      setIsLoading(true);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      wsRef.current.send(
        JSON.stringify({
          content,
          conversation_id: conversationId,
        })
      );
    },
    [conversationId]
  );

  return { messages, sendMessage, isConnected, isLoading };
}
