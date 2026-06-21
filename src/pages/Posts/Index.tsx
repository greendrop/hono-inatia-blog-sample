import { Link } from "@ts-76/inertia-hono-jsx";
import Layout from "../../components/Layout";
import type { Post } from "../../db/schema";

export default function Index({ posts }: { posts: Post[] }) {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">記事一覧</h1>

      {posts.length === 0 ? (
        <p class="mt-6 text-gray-500">まだ記事がありません。</p>
      ) : (
        <ul class="mt-6 space-y-3">
          {posts.map((post) => (
            <li
              key={post.id}
              class="rounded-lg border bg-white p-4 transition hover:shadow-sm"
            >
              <Link
                href={`/posts/${post.id}`}
                class="text-lg font-semibold text-blue-700 hover:underline"
              >
                {post.title}
              </Link>
              <p class="mt-1 line-clamp-2 text-sm text-gray-600">{post.body}</p>
              <p class="mt-2 text-xs text-gray-400">{post.createdAt}</p>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
