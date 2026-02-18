import logoUrl from "@/assets/logo.svg";

const base = import.meta.env.BASE_URL;

export const Logo = () => (
  <div className="p-5 mb-2">
    <a href={base}>
      <img src={logoUrl} height={64} width={64} alt="logo" />
    </a>
  </div>
);
