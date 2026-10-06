import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

export function Shell() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
