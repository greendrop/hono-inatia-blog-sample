import { Link } from "@ts-76/inertia-hono-jsx";
import Layout from "@/shared/components/Layout";
import type { Post } from "@/db/schema";

export default function Show({ post }: { post: Post }) {
  const excerpt = post.body.replace(/\s+/g, " ").slice(0, 100);
  return (
    <Layout title={post.title} description={excerpt}>
      <article>
        <h1 class="text-3xl font-bold text-gray-900">{post.title}</h1>
        <p class="mt-2 text-sm text-gray-400">{post.createdAt}</p>
        <div class="mt-6 whitespace-pre-wrap leading-relaxed text-gray-800">
          {post.body}
        </div>
      </article>
      <Link
        href="/posts"
        class="mt-8 inline-block text-blue-700 hover:underline"
      >
        ← 一覧へ戻る
      </Link>
    </Layout>
  );
}
