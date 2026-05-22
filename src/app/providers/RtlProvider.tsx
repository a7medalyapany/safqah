import { useEffect, type ReactNode } from "react";

type RtlProviderProps = {
  children: ReactNode;
};

export function RtlProvider({ children }: RtlProviderProps) {
  useEffect(() => {
    document.body.setAttribute("dir", "rtl");
    document.body.setAttribute("lang", "ar");

    return () => {
      document.body.removeAttribute("dir");
      document.body.removeAttribute("lang");
    };
  }, []);

  return children;
}
