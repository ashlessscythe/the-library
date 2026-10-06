import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { About } from "@/pages/About";
import { Explore } from "@/pages/Explore";
import { Home } from "@/pages/Home";
import { Random } from "@/pages/Random";
import { Reader } from "@/pages/Reader";
import { Search } from "@/pages/Search";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="explore" element={<Explore />} />
          <Route path="about" element={<About />} />
          <Route path="random" element={<Random />} />
          <Route
            path="book/:room/wall/:wall/shelf/:shelf/book/:book/page/:page"
            element={<Reader />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
