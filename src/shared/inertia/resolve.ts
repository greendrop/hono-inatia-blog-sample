const modules = import.meta.glob("/src/features/**/pages/**/*.tsx");

// パス → レンダ名 に変換したマップを事前構築
//   /src/features/admin/posts/pages/Edit.tsx → admin/posts/Edit
//   /src/features/home/pages/Home.tsx        → home/Home
const pages: Record<string, () => Promise<{ default: unknown }>> = {};
for (const [path, loader] of Object.entries(modules)) {
  const name = path
    .replace(/^\/src\/features\//, "")  // /src/features/admin/posts/pages/Edit.tsx → admin/posts/pages/Edit.tsx
    .replace(/\/pages\//, "/")          // admin/posts/pages/Edit.tsx → admin/posts/Edit.tsx
    .replace(/\.tsx$/, "");             // admin/posts/Edit.tsx → admin/posts/Edit
  pages[name] = loader as () => Promise<{ default: unknown }>;
}

export async function resolvePage(name: string): Promise<unknown> {
  const loader = pages[name];
  if (!loader) throw new Error(`Page not found: ${name}`);
  return (await loader()).default;
}
