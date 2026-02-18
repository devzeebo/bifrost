type LinkProps = {
  href: string;
  children: React.ReactNode;
};

const base = import.meta.env.BASE_URL;

export const Link = ({ href, children }: LinkProps) => {
  const fullHref = href.startsWith("/") ? `${base}${href.slice(1)}` : href;
  return (
    <a href={fullHref} className="block p-2 hover:bg-gray-100 rounded">
      {children}
    </a>
  );
};
