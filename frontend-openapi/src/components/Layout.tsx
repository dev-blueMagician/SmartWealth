import { type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { RightRail, type TocItem } from "./RightRail";

type LayoutProps = {
  children: ReactNode;
  toc?: TocItem[];
  hideRightRail?: boolean;
};

export function Layout({ children, toc, hideRightRail }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 flex w-full max-w-[1320px] mx-auto">
        <aside className="hidden lg:block w-[260px] shrink-0 border-r border-border px-3 py-6 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-bg-panel/60 backdrop-blur-sm">
          <Sidebar />
        </aside>
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-10">
          <div className="max-w-content mx-auto">{children}</div>
        </main>
        {!hideRightRail && (
          <aside className="hidden xl:block w-[240px] shrink-0 border-l border-border px-4 py-10 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <RightRail toc={toc} />
          </aside>
        )}
      </div>
    </div>
  );
}
