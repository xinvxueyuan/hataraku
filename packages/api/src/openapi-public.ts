/**
 * The public HTTP contract.
 *
 * The router also carries the admin and per-user procedures. They are internal: the browser reaches
 * them over RPC, and they must not appear in the published OpenAPI document or answer cross-origin
 * requests. This module is the single allowlist both rules read, so a procedure becomes public in
 * one edit instead of three places drifting apart.
 *
 * Every route here is a GET over public read data. Nothing in this list needs a session, a body or
 * a write; a procedure that fails those tests belongs in the RPC-only set. The OpenAPI document
 * filters by router key, and the web server only emits CORS headers for the paths listed here.
 */
interface PublicApiRouteDefinition {
  /** Router key path, dot separated: the OpenAPI filter and the docs are keyed by it. */
  readonly key: string;
  /** HTTP path under the /api prefix. {name} segments are path parameters. */
  readonly path: `/${string}`;
  readonly summary: string;
  readonly tag: string;
}

export const PUBLIC_API_ROUTES = [
  {
    key: "health",
    path: "/health",
    summary: "服务健康检查",
    tag: "健康检查",
  },
  {
    key: "posts.list",
    path: "/posts",
    summary: "分页列出已发布文章",
    tag: "文章",
  },
  {
    key: "posts.bySlug",
    path: "/posts/{slug}",
    summary: "按 slug 读取一篇文章",
    tag: "文章",
  },
  {
    key: "posts.adjacent",
    path: "/posts/{slug}/adjacent",
    summary: "读取相邻文章",
    tag: "文章",
  },
  {
    key: "posts.related",
    path: "/posts/{slug}/related",
    summary: "读取相关文章",
    tag: "文章",
  },
  {
    key: "taxonomy.categories",
    path: "/taxonomy/categories",
    summary: "列出分类及已发布文章数",
    tag: "分类与标签",
  },
  {
    key: "taxonomy.tags",
    path: "/taxonomy/tags",
    summary: "列出标签及已发布文章数",
    tag: "分类与标签",
  },
  {
    key: "taxonomy.overview",
    path: "/taxonomy",
    summary: "分类与标签总览",
    tag: "分类与标签",
  },
  {
    key: "search.query",
    path: "/search",
    summary: "全文搜索文章",
    tag: "搜索",
  },
  {
    key: "site.profile",
    path: "/site",
    summary: "读取站点资料",
    tag: "站点",
  },
  {
    key: "content.micro.list",
    path: "/micro",
    summary: "分页列出微言",
    tag: "微言",
  },
  {
    key: "content.projects.list",
    path: "/projects",
    summary: "分页列出项目",
    tag: "项目",
  },
  {
    key: "content.projects.bySlug",
    path: "/projects/{slug}",
    summary: "按 slug 读取一个项目",
    tag: "项目",
  },
  {
    key: "content.changelog.list",
    path: "/changelog",
    summary: "分页列出更新日志",
    tag: "更新日志",
  },
  {
    key: "content.friends.list",
    path: "/friends",
    summary: "列出友链",
    tag: "友链",
  },
  {
    key: "content.skills.list",
    path: "/skills",
    summary: "列出技能",
    tag: "技能",
  },
  {
    key: "content.tools.list",
    path: "/tools",
    summary: "分页列出工具",
    tag: "工具",
  },
  {
    key: "media.albums.list",
    path: "/albums",
    summary: "分页列出相册",
    tag: "相册",
  },
  {
    key: "media.albums.bySlug",
    path: "/albums/{slug}",
    summary: "按 slug 读取相册与照片",
    tag: "相册",
  },
  {
    key: "media.devices.list",
    path: "/devices",
    summary: "分页列出设备",
    tag: "设备",
  },
  {
    key: "media.diary.list",
    path: "/diary",
    summary: "分页列出日记",
    tag: "日记",
  },
  {
    key: "media.timeline.list",
    path: "/timeline",
    summary: "分页列出时间线",
    tag: "时间线",
  },
] as const satisfies readonly PublicApiRouteDefinition[];

const TAG_DESCRIPTIONS = {
  健康检查: "服务存活检查",
  分类与标签: "分类、标签及已发布文章计数",
  友链: "友情链接",
  工具: "工具清单",
  微言: "短内容",
  技能: "技能清单",
  搜索: "全站文章搜索",
  文章: "已发布文章的列表、详情、相邻文章与相关推荐",
  日记: "日记",
  时间线: "时间线",
  更新日志: "版本与发布记录",
  相册: "相册与照片",
  站点: "站点资料",
  设备: "设备清单",
  项目: "项目展示",
} as const satisfies Record<string, string>;

/** OpenAPI tag objects, in the order the routes first introduce them. */
export const PUBLIC_API_TAGS = Object.entries(TAG_DESCRIPTIONS).map(
  ([name, description]) => ({ description, name })
);

interface PublicRouteMetadata {
  readonly method: "GET";
  readonly path: `/${string}`;
  readonly summary: string;
  readonly tags: readonly string[];
}

const ROUTES_BY_KEY = new Map<string, PublicApiRouteDefinition>(
  PUBLIC_API_ROUTES.map((route): [string, PublicApiRouteDefinition] => [
    route.key,
    route,
  ])
);

const PUBLIC_PROCEDURE_KEYS = new Set<string>(
  PUBLIC_API_ROUTES.map((route) => route.key)
);

/**
 * Route metadata for one public procedure.
 *
 * The key is looked up at module load: a typo fails the build instead of silently publishing a
 * procedure whose summary or path is missing from the contract.
 */
export const publicRoute = (key: string): PublicRouteMetadata => {
  const route = ROUTES_BY_KEY.get(key);

  if (route === undefined) {
    throw new Error(`Unknown public API route: ${key}`);
  }

  return {
    method: "GET",
    path: route.path,
    summary: route.summary,
    tags: [route.tag],
  };
};

/** True when the router-key path is part of the published contract. */
export const isPublicApiProcedure = (path: readonly string[]): boolean =>
  PUBLIC_PROCEDURE_KEYS.has(path.join("."));

const DOCUMENT_PATHS = new Set(["/", "/spec.json", "/openapi.json"]);

const normalizePath = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/u, "");

  return trimmed === "" ? "/" : trimmed;
};

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const patternOf = (path: string): RegExp => {
  const segments = path
    .split("/")
    .map((segment) =>
      segment.startsWith("{") && segment.endsWith("}")
        ? "[^/]+"
        : escapeRegExp(segment)
    );

  return new RegExp(`^${segments.join("/")}$`, "u");
};

const PUBLIC_PATH_PATTERNS = PUBLIC_API_ROUTES.map((route) =>
  patternOf(route.path)
);

/** True when the /api-relative path is public: the document, the reference UI or a read route. */
export const isPublicApiPath = (pathname: string): boolean => {
  const path = normalizePath(pathname);

  return (
    DOCUMENT_PATHS.has(path) ||
    PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(path))
  );
};

/**
 * CORS headers for the public, read-only surface; null means "emit nothing".
 *
 * The origin is the wildcard because these responses carry no credentials and the data is public.
 * The allowlist is what keeps the boundary: auth flows, admin procedures and every write path are
 * absent, so a browser gets no grant to call them even with the right session cookies. Preflight
 * never returns Access-Control-Allow-Credentials, and only GET, HEAD and OPTIONS are advertised.
 */
export const publicApiCorsHeaders = (
  method: string,
  pathname: string,
  requestedMethod?: string
): Record<string, string> | null => {
  if (!isPublicApiPath(pathname)) {
    return null;
  }

  if (method === "OPTIONS") {
    // A preflight that asks for a write is refused even on a path that happens to look like a
    // public route: the browser never receives a grant for POST.
    if (
      requestedMethod !== undefined &&
      requestedMethod.toUpperCase() !== "GET" &&
      requestedMethod.toUpperCase() !== "HEAD"
    ) {
      return null;
    }

    return {
      "access-control-allow-headers": "Accept, Content-Type",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-origin": "*",
      "access-control-max-age": "86400",
    };
  }

  if (method === "GET" || method === "HEAD") {
    return { "access-control-allow-origin": "*" };
  }

  return null;
};
