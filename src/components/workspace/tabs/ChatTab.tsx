import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface ChatTabProps {
  departmentId?: string;
  teamId?: string;
}

export const ChatTab: React.FC<ChatTabProps> = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Team Chat</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Real-time messaging is coming in a future release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
