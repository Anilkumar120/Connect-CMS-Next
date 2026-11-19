"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Props = { beforeText?: string; animatedText?: string[]; afterText?: string; animation?: string; interval?: number; style?: CSSProperties };

export default function PublicAnimatedHeadline({ beforeText = "", animatedText = [], afterText = "", interval = 2400, style }: Props) {
  const words = animatedText.filter((word) => typeof word === "string" && word.trim());
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (words.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % words.length), Math.max(900, Math.min(10000, interval)));
    return () => window.clearInterval(timer);
  }, [words.length, interval]);
  return <span style={style}>{beforeText ? `${beforeText} ` : ""}<strong aria-live="polite" style={{ color: "#3984e8" }}>{words[index] || "Add headline text"}</strong>{afterText ? ` ${afterText}` : ""}</span>;
}
