"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { QRCode } from "react-qr-code";

import { Button } from "@hataraku/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";
import { Checkbox } from "@hataraku/ui/components/checkbox";
import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import { authClient } from "#src/lib/auth-client.ts";

/** What the enable endpoint hands back, reduced to what the page renders. */
interface Enrollment {
  backupCodes: string[];
  secret: string;
  totpUri: string;
}

/** Why the state changed, so a transition confirms itself without the user guessing. */
type Feedback = "disabled" | "enabled" | null;

const CLIPBOARD_FALLBACK = "Copy failed — select the text and press Ctrl+C.";

const requestFailure = (error: { message?: string; statusText?: string }) =>
  error.message ?? error.statusText ?? "The request failed.";

/**
 * The base32 key inside the otpauth URI is the manual-entry fallback for an authenticator that
 * cannot scan. The URI is the only place the server exposes it, so read it from there; a URI that
 * cannot be parsed leaves the page without a fallback rather than throwing during render.
 */
const readTotpSecret = (totpUri: string) => {
  try {
    return new URL(totpUri).searchParams.get("secret");
  } catch {
    return null;
  }
};

export const TwoFactorSetup = ({
  enabled: initialEnabled,
}: {
  enabled: boolean;
}) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [savedBackupCodes, setSavedBackupCodes] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const startEnrollment = useMutation({
    mutationFn: async (accountPassword: string) => {
      const { data, error } = await authClient.twoFactor.enable({
        password: accountPassword,
      });

      if (error) {
        throw new Error(requestFailure(error));
      }

      if (data.method !== "totp") {
        throw new Error(
          "The server did not return an authenticator app secret."
        );
      }

      const secret = readTotpSecret(data.totpURI);

      if (secret === null) {
        throw new Error(
          "The server returned an authenticator app URI without a secret."
        );
      }

      return { backupCodes: data.backupCodes, secret, totpUri: data.totpURI };
    },
    onSuccess: (data) => {
      setEnrollment(data);
      setPassword("");
    },
  });

  const finishEnrollment = useMutation({
    mutationFn: async (totpCode: string) => {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: totpCode,
      });

      if (error) {
        throw new Error(requestFailure(error));
      }
    },
    onSuccess: () => {
      setEnrollment(null);
      setCode("");
      setSavedBackupCodes(false);
      setEnabled(true);
      setFeedback("enabled");
    },
  });

  const disable = useMutation({
    mutationFn: async (accountPassword: string) => {
      const { error } = await authClient.twoFactor.disable({
        password: accountPassword,
      });

      if (error) {
        throw new Error(requestFailure(error));
      }
    },
    onSuccess: () => {
      setEnabled(false);
      setDisabling(false);
      setPassword("");
      setFeedback("disabled");
    },
  });

  const copy = async (text: string, confirmation: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(confirmation);
    } catch {
      setCopied(CLIPBOARD_FALLBACK);
    }
  };

  const handleStart = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    startEnrollment.mutate(password);
  };

  const handleVerify = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    finishEnrollment.mutate(code);
  };

  const handleDisable = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    disable.mutate(password);
  };

  if (enrollment !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan the QR code</CardTitle>
          <CardDescription>
            Scan it with an authenticator app, or enter the key by hand. Codes
            rotate every 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex justify-center">
              {/* A camera needs a light quiet zone, so the code keeps its own background in every theme. */}
              <div className="bg-white p-3" data-testid="totp-qr">
                <QRCode
                  level="M"
                  size={192}
                  title="Two-factor authentication QR code"
                  value={enrollment.totpUri}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">
                Cannot scan it? Enter this key by hand.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  className="bg-muted rounded-md px-2 py-1 font-mono text-sm break-all"
                  data-testid="totp-secret"
                >
                  {enrollment.secret}
                </code>
                <Button
                  onClick={() => {
                    void copy(enrollment.secret, "Key copied.");
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Copy key
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Backup codes</p>
              <p className="text-muted-foreground text-sm">
                Each code works once, then stops working. They are shown only
                now, so keep them somewhere safe.
              </p>
              <ul
                className="grid grid-cols-2 gap-1 font-mono text-sm"
                data-testid="backup-codes"
              >
                {enrollment.backupCodes.map((backupCode) => (
                  <li
                    className="bg-muted rounded-md px-2 py-1"
                    key={backupCode}
                  >
                    {backupCode}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => {
                  void copy(
                    enrollment.backupCodes.join("\n"),
                    "Backup codes copied."
                  );
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Copy backup codes
              </Button>
              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  aria-label="I have saved these backup codes"
                  checked={savedBackupCodes}
                  id="backup-codes-saved"
                  onCheckedChange={(checked) => {
                    setSavedBackupCodes(checked);
                  }}
                />
                <Label htmlFor="backup-codes-saved">
                  I have saved these backup codes
                </Label>
              </div>
            </div>
            <form className="grid gap-4" onSubmit={handleVerify}>
              <div className="grid gap-2">
                <Label htmlFor="two-factor-code">Authentication code</Label>
                <Input
                  autoComplete="one-time-code"
                  id="two-factor-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => {
                    setCode(event.target.value);
                  }}
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  required
                  value={code}
                />
              </div>
              <Button
                disabled={
                  finishEnrollment.isPending ||
                  !savedBackupCodes ||
                  code.length !== 6
                }
                type="submit"
              >
                Turn on two-factor authentication
              </Button>
              {finishEnrollment.isError && (
                <p className="text-destructive text-sm" role="alert">
                  {finishEnrollment.error.message}
                </p>
              )}
            </form>
            {copied === null ? null : (
              <output className="text-muted-foreground text-sm">
                {copied}
              </output>
            )}
            <Button
              onClick={() => {
                setEnrollment(null);
                setCode("");
                setSavedBackupCodes(false);
              }}
              type="button"
              variant="link"
            >
              Cancel setup
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Two-factor authentication is on. Signing in now also needs a code
            from your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {feedback === "enabled" && (
              <output className="text-sm font-medium">
                Two-factor authentication is on.
              </output>
            )}
            {disabling ? (
              <form
                className="border-destructive/40 grid gap-4 rounded-lg border p-4"
                onSubmit={handleDisable}
              >
                <div className="grid gap-1">
                  <p className="text-sm font-medium">
                    Disable two-factor authentication?
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Your password alone will sign in again, and the backup codes
                    stop working. Enter your password to confirm.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="disable-password">Password</Label>
                  <Input
                    autoComplete="current-password"
                    id="disable-password"
                    onChange={(event) => {
                      setPassword(event.target.value);
                    }}
                    type="password"
                    value={password}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setDisabling(false);
                      setPassword("");
                    }}
                    type="button"
                    variant="outline"
                  >
                    Keep two-factor
                  </Button>
                  <Button
                    disabled={disable.isPending || password === ""}
                    type="submit"
                    variant="destructive"
                  >
                    Yes, disable it
                  </Button>
                </div>
                {disable.isError && (
                  <p className="text-destructive text-sm" role="alert">
                    {disable.error.message}
                  </p>
                )}
              </form>
            ) : (
              <Button
                onClick={() => {
                  setDisabling(true);
                  setPassword("");
                }}
                type="button"
                variant="outline"
              >
                Disable two-factor authentication
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          Two-factor authentication is off. Add an authenticator app so a stolen
          password is not enough to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {feedback === "disabled" && (
            <output className="text-sm font-medium">
              Two-factor authentication is off.
            </output>
          )}
          <form className="grid gap-4" onSubmit={handleStart}>
            <div className="grid gap-2">
              <Label htmlFor="two-factor-password">Password</Label>
              <Input
                autoComplete="current-password"
                id="two-factor-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                required
                type="password"
                value={password}
              />
            </div>
            <Button
              disabled={startEnrollment.isPending || password === ""}
              type="submit"
            >
              Set up an authenticator app
            </Button>
            {startEnrollment.isError && (
              <p className="text-destructive text-sm" role="alert">
                {startEnrollment.error.message}
              </p>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
