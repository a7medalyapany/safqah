import { useEffect, type ReactNode } from "react";

type RtlProviderProps = {
  children: ReactNode;
};

export function RtlProvider({ children }: RtlProviderProps) {
  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
    document.body.setAttribute("dir", "rtl");

    return () => {
      document.documentElement.removeAttribute("dir");
      document.documentElement.removeAttribute("lang");
      document.body.removeAttribute("dir");
    };
  }, []);

  return children;
}
