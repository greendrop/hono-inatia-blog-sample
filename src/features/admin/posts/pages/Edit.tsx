import Layout from "@/shared/components/Layout";
import PostForm from "@/features/admin/posts/components/PostForm";
import type { Post } from "@/db/schema";

export default function Edit({ post }: { post: Post }) {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">投稿を編集</h1>
      <div class="mt-6">
        <PostForm
          action={`/admin/posts/${post.id}`}
          method="put"
          initial={{ title: post.title, body: post.body }}
          submitLabel="更新する"
        />
      </div>
    </Layout>
  );
}
