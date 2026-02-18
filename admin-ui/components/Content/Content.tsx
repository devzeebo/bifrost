type ContentProps = {
  children: React.ReactNode;
};

export const Content = ({ children }: ContentProps) => (
  <div id="page-container">
    <div id="page-content" className="p-5 pb-12 min-h-screen">
      {children}
    </div>
  </div>
);
