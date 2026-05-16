import Link from "next/link";

export default function NotFound() {
  return (
    <main className="webview-root">
      <div className="webview-frame">
        <section className="glass-panel p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next Card</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">没有找到这张卡</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            当前页面不存在，回到输入区继续生成执行方案。
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            回到 input
          </Link>
        </section>
      </div>
    </main>
  );
}
