import { Children, isValidElement, useRef, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import darkCss from "highlight.js/styles/github-dark.css?inline";
import lightCss from "highlight.js/styles/github.css?inline";
import { PART_HEADING, statementPreview } from "./statement-preview";

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
  // The same part headings Home's preview lists, anchored the same way as the h2s below.
  const parts = statementPreview(markdown).partTitles.map((title) => ({ title, anchor: partAnchor(title)! }));

  const jump = (anchor: string) =>
    container.current?.querySelector(`#${anchor}`)?.scrollIntoView({ block: "start" });

  return (
    <div className="statement" ref={container}>
      {parts.length > 0 && (
        <nav className="part-links">
          {parts.map((p) => (
            <button key={p.anchor} type="button" className="link" onClick={() => jump(p.anchor)}>
              {p.title}
            </button>
          ))}
        </nav>
      )}
      <StatementMarkdown
        markdown={markdown}
        components={{
          h2: ({ children }) => <h2 id={partAnchor(textOf(children))}>{children}</h2>,
        }}
      />
    </div>
  );
}

/**
 * Statement markdown rendered the way test mode shows it: GitHub-flavoured, with highlighted code
 * blocks in the light or dark theme. Place it inside a `.statement` element for its styles.
 */
export function StatementMarkdown({ markdown, components }: { markdown: string; components?: Components }) {
  return (
    <>
      <style>{lightCss}</style>
      <style media="(prefers-color-scheme: dark)">{darkCss}</style>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {markdown}
      </Markdown>
    </>
  );
}
