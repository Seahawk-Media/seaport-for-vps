import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { useRole } from "@/hooks/useRole";
import { BrandingManagement } from "./BrandingManagement";
import { Save, Building } from "lucide-react";

export const OrganizationManagement: React.FC = () => {
  const { organization, refetch } = useOrganization();
  const { isSuperAdmin, loading: roleLoading } = useRole();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        slug: organization.slug,
      });
    }
  }, [organization]);

  const updateOrg = trpc.org.update.useMutation({
    onSuccess: async () => {
      await refetch();
      toast({ title: "Success", description: "Organization updated successfully." });
      setSaving(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update organization. Please try again.", variant: "destructive" });
      setSaving(false);
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      name,
      slug: generateSlug(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization || !isSuperAdmin()) {
      toast({
        title: "Access Denied",
        description: "Only super admins can update organization settings.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Organization name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    updateOrg.mutate({
      name: formData.name.trim(),
    });
  };

  if (roleLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (!isSuperAdmin()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Access Denied</CardTitle>
          <CardDescription>
            Only super admins can manage organization settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* General info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organization Settings
          </CardTitle>
          <CardDescription>
            Manage your workspace name and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter organization name"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgSlug">URL Slug</Label>
              <Input
                id="orgSlug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="organization-slug"
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">
                This will be used in URLs and should be unique.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  "Updating..."
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Organization
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Branding */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Branding</h3>
        <BrandingManagement />
      </div>
    </div>
  );
};
