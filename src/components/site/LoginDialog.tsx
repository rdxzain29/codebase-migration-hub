import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

/** Listens for "open login" requests and opens the reader sign-in page. */
export function LoginDialog() {
  const navigate = useNavigate();
  useEffect(() => {
    const onOpen = () => {
      const here = `${window.location.pathname}${window.location.search}`;
      void navigate({ to: "/login", search: here === "/" ? {} : { redirect: here } });
    };
    window.addEventListener("nf:open-login", onOpen);
    return () => window.removeEventListener("nf:open-login", onOpen);
  }, [navigate]);
  return null;
}
