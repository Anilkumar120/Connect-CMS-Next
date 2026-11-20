type SeoJsonLdProps = {
  schemaType?: string;
  title: string;
  description?: string | null;
  url: string;
  image?: string | null;
  siteName: string;
  publishedAt?: Date | string | null;
  modifiedAt?: Date | string | null;
};

const allowedTypes = new Set(["WebPage", "Article", "BlogPosting", "Product", "Service"]);

export default function SeoJsonLd({
  schemaType,
  title,
  description,
  url,
  image,
  siteName,
  publishedAt,
  modifiedAt,
}: SeoJsonLdProps) {
  const selectedType = schemaType && allowedTypes.has(schemaType)
    ? schemaType
    : "WebPage";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": selectedType,
    name: title,
    url,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
  };

  if (selectedType === "Article" || selectedType === "BlogPosting") {
    schema.headline = title;
    schema.mainEntityOfPage = { "@type": "WebPage", "@id": url };
    schema.publisher = { "@type": "Organization", name: siteName };
    if (publishedAt) schema.datePublished = new Date(publishedAt).toISOString();
    if (modifiedAt) schema.dateModified = new Date(modifiedAt).toISOString();
  }

  if (selectedType === "Service") {
    schema.provider = { "@type": "Organization", name: siteName, url: new URL(url).origin };
  }

  const json = JSON.stringify(schema).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
