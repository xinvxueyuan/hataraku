"use client";

import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";

import { Button } from "@hataraku/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";
import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import {
  authClient,
  setTwoFactorRequiredHandler,
} from "#src/lib/auth-client.ts";

import { TurnstileWidget, turnstileSiteKey } from "./turnstile-widget.tsx";

type Mode = "sign-in" | "sign-up";

/** The credential form, then the second factor once Better Auth asks for it. */
type Step = "credentials" | "two-factor";

const copy = {
  "sign-in": {
    description: "Welcome back.",
    submit: "Sign in",
    switchLabel: "Need an account? Sign up",
    title: "Sign in",
  },
  "sign-up": {
    description: "Sign up with your email and a password.",
    submit: "Sign up",
    switchLabel: "Already have an account? Sign in",
    title: "Create an account",
  },
} as const;

const formValue = (form: FormData, name: string) => {
  const value = form.get(name);

  if (value === null || value instanceof File) {
    return "";
  }

  return value;
};

/**
 * The captcha plugin reads this header; an absent token is fine when the server has no secret.
 */
const captchaHeaders = (token: string) =>
  token === "" ? undefined : { "x-captcha-response": token };

export const AuthForm = ({ redirectTo }: { redirectTo: Route }) => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [step, setStep] = useState<Step>("credentials");
  const [captchaToken, setCaptchaToken] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const text = copy[mode];

  const finish = () => {
    router.push(redirectTo);
    router.refresh();
  };

  const { isPending, mutate } = useMutation({
    mutationFn: async (form: FormData) => {
      const email = formValue(form, "email");
      const password = formValue(form, "password");
      const headers = captchaHeaders(captchaToken);
      const fetchOptions = headers === undefined ? undefined : { headers };

      if (mode === "sign-in") {
        const { error } = await authClient.signIn.email({
          email,
          fetchOptions,
          password,
        });

        if (error) {
          throw new Error(error.message ?? error.statusText);
        }

        return;
      }

      const { error } = await authClient.signUp.email({
        email,
        fetchOptions,
        name: formValue(form, "name"),
        password,
      });

      if (error) {
        throw new Error(error.message ?? error.statusText);
      }
    },
    onSuccess: finish,
  });

  const verify = useMutation({
    mutationFn: async (form: FormData) => {
      const code = formValue(form, "code");

      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code });

      if (error) {
        throw new Error(error.message ?? error.statusText);
      }
    },
    onSuccess: finish,
  });

  const signOut = useMutation({
    mutationFn: async () => {
      // Better Auth's sign-out is a POST; a GET never ends the session.
      const { error } = await authClient.signOut();

      if (error) {
        throw new Error(error.message ?? error.statusText);
      }
    },
    onSuccess: () => {
      setStep("credentials");
      setMode("sign-in");
    },
  });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutate(new FormData(event.currentTarget));
  };

  const handleVerify = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    verify.mutate(new FormData(event.currentTarget));
  };

  // The second factor is reported through the plugin callback, not the sign-in response.
  useEffect(() => {
    setTwoFactorRequiredHandler(() => {
      setStep("two-factor");
    });

    return () => {
      setTwoFactorRequiredHandler(undefined);
    };
  }, []);

  if (step === "two-factor") {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            {useBackupCode
              ? "Enter one of the backup codes you saved when you enrolled."
              : "Enter the six digit code from your authenticator app."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleVerify}>
            <div className="grid gap-2">
              <Label htmlFor="code">
                {useBackupCode ? "Backup code" : "Authentication code"}
              </Label>
              <Input
                autoComplete="one-time-code"
                id="code"
                inputMode={useBackupCode ? "text" : "numeric"}
                name="code"
                required
                type="text"
              />
            </div>
            <Button disabled={verify.isPending} type="submit">
              Verify
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                }}
                type="button"
                variant="link"
              >
                {useBackupCode
                  ? "Use an authenticator code"
                  : "Use a backup code"}
              </Button>
              {/* Without this the second factor is a dead end: the dashboard needs a verified
                  session, so a user who cannot produce a code has nowhere to go. */}
              <Button
                disabled={signOut.isPending}
                onClick={() => {
                  signOut.mutate();
                }}
                type="button"
                variant="outline"
              >
                Sign out
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {mode === "sign-up" && (
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input autoComplete="name" id="name" name="name" required />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              id="password"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </div>
          {turnstileSiteKey === "" ? null : (
            <TurnstileWidget onToken={setCaptchaToken} />
          )}
          <Button disabled={isPending} type="submit">
            {text.submit}
          </Button>
          <Button
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            }}
            type="button"
            variant="link"
          >
            {text.switchLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
