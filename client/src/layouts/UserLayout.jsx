import Sidebar from "../components/Sidebar";

const UserLayout = ({ children }) => {
  return (
    <div className="h-screen overflow-hidden bg-slate-100 flex">
      <Sidebar />

      <div className="min-w-0 flex-1 h-screen overflow-y-auto p-6 sm:ml-64">
        {children}
      </div>
    </div>
  );
};

export default UserLayout;