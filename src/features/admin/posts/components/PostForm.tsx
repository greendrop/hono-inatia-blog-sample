import { useForm, usePage } from "@ts-76/inertia-hono-jsx";

type Props = {
  action: string;
  method: "post" | "put";
  initial?: { title: string; body: string };
  submitLabel: string;
};

export default function PostForm({
  action,
  method,
  initial,
  submitLabel,
}: Props) {
  const page = usePage();
  const old = (page.props as { old?: { title?: string; body?: string } }).old;

  const form = useForm({
    title: old?.title ?? initial?.title ?? "",
    body: old?.body ?? initial?.body ?? "",
  });

  const submit = (e: Event) => {
    e.preventDefault();
    if (method === "post") form.post(action);
    else form.put(action);
  };

  return (
    <form onSubmit={submit} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700">タイトル</label>
        <input
          type="text"
          value={form.data.title}
          onInput={(e) =>
            form.setData("title", (e.target as HTMLInputElement).value)
          }
          class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {form.errors.title && (
          <p class="mt-1 text-sm text-red-600">{form.errors.title}</p>
        )}
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700">本文</label>
        <textarea
          rows={8}
          value={form.data.body}
          onInput={(e) =>
            form.setData("body", (e.target as HTMLTextAreaElement).value)
          }
          class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {form.errors.body && (
          <p class="mt-1 text-sm text-red-600">{form.errors.body}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={form.processing}
        class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
