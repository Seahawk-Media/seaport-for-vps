import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowRight, ArrowLeft, Rocket } from "lucide-react";

const APP_NAME = import.meta.env.VITE_APP_NAME || "Seaport";

export default function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    orgName: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setupMutation = trpc.setup.complete.useMutation({
    onSuccess: async () => {
      await authClient.signIn.email({
        email: form.adminEmail,
        password: form.adminPassword,
      });
      navigate("/dashboard");
    },
    onError: (err) => {
      try {
        const zodErrors = JSON.parse(err.message);
        if (Array.isArray(zodErrors)) {
          const messages = zodErrors.map(
            (e: { path?: string[]; message?: string }) => e.message || "Validation error"
          );
          setError(messages.join(". "));
        } else {
          setError(err.message);
        }
      } catch {
        setError(err.message);
      }
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setupMutation.mutate(form);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <div className="rounded-lg bg-primary p-2">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold">Welcome to {APP_NAME}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set up your organization in 30 seconds.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>

        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      type="text"
                      required
                      value={form.orgName}
                      onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                      placeholder="Acme Corp"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => setStep(2)}
                    disabled={!form.orgName}
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="adminName">Your Full Name</Label>
                    <Input
                      id="adminName"
                      type="text"
                      required
                      value={form.adminName}
                      onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                      placeholder="Jane Smith"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      required
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      placeholder="you@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Password</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      required
                      minLength={8}
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      placeholder="Min 8 characters"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={loading || !form.adminName || !form.adminEmail || !form.adminPassword}
                    >
                      {loading ? (
                        "Setting up..."
                      ) : (
                        <>
                          <Rocket className="w-4 h-4 mr-2" />
                          {`Launch ${APP_NAME}`}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          This creates your organization and admin account.
        </p>
      </div>
    </div>
  );
}
