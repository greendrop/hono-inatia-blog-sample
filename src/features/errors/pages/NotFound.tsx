import { Link } from "@ts-76/inertia-hono-jsx";
import Layout from "@/shared/components/Layout";

export default function NotFound() {
  return (
    <Layout>
      <div class="text-center">
        <p class="text-6xl font-bold text-gray-300">404</p>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">ページが見つかりません</h1>
        <p class="mt-2 text-gray-600">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link href="/" class="mt-6 inline-block text-blue-600 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </Layout>
  );
}
