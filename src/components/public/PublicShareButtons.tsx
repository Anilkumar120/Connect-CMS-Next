"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Copy, Globe, Link2, MessageCircle, Share2 } from "lucide-react";

type Props = { networks?: string[]; showLabels?: boolean; buttonSize?: number; iconSize?: number; shape?: string; iconColor?: string; backgroundColor?: string; style?: CSSProperties };
const NETWORKS = ["facebook", "x", "linkedin", "whatsapp", "copy"] as const;

export default function PublicShareButtons({ networks = ["facebook", "x", "linkedin", "whatsapp"], showLabels = false, buttonSize = 40, iconSize = 18, shape = "circle", iconColor = "#ffffff", backgroundColor = "#0c2f55", style }: Props) {
  const [pageUrl, setPageUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setPageUrl(window.location.href); }, []);
  const encoded = encodeURIComponent(pageUrl);
  const links: Record<string, string> = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    x: `https://twitter.com/intent/tweet?url=${encoded}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
    whatsapp: `https://wa.me/?text=${encoded}`,
  };
  const icons: Record<string, ReactNode> = {
    facebook: <Globe size={iconSize} />, x: <Share2 size={iconSize} />, linkedin: <Link2 size={iconSize} />, whatsapp: <MessageCircle size={iconSize} />, copy: <Copy size={iconSize} />,
  };
  const selected = NETWORKS.filter((network) => networks.includes(network));
  return <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, ...style }}>{selected.map((network) => <a key={network} href={network === "copy" ? undefined : links[network]} target={network === "copy" ? undefined : "_blank"} rel="noopener noreferrer" aria-label={`Share on ${network}`} title={network === "copy" ? "Copy page link" : `Share on ${network}`} onClick={network === "copy" ? (event) => { event.preventDefault(); if (pageUrl) void navigator.clipboard.writeText(pageUrl).then(() => setCopied(true)).catch(() => setCopied(false)); } : undefined} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: showLabels ? "auto" : buttonSize, height: buttonSize, padding: showLabels ? "0 12px" : 0, borderRadius: shape === "square" ? 4 : shape === "rounded" ? 10 : 999, color: iconColor, background: backgroundColor, textDecoration: "none" }}>{icons[network]}{showLabels ? (network === "copy" && copied ? "Copied" : network === "x" ? "X" : network[0].toUpperCase() + network.slice(1)) : null}</a>)}</div>;
}
