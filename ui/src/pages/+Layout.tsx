import type { ReactNode } from "react";
import { Head } from "vike-react/Head";
import { usePageContext } from "vike-react/usePageContext";
import { TopNav } from "../components/TopNav/TopNav";
import "../index.css";

export { Layout };

function Layout({ children }: { children: ReactNode }) {
  const pageContext = usePageContext();
  const isAuthlessPage = pageContext.urlPathname === "/login" || pageContext.urlPathname === "/onboarding";

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Bifrost</title>
      </Head>
      {!isAuthlessPage && <TopNav currentPath={pageContext.urlPathname} />}
      <main>{children}</main>
    </>
  );
}
