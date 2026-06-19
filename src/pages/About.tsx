import { Link } from "@ts-76/inertia-hono-jsx";
import Layout from "../components/Layout";

export default function About() {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">About</h1>
      <Link href="/">← Home へ</Link>
    </Layout>
  );
}
