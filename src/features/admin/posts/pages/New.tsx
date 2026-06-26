import Layout from "@/shared/components/Layout";
import PostForm from "@/features/admin/posts/components/PostForm";

export default function New() {
  return (
    <Layout title="新規投稿" description="新しい記事を作成します。">
      <h1 class="text-2xl font-bold text-gray-900">新規投稿</h1>
      <div class="mt-6">
        <PostForm action="/admin/posts" method="post" submitLabel="作成する" />
      </div>
    </Layout>
  );
}
