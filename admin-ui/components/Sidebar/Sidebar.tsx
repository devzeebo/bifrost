type SidebarProps = {
  children: React.ReactNode;
};

export const Sidebar = ({ children }: SidebarProps) => (
  <div id="sidebar" className="p-5 flex flex-col shrink-0 border-r-2 border-r-gray-200">
    {children}
  </div>
);
