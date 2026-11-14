
import { Suspense, type ReactNode } from "react";
import PublicThemeRenderer from "./PublicThemeRenderer";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import PublicSiteMetadata from "./PublicSiteMetadata";
import PublicBuilderDocument from "./PublicBuilderDocument";
import { getPublishedBuilderDocument } from "@/lib/builder/public-layout";

async function PublishedHeader() {
  const document = await getPublishedBuilderDocument("header:primary");
  return document?.layout.root.length ? (
    <header className="public-builder-header">
      <PublicBuilderDocument
        layout={document.layout}
        globalStyles={document.globalStyles}
      />
    </header>
  ) : (
    <PublicHeader />
  );
}

async function PublishedFooter() {
  const document = await getPublishedBuilderDocument("footer:primary");
  return document?.layout.root.length ? (
    <footer className="public-builder-footer">
      <PublicBuilderDocument
        layout={document.layout}
        globalStyles={document.globalStyles}
      />
    </footer>
  ) : (
    <PublicFooter />
  );
}

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PublicThemeRenderer>
      <Suspense fallback={null}>
        <PublicSiteMetadata />
      </Suspense>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Suspense fallback={<PublicHeader />}>
          <PublishedHeader />
        </Suspense>

        <main style={{ flex: 1 }}>
          {children}
        </main>

        <Suspense fallback={<PublicFooter />}>
          <PublishedFooter />
        </Suspense>
      </div>
    </PublicThemeRenderer>
  );
}
