"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Props = {
  date?: string;
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
  expiredText?: string;
  numberColor?: string;
  labelColor?: string;
  boxBackground?: string;
  boxRadius?: string;
  style?: CSSProperties;
};

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function getParts(target: number): Parts {
  const seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export default function PublicCountdownWidget({
  date,
  showDays = true,
  showHours = true,
  showMinutes = true,
  showSeconds = true,
  expiredText = "The offer has ended.",
  numberColor = "#ffffff",
  labelColor = "#ffffff",
  boxBackground = "#0c2f55",
  boxRadius = "8px",
  style,
}: Props) {
  const target = useMemo(() => date ? new Date(date).getTime() : NaN, [date]);
  const [parts, setParts] = useState<Parts>(() => Number.isFinite(target) ? getParts(target) : { days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const update = () => {
      setParts(getParts(target));
      setExpired(target <= Date.now());
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!Number.isFinite(target)) return <div style={style}>Set a valid countdown date in the Content tab.</div>;
  if (expired) return <div style={style}>{expiredText}</div>;

  const values: Array<[string, number, boolean]> = [
    ["Days", parts.days, showDays],
    ["Hours", parts.hours, showHours],
    ["Minutes", parts.minutes, showMinutes],
    ["Seconds", parts.seconds, showSeconds],
  ];

  return (
    <div aria-live="off" style={{ display: "flex", flexWrap: "wrap", gap: 10, ...style }}>
      {values.filter(([, , visible]) => visible).map(([label, value]) => (
        <div key={label} style={{ minWidth: 66, padding: "12px 14px", textAlign: "center", background: boxBackground, color: labelColor, borderRadius: boxRadius }}>
          <strong style={{ display: "block", fontSize: 24, lineHeight: 1.2, fontVariantNumeric: "tabular-nums", color: numberColor }}>{String(value).padStart(2, "0")}</strong>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
