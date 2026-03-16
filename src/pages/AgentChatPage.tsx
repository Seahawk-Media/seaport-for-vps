import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AgentChat } from "@/components/agents/AgentChat";
import { trpc } from '@/lib/trpc';
import { useAuth } from "@/hooks/useAuth";

const AgentChatPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);

  const { data: agent } = trpc.agents.get.useQuery(
    { id: agentId! },
    { enabled: !!agentId }
  );

  const { data: conversations } = trpc.agentChat.listConversations.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId && !!user }
  );

  const createConversation = trpc.agentChat.createConversation.useMutation();

  useEffect(() => {
    if (!agentId || !user || !conversations) return;

    const activeConversation = conversations.find((c: any) => c.status === 'active');
    if (activeConversation) {
      setConversationId(activeConversation.id);
    } else {
      // Create a new conversation
      createConversation.mutate(
        { agentId, title: `Chat with ${agent?.name ?? "Agent"}` },
        {
          onSuccess: (data) => {
            setConversationId(data.id);
          },
        }
      );
    }
  }, [agentId, user, conversations]);

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
