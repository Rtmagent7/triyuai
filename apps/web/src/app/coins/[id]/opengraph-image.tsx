import { ImageResponse } from "next/og";
import { serverApi } from "@/lib/api/server";
import { formatPrice, formatSignedPercent } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Coin price on TRIYUAI";

/** FR-17: auto-generated OG image with the coin name and price. */
export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coin = await serverApi
    .coin(id)
    .then((r) => r.data)
    .catch(() => null);
  const up = (coin?.change24h ?? 0) >= 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #0b0e14 0%, #121722 60%, #1e1b4b 100%)",
        color: "#e6eaf2",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700 }}>
        TRIYU<span style={{ color: "#7c7cff" }}>AI</span>
      </div>
      {coin ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coin.image} width={88} height={88} style={{ borderRadius: 44 }} alt="" />
            <div style={{ fontSize: 72, fontWeight: 700 }}>{coin.name}</div>
            <div style={{ fontSize: 44, color: "#8a94a6" }}>{coin.symbol}</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
            <div style={{ fontSize: 96, fontWeight: 700 }}>{formatPrice(coin.price)}</div>
            {/* Satori needs a single text child here, and its default font has no ▲/▼ glyphs. */}
            <div style={{ fontSize: 48, color: up ? "#22c55e" : "#ef4444" }}>
              {`${formatSignedPercent(coin.change24h)} 24h`}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 72, fontWeight: 700 }}>Real-time crypto dashboard</div>
      )}
      <div style={{ fontSize: 28, color: "#8a94a6" }}>
        Live prices · Interactive charts · Ask TRIYU AI assistant
      </div>
    </div>,
    size,
  );
}
