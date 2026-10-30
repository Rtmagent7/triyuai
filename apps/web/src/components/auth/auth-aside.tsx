import { DEMO_WATCHLIST_LABEL } from "./demo";

/** What an account changes, stated plainly beside the form (wide screens only). */
export function AuthAside() {
  return (
    <div className="hidden max-w-md lg:block">
      <h2 className="text-xl font-semibold tracking-tight">What an account changes</h2>
      <dl className="mt-6 space-y-5 text-sm">
        <div>
          <dt className="font-medium">Your watchlist follows you</dt>
          <dd className="text-muted mt-1">
            Star a coin on your phone and it is there on your laptop. Coins you starred before
            signing in are added to the account the first time.
          </dd>
        </div>
        <div>
          <dt className="font-medium">30 Ask TRIYU messages a day</dt>
          <dd className="text-muted mt-1">Guests get 10. The count resets at midnight UTC.</dd>
        </div>
        <div>
          <dt className="font-medium">No account needed to look around</dt>
          <dd className="text-muted mt-1">
            The demo account comes with a watchlist of {DEMO_WATCHLIST_LABEL} and resets every day.
          </dd>
        </div>
      </dl>
    </div>
  );
}
