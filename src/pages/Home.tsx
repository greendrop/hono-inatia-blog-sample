import { Link } from "@ts-76/inertia-hono-jsx";

export default function Home({ message }: { message: string }) {
  return (
    <div>
      <h1>{message}</h1>
      <Link href="/about">About へ →</Link>
    </div>
  );
}
