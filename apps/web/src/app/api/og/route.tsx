/* oxlint-disable shadcn/no-inline-styles -- satori (next/og) only understands inline style objects; it does not load the app's Tailwind CSS. */
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  siteOrigin,
} from "#src/components/site.ts";

import { OG_FONT } from "./og-font.ts";

/**
 * /api/og — one share card for every page, 1200×630.
 *
 * The font is a repo-local subset of Noto Sans SC (SIL OFL): satori only accepts ttf / otf / woff,
 * and its built-in font has no CJK glyphs, so a Chinese title would render as blank boxes. The file
 * is imported through `import.meta.url` rather than fetched from a CDN — rendering a card must not
 * reach the network, and a deployment should not depend on a third-party font host. The subset covers
 * GB 2312 (6,892 characters) plus ASCII and CJK punctuation; a glyph outside it falls back to a
 * blank box, which is why titles are also length-clamped.
 */

export const runtime = "nodejs";

const SIZE = { height: 630, width: 1200 };
const FONT_FAMILY = "OgCJK";
const MAX_TITLE = 80;
const MAX_DESCRIPTION = 110;
const MAX_CATEGORY = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

/** Query text is untrusted: drop control characters and tag delimiters, then clamp by characters. */
const clamp = (raw: string | null, max: number): string => {
  if (raw === null) {
    return "";
  }

  const cleaned = raw
    .replaceAll(/[\p{Cc}<>]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();

  const graphemes = [...segmenter.segment(cleaned)].map((part) => part.segment);

  return graphemes.slice(0, max).join("").trim();
};

/** ImageResponse wants an ArrayBuffer; a Buffer can share a larger slab, so copy its exact range. */
const toArrayBuffer = (bytes: Buffer): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(copy).set(bytes);

  return copy;
};

const OG_FONT_DATA = toArrayBuffer(OG_FONT);

const sizeForTitle = (length: number): number => {
  if (length > 40) {
    return 52;
  }

  return length > 26 ? 60 : 70;
};

const GET = async (request: NextRequest): Promise<Response> => {
  const params = request.nextUrl.searchParams;
  const title = clamp(params.get("title"), MAX_TITLE) || SITE_TITLE;

  const description =
    clamp(params.get("description"), MAX_DESCRIPTION) || SITE_DESCRIPTION;

  const category = clamp(params.get("category"), MAX_CATEGORY);
  const rawDate = clamp(params.get("date"), 10);
  const date = DATE_PATTERN.test(rawDate) ? rawDate : "";
  const origin = await siteOrigin();
  const host = origin.replace(/^https?:\/\//u, "");
  const font = OG_FONT_DATA;
  const titleSize = sizeForTitle(title.length);

  return new ImageResponse(
    <div
      style={{
        backgroundColor: "#0f1117",
        backgroundImage:
          "linear-gradient(135deg, #0b0d13 0%, #151827 55%, #2a1020 100%)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "56px 64px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255, 61, 140, 0.14)",
          borderRadius: "270px",
          display: "flex",
          height: "540px",
          position: "absolute",
          right: "-130px",
          top: "-170px",
          width: "540px",
        }}
      />
      <div
        style={{
          backgroundColor: "rgba(200, 30, 107, 0.13)",
          borderRadius: "250px",
          bottom: "-210px",
          display: "flex",
          height: "500px",
          left: "-150px",
          position: "absolute",
          width: "500px",
        }}
      />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex" }}>
          <div
            style={{
              alignItems: "center",
              backgroundColor: "#FF3D8C",
              borderRadius: "18px",
              boxShadow: "7px 7px 0 0 #C81E6B",
              color: "#1e1e24",
              display: "flex",
              fontSize: "34px",
              fontWeight: 700,
              height: "66px",
              justifyContent: "center",
              width: "66px",
            }}
          >
            夜
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: FONT_FAMILY,
                fontSize: "30px",
                fontWeight: 700,
                letterSpacing: "2px",
              }}
            >
              {SITE_NAME}
            </div>
            <div
              style={{
                color: "#FF9DC6",
                display: "flex",
                fontSize: "16px",
                letterSpacing: "6px",
                marginTop: "4px",
              }}
            >
              NIGHTSTACK
            </div>
          </div>
        </div>

        {category === "" ? null : (
          <div
            style={{
              border: "2px solid #FF3D8C",
              borderRadius: "999px",
              color: "#FF3D8C",
              display: "flex",
              fontFamily: FONT_FAMILY,
              fontSize: "22px",
              padding: "8px 22px",
            }}
          >
            {category}
          </div>
        )}
      </div>

      <div
        style={{
          borderLeft: "6px solid #FF3D8C",
          display: "flex",
          flexDirection: "column",
          marginTop: "20px",
          paddingLeft: "30px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: FONT_FAMILY,
            fontSize: `${titleSize}px`,
            fontWeight: 700,
            letterSpacing: "1px",
            lineHeight: 1.22,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "#c9c9d6",
            display: "flex",
            fontFamily: FONT_FAMILY,
            fontSize: "24px",
            lineHeight: 1.45,
            marginTop: "20px",
          }}
        >
          {description}
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          fontSize: "22px",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "#FF9DC6",
            display: "flex",
            fontFamily: FONT_FAMILY,
          }}
        >
          {date === "" ? "hataraku" : date}
        </div>
        <div style={{ color: "#8a8a99", display: "flex" }}>{host}</div>
      </div>
    </div>,
    {
      ...SIZE,
      fonts: [
        {
          data: font,
          name: FONT_FAMILY,
          style: "normal",
          weight: 400,
        },
        {
          data: font,
          name: FONT_FAMILY,
          style: "normal",
          weight: 700,
        },
      ],
      headers: {
        "cache-control":
          "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
};

export { GET };
