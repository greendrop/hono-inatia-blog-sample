import { useEffect, useState } from "hono/jsx";
import { Head, Link, usePage } from "@ts-76/inertia-hono-jsx";

const SITE_NAME = "Blog";
const DEFAULT_DESCRIPTION = "Hono × Inertia × hono/jsx で作るブログサンプル";

export default function Layout({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: unknown;
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const desc = description ?? DEFAULT_DESCRIPTION;

  const page = usePage();
  const flash = (page.props as { flash?: string | null }).flash ?? null;
  const [show, setShow] = useState(false);

  // flash が来たら表示 → 3秒で消す
  useEffect(() => {
    if (!flash) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <>
      <Head title={fullTitle}>
        <meta name="description" content={desc} />
      </Head>
      <div class="min-h-screen bg-gray-50">
      {/* 既存のヘッダーはそのまま */}
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
        </nav>
      </header>

      {/* トースト */}
      {show && flash && (
        <div class="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg">
          <span>{flash}</span>
          <button
            onClick={() => setShow(false)}
            class="text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      <main class="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
    </>
  );
}
