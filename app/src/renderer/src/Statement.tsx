import { Children, isValidElement, useRef, type ReactNode } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import darkCss from "highlight.js/styles/github-dark.css?inline";
import lightCss from "highlight.js/styles/github.css?inline";

const PART_HEADING = /^Part (\d+)\b/;

/** `part-3` for a heading reading "Part 3 — …"; undefined for any other heading. */
function partAnchor(text: string): string | undefined {
  const match = PART_HEADING.exec(text.trim());
  return match ? `part-${match[1]}` : undefined;
}

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? textOf(child.props.children)
          : "",
    )
    .join("");
}

/** The problem statement as GitHub-flavoured markdown, with links jumping to each `## Part N`. */
export function Statement({ markdown }: { markdown: string }) {
  const container = useRef<HTMLDivElement>(null);
  // `## ` headings outside fenced code blocks that name a part, anchored the same way as the h2s below.
  const outsideCode = markdown.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, "");
  const parts = [...outsideCode.matchAll(/^## (.+)$/gm)]
    .map((m) => ({ title: m[1]!.trim(), anchor: partAnchor(m[1]!) }))
    .filter((p): p is { title: string; anchor: string } => p.anchor !== undefined);

  const jump = (anchor: string) =>
    container.current?.querySelector(`#${anchor}`)?.scrollIntoView({ block: "start" });

  return (
    <div className="statement" ref={container}>
      <style>{lightCss}</style>
      <style media="(prefers-color-scheme: dark)">{darkCss}</style>
      {parts.length > 0 && (
        <nav className="part-links">
          {parts.map((p) => (
            <button key={p.anchor} type="button" className="link" onClick={() => jump(p.anchor)}>
              {p.title}
            </button>
          ))}
        </nav>
      )}
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h2: ({ children }) => <h2 id={partAnchor(textOf(children))}>{children}</h2>,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
