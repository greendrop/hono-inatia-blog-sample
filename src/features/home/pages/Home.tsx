import { Link } from "@ts-76/inertia-hono-jsx";
import Layout from "@/shared/components/Layout";

export default function Home({ message }: { message: string }) {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">{message}</h1>
      <p class="mt-2 text-gray-600">Hono × Inertia × hono/jsx</p>
    </Layout>
  );
}
