import "./Layout.css";

import "./tailwind.css";
import { Content } from "@/components/Content";
import { Link } from "@/components/Link";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/Sidebar";

type LayoutProps = {
  children: React.ReactNode;
};

export const Layout = ({ children }: LayoutProps) => (
  <div className="flex max-w-5xl m-auto">
    <Sidebar>
      <Logo />
      <Link href="/">Welcome</Link>
      <Link href="/todo">Todo</Link>
      <Link href="/star-wars">Data Fetching</Link>
    </Sidebar>
    <Content>{children}</Content>
  </div>
);
