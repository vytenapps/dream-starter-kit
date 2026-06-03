import { ImageResponse } from "next/og";

// Generated Open Graph image (no committed binary). Next wires this into the
// page <meta> automatically, overriding the openGraph.images default.
export const alt = "Dream Starter Kit — Next.js + Expo on one Supabase backend";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #1F104A 0%, #3B1E7E 55%, #6D28D9 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{ fontSize: 88, fontWeight: 800, letterSpacing: "-0.03em" }}
        >
          Dream Starter Kit
        </div>
        <div
          style={{ fontSize: 38, marginTop: 24, opacity: 0.85, maxWidth: 900 }}
        >
          A clone-and-ship starter — Next.js (web) + Expo (iOS/Android) sharing
          one Supabase backend, with Stripe billing & AI built in.
        </div>
        <div style={{ fontSize: 26, marginTop: 48, opacity: 0.7 }}>
          Turborepo · Supabase · Row-Level Security · Stripe · Vercel AI
        </div>
      </div>
    ),
    size,
  );
}
