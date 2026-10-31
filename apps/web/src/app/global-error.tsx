"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/monitoring";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => captureError(error), [error]);
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0b",
          color: "#e6eaf2",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>TRIYUAI hit an unexpected error</h1>
          <p style={{ color: "#8a94a6" }}>Please reload the page.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 8,
              border: 0,
              background: "#f1f1f3",
              color: "#0a0a0b",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
