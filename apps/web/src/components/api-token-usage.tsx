import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";

import { CopyButton } from "#src/components/api-token-copy.tsx";

const POST_CURL = [
  "curl -X POST https://www.xinvstar.xyz/api/posts \\",
  '  -H "Authorization: Bearer $HATARAKU_TOKEN" \\',
  '  -H "Content-Type: application/json" \\',
  '  -d \'{"title":"标题","bodyMd":"正文"}\'',
].join("\n");

const NOTE_CURL = [
  "curl -X POST https://www.xinvstar.xyz/api/notes \\",
  '  -H "Authorization: Bearer $HATARAKU_TOKEN" \\',
  '  -H "Content-Type: application/json" \\',
  '  -d \'{"content":"一条微言"}\'',
].join("\n");

const CodeBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="grid gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium">{label}</p>
      <CopyButton label={`复制${label}命令`} value={value} />
    </div>
    <pre className="bg-muted overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
      <code>{value}</code>
    </pre>
  </div>
);

/** The external-writer quick start: four scopes, no documentation publishing. */
export const ApiTokenUsage = () => (
  <Card>
    <CardHeader>
      <CardTitle>用法</CardTitle>
      <CardDescription>
        把令牌放进 <code>Authorization: Bearer …</code> 请求头，调用写作
        API。令牌只代表它被授予的作用域。
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid gap-5">
        <p className="text-sm">
          接口基地址：{" "}
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
            https://www.xinvstar.xyz/api
          </code>
        </p>

        <CodeBlock label="发一篇文章" value={POST_CURL} />
        <CodeBlock label="发一条微言" value={NOTE_CURL} />

        <p className="text-muted-foreground text-sm">
          完整字段与响应说明见{" "}
          <Link className="underline underline-offset-4" href="/docs/api">
            API 文档
          </Link>
          。写入作用域只有文章、微言、项目、更新日志四种。
        </p>
      </div>
    </CardContent>
  </Card>
);
