"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}

/**
 * The last boundary: it replaces the whole document when the root layout itself throws.
 *
 * Nothing here may depend on the theme, the token stylesheet, or a component — those are exactly
 * what failed. That is why the stylesheet is written here instead of in the theme, and why the
 * colours are the CSS system colours (Canvas, CanvasText, ButtonFace, ButtonBorder): they follow
 * the reader's own light or dark preference with no import at all.
 *
 * The home button reloads the document instead of routing: by the time this renders, the router and
 * the layout that hosts it may be the thing that failed.
 */
const styles = `
  :root { color-scheme: light dark; }
  body {
    background-color: Canvas;
    color: CanvasText;
    font-family: system-ui, sans-serif;
    margin: 0;
  }
  main { margin: 0 auto; max-width: 34rem; padding: 4rem 1.5rem; }
  [data-slot="eyebrow"] {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    margin: 0 0 0.75rem;
    opacity: 0.7;
  }
  h1 { font-size: 1.5rem; line-height: 1.3; margin: 0 0 0.75rem; }
  p { line-height: 1.7; margin: 0 0 1.5rem; }
  [data-slot="actions"] { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  button {
    background-color: ButtonFace;
    border: 1px solid ButtonBorder;
    border-radius: 0.5rem;
    color: ButtonText;
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    padding: 0.4rem 0.9rem;
  }
  [data-slot="digest"] {
    font-family: monospace;
    font-size: 0.75rem;
    margin: 1.5rem 0 0;
    opacity: 0.7;
    word-break: break-all;
  }
`;

const GlobalError = ({ error, reset, retry }: GlobalErrorProps) => {
  const digest = error.digest ?? null;

  const recover = retry ?? reset;

  return (
    <html lang="zh-CN">
      <body>
        {/* oxlint-disable-next-line shadcn/no-inline-styles -- the document that owns the token stylesheet is the one that failed */}
        <style>{styles}</style>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <title>这一页出错了</title>
        <main>
          <p data-slot="eyebrow">出错了</p>
          <h1>这一页出错了</h1>
          <p>
            站点在最外层就出了问题，页面没能渲染出来。样式和组件此刻都不可用，所以这页只用浏览器自己的颜色。
            可以重试一次；如果一直失败，稍后再来。
          </p>
          <div data-slot="actions">
            <button onClick={recover} type="button">
              重试
            </button>
            <button
              onClick={() => {
                window.location.assign("/");
              }}
              type="button"
            >
              回首页
            </button>
          </div>
          {digest === null ? null : (
            <p data-slot="digest">错误编号：{digest}</p>
          )}
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
