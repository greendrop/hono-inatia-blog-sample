import { Link } from "@ts-76/inertia-hono-jsx";
import Layout from "@/shared/components/Layout";

const MESSAGES: Record<number, string> = {
  405: "許可されていないメソッドです",
  429: "リクエストが多すぎます",
  503: "現在ご利用いただけません",
};

export default function Error({ status }: { status: number }) {
  const message = MESSAGES[status] ?? "エラーが発生しました";
  return (
    <Layout title={`${status} ${message}`} description={message}>
      <div class="text-center">
        <p class="text-6xl font-bold text-gray-300">{status}</p>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">
          {message}
        </h1>
        <Link href="/" class="mt-6 inline-block text-blue-600 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </Layout>
  );
}
