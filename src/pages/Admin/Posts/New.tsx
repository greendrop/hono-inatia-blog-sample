import Layout from "../../../components/Layout";
import PostForm from "../../../components/PostForm";

export default function New() {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">新規投稿</h1>
      <div class="mt-6">
        <PostForm action="/admin/posts" method="post" submitLabel="作成する" />
      </div>
    </Layout>
  );
}
