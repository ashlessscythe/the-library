import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

export function Shell() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
