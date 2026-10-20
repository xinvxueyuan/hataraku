-- Full-text search for posts, replacing the old site's Pagefind build step.
--
-- Ported from the nightstack repository, where this logic grew across two hand-written
-- migrations (0001_search_index_fulltext and 0002_search_query_precision). Only the settled
-- behaviour is carried over here: 0002 exists because 0001's OR-only expansion returned unrelated
-- posts for a query like "不存在的词xyz" (measured: 5 hits). Folding both into one migration keeps
-- this repository free of a first migration whose semantics were known to be wrong, and no data
-- exists yet that would need replaying through it.
--
-- ## Shape
-- search_index is a projection of posts (1:1), maintained by triggers so readers never rebuild a
-- tsvector per query and the GIN index created with the table stays usable. Weights:
-- title=A, description=B, category_slug=C, body_md=D, so ts_rank orders results as written.
--
-- ## Why the text search configuration is 'simple'
-- Chinese has no stems, and 'english' stemming collapses distinct technical terms
-- (indexes/indexing become one lexeme), so a reader searching the word they can see would match
-- unrelated rows.
--
-- ## The Chinese tokenisation gap, and the patch
-- PostgreSQL's built-in parser does not segment Chinese:
--     to_tsvector('simple','限流网关与 monorepo') = 'monorepo':2 '限流网关与':1
-- The whole run becomes ONE lexeme, so searching 「限流」 can never match. No extension
-- (zhparser / pg_jieba / pg_trgm) is assumed to be available, so the patch is pure SQL:
--   - the document side adds every 2- and 3-character n-gram of each CJK run to the same vector,
--     layered on top of to_tsvector('simple', ...) rather than replacing it;
--   - the query side runs the SAME segmentation (ns_cjk_ngrams is the single source of truth for
--     both sides, so they cannot drift) before handing the result to
--     websearch_to_tsquery('simple', ...).
--
-- ## Why the query side uses 2-grams joined by AND
-- Expanding 「限流网关」 to its full n-gram set and joining with AND would demand all six
-- ('限流网关' & '限流' & '流网' & '网关' & '限流网' & '流网关'), which fails when the document
-- stores the run as 「限流网关与」 and therefore holds no '流网关' trigram. Joining with OR instead
-- matches any single 2-gram, which is what returned unrelated rows. The settled rule is: take
-- 2-grams only, joined by AND (a space), and fall back to the OR form only when the primary query
-- finds nothing and the query has at most three terms.
--
-- ## Known bounds
-- Pure ASCII queries (including OR / - / "phrase") keep native websearch semantics untouched.
-- When CJK and ASCII are mixed, websearch operators are treated as ordinary characters and
-- dropped; that degradation is accepted.

-- ---------------------------------------------------------------------------
-- CJK segmentation: the one definition both sides share
-- ---------------------------------------------------------------------------

/**
 * Expands each CJK run c (length n) to c plus all of its 2- and 3-character n-grams, and passes
 * non-CJK runs through for the simple configuration to tokenise normally.
 *
 * '限流网关 React' -> '限流网关 限流 流网 网关 限流网 流网关 React'
 */
CREATE OR REPLACE FUNCTION ns_cjk_ngrams(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_chunk text;
  v_parts text[] := '{}';
  v_terms text[];
  v_chars text[];
  v_n     int;
  v_i     int;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN '';
  END IF;

  -- The two alternatives are mutually exclusive, so one capture group is always NULL.
  FOR v_chunk IN
    SELECT coalesce(m[1], m[2])
      FROM regexp_matches(p_text, '([\u4e00-\u9fff\u3400-\u4dbf]+)|([^\u4e00-\u9fff\u3400-\u4dbf]+)', 'g') AS m
  LOOP
    IF v_chunk ~ '^[\u4e00-\u9fff\u3400-\u4dbf]+$' THEN
      v_terms := ARRAY[v_chunk];
      v_chars := regexp_split_to_array(v_chunk, '');
      v_n     := array_length(v_chars, 1);

      IF v_n >= 2 THEN
        FOR v_i IN 1 .. (v_n - 1) LOOP
          v_terms := v_terms || (v_chars[v_i] || v_chars[v_i + 1]);
        END LOOP;
        FOR v_i IN 1 .. (v_n - 2) LOOP
          v_terms := v_terms || (v_chars[v_i] || v_chars[v_i + 1] || v_chars[v_i + 2]);
        END LOOP;
      END IF;

      v_parts := v_parts || array_to_string(v_terms, ' ');
    ELSE
      v_parts := v_parts || v_chunk;
    END IF;
  END LOOP;

  RETURN btrim(array_to_string(v_parts, ' '));
END;
$$;

/**
 * The document-side wrapper: ns_cjk_ngrams minus the OR keyword. Building a vector from the query
 * expansion would index 'or' itself (measured: 'or':22A in the tsvector).
 */
CREATE OR REPLACE FUNCTION ns_tsvector_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(string_agg(term, ' '), '')
    FROM unnest(string_to_array(ns_cjk_ngrams(p_text), ' ')) AS term
   WHERE term <> '' AND lower(term) <> 'or';
$$;

/**
 * Query-side terms: each CJK run becomes its 2-grams, and each non-CJK run stays one term.
 *
 * '限流网关 React' -> ARRAY['限流','流网','网关','React']
 */
CREATE OR REPLACE FUNCTION ns_tsquery_terms(p_text text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_chunk text;
  v_terms text[] := '{}';
  v_chars text[];
  v_n     int;
  v_i     int;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN '{}';
  END IF;

  FOR v_chunk IN
    SELECT coalesce(m[1], m[2])
      FROM regexp_matches(p_text, '([\u4e00-\u9fff\u3400-\u4dbf]+)|([^\u4e00-\u9fff\u3400-\u4dbf]+)', 'g') AS m
  LOOP
    IF v_chunk ~ '^[\u4e00-\u9fff\u3400-\u4dbf]+$' THEN
      v_chars := regexp_split_to_array(v_chunk, '');
      v_n     := array_length(v_chars, 1);
      IF v_n <= 1 THEN
        v_terms := v_terms || v_chunk;
      ELSE
        FOR v_i IN 1 .. (v_n - 1) LOOP
          v_terms := v_terms || (v_chars[v_i] || v_chars[v_i + 1]);
        END LOOP;
      END IF;
    ELSE
      v_terms := v_terms || btrim(v_chunk);
    END IF;
  END LOOP;

  RETURN v_terms;
END;
$$;

/**
 * Primary rewrite: terms separated by a space, which websearch_to_tsquery reads as AND.
 * '限流网关' -> '限流 流网 网关'
 */
CREATE OR REPLACE FUNCTION ns_tsquery_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(array_to_string(nullif(ns_tsquery_terms(p_text), '{}'), ' '), '');
$$;

/**
 * Fallback rewrite: terms joined by OR (websearch requires the keyword in upper case).
 * '限流网关' -> '限流 OR 流网 OR 网关'
 */
CREATE OR REPLACE FUNCTION ns_tsquery_text_or(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(array_to_string(nullif(ns_tsquery_terms(p_text), '{}'), ' OR '), '');
$$;

-- ---------------------------------------------------------------------------
-- Projection maintenance
-- ---------------------------------------------------------------------------

/**
 * Rebuilds the projection for one post. Idempotent, and removes the row when the post is gone.
 * Called by the triggers below; callable by hand to repair a single post.
 */
CREATE OR REPLACE FUNCTION refresh_search_index(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO search_index (post_id, title, description, body, tags, published_at, tsv)
  SELECT
    p.id,
    p.title,
    p.description,
    p.body_md,
    COALESCE(
      (SELECT array_agg(t.slug ORDER BY t.slug)
         FROM post_tags pt
         JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = p.id),
      '{}'::text[]
    ),
    p.published_at,
      setweight(to_tsvector('simple', coalesce(p.title, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(p.description, '')), 'B')
   || setweight(to_tsvector('simple', coalesce(p.category_slug, '')), 'C')
   || setweight(to_tsvector('simple', coalesce(p.body_md, '')), 'D')
   || setweight(to_tsvector('simple', ns_tsvector_text(coalesce(p.title, ''))), 'A')
   || setweight(to_tsvector('simple', ns_tsvector_text(coalesce(p.description, ''))), 'B')
   || setweight(to_tsvector('simple', ns_tsvector_text(coalesce(p.body_md, ''))), 'D')
  FROM posts p
  WHERE p.id = p_post_id
  ON CONFLICT (post_id) DO UPDATE SET
    title        = EXCLUDED.title,
    description  = EXCLUDED.description,
    body         = EXCLUDED.body,
    tags         = EXCLUDED.tags,
    published_at = EXCLUDED.published_at,
    tsv          = EXCLUDED.tsv;

  DELETE FROM search_index si
   WHERE si.post_id = p_post_id
     AND NOT EXISTS (SELECT 1 FROM posts p2 WHERE p2.id = p_post_id);
END;
$$;

CREATE OR REPLACE FUNCTION search_index_sync_from_posts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM search_index WHERE post_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM refresh_search_index(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_search_index_sync ON posts;
CREATE TRIGGER posts_search_index_sync
AFTER INSERT OR UPDATE OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION search_index_sync_from_posts();

-- Tags live in a join table, so the vector's tag terms change without a write to posts.
CREATE OR REPLACE FUNCTION search_index_sync_from_post_tags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM refresh_search_index(OLD.post_id);
    RETURN OLD;
  END IF;
  PERFORM refresh_search_index(NEW.post_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_tags_search_index_sync ON post_tags;
CREATE TRIGGER post_tags_search_index_sync
AFTER INSERT OR UPDATE OR DELETE ON post_tags
FOR EACH ROW EXECUTE FUNCTION search_index_sync_from_post_tags();

-- Backfill for posts that already exist when this migration runs. Idempotent.
INSERT INTO search_index (post_id, title, description, body, tags, published_at, tsv)
SELECT
  p.id,
  p.title,
  p.description,
  p.body_md,
  COALESCE(
    (SELECT array_agg(t.slug ORDER BY t.slug)
       FROM post_tags pt
       JOIN tags t ON t.id = pt.tag_id
      WHERE pt.post_id = p.id),
    '{}'::text[]
  ),
  p.published_at,
    setweight(to_tsvector('simple', coalesce(p.title, '')), 'A')
 || setweight(to_tsvector('simple', coalesce(p.description, '')), 'B')
 || setweight(to_tsvector('simple', coalesce(p.category_slug, '')), 'C')
 || setweight(to_tsvector('simple', coalesce(p.body_md, '')), 'D')
 || setweight(to_tsvector('simple', ns_tsvector_text(coalesce(p.title, ''))), 'A')
 || setweight(to_tsvector('simple', ns_tsvector_text(coalesce(p.description, ''))), 'B')
 || setweight(to_tsvector('simple', ns_tsvector_text(coalesce(p.body_md, ''))), 'D')
FROM posts p
ON CONFLICT (post_id) DO UPDATE SET
  title        = EXCLUDED.title,
  description  = EXCLUDED.description,
  body         = EXCLUDED.body,
  tags         = EXCLUDED.tags,
  published_at = EXCLUDED.published_at,
  tsv          = EXCLUDED.tsv;
