import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AgentChat } from "@/components/agents/AgentChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const AgentChatPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const { user } = useAuth();
  const [agent, setAgent] = useState<{ name: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId || !user) return;

    const init = async () => {
      // Load agent
      const { data: agentData } = await supabase
        .from("agents")
        .select("name")
        .eq("id", agentId)
        .single();

      if (agentData) setAgent(agentData);

      // Find or create conversation
      const { data: existing } = await supabase
        .from("agent_conversations" as any)
        .select("id")
        .eq("agent_id", agentId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        setConversationId((existing as any).id);
      } else {
        // Get user's org
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          const { data: newConv } = await supabase
            .from("agent_conversations" as any)
            .insert({
              agent_id: agentId,
              user_id: user.id,
              organization_id: profile.organization_id,
              title: `Chat with ${agentData?.name ?? "Agent"}`,
            })
            .select("id")
            .single();

          if (newConv) setConversationId((newConv as any).id);
        }
      }
    };

    init();
  }, [agentId, user]);

  if (!agentId) return null;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)]">
        <AgentChat
          agentId={agentId}
          agentName={agent?.name ?? "Agent"}
          conversationId={conversationId}
        />
      </div>
    </DashboardLayout>
  );
};

export default AgentChatPage;
