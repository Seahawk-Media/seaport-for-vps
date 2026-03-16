import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface ChatTabProps {
  departmentId?: string;
  teamId?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender?: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface ChatChannel {
  id: string;
  name: string;
}

export const ChatTab: React.FC<ChatTabProps> = ({ departmentId, teamId }) => {
  const [channel, setChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { organization } = useOrganization();
  const { user } = useAuth();

  useEffect(() => {
    initializeChannel();
    fetchCurrentProfile();
  }, [departmentId, teamId]);

  useEffect(() => {
    if (channel) {
      fetchMessages();
      
      // Subscribe to realtime updates
      const subscription = supabase
        .channel(`chat-${channel.id}`)
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channel.id}` },
          async (payload) => {
            const newMsg = payload.new as ChatMessage;
            // Fetch sender info
            const { data: sender } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();
            setMessages(prev => [...prev, { ...newMsg, sender }]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [channel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchCurrentProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (data) setCurrentProfileId(data.id);
  };

  const initializeChannel = async () => {
    if (!organization) return;

    try {
      // Find or create channel for this department/team
      let query = supabase.from('chat_channels').select('*');
      
      if (teamId) {
        query = query.eq('team_id', teamId);
      } else if (departmentId) {
        query = query.eq('department_id', departmentId).is('team_id', null);
      }

      const { data, error } = await query.single();

      if (error && error.code === 'PGRST116') {
        // Channel doesn't exist, create it
        const channelName = teamId ? 'Team Chat' : 'Department Chat';
        const { data: newChannel, error: createError } = await supabase
          .from('chat_channels')
          .insert({
            name: channelName,
            organization_id: organization.id,
            department_id: departmentId || null,
            team_id: teamId || null,
          })
          .select()
          .single();

        if (createError) throw createError;
        setChannel(newChannel);
      } else if (error) {
        throw error;
      } else {
        setChannel(data);
      }
    } catch (error) {
      console.error('Error initializing channel:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!channel) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Fetch sender details
      const messagesWithSenders = await Promise.all((data || []).map(async (msg) => {
        const { data: sender } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', msg.sender_id)
          .single();
        return { ...msg, sender };
      }));

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channel || !newMessage.trim() || !currentProfileId) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: channel.id,
          sender_id: currentProfileId,
          content: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Chat</h2>
        <p className="text-sm text-muted-foreground">Real-time team communication</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.sender_id === currentProfileId;
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={msg.sender?.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{getInitials(msg.sender?.full_name || '')}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{msg.sender?.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </span>
                    </div>
                    <div 
                      className={`rounded-lg px-3 py-2 max-w-md ${
                        isOwnMessage 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <form onSubmit={sendMessage} className="border-t p-4 flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
};
