"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import styles from "./BannerSlider.module.css";

export type BannerSliderButton = {
  text?: string;
  url?: string;
  linkType?: string;
  dynamicLink?: string;
  target?: string;
  width?: string;
  backgroundColor?: string;
  textColor?: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
  iconImage?: string;
  iconPosition?: string;
};

export type BannerSliderSlide = {
  id?: string;
  heading?: string;
  descriptionHtml?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  backgroundPosition?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  imageEffect?: string;
  headingColor?: string;
  textColor?: string;
  buttons?: BannerSliderButton[];
};

type Props = {
  slides: BannerSliderSlide[];
  autoplay?: boolean;
  autoplayDelay?: number;
  navigation?: boolean;
  pagination?: boolean;
  transition?: string;
  className?: string;
  id?: string;
  style?: CSSProperties;
};

function safeMediaUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || /^(javascript|vbscript|data):/i.test(value)) {
    return "";
  }

  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return url;
  }

  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function safeLink(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || /^(javascript|vbscript|data):/i.test(value)) {
    return "";
  }

  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  if (/^(mailto|tel):/i.test(url)) return url;

  try {
    return ["https:", "http:"].includes(new URL(url).protocol) ? url : "";
  } catch {
    return "";
  }
}

function buttonWidth(value: unknown): string {
  if (typeof value !== "string") return "fit-content";
  const width = value.trim();
  return /^(auto|fit-content|100%|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem|vw))$/.test(width)
    ? width
    : "fit-content";
}

export default function BannerSlider({
  slides,
  autoplay = true,
  autoplayDelay = 5000,
  navigation = true,
  pagination = true,
  transition = "slide",
  className,
  id,
  style,
}: Props) {
  const pathname = usePathname();
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const count = slides.length;

  useEffect(() => {
    if (!autoplay || count < 2) return;
    const timer = window.setInterval(
      () => setActiveIndex((index) => (index % count + 1) % count),
      Math.max(1000, Number(autoplayDelay) || 5000),
    );
    return () => window.clearInterval(timer);
  }, [activeIndex, autoplay, autoplayDelay, count]);

  if (!count) return null;

  const move = (offset: number) => {
    setActiveIndex((index) => (index % count + offset + count) % count);
  };
  const visibleIndex = activeIndex % count;
  const rootClassName = [styles.slider, className].filter(Boolean).join(" ");

  return (
    <div
      id={id}
      className={rootClassName}
      style={style}
      data-transition={transition}
      aria-roledescription="carousel"
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || typeof end !== "number" || Math.abs(end - start) < 40) return;
        move(end < start ? 1 : -1);
      }}
    >
      {slides.map((slide, index) => {
        const image = safeMediaUrl(slide.backgroundImage);
        const effect = slide.imageEffect === "zoom" || slide.imageEffect === "pan"
          ? slide.imageEffect
          : "none";
        const imageStyle = image
          ? ({
              backgroundImage: `url("${image.replace(/["\\]/g, "")}")`,
              backgroundPosition: slide.backgroundPosition || "center",
            } as CSSProperties)
          : undefined;
        const overlayOpacity = Math.max(0, Math.min(1, Number(slide.overlayOpacity) || 0));
        const isActive = index === visibleIndex;

        return (
          <section
            key={slide.id || index}
            className={`${styles.slide} ${isActive ? styles.active : ""}`}
            style={{ backgroundColor: slide.backgroundColor || undefined }}
            aria-hidden={!isActive}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
          >
            {image ? (
              <div
                className={`${styles.imageLayer} ${effect === "none" ? "" : styles[effect]}`}
                style={imageStyle}
                aria-hidden="true"
              />
            ) : null}
            {slide.overlayColor && overlayOpacity > 0 ? (
              <div
                className={styles.overlay}
                style={{ backgroundColor: slide.overlayColor, opacity: overlayOpacity }}
                aria-hidden="true"
              />
            ) : null}
            <div className={styles.content}>
              {slide.heading ? (
                <h2 style={{ color: slide.headingColor || undefined }}>{slide.heading}</h2>
              ) : null}
              {slide.descriptionHtml ? (
                <div
                  className={styles.description}
                  style={{ color: slide.textColor || undefined }}
                  dangerouslySetInnerHTML={{ __html: slide.descriptionHtml }}
                />
              ) : null}
              {slide.buttons?.length ? (
                <div className={styles.buttons}>
                  {slide.buttons.slice(0, 3).map((button, buttonIndex) => {
                    const href = button.linkType === "dynamic"
                      ? button.dynamicLink === "homepage"
                        ? "/"
                        : pathname || "/"
                      : safeLink(button.url);
                    const icon = safeMediaUrl(button.iconImage);
                    const buttonStyle = {
                      width: buttonWidth(button.width),
                      backgroundColor: button.backgroundColor || undefined,
                      color: button.textColor || undefined,
                      "--banner-button-hover-bg": button.hoverBackgroundColor || button.backgroundColor || "#0c2f55",
                      "--banner-button-hover-color": button.hoverTextColor || button.textColor || "#ffffff",
                    } as CSSProperties;
                    const contents = (
                      <>
                        {button.iconPosition !== "after" && icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className={styles.buttonIcon} />
                        ) : null}
                        {button.text || `Button ${buttonIndex + 1}`}
                        {button.iconPosition === "after" && icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className={styles.buttonIcon} />
                        ) : null}
                      </>
                    );

                    return href ? (
                      <a
                        key={buttonIndex}
                        className={styles.button}
                        style={buttonStyle}
                        href={href}
                        target={button.target === "_blank" ? "_blank" : undefined}
                        rel={button.target === "_blank" ? "noopener noreferrer" : undefined}
                      >
                        {contents}
                      </a>
                    ) : (
                      <span key={buttonIndex} className={styles.button} style={buttonStyle}>
                        {contents}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
      {navigation && count > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.previous}`}
            aria-label="Previous slide"
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="Next slide"
            onClick={() => move(1)}
          >
            ›
          </button>
        </>
      ) : null}
      {pagination && count > 1 ? (
        <div className={styles.pagination} role="group" aria-label="Choose slide">
          {slides.map((slide, index) => (
            <button
              key={slide.id || index}
              type="button"
              className={`${styles.dot} ${index === visibleIndex ? styles.selectedDot : ""}`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === visibleIndex}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
