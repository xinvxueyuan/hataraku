"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitEvent } from "react";

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

import { CopyButton } from "#src/components/api-token-copy.tsx";
import { api } from "#src/lib/api.ts";

const SCOPES = [
  { label: "文章", value: "posts:write" },
  { label: "微言", value: "notes:write" },
  { label: "项目", value: "projects:write" },
  { label: "更新日志", value: "changelog:write" },
] as const;

type Scope = (typeof SCOPES)[number]["value"];

type Expiry = "7" | "30" | "90" | "never";

const EXPIRY_OPTIONS: readonly { label: string; value: Expiry }[] = [
  { label: "7 天", value: "7" },
  { label: "30 天", value: "30" },
  { label: "90 天", value: "90" },
  { label: "永久", value: "never" },
];

interface RevealedToken {
  name: string;
  token: string;
}

/**
 * The create form. The plaintext token lives in this component's state only: it arrives in the create
 * response, is shown once, and disappears when the owner closes the panel or reloads the page.
 */
export const ApiTokenCreate = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [expiry, setExpiry] = useState<Expiry>("30");
  const [problem, setProblem] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedToken | null>(null);

  const create = useMutation(
    api.apiTokens.create.mutationOptions({
      onSuccess: (result) => {
        setRevealed({ name: result.name, token: result.token });
        setName("");
        setScopes([]);
        router.refresh();
      },
    })
  );

  const toggleScope = (scope: Scope, checked: boolean) => {
    setProblem(null);
    setScopes((previous) =>
      checked
        ? [...previous.filter((value) => value !== scope), scope]
        : previous.filter((value) => value !== scope)
    );
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProblem(null);

    if (name.trim() === "") {
      setProblem("给令牌起一个名字，方便以后辨认。");

      return;
    }

    if (scopes.length === 0) {
      setProblem("至少选择一个作用域。");

      return;
    }

    const input = { name: name.trim(), scopes };
    create.mutate(
      expiry === "never" ? input : { ...input, expiresInDays: Number(expiry) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>新建令牌</CardTitle>
        <CardDescription>
          只授予它需要的一个或多个写入范围；令牌创建后只显示一次。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {revealed === null ? null : (
            <output
              aria-live="polite"

              className="border-primary/30 bg-primary/5 flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="grid gap-1">
                <p className="font-medium">「{revealed.name}」已创建</p>
                <p className="text-muted-foreground text-sm">
                  这是唯一一次显示明文。关闭后无法再次查看，请立即保存到密码管理器。
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <code className="bg-background min-w-0 flex-1 rounded-md border p-2 font-mono text-xs break-all">
                  {revealed.token}
                </code>
                <CopyButton label="复制令牌" value={revealed.token} />
              </div>
              <div>
                <Button
                  onClick={() => {
                    setRevealed(null);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  我已保存，关闭
                </Button>
              </div>
            </output>
          )}

          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="api-token-name">名称</Label>
              <Input
                autoComplete="off"
                id="api-token-name"
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                placeholder="例如：Obsidian 发布"
                required
                value={name}
              />
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">作用域</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCOPES.map((scope) => (
                  <div className="flex items-center gap-2" key={scope.value}>
                    <Checkbox
                      checked={scopes.includes(scope.value)}
                      id={`scope-${scope.value}`}
                      onCheckedChange={(checked) => {
                        toggleScope(scope.value, checked);
                      }}
                    />
                    <Label htmlFor={`scope-${scope.value}`}>
                      {scope.label}
                    </Label>
                    <span className="text-muted-foreground font-mono text-xs">
                      {scope.value}
                    </span>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">有效期</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {EXPIRY_OPTIONS.map((option) => (
                  <div className="flex items-center gap-2" key={option.value}>
                    <input
                      checked={expiry === option.value}
                      className="accent-primary size-4"
                      id={`expiry-${option.value}`}
                      name="expiry"
                      onChange={() => {
                        setExpiry(option.value);
                      }}
                      type="radio"
                      value={option.value}
                    />
                    <Label htmlFor={`expiry-${option.value}`}>
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={
                  create.isPending || name.trim() === "" || scopes.length === 0
                }
                type="submit"
              >
                {create.isPending ? "创建中…" : "创建令牌"}
              </Button>
              <span className="text-muted-foreground text-xs">
                明文不会存进浏览器存储，也不会出现在 URL 里。
              </span>
            </div>

            {problem === null ? null : (
              <p className="text-destructive text-sm" role="alert">
                {problem}
              </p>
            )}
            {create.isError ? (
              <p className="text-destructive text-sm" role="alert">
                {create.error.message}
              </p>
            ) : null}
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
