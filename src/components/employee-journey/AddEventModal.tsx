import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onEventAdded: () => void;
}

const eventTypes = [
  { value: "note", label: "Note" },
  { value: "meeting", label: "Meeting" },
  { value: "training", label: "Training" },
  { value: "achievement", label: "Achievement" },
  { value: "goal", label: "Goal" },
  { value: "feedback", label: "Feedback" },
  { value: "document", label: "Document" },
  { value: "milestone", label: "Milestone" },
];

export function AddEventModal({ isOpen, onClose, employeeId, onEventAdded }: AddEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !eventType || !user) return;

    setLoading(true);
    try {
      // Get current user's profile ID and organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, organization_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        throw new Error("Profile not found");
      }

      const { error } = await supabase
        .from("trail_events")
        .insert({
          profile_id: employeeId,
          event_type: eventType,
          title,
          description: description || null,
          created_by: user.id,
          organization_id: profile.organization_id,
        });

      if (error) throw error;

      toast({
        title: "Event added",
        description: "Journey event has been successfully added.",
      });

      onEventAdded();
      handleClose();
    } catch (error) {
      console.error("Error adding event:", error);
      toast({
        title: "Error",
        description: "Failed to add event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setEventType("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Journey Event</DialogTitle>
          <DialogDescription>
            Add a new event to the employee's journey.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter event description (optional)"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title || !eventType}>
              {loading ? "Adding..." : "Add Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}