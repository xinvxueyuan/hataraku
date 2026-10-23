"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@hataraku/ui/components/button";
import { Checkbox } from "@hataraku/ui/components/checkbox";
import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import { CopyButton } from "#src/components/api-token-copy.tsx";
import { api } from "#src/lib/api.ts";

const SCOPES = [
  {
    description: "创建、更新、发布或撤回文章。",
    label: "写作",
    value: "posts:write",
  },
  {
    description: "发布短句与碎片。",
    label: "微言",
    value: "notes:write",
  },
  {
    description: "维护项目条目与状态。",
    label: "项目",
    value: "projects:write",
  },
  {
    description: "写入版本记录与变更。",
    label: "更新日志",
    value: "changelog:write",
  },
] as const;

type Scope = (typeof SCOPES)[number]["value"];

type Expiry = "7" | "30" | "90" | "never";

const EXPIRY_OPTIONS: readonly { label: string; value: Expiry }[] = [
  { label: "7 天", value: "7" },
  { label: "30 天", value: "30" },
  { label: "90 天", value: "90" },
  { label: "永久", value: "never" },
];

const STEPS = ["名称", "作用域", "有效期", "复核", "结果"] as const;

const normalizeStep = (value: string | string[] | undefined): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const step = raw === undefined ? 1 : Number(raw);

  return Number.isInteger(step) && step >= 1 && step <= STEPS.length ? step : 1;
};

const stepFromLocation = () => {
  if (typeof window === "undefined") {
    return 1;
  }

  return normalizeStep(
    new URLSearchParams(window.location.search).get("step") ?? undefined
  );
};

const syncStep = (step: number) => {
  window.history.replaceState(
    window.history.state,
    "",
    `/settings/api/new?step=${step}`
  );
};

const stepButtonClass = (active: boolean, done: boolean, disabled: boolean) => {
  const state = active
    ? "border-primary/50 bg-primary/5"
    : "border-border/60 text-muted-foreground";

  const completed = done && !active ? "hover:bg-muted border-border" : "";
  const cursor = disabled ? "cursor-not-allowed" : "cursor-pointer";

  return `flex w-full min-w-0 flex-col gap-1 rounded-lg border p-2 text-left transition-colors ${state} ${completed} ${cursor}`;
};

const StepIndicator = ({
  current,
  onSelect,
}: {
  current: number;
  onSelect: (step: number) => void;
}) => (
  <ol
    aria-label="新建令牌步骤"
    className="grid grid-cols-5 gap-2"
    data-slot="api-token-steps"
  >
    {STEPS.map((label, index) => {
      const number = index + 1;
      const done = number < current;
      const active = number === current;
      const disabled = !done && !active;

      return (
        <li className="min-w-0" key={label}>
          <button
            aria-current={active ? "step" : undefined}
            className={stepButtonClass(active, done, disabled)}
            disabled={disabled}
            onClick={() => {
              onSelect(number);
            }}
            type="button"
          >
            <span className="text-muted-foreground text-xs tabular-nums">
              {number}
            </span>
            <span className="truncate text-xs font-medium sm:text-sm">
              {label}
            </span>
          </button>
        </li>
      );
    })}
  </ol>
);

const StepName = ({
  name,
  nameProblem,
  onChange,
}: {
  name: string;
  nameProblem: string | null;
  onChange: (value: string) => void;
}) => (
  <div className="grid gap-3">
    <h2 className="text-xl font-semibold">给这枚令牌起个名字</h2>
    <p className="text-muted-foreground text-sm">
      以后在列表里靠名字辨认它的用途。例如「Obsidian 发布」「CI 自动发布」。
    </p>
    <div className="grid max-w-lg gap-2">
      <Label htmlFor="api-token-name">名称</Label>
      <Input
        autoComplete="off"
        id="api-token-name"
        maxLength={120}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="例如：Obsidian 发布"
        value={name}
      />
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-muted-foreground">必填，最多 120 个字符。</span>
        <span className="text-muted-foreground tabular-nums">
          {name.length}/120
        </span>
      </div>
      {nameProblem === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {nameProblem}
        </p>
      )}
    </div>
  </div>
);

const StepScopes = ({
  scopes,
  onToggle,
}: {
  scopes: Scope[];
  onToggle: (scope: Scope, checked: boolean) => void;
}) => (
  <div className="grid gap-3">
    <h2 className="text-xl font-semibold">这枚令牌能做什么？</h2>
    <p className="text-muted-foreground text-sm">
      至少选择一个作用域；它只能做你勾选的事。
    </p>
    <div className="grid gap-3 sm:grid-cols-2">
      {SCOPES.map((scope) => {
        const checked = scopes.includes(scope.value);

        return (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
              checked ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"
            }`}
            htmlFor={`scope-${scope.value}`}
            key={scope.value}
          >
            <Checkbox
              checked={checked}
              id={`scope-${scope.value}`}
              onCheckedChange={(value) => {
                onToggle(scope.value, value);
              }}
            />
            <span className="grid min-w-0 gap-1">
              <span className="font-medium">{scope.label}</span>
              <span className="text-muted-foreground text-sm">
                {scope.description}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {scope.value}
              </span>
            </span>
          </label>
        );
      })}
    </div>
    {scopes.length === 0 ? (
      <p className="text-muted-foreground text-sm">还没有选择作用域。</p>
    ) : null}
  </div>
);

const StepExpiry = ({
  expiry,
  onChange,
}: {
  expiry: Expiry;
  onChange: (value: Expiry) => void;
}) => (
  <div className="grid gap-3">
    <h2 className="text-xl font-semibold">这枚令牌用多久？</h2>
    <p className="text-muted-foreground text-sm">
      到期后自动失效；短期任务建议选较短有效期。
    </p>
    <div className="flex flex-wrap gap-3">
      {EXPIRY_OPTIONS.map((option) => (
        <div className="flex items-center gap-2" key={option.value}>
          <input
            checked={expiry === option.value}
            className="accent-primary size-4"
            id={`api-token-expiry-${option.value}`}
            name="api-token-expiry"
            onChange={() => {
              onChange(option.value);
            }}
            type="radio"
            value={option.value}
          />
          <Label htmlFor={`api-token-expiry-${option.value}`}>
            {option.label}
          </Label>
        </div>
      ))}
    </div>
  </div>
);

const StepReview = ({
  error,
  expiry,
  isPending,
  name,
  scopes,
}: {
  error: string | null;
  expiry: Expiry;
  isPending: boolean;
  name: string;
  scopes: Scope[];
}) => {
  const expiryLabel =
    EXPIRY_OPTIONS.find((option) => option.value === expiry)?.label ?? expiry;

  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">确认一下</h2>
      <p className="text-muted-foreground text-sm">
        确认后才会创建令牌；明文只在下一步显示一次。
      </p>
      <dl className="max-w-xl divide-y rounded-xl border text-sm">
        <div className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-3">
          <dt className="text-muted-foreground sm:w-28 sm:shrink-0">名称</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        <div className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-3">
          <dt className="text-muted-foreground sm:w-28 sm:shrink-0">作用域</dt>
          <dd className="min-w-0">
            {scopes
              .map(
                (scope) =>
                  SCOPES.find((entry) => entry.value === scope)?.label ?? scope
              )
              .join(" · ")}
          </dd>
        </div>
        <div className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-3">
          <dt className="text-muted-foreground sm:w-28 sm:shrink-0">有效期</dt>
          <dd className="min-w-0">{expiryLabel}</dd>
        </div>
      </dl>
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      {isPending ? (
        <p className="text-muted-foreground text-sm">创建中…</p>
      ) : null}
    </div>
  );
};

const StepResult = ({
  name,
  token,
}: {
  name: string;
  token: string | null;
}) => {
  if (token === null) {
    return (
      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">令牌已创建</h2>
        <p className="text-muted-foreground text-sm">
          刷新后无法再次查看明文。请回列表确认这枚令牌，或重新创建一枚。
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-slot="api-token-result">
      <h2 className="text-xl font-semibold">「{name}」已创建</h2>
      <p className="text-muted-foreground text-sm">
        这是唯一一次显示明文。离开或刷新后无法再次查看，请立即保存到密码管理器。
      </p>
      <output
        aria-live="polite"

        className="border-primary/30 bg-primary/5 flex flex-col gap-3 rounded-xl border p-4"
      >
        <code className="bg-background rounded-md border p-3 font-mono text-sm break-all">
          {token}
        </code>
        <div>
          <CopyButton label="复制令牌" value={token} />
        </div>
      </output>
    </div>
  );
};

const LeaveDialog = ({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <div
    aria-labelledby="leave-token-title"
    aria-modal="true"
    className="bg-background/95 fixed inset-0 z-50 grid place-items-center p-4"
    role="alertdialog"
  >
    <div className="bg-card grid max-w-md gap-4 rounded-xl border p-5 shadow-lg">
      <h2 className="text-lg font-semibold" id="leave-token-title">
        离开后无法再次查看该令牌
      </h2>
      <p className="text-muted-foreground text-sm">
        明文只显示这一次。已经保存好了吗？
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          留在这页
        </Button>
        <Button onClick={onConfirm} type="button" variant="destructive">
          离开并返回列表
        </Button>
      </div>
    </div>
  </div>
);

const WizardFooter = ({
  createError,
  isCreating,
  onBack,
  onConfirm,
  onDone,
  onNext,
  step,
  submitDisabled,
}: {
  createError: string | null;
  isCreating: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
  onNext: () => void;
  step: number;
  submitDisabled: boolean;
}) => {
  if (step === 5) {
    return (
      <div className="mt-auto flex flex-col gap-3 border-t pt-4">
        <div className="flex justify-end">
          <Button onClick={onDone} type="button">
            完成，返回列表
          </Button>
        </div>
        {createError === null ? null : (
          <p className="text-destructive text-sm" role="alert">
            {createError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <Button
        disabled={step === 1}
        onClick={onBack}
        type="button"
        variant="outline"
      >
        上一步
      </Button>
      <div className="flex items-center gap-2">
        {step === 4 ? (
          <Button
            disabled={isCreating || submitDisabled}
            onClick={onConfirm}
            type="button"
          >
            {isCreating ? "创建中…" : "确认创建"}
          </Button>
        ) : (
          <Button disabled={submitDisabled} onClick={onNext} type="button">
            下一步
          </Button>
        )}
      </div>
      {createError === null ? null : (
        <p className="text-destructive w-full text-sm" role="alert">
          {createError}
        </p>
      )}
    </div>
  );
};

export const ApiTokenWizard = ({ initialStep }: { initialStep: number }) => {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [expiry, setExpiry] = useState<Expiry>("30");

  const [revealed, setRevealed] = useState<{
    name: string;
    token: string;
  } | null>(null);

  const [leaveOpen, setLeaveOpen] = useState(false);

  const create = useMutation(
    api.apiTokens.create.mutationOptions({
      onSuccess: (result) => {
        setRevealed({ name: result.name, token: result.token });
        setStep(5);
        syncStep(5);
      },
    })
  );

  useEffect(() => {
    const onPopState = () => {
      const next = stepFromLocation();
      setStep(next);
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const nameProblem =
    nameTouched && name.trim() === "" ? "名称不能为空。" : null;

  const canLeave = step !== 5;

  const requestStep = (next: number) => {
    if (next === step) {
      return;
    }

    if (!canLeave) {
      setLeaveOpen(true);

      return;
    }

    setStep(next);
    syncStep(next);
  };

  const requestLeave = () => {
    if (step === 5) {
      setLeaveOpen(true);

      return;
    }

    router.push("/settings/api");
  };

  const toggleScope = (scope: Scope, checked: boolean) => {
    setScopes((previous) =>
      checked
        ? [...previous.filter((value) => value !== scope), scope]
        : previous.filter((value) => value !== scope)
    );
  };

  const submit = () => {
    if (name.trim() === "" || scopes.length === 0) {
      return;
    }

    create.mutate(
      expiry === "never"
        ? { name: name.trim(), scopes }
        : { expiresInDays: Number(expiry), name: name.trim(), scopes }
    );
  };

  const stepBody: ReactNode = (() => {
    if (step === 1) {
      return (
        <StepName
          name={name}
          nameProblem={nameProblem}
          onChange={(value) => {
            setName(value);
            setNameTouched(true);
          }}
        />
      );
    }

    if (step === 2) {
      return <StepScopes onToggle={toggleScope} scopes={scopes} />;
    }

    if (step === 3) {
      return <StepExpiry expiry={expiry} onChange={setExpiry} />;
    }

    if (step === 4) {
      return (
        <StepReview
          error={create.isError ? create.error.message : null}
          expiry={expiry}
          isPending={create.isPending}
          name={name.trim()}
          scopes={scopes}
        />
      );
    }

    return (
      <StepResult
        name={revealed?.name ?? name.trim()}
        token={revealed?.token ?? null}
      />
    );
  })();

  const stepValid = (() => {
    if (step === 1) {
      return name.trim() !== "" && name.length <= 120;
    }

    if (step === 2) {
      return scopes.length > 0;
    }

    return true;
  })();

  return (
    <div className="flex min-h-96 flex-col gap-6" data-slot="api-token-wizard">
      <StepIndicator current={step} onSelect={requestStep} />
      <div className="flex-1">{stepBody}</div>
      <WizardFooter
        createError={create.isError ? create.error.message : null}
        isCreating={create.isPending}
        onBack={() => {
          requestStep(step - 1);
        }}
        onConfirm={submit}
        onDone={requestLeave}
        onNext={() => {
          if (step === 1) {
            setNameTouched(true);
          }

          requestStep(step + 1);
        }}
        step={step}
        submitDisabled={!stepValid || (step === 4 && create.isPending)}
      />
      {leaveOpen ? (
        <LeaveDialog
          onCancel={() => {
            setLeaveOpen(false);
          }}
          onConfirm={() => {
            setLeaveOpen(false);
            window.location.assign("/settings/api");
          }}
        />
      ) : null}
    </div>
  );
};
