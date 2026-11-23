"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type VideoProvider = "auto" | "youtube" | "vimeo" | "dailymotion" | "videopress" | "self-hosted";

type BuilderVideoPlayerProps = {
  source?: string;
  url?: string;
  poster?: string;
  startTime?: number | string;
  endTime?: number | string;
  autoplay?: boolean;
  playOnMobile?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  captions?: boolean;
  captionsUrl?: string;
  captionsLanguage?: string;
  captionsLabel?: string;
  privacyMode?: boolean;
  lazyLoad?: boolean;
  suggestedVideos?: string;
  modestBranding?: boolean;
  showTitle?: boolean;
  showPortrait?: boolean;
  showByline?: boolean;
  showInfo?: boolean;
  showLogo?: boolean;
  controlsColor?: string;
  downloadButton?: boolean;
  preload?: string;
  imageOverlay?: boolean;
  playIcon?: boolean;
  lightbox?: boolean;
  aspectRatio?: string;
  objectFit?: string;
  overlayOpacity?: number | string;
  overlayColor?: string;
  playIconColor?: string;
  playIconSize?: number | string;
  className?: string;
  id?: string;
  style?: CSSProperties;
  nodeId?: string;
  preview?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

type ResolvedSource =
  | { kind: "file"; url: string }
  | { kind: "embed"; url: string; provider: Exclude<VideoProvider, "auto" | "self-hosted"> }
  | null;

function safeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const input = value.trim();
  if (!input || /^(javascript|vbscript|data):/i.test(input) || input.startsWith("//")) return "";
  if (input.startsWith("/") && !input.includes("\\")) return input;
  try {
    const parsed = new URL(input);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? input : "";
  } catch {
    return "";
  }
}

function seconds(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : undefined;
}

function videoId(url: string, provider: Exclude<VideoProvider, "auto" | "self-hosted">): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return /^[a-zA-Z0-9_-]{6,}$/.test(url) ? url : "";
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const parts = parsed.pathname.split("/").filter(Boolean);

  if (provider === "youtube") {
    if (["youtu.be"].includes(host)) return parts[0] || "";
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (parsed.searchParams.get("v")) return parsed.searchParams.get("v") || "";
      const marker = parts.findIndex((part) => ["embed", "shorts", "live", "v"].includes(part));
      if (marker >= 0) return parts[marker + 1] || "";
    }
  }

  if (provider === "vimeo" && (host === "vimeo.com" || host.endsWith(".vimeo.com"))) {
    return parts.find((part) => /^\d+$/.test(part)) || "";
  }

  if (provider === "dailymotion") {
    if (host === "dai.ly") return parts[0] || "";
    if (host.endsWith("dailymotion.com")) {
      const marker = parts.findIndex((part) => part === "video");
      if (marker >= 0) return (parts[marker + 1] || "").split("_")[0];
      if (host.startsWith("geo.")) return "";
    }
  }

  if (provider === "videopress" && host.endsWith("videopress.com")) {
    const marker = parts.findIndex((part) => part === "v" || part === "embed");
    if (marker >= 0) return parts[marker + 1] || "";
  }

  return "";
}

function detectProvider(url: string, explicit?: string): Exclude<VideoProvider, "auto"> {
  const allowed: VideoProvider[] = ["auto", "youtube", "vimeo", "dailymotion", "videopress", "self-hosted"];
  const selected = allowed.includes(explicit as VideoProvider) ? (explicit as VideoProvider) : "auto";
  if (selected !== "auto") return selected;

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) return "youtube";
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "vimeo";
    if (host === "dai.ly" || host.endsWith("dailymotion.com")) return "dailymotion";
    if (host.endsWith("videopress.com")) return "videopress";
  } catch {
    // Relative URLs and non-URL values are treated as self-hosted files.
  }
  return "self-hosted";
}

function resolveSource(props: BuilderVideoPlayerProps): ResolvedSource {
  const url = safeUrl(props.url);
  if (!url) return null;
  const provider = detectProvider(url, props.source);

  if (provider === "self-hosted") return { kind: "file", url };
  const id = videoId(url, provider);
  if (!id) return null;

  const start = seconds(props.startTime);
  const end = seconds(props.endTime);
  const autoplay = Boolean(props.autoplay);
  const muted = Boolean(props.muted || autoplay);
  const params = new URLSearchParams();

  if (provider === "youtube") {
    params.set("autoplay", autoplay ? "1" : "0");
    params.set("mute", muted ? "1" : "0");
    params.set("controls", props.controls === false ? "0" : "1");
    params.set("rel", "0");
    if (props.modestBranding) params.set("modestbranding", "1");
    if (props.captions) params.set("cc_load_policy", "1");
    if (start !== undefined) params.set("start", String(start));
    if (end !== undefined) params.set("end", String(end));
    if (props.loop) {
      params.set("loop", "1");
      params.set("playlist", id);
    }
    if (props.suggestedVideos === "current-channel") params.set("rel", "1");
    const host = props.privacyMode ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
    return { kind: "embed", provider, url: `${host}/embed/${encodeURIComponent(id)}?${params.toString()}` };
  }

  if (provider === "vimeo") {
    params.set("autoplay", autoplay ? "1" : "0");
    params.set("muted", muted ? "1" : "0");
    params.set("loop", props.loop ? "1" : "0");
    params.set("controls", props.controls === false ? "0" : "1");
    params.set("title", props.showTitle === false ? "0" : "1");
    params.set("portrait", props.showPortrait === false ? "0" : "1");
    params.set("byline", props.showByline === false ? "0" : "1");
    if (props.privacyMode) params.set("dnt", "1");
    if (props.controlsColor) params.set("color", props.controlsColor.replace(/^#/, ""));
    try {
      const original = new URL(url);
      const pathParts = original.pathname.split("/").filter(Boolean);
      const privateHash = original.searchParams.get("h") || (pathParts.length > 1 && /^[-a-zA-Z0-9]{5,}$/.test(pathParts[1]) ? pathParts[1] : "");
      if (privateHash) params.set("h", privateHash);
    } catch {
      // Public Vimeo ID-only URLs do not need a private hash.
    }
    const fragment = start !== undefined ? `#t=${start}s` : "";
    return { kind: "embed", provider, url: `https://player.vimeo.com/video/${encodeURIComponent(id)}?${params.toString()}${fragment}` };
  }

  if (provider === "dailymotion") {
    params.set("autoplay", autoplay ? "1" : "0");
    params.set("mute", muted ? "1" : "0");
    params.set("queue-enable", "0");
    params.set("ui-start-screen-info", props.showInfo === false ? "0" : "1");
    params.set("ui-logo", props.showLogo === false ? "0" : "1");
    params.set("controls", props.controls === false ? "0" : "1");
    if (start !== undefined) params.set("start", String(start));
    return { kind: "embed", provider, url: `https://www.dailymotion.com/embed/video/${encodeURIComponent(id)}?${params.toString()}` };
  }

  return { kind: "embed", provider, url: `https://videopress.com/embed/${encodeURIComponent(id)}` };
}

function ratioValue(value?: string): string {
  if (!value) return "16 / 9";
  const normalized = value.trim().replace(":", " / ");
  return /^[0-9.]+\s*\/\s*[0-9.]+$/.test(normalized) ? normalized : "16 / 9";
}

function cssSize(value: number | string | undefined, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  if (typeof value === "string" && /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/.test(value.trim())) {
    return /[a-z%]+$/i.test(value.trim()) ? value.trim() : `${value.trim()}px`;
  }
  return fallback;
}

function colorWithOpacity(value: string | undefined, opacity: number): string {
  const input = (value || "#000000").trim();
  const short = input.match(/^#([0-9a-f]{3})$/i);
  const full = input.match(/^#([0-9a-f]{6})$/i);
  const hex = full?.[1] || (short ? short[1].split("").map((part) => part + part).join("") : "000000");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export default function BuilderVideoPlayer(props: BuilderVideoPlayerProps) {
  const [playerVisible, setPlayerVisible] = useState(!(props.imageOverlay || props.lightbox));
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const start = seconds(props.startTime);
  const end = seconds(props.endTime);
  const poster = safeUrl(props.poster);
  const ratio = ratioValue(props.aspectRatio);
  const overlayOpacity = Math.max(0, Math.min(1, Number(props.overlayOpacity ?? 0.28)));
  const overlayEnabled = Boolean(props.imageOverlay || props.lightbox);
  const playerTitle = "Embedded video player";
  const autoplay = Boolean(props.autoplay && (!isMobile || props.playOnMobile));
  const resolved = useMemo(() => resolveSource({ ...props, autoplay }), [
    props.source, props.url, props.startTime, props.endTime, autoplay,
    props.muted, props.loop, props.controls, props.captions, props.privacyMode,
    props.suggestedVideos, props.modestBranding, props.showTitle,
    props.showPortrait, props.showByline, props.showInfo, props.showLogo,
    props.controlsColor,
  ]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    setPlayerVisible(!(props.imageOverlay || props.lightbox));
    setLightboxOpen(false);
  }, [props.url, props.source, props.imageOverlay, props.lightbox, props.poster]);

  const onLoadedMetadata = () => {
    if (videoRef.current && start !== undefined && Number.isFinite(videoRef.current.duration)) {
      videoRef.current.currentTime = Math.min(start, Math.max(0, videoRef.current.duration - 0.1));
    }
  };

  const onTimeUpdate = () => {
    if (videoRef.current && end !== undefined && videoRef.current.currentTime >= end) {
      videoRef.current.pause();
      videoRef.current.currentTime = end;
    }
  };

  const player = resolved?.kind === "embed" ? (
    <iframe
      src={resolved.url}
      title={`${playerTitle} (${resolved.provider})`}
      loading={props.lazyLoad === false ? "eager" : "lazy"}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy={props.privacyMode ? "strict-origin-when-cross-origin" : "origin-when-cross-origin"}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  ) : resolved?.kind === "file" ? (
    <video
      ref={videoRef}
      src={resolved.url}
      poster={poster || undefined}
      controls={props.controls !== false}
      autoPlay={autoplay}
      muted={Boolean(props.muted || autoplay)}
      loop={Boolean(props.loop)}
      playsInline
      preload={(["auto", "metadata", "none"].includes(String(props.preload)) ? props.preload : "metadata") as "auto" | "metadata" | "none"}
      controlsList={props.downloadButton === false ? "nodownload" : undefined}
      onLoadedMetadata={onLoadedMetadata}
      onTimeUpdate={onTimeUpdate}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: props.objectFit === "contain" || props.objectFit === "fill" || props.objectFit === "none" ? props.objectFit : "cover" }}
    >
      {safeUrl(props.captionsUrl) ? (
        <track
          kind="captions"
          src={safeUrl(props.captionsUrl)}
          srcLang={props.captionsLanguage || "en"}
          label={props.captionsLabel || "Captions"}
          default
        />
      ) : null}
    </video>
  ) : (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b", background: "#f1f5f9", fontSize: 13 }}>
      Add a valid video URL or choose a video from Media Library.
    </div>
  );

  const containerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: ratio,
    minWidth: 0,
    overflow: "hidden",
    background: props.overlayColor || "#000000",
    ...props.style,
  };

  const playOverlay = overlayEnabled && !playerVisible ? (
    <button
      type="button"
      onClick={() => props.lightbox ? setLightboxOpen(true) : setPlayerVisible(true)}
      aria-label="Play video"
      style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", width: "100%", height: "100%", padding: 0, border: 0, cursor: "pointer", background: "transparent" }}
    >
      {props.imageOverlay && poster ? <img src={poster} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} /> : null}
      <span style={{ position: "absolute", inset: 0, background: colorWithOpacity(props.overlayColor, overlayOpacity) }} />
      {props.playIcon !== false ? (
        <span style={{ position: "relative", zIndex: 1, width: cssSize(props.playIconSize, "64px"), height: cssSize(props.playIconSize, "64px"), display: "grid", placeItems: "center", borderRadius: "50%", color: props.playIconColor || "#ffffff", background: "rgba(0,0,0,.48)", fontSize: 30, lineHeight: 1 }}>
          Ã¢â€“Â¶
        </span>
      ) : null}
    </button>
  ) : null;

  return (
    <>
      <div id={props.id} className={props.className} data-builder-node-id={props.nodeId} onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave} style={containerStyle}>
        {playerVisible ? player : null}
        {playOverlay}
      </div>
      {lightboxOpen ? (
        <div role="dialog" aria-modal="true" aria-label="Video lightbox" onClick={() => setLightboxOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100000, display: "grid", placeItems: "center", padding: 24, background: "rgba(0,0,0,.88)" }}>
          <button type="button" aria-label="Close video" onClick={() => setLightboxOpen(false)} style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, border: 0, borderRadius: 999, background: "#ffffff", color: "#111827", fontSize: 24, cursor: "pointer" }}>Ãƒâ€”</button>
          <div onClick={(event) => event.stopPropagation()} style={{ position: "relative", width: "min(1100px, 94vw)", aspectRatio: ratio, background: "#000" }}>
            {player}
          </div>
        </div>
      ) : null}
    </>
  );
}
