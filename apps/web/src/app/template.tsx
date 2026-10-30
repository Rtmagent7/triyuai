/**
 * Re-mounted on every navigation, so each page fades in. Opacity only: no layout
 * shift, and the first frame is painted immediately for LCP.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
