import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loadTheme } from "../features/themeSlice";
import { Loader2Icon } from "lucide-react";
import {
  useUser,
  SignIn,
  useAuth,
  useClerk,
  useOrganizationList,
} from "@clerk/clerk-react";
import { fetchWorkspaces } from "../features/workspaceSlice";

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { loading, workspaces } = useSelector((state) => state.workspace);
  const dispatch = useDispatch();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { openCreateOrganization } = useClerk();
  const { userMemberships } = useOrganizationList({ userMemberships: true });

  // Initial load of theme
  useEffect(() => {
    dispatch(loadTheme());
  }, []);

  // Initial load of workspaces
  useEffect(() => {
    if (isLoaded && user && workspaces.length === 0) {
      dispatch(fetchWorkspaces({ getToken }));
    }
  }, [user, isLoaded, userMemberships?.data?.length]);

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-zinc-950">
        <SignIn />
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
        <Loader2Icon className="size-7 text-blue-500 animate-spin" />
      </div>
    );

  if (user && workspaces.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 px-6">
        <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10">
            <span className="text-2xl">🚀</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome to We4X Studio
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-zinc-400">
            Your account is connected, but no workspace is available yet. Create a workspace to continue.
          </p>
          <button
            type="button"
            onClick={() => openCreateOrganization()}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Create Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />
      <div className="flex-1 flex flex-col h-screen">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />
        <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
