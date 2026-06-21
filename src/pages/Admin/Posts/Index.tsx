import { Link, router } from "@ts-76/inertia-hono-jsx";
import Layout from "../../../components/Layout";
import type { Post } from "../../../db/schema";

export default function Index({ posts }: { posts: Post[] }) {
  const onDelete = (id: number) => {
    if (confirm("この投稿を削除しますか？"))
      router.delete(`/admin/posts/${id}`);
  };
  return (
    <Layout>
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">投稿管理</h1>
        <Link
          href="/admin/posts/new"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          新規作成
        </Link>
      </div>
      <table class="mt-6 w-full text-left text-sm">
        <thead>
          <tr class="border-b text-gray-500">
            <th class="py-2">ID</th>
            <th class="py-2">タイトル</th>
            <th class="py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} class="border-b">
              <td class="py-2">{post.id}</td>
              <td class="py-2">{post.title}</td>
              <td class="space-x-3 py-2 text-right">
                <Link
                  href={`/admin/posts/${post.id}/edit`}
                  class="text-blue-700 hover:underline"
                >
                  編集
                </Link>
                <button
                  onClick={() => onDelete(post.id)}
                  class="text-red-600 hover:underline"
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
