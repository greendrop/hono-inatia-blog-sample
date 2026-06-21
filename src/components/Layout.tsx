import { useEffect } from "hono/jsx";
import { Link } from "@ts-76/inertia-hono-jsx";

export default function Layout({ children }: { children: unknown }) {
  useEffect(() => {
    window.HSStaticMethods?.autoInit();
  }, []);

  return (
    <div class="min-h-screen bg-gray-50">
      <header class="border-b bg-white">
        <nav class="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <Link href="/" class="font-bold text-gray-900">
            Blog
          </Link>
          <Link href="/posts" class="text-gray-600 hover:text-gray-900">
            記事一覧
          </Link>
          <Link href="/admin/posts" class="text-gray-600 hover:text-gray-900">
            管理
          </Link>

          {/* 動作確認用：Preline のドロップダウン */}
          <div class="hs-dropdown relative ml-auto inline-flex">
            <button
              type="button"
              class="hs-dropdown-toggle rounded-lg border px-3 py-1.5 text-sm"
            >
              Menu
            </button>
            <div class="hs-dropdown-menu hidden opacity-0 transition-opacity duration-150 hs-dropdown-open:opacity-100 z-10 mt-2 min-w-40 rounded-lg border bg-white p-1 shadow-md">
              <Link
                href="/"
                class="block rounded px-3 py-2 text-sm hover:bg-gray-100"
              >
                Home
              </Link>
              <Link
                href="/posts"
                class="block rounded px-3 py-2 text-sm hover:bg-gray-100"
              >
                記事一覧
              </Link>
              <Link
                href="/admin/posts"
                class="text-gray-600 hover:text-gray-900"
              >
                管理
              </Link>
            </div>
          </div>
        </nav>
      </header>
      <main class="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
