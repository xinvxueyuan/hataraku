import { count as countDocuments, create, insert, search } from "@orama/orama";
import type { DefaultTokenizer } from "@orama/orama";
import { stopwords } from "@orama/stopwords/mandarin";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@hataraku/db";
import { posts } from "@hataraku/db/schema/posts";
import { postTags, tags } from "@hataraku/db/schema/taxonomy";

import { markdownToPlainText } from "#src/search/plain-text.ts";

/**
 * Search runs on an in-process Orama index; Postgres stays the source of truth.
 *
 * The old search_index table, its triggers and the ns_tsquery_* functions still exist and still
 * maintain themselves on every write, but nothing reads them any more. That is a transitional
 * state with a defined end — removed after this path has served a full release cycle without a
 * search regression — and the removal is a migration, not a rewrite here:
 *   1. confirm nothing references search_index or ns_tsquery_ in the repository or the query logs;
 *   2. write a new migration that drops the two triggers (posts_search_index_sync,
 *      post_tags_search_index_sync), then refresh_search_index, search_index_sync_from_posts,
 *      search_index_sync_from_post_tags, ns_tsquery_terms, ns_tsquery_text, ns_tsquery_text_or,
 *      ns_cjk_ngrams and ns_tsvector_text, then the table itself;
 *   3. delete db/schema/search.ts and its relations entry, and the tests that name the old path.
 * Until that lands the derived table is dead weight, not a second read path.
 *
 * The index is rebuilt from posts when a cheap fingerprint changes: the number of published posts
 * and their newest updated_at. Every write in this repository sets updated_at, including tag
 * edits, so one aggregate covers content, publish state and taxonomy changes.
 */
const MAX_QUERY_LENGTH = 256;

/** Field weights: the title should win over a body mention, then the summary and tags. */
const SEARCH_PROPERTIES = [
  "title",
  "description",
  "bodyText",
  "tags",
  "category",
  "content",
] as const;

const BOOST = {
  bodyText: 1,
  category: 1,
  content: 1,
  description: 2,
  tags: 2,
  title: 5,
} as const;

/**
 * Deterministic tokeniser for mixed Chinese and Latin text.
 *
 * Orama's mandarin tokeniser is context dependent: the query 限流 segments to [限, 流], while a
 * document containing 限流区域 segments to [限流, 区域]. Prefix matching only looks forward from a
 * token's first character, so the query token 流 can never match inside 限流 — measured: the Nginx
 * article that contains 限流 three times was not returned at all. A tokeniser that cannot disagree
 * with itself fixes that: each Han run becomes its characters plus its adjacent bigrams, and each
 * non-Han run is split into lowercased words. 限流 then asks for 限, 流 and 限流; the document
 * holds all three. Latin prefixes still work through Orama's radix tree (goo finds google).
 *
 * Cost: every CJK run doubles its token count (chars + bigrams), which is why the index build is
 * measured in the H41 report. The mandarin dictionary's word knowledge is given up in exchange for
 * query/index consistency; phrase precision is preserved by the bigrams.
 */
const CJK_RUN = /(?<han>\p{Script=Han}+)|(?<other>[^\p{Script=Han}]+)/gu;
const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

/** Grapheme granularity keeps a Han character whole even outside the BMP. */
const graphemes = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

const tokenizeText = (input: string): string[] => {
  const tokens: string[] = [];

  for (const match of input.toLowerCase().matchAll(CJK_RUN)) {
    const han = match.groups?.han ?? "";
    const other = match.groups?.other ?? "";

    if (han !== "") {
      const chars = [...graphemes.segment(han)].map((part) => part.segment);

      for (const char of chars) {
        tokens.push(char);
      }

      for (let index = 0; index < chars.length - 1; index += 1) {
        const first = chars[index];
        const second = chars[index + 1];

        if (first !== undefined && second !== undefined) {
          tokens.push(first + second);
        }
      }

      continue;
    }

    if (other !== "") {
      for (const word of other.split(WORD_SEPARATOR)) {
        if (word !== "") {
          tokens.push(word);
        }
      }
    }
  }

  return [...new Set(tokens.filter((token) => !stopwords.includes(token)))];
};

const tokenizer: DefaultTokenizer = {
  allowDuplicates: false,
  language: "mandarin",
  normalizationCache: new Map<string, string>(),
  normalizeToken: (_prop, token) => (stopwords.includes(token) ? "" : token),
  stemmerSkipProperties: new Set<string>(),
  stopWords: stopwords,
  tokenize: (input) => tokenizeText(input),
  tokenizeSkipProperties: new Set<string>(),
};

/**
 * Searchable fields. content repeats every other field: it lets a query's tokens be found when they
 * come from different properties (the title and the body) without asking Orama to join fields; it
 * carries weight 1 and only exists for that recall guard.
 */
const searchSchema = {
  bodyText: "string",
  category: "string",
  content: "string",
  description: "string",
  id: "string",
  publishedAt: "number",
  slug: "string",
  tags: "string[]",
  title: "string",
} as const;

type SearchDatabase = ReturnType<typeof create<typeof searchSchema>>;

interface SearchDocument {
  bodyText: string;
  category: string;
  content: string;
  description: string;
  id: string;
  publishedAt: number;
  slug: string;
  tags: string[];
  title: string;
}

interface CachedIndex {
  database: SearchDatabase;
  /** Every token the document contributed; the router's AND filter is applied against this list. */
  tokensBySlug: Map<string, string[]>;
  signature: string;
}

const cache = new WeakMap<Database, CachedIndex>();
const pending = new WeakMap<Database, Promise<CachedIndex>>();

/** The fingerprint that decides whether the in-memory index is still current. */
const signatureOf = async (db: Database): Promise<string> => {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      newestUpdate: sql<string | null>`max(${posts.updatedAt})::text`,
    })
    .from(posts)
    .where(and(eq(posts.published, true), eq(posts.draft, false)));

  return `${row?.count ?? 0}:${row?.newestUpdate ?? ""}`;
};

const tagsByPost = async (db: Database): Promise<Map<string, string[]>> => {
  const rows = await db
    .select({ postId: postTags.postId, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId));

  const byPost = new Map<string, string[]>();

  for (const row of rows) {
    const list = byPost.get(row.postId) ?? [];

    list.push(row.slug);
    byPost.set(row.postId, list);
  }

  for (const list of byPost.values()) {
    list.sort();
  }

  return byPost;
};

const tokensOf = (document: SearchDocument): string[] => [
  ...new Set([
    ...tokenizeText(document.title),
    ...tokenizeText(document.description),
    ...tokenizeText(document.bodyText),
    ...document.tags.flatMap((tag) => tokenizeText(tag)),
    ...tokenizeText(document.category),
  ]),
];

/**
 * Builds the index from scratch. Exported for tests and timing: the router only reaches it through
 * indexFor, and a caller holding the returned database must treat it as read-only.
 */
export const createSearchIndex = async (
  db: Database
): Promise<{
  database: SearchDatabase;
  documentCount: number;
  tokensBySlug: Map<string, string[]>;
}> => {
  const rows = await db
    .select({
      bodyMd: posts.bodyMd,
      categorySlug: posts.categorySlug,
      description: posts.description,
      id: posts.id,
      publishedAt: posts.publishedAt,
      slug: posts.slug,
      title: posts.title,
    })
    .from(posts)
    .where(and(eq(posts.published, true), eq(posts.draft, false)));

  const postTagsByPost = await tagsByPost(db);
  const database = create({ components: { tokenizer }, schema: searchSchema });
  const tokensBySlug = new Map<string, string[]>();

  await Promise.all(
    rows.map(async (row) => {
      const tagsOfRow = postTagsByPost.get(row.id) ?? [];
      const bodyText = markdownToPlainText(row.bodyMd ?? "");

      const document: SearchDocument = {
        bodyText,
        category: row.categorySlug ?? "",
        content: [
          row.title,
          row.description ?? "",
          bodyText,
          tagsOfRow.join(" "),
          row.categorySlug ?? "",
        ].join(" "),
        description: row.description ?? "",
        id: row.id,
        publishedAt: row.publishedAt?.getTime() ?? 0,
        slug: row.slug,
        tags: tagsOfRow,
        title: row.title,
      };

      tokensBySlug.set(row.slug, tokensOf(document));
      await insert(database, document);
    })
  );

  return { database, documentCount: rows.length, tokensBySlug };
};

/** The current index for this database, rebuilt only when the fingerprint moved. */
const indexFor = async (db: Database, depth = 0): Promise<CachedIndex> => {
  const signature = await signatureOf(db);
  const cached = cache.get(db);

  if (cached !== undefined && cached.signature === signature) {
    return cached;
  }

  const building = pending.get(db);

  if (building !== undefined) {
    const built = await building;

    if (built.signature === signature || depth >= 2) {
      return built;
    }

    return await indexFor(db, depth + 1);
  }

  const started = (async (): Promise<CachedIndex> => {
    try {
      const result = await createSearchIndex(db);

      const entry: CachedIndex = {
        database: result.database,
        signature,
        tokensBySlug: result.tokensBySlug,
      };

      cache.set(db, entry);

      return entry;
    } finally {
      pending.delete(db);
    }
  })();

  pending.set(db, started);

  const entry = await started;

  if (entry.signature !== signature && depth < 2) {
    return await indexFor(db, depth + 1);
  }

  return entry;
};

interface SearchHit {
  categorySlug: string | null;
  description: string | null;
  publishedAt: Date | null;
  rank: number;
  slug: string;
  /** Body evidence for a hit whose title and summary do not contain the query; null otherwise. */
  snippet: SearchSnippet | null;
  title: string;
}

interface SearchSnippetMatch {
  length: number;
  start: number;
}

interface SearchSnippet {
  matches: SearchSnippetMatch[];
  text: string;
}

export interface SearchResult {
  items: SearchHit[];
  query: string;
  total: number;
}

/** Context on each side of the first hit, in characters; widened to whole Latin words below. */
const SNIPPET_RADIUS = 48;
const SNIPPET_LIMIT = 200;
const LATIN_WORD_CHAR = /[\p{Script=Latin}\p{N}]/u;

/** Keeps a slice from ending inside a surrogate pair (Han characters outside the BMP). */
const codePointStart = (text: string, index: number): number => {
  if (index <= 0) {
    return 0;
  }

  if (index >= text.length) {
    return text.length;
  }

  const code = text.codePointAt(index);

  return code !== undefined && code >= 0xdc_00 && code <= 0xdf_ff
    ? index - 1
    : index;
};

const codePointEnd = (text: string, index: number): number => {
  if (index <= 0) {
    return 0;
  }

  if (index >= text.length) {
    return text.length;
  }

  const code = text.codePointAt(index - 1);

  return code !== undefined &&
    (code > 0xff_ff || (code >= 0xd8_00 && code <= 0xdb_ff))
    ? index - 1
    : index;
};

/**
 * Widens an excerpt boundary to a whole Latin word, within a small overshoot budget.
 *
 * Chinese runs are deliberately left alone: every Han character is its own unit, so walking the
 * boundary across a CJK run would grow the excerpt to the start of the paragraph.
 */
const widenStart = (text: string, start: number, floor: number): number => {
  let next = start;

  while (
    next > floor &&
    LATIN_WORD_CHAR.test(text[next - 1] ?? "") &&
    LATIN_WORD_CHAR.test(text[next] ?? "")
  ) {
    next -= 1;
  }

  return next;
};

const widenEnd = (text: string, end: number, ceiling: number): number => {
  let next = end;

  while (
    next < ceiling &&
    LATIN_WORD_CHAR.test(text[next - 1] ?? "") &&
    LATIN_WORD_CHAR.test(text[next] ?? "")
  ) {
    next += 1;
  }

  return next;
};

const matchesOf = (
  text: string,
  tokens: readonly string[]
): SearchSnippetMatch[] => {
  const haystack = text.toLowerCase();
  const ranges: SearchSnippetMatch[] = [];

  for (const token of tokens) {
    if (token === "") {
      continue;
    }

    let from = 0;

    while (from < haystack.length) {
      const at = haystack.indexOf(token, from);

      if (at === -1) {
        break;
      }

      ranges.push({ length: token.length, start: at });
      from = at + Math.max(token.length, 1);
    }
  }

  const merged: SearchSnippetMatch[] = [];

  for (const range of ranges.toSorted(
    (left, right) => left.start - right.start
  )) {
    const last = merged.at(-1);

    if (last !== undefined && range.start <= last.start + last.length) {
      last.length = Math.max(
        last.length,
        range.start + range.length - last.start
      );
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
};

/**
 * Builds a one-line body excerpt around the first query hit.
 *
 * Only called for hits whose title and summary do not contain a query token, which is exactly the
 * case the result page looks unexplained. The returned text is plain (no markup) and the ranges
 * let the React highlighter mark the evidence without re-tokenising on the client.
 */
const buildSnippet = (
  body: string,
  query: string,
  tokens: readonly string[]
): SearchSnippet | null => {
  const text = body;

  if (text === "") {
    return null;
  }

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let hit = haystack.indexOf(needle);
  let hitLength = needle.length;

  if (hit === -1) {
    for (const token of tokens.toSorted(
      (left, right) => right.length - left.length
    )) {
      const at = haystack.indexOf(token);

      if (at !== -1) {
        hit = at;
        hitLength = token.length;
        break;
      }
    }
  }

  if (hit === -1) {
    return null;
  }

  const floor = Math.max(0, hit - SNIPPET_RADIUS - 24);
  const ceiling = Math.min(text.length, hit + hitLength + SNIPPET_RADIUS + 24);

  const start = widenStart(
    text,
    codePointStart(text, Math.max(0, hit - SNIPPET_RADIUS)),
    floor
  );

  let end = widenEnd(
    text,
    codePointEnd(text, Math.min(text.length, hit + hitLength + SNIPPET_RADIUS)),
    ceiling
  );

  if (end - start > SNIPPET_LIMIT) {
    end = codePointEnd(text, start + SNIPPET_LIMIT);
  }

  const snippetText = `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;

  return {
    matches: matchesOf(snippetText, tokens),
    text: snippetText,
  };
};

const titleOrSummaryHasToken = (
  document: SearchDocument,
  tokens: readonly string[]
): boolean => {
  const haystack = `${document.title} ${document.description}`.toLowerCase();

  return tokens.some((token) => haystack.includes(token));
};

const toHit = (
  document: SearchDocument,
  score: number,
  snippet: SearchSnippet | null
): SearchHit => ({
  categorySlug: document.category === "" ? null : document.category,
  description: document.description === "" ? null : document.description,
  publishedAt:
    document.publishedAt === 0 ? null : new Date(document.publishedAt),
  rank: score,
  slug: document.slug,
  snippet,
  title: document.title,
});

const countOccurrences = (haystack: string, needle: string): number => {
  if (needle === "") {
    return 0;
  }

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
};

/**
 * A literal-match rerank on top of BM25. The tokeniser indexes single characters as well as
 * bigrams, so 限流 matches every document holding 限 and 流 separately; a document containing the
 * phrase itself should win. Title occurrences weigh most, then the summary, then the body.
 */
const exactScore = (document: SearchDocument, needle: string): number =>
  countOccurrences(document.title.toLowerCase(), needle) * 100 +
  countOccurrences(document.description.toLowerCase(), needle) * 10 +
  countOccurrences(document.bodyText.toLowerCase(), needle);

/**
 * Runs one query.
 *
 * Orama's own threshold filter cannot express this AND with prefixes: it counts matched words per
 * property, so a token that prefixes two indexed words (限 matching 限 and 限流) counts twice and
 * the document is dropped even though every token matched. The router therefore asks Orama for the
 * union (threshold 1) and applies the AND itself: every query token must be a prefix of some token
 * the document contributed. That is also the precision gate — 不存在的词xyz asks for 不存, 存在,
 * 在的, 的词 and xyz, which no post contains together.
 *
 * Pagination is ours because the ranking is: a literal phrase match outranks a token match, equal
 * scores fall back to publishedAt, and Orama cannot be told that second key without sorting the
 * whole match list anyway.
 */
export const searchPosts = async (
  db: Database,
  input: { page: number; pageSize: number; q: string }
): Promise<SearchResult> => {
  const query = input.q.trim().slice(0, MAX_QUERY_LENGTH);

  if (query === "") {
    return { items: [], query: "", total: 0 };
  }

  const queryTokens = tokenizeText(query);

  if (queryTokens.length === 0) {
    return { items: [], query, total: 0 };
  }

  const index = await indexFor(db);

  const result = await search(index.database, {
    boost: { ...BOOST },
    limit: countDocuments(index.database),
    properties: [...SEARCH_PROPERTIES],
    term: query,
    threshold: 1,
  });

  const matches = result.hits.filter((hit) => {
    const documentTokens = index.tokensBySlug.get(hit.document.slug);

    if (documentTokens === undefined) {
      return false;
    }

    return queryTokens.every((queryToken) =>
      documentTokens.some((token) => token.startsWith(queryToken))
    );
  });

  if (matches.length === 0) {
    return { items: [], query, total: 0 };
  }

  const needle = query.toLowerCase();

  const ranked = matches
    .map((hit) => ({ exact: exactScore(hit.document, needle), hit }))
    .toSorted((left, right) => {
      if (right.exact !== left.exact) {
        return right.exact - left.exact;
      }

      if (right.hit.score !== left.hit.score) {
        return right.hit.score - left.hit.score;
      }

      return right.hit.document.publishedAt - left.hit.document.publishedAt;
    });

  const start = (input.page - 1) * input.pageSize;

  return {
    items: ranked.slice(start, start + input.pageSize).map((entry) => {
      const { document } = entry.hit;

      // The excerpt exists to answer "why did this match?"; when the visible title or summary
      // already carries a query token, the reader has the evidence and another line would repeat it.
      const snippet = titleOrSummaryHasToken(document, queryTokens)
        ? null
        : buildSnippet(document.bodyText, query, queryTokens);

      return toHit(document, entry.hit.score, snippet);
    }),
    query,
    total: ranked.length,
  };
};
