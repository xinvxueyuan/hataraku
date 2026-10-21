"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@hataraku/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@hataraku/ui/components/dropdown-menu";

import { authClient } from "#src/lib/auth-client.ts";

interface UserMenuProps {
  /** Computed on the server from the write allowlist; the browser never sees the list itself. */
  isAdmin: boolean;
  user: { name: string; email: string } | null;
}

export const UserMenu = ({ isAdmin, user }: UserMenuProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const signOut = useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/");
      router.refresh();
    },
  });

  if (!user) {
    return pathname === "/login" ? null : (
      <Button
        nativeButton={false}
        render={<Link href="/login" />}
        size="sm"
        variant="outline"
      >
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className="shrink-0" size="sm" variant="outline" />}
      >
        <UserRound aria-hidden="true" className="size-4 sm:hidden" />
        <span className="sr-only sm:not-sr-only">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>写作后台</DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/settings/admin" />}>
                后台管理
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuLabel>账号设置</DropdownMenuLabel>
          <DropdownMenuItem render={<Link href="/settings/password" />}>
            修改密码
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings/security" />}>
            安全设置
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings/two-factor" />}>
            两步验证
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            signOut.mutate();
          }}
          variant="destructive"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
