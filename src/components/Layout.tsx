import { Footer } from "./Footer";
import Header from "./Header";

import { ReactNode } from "react";

export default function Layout({
  children,
  fontClass,
}: {
  children: ReactNode;
  fontClass: string;
}) {
  return (
    <>
      <div
        className={`flex flex-col row-start-2 items-center sm:items-start ${fontClass}`}
      >
        <Header />
        <main className="w-full">{children}</main>
        <Footer />
      </div>
    </>
  );
}
