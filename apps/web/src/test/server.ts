import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";

/** Same handlers as the browser mock, so tests exercise the real API contract. */
export const server = setupServer(...handlers);
