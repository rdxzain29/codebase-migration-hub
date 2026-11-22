import { useAccount } from "@/lib/account";

/** Name of the signed-in reader, shown on reviews; null when signed out. */
export function useReaderName(): string | null {
  return useAccount()?.name ?? null;
}

/** Sends the reader to the sign-in page from anywhere, returning here afterwards. */
export const openLogin = () => window.dispatchEvent(new Event("nf:open-login"));
