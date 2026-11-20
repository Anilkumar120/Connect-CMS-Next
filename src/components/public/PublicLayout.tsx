import { Suspense, type CSSProperties, type ReactNode } from "react";
import PublicThemeRenderer from "./PublicThemeRenderer";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import PublicSiteMetadata from "./PublicSiteMetadata";
import PublicBuilderDocument from "./PublicBuilderDocument";
import { getPublishedBuilderDocumentForPath } from "@/lib/builder/public-layout";
import type { BuilderNode, BuilderStyle } from "@/lib/builder/types";

function responsiveDesktopValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const responsive = value as Record<string, unknown>;
    if (typeof responsive.desktop === "string" && responsive.desktop.trim()) return responsive.desktop;
    if (typeof responsive.tablet === "string" && responsive.tablet.trim()) return responsive.tablet;
    if (typeof responsive.mobile === "string" && responsive.mobile.trim()) return responsive.mobile;
  }
  return undefined;
}

function getPublishedHeaderStickyStyle(root: BuilderNode[]): CSSProperties | undefined {
  // Header sticky is promoted to the site header wrapper so it can stick
  // while the page <main> scrolls; the inner root section cannot outlive
  // the short <header> element that contains it.
  const stickyNode = root.find((node) =>
    node.enabled && (Boolean(node.styles.motion?.sticky) || node.styles.position === "sticky")
  );
  if (!stickyNode) return undefined;

  const motion = stickyNode.styles.motion;
  const motionSticky = Boolean(motion?.sticky);
  const stickyBottom = motionSticky && motion?.stickyPosition === "bottom";
  const offset = Math.max(0, Number(motion?.stickyOffset ?? 0) || 0);
  const configuredTop = responsiveDesktopValue(stickyNode.styles.top as BuilderStyle["top"]);
  const configuredBottom = responsiveDesktopValue(stickyNode.styles.bottom as BuilderStyle["bottom"]);
  const selectedSideValue = stickyBottom
    ? undefined
    : motionSticky
      ? `${offset}px`
      : configuredTop || (configuredBottom ? undefined : "0px");
  const bottomValue = stickyBottom
    ? `${offset}px`
    : !motionSticky && !configuredTop
      ? configuredBottom
      : undefined;

  return {
    position: "sticky",
    top: selectedSideValue,
    bottom: bottomValue,
    zIndex: Number(stickyNode.styles.zIndex ?? 1000),
    alignSelf: "stretch",
    width: "100%",
  };
}

async function PublishedHeader({ pathname }: { pathname: string }) {
  const document = await getPublishedBuilderDocumentForPath("header", pathname);
  if (!document?.layout.root.length) return <PublicHeader />;

  const stickyStyle = getPublishedHeaderStickyStyle(document.layout.root);
  return (
    <header className="public-builder-header" style={stickyStyle}>
      <PublicBuilderDocument layout={document.layout} globalStyles={document.globalStyles} />
    </header>
  );
}

async function PublishedFooter({ pathname }: { pathname: string }) {
  const document = await getPublishedBuilderDocumentForPath("footer", pathname);
  return document?.layout.root.length ? (
    <footer className="public-builder-footer"><PublicBuilderDocument layout={document.layout} globalStyles={document.globalStyles} /></footer>
  ) : <PublicFooter />;
}

export default function PublicLayout({ children, pathname = "/" }: { children: ReactNode; pathname?: string }) {
  return (
    <PublicThemeRenderer>
      <Suspense fallback={null}><PublicSiteMetadata /></Suspense>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Suspense fallback={<PublicHeader />}><PublishedHeader pathname={pathname} /></Suspense>
        <main style={{ flex: 1 }}>{children}</main>
        <Suspense fallback={<PublicFooter />}><PublishedFooter pathname={pathname} /></Suspense>
      </div>
    </PublicThemeRenderer>
  );
}
