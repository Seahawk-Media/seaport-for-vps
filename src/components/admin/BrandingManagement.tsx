import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { useRole } from "@/hooks/useRole";
import { Save, Upload, X, Palette, ImageIcon } from "lucide-react";

const PRESET_COLORS = [
  { label: 'Charcoal', value: '#1a1a1a' },
  { label: 'Navy', value: '#1e3a5f' },
  { label: 'Forest', value: '#1a4731' },
  { label: 'Plum', value: '#4a1942' },
  { label: 'Rust', value: '#7c2d12' },
  { label: 'Slate', value: '#334155' },
  { label: 'Indigo', value: '#312e81' },
  { label: 'Teal', value: '#134e4a' },
];

const ACCENT_PRESETS = [
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Lime', value: '#84cc16' },
];

interface BrandingManagementProps {
  onBrandingChange?: () => void;
}

export const BrandingManagement: React.FC<BrandingManagementProps> = ({ onBrandingChange }) => {
  const { organization, refetch } = useOrganization();
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#1a1a1a');
  const [accentColor, setAccentColor] = useState('#0ea5e9');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      const org = organization as { primaryColor?: string; accentColor?: string; logoUrl?: string };
      setPrimaryColor(org.primaryColor || '#1a1a1a');
      setAccentColor(org.accentColor || '#0ea5e9');
      setLogoUrl(org.logoUrl || null);
      setLogoPreview(org.logoUrl || null);
    }
  }, [organization]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization) return;

    // Local preview
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // TODO: Implement tRPC file upload route for org logos
      toast({ title: 'Coming soon', description: 'Logo upload will be available in a future update.' });
    } catch (err: unknown) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'An unexpected error occurred', variant: 'destructive' });
      setLogoPreview(logoUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateOrg = trpc.org.update.useMutation({
    onSuccess: async () => {
      await refetch();
      onBrandingChange?.();
      toast({ title: 'Branding saved', description: 'Your workspace branding has been updated.' });
      setSaving(false);
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setSaving(false);
    },
  });

  const handleSave = async () => {
    if (!organization || !isSuperAdmin()) return;
    setSaving(true);
    updateOrg.mutate({
      primaryColor,
      accentColor,
      logoUrl,
    });
  };

  if (!isSuperAdmin()) return null;

  return (
    <div className="space-y-4">
      {/* Logo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Logo
          </CardTitle>
          <CardDescription className="text-xs">
            PNG, JPG, SVG or WebP · max 5 MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Org logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              {logoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Brand Colors
          </CardTitle>
          <CardDescription className="text-xs">
            Primary is used for the sidebar and key UI elements; accent for highlights and CTAs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Primary */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Primary Color</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-md border border-border flex-shrink-0 cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: primaryColor }}
              >
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono">{primaryColor}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setPrimaryColor(c.value)}
                  className={`w-6 h-6 rounded-md border-2 transition-all ${
                    primaryColor === c.value ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Accent */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Accent Color</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-md border border-border flex-shrink-0 cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: accentColor }}
              >
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono">{accentColor}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setAccentColor(c.value)}
                  className={`w-6 h-6 rounded-md border-2 transition-all ${
                    accentColor === c.value ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Preview strip */}
          <div className="rounded-md overflow-hidden border border-border mt-2">
            <div className="h-8 flex">
              <div className="flex-1" style={{ backgroundColor: primaryColor }} />
              <div className="flex-1" style={{ backgroundColor: accentColor }} />
            </div>
            <div className="px-3 py-2 text-xs text-muted-foreground bg-card">
              Color preview -- primary · accent
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving...' : (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Branding
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
