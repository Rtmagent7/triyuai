import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { Coin } from "@triyuai/shared";
import { markets } from "@/mocks/data";

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

export function renderWithClient(ui: React.ReactElement, options?: RenderOptions) {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper, ...options }) };
}

export const coin = (id: string): Coin => {
  const c = markets.find((m) => m.id === id);
  if (!c) throw new Error(`fixture coin ${id} missing`);
  return c;
};
