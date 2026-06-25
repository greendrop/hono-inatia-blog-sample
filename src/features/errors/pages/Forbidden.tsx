import { Link } from "@ts-76/inertia-hono-jsx";
import Layout from "@/shared/components/Layout";

export default function Forbidden() {
  return (
    <Layout>
      <div class="text-center">
        <p class="text-6xl font-bold text-gray-300">403</p>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">アクセスが許可されていません</h1>
        <p class="mt-2 text-gray-600">このページへのアクセス権限がありません。</p>
        <Link href="/" class="mt-6 inline-block text-blue-600 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </Layout>
  );
}
