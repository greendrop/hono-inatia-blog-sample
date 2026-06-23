# Hono + Inertia(hono/jsx) で作る簡易ブログ ハンズオン

Cloudflare Workers 上で **Hono + @hono/inertia + hono/jsx** を使い、簡易ブログをステップバイステップで構築する記録。
最終的に **D1 / Drizzle / Vitest / フラッシュメッセージ / SSR** まで含む。すべて**ローカル完結**（Cloudflare アカウントへのデプロイはしない構成）。

- 簡易ブログ：投稿は `title` / `body` のみ（タグ・カテゴリ・コメントなし）
- ユーザ画面：一覧・詳細
- 管理画面：CRUD（認証・認可はなし）

---

## 技術スタック

| 領域 | 採用 |
|---|---|
| ランタイム | Cloudflare Workers（ローカル: workerd） |
| フレームワーク | Hono |
| ビルド | Vite + `@cloudflare/vite-plugin` |
| ビュー | hono/jsx |
| ページ遷移 | `@hono/inertia`（サーバ） + `@ts-76/inertia-hono-jsx`（クライアント） |
| DB | Cloudflare D1（ローカル SQLite） |
| ORM | Drizzle |
| UI | Tailwind CSS v4 |
| テスト | Vitest + libsql インメモリ |
| パッケージ管理 | pnpm |

### なぜ hono/jsx 版か

`@hono/inertia`（サーバ側）はクライアントフレームワーク非依存で、`c.render('Posts/Show', { post })` で Inertia プロトコルを話す。クライアントだけ差し替え可能なので、React の `@inertiajs/react` の代わりに **`@ts-76/inertia-hono-jsx`** を使うと hono/jsx で書ける。

Cloudflare Workers との相性が良い理由：React 版は Edge 側にも `react-dom/server` が同梱され worker bundle が肥大化するが、hono/jsx 版にはそれが無い（worker bundle が大幅に小さい）。Edge に載せる前提なら hono/jsx は妥当な選択。

参考実装：`yusukebe/hono-inertia-example`（hono/jsx + Inertia + Cloudflare Workers）はページ構成が本ブログとほぼ 1:1。手元に開いておくと「答え合わせ」に便利。

---

## 完成後のディレクトリ構成

```
src/
  index.ts            # Worker エントリ（server を再エクスポート）
  server.tsx          # createApp ファクトリ：inertia + flash + db ミドルウェア + ルート
  root-view.ts        # 初期HTMLシェル（SSR対応：非同期）
  ssr.tsx             # SSR描画エントリ
  client.tsx          # クライアント起動（createInertiaApp）
  flash.ts            # Cookieベースのフラッシュ
  style.css           # Tailwind CSS
  db/
    index.ts          # Db 型 + createDb（D1）
    schema.ts         # posts テーブル
  routes/admin/
    posts.tsx         # 管理CRUD（サブアプリ）
  components/
    Layout.tsx        # 共通レイアウト（flashトースト）
    PostForm.tsx      # 新規・編集共通フォーム
  pages/
    Home.tsx
    Posts/
      Index.tsx
      Show.tsx
    Admin/Posts/
      Index.tsx
      New.tsx
      Edit.tsx
drizzle/migrations/   # drizzle-kit が生成
seeds/dev.sql
test/
  db.ts
  posts.test.ts
wrangler.jsonc
drizzle.config.ts
vitest.config.ts
```

---

## Phase 1：土台（Hono + Vite + Cloudflare Workers）

Inertia はクライアントビルドのために Vite が必須。`@cloudflare/vite-plugin` は Worker をローカルでも workerd 上で動かし、本番挙動に近づけてくれる。Vite を最初から噛ませる。

```bash
pnpm create hono@latest blog          # テンプレートは cloudflare-workers を選択
cd blog
pnpm add -D vite @cloudflare/vite-plugin wrangler
```

**`vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [cloudflare()],
})
```

**`wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "blog",
  "compatibility_date": "2025-08-03",
  "main": "./src/index.ts"
}
```

**`src/index.ts`**

```ts
import { Hono } from 'hono'

const app = new Hono()
app.get('/', (c) => c.text('Hello Hono'))

export default app
```

```bash
pnpm dev   # http://localhost:5173 で "Hello Hono"
```

`export default app` が「Workers の fetch ハンドラ = Hono アプリ」の対応。Hono が Web 標準の `fetch` ベースなのでこの一行で繋がる。

---

## Phase 2：Inertia を手配線する

```bash
pnpm add @hono/inertia @ts-76/inertia-hono-jsx
```

**tsconfig（JSX を hono/jsx に）**

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

**`src/root-view.ts`（初期HTMLシェル / CSR版）**

> SSR を入れる Phase 8-b で非同期版に差し替える。まずは CSR 版。

```ts
import { serializePage, type RootView } from '@hono/inertia'

export const rootView: RootView = (page) => `<!DOCTYPE html>
<html>
  <head>
    <title>Blog</title>
    <script type="module" src="/src/client.tsx"></script>
  </head>
  <body>
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`
```

`data-page="app"` の中に page object（コンポーネント名・props・URL・version）が JSON で埋まり、`#app` がマウント先。`createInertiaApp` の `id` デフォルトが `'app'` なので対応する。`serializePage` は `/` → `\/` のエスケープを行うので props 内に `</script>` があってもタグを抜け出せない。

**`src/server.tsx`（最小）**

```tsx
import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { rootView } from './root-view'

const app = new Hono()
app.use(inertia({ version: '1', rootView }))

const routes = app
  .get('/', (c) => c.render('Home', { message: 'Hono x Inertia' }))

export default routes
```

**`src/client.tsx`**

```tsx
import { createInertiaApp } from '@ts-76/inertia-hono-jsx'
import { render } from 'hono/jsx/dom'

createInertiaApp({
  resolve: async (name) => {
    const pages = import.meta.glob('./pages/**/*.tsx')
    const page = await pages[`./pages/${name}.tsx`]()
    return (page as { default: unknown }).default
  },
  setup({ el, App, props }) {
    render(<App {...props} />, el)
  },
})
```

React 版との違いは2点だけ：`@inertiajs/react` → `@ts-76/inertia-hono-jsx`、`createRoot(el).render(...)` → `hono/jsx/dom` の `render(<App/>, el)`。

**`src/index.ts`** を差し替え（server を再エクスポート）

```ts
export { default } from './server'
```

**`src/pages/Home.tsx`**

```tsx
export default function Home({ message }: { message: string }) {
  return <h1>{message}</h1>
}
```

### 動作確認のポイント
- 「ページのソースを表示」で `data-page` の JSON が初期HTMLに埋まっている。
- `<Link>` 遷移時、ネットワークタブで `X-Inertia: true` ヘッダ付き JSON が返る（初回は HTML）。これが Inertia の核心。

---

## Phase 3：Tailwind v4 + 共通レイアウト

Tailwind v4 は設定が v3 から変わり、`@tailwind base/components/utilities` の3行は誤り。正しくは `@import "tailwindcss";` の1行。

```bash
pnpm add -D tailwindcss @tailwindcss/vite @tailwindcss/forms
```

**`vite.config.ts`** に Tailwind プラグインを追加

```ts
import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [cloudflare(), tailwindcss()],
})
```

**`src/style.css`**

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";
```

**`src/client.tsx`** の先頭で CSS を読み込む

```tsx
import './style.css'
// 既存の createInertiaApp(...) はそのまま
```

**`src/components/Layout.tsx`**

> フラッシュ対応版は Phase 8-a を参照。まずはレイアウトのみ。

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'

export default function Layout({ children }: { children: unknown }) {
  return (
    <div class="min-h-screen bg-gray-50">
      <header class="border-b bg-white">
        <nav class="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <Link href="/" class="font-bold text-gray-900">Blog</Link>
          <Link href="/posts" class="text-gray-600 hover:text-gray-900">記事一覧</Link>
          <Link href="/admin/posts" class="text-gray-600 hover:text-gray-900">管理</Link>
        </nav>
      </header>
      <main class="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
```

> **React からの最重要の違い**：hono/jsx は `className` ではなく **`class`**。

各ページを `<Layout>` で包む。

---

## Phase 4：D1 + Drizzle（ローカル限定）

`wrangler d1 create` は名前に反して**リモート（Cloudflare アカウント上）に DB を作る操作**。ローカル限定なら **スキップ**してよい。バインディングを手書きし、`--local` でマイグレーションを当てるだけ。

マイグレーションは「Drizzle で生成 → wrangler で適用」方式（`drizzle-kit migrate` は使わない。ローカル D1 のハッシュ付きパス指定が脆いため）。

```bash
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

**`src/db/schema.ts`**

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
})

export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
```

**`drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
})
```

**`wrangler.jsonc`** に D1 バインディング追加（ローカル placeholder）

```jsonc
{
  // ...既存
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "blog",
      "database_id": "local-blog-placeholder",
      "migrations_dir": "drizzle/migrations"
    }
  ]
}
```

> `migrations_dir` を Drizzle の `out` と一致させ、**`d1_databases` の各オブジェクトの中**に置くこと（配列の外やトップレベルだと無視される）。`database_id` はローカルなら任意の文字列でよい。

**マイグレーション生成 → ローカル適用**

```bash
pnpm exec drizzle-kit generate                          # drizzle/migrations/0000_*.sql 生成
pnpm exec wrangler d1 migrations apply blog --local
```

> ⚠️ `--local` を**必ず**付ける。付けないとリモート扱いになり OAuth ログインが開く。`migrations apply` も `execute` も常に `--local` を付ける癖を。
> ⚠️ コマンドの DB 名（`blog`）は `wrangler.jsonc` の `database_name` と**一致**させること。不一致だと wrangler は設定を見つけられずデフォルトの `migrations` フォルダにフォールバックし「No migrations present」エラーになる。

**seed**：`seeds/dev.sql`

```sql
INSERT INTO posts (title, body) VALUES
  ('はじめての投稿', 'Hono と Inertia で作る簡易ブログです。'),
  ('2本目の記事', 'Drizzle 経由で D1 にアクセスしています。');
```

```bash
pnpm exec wrangler d1 execute blog --local --file ./seeds/dev.sql
pnpm exec wrangler d1 execute blog --local --command "SELECT id, title, created_at FROM posts"
```

**型生成**

```bash
pnpm exec wrangler types   # worker-configuration.d.ts に DB: D1Database を含む型が生成される
```

生成ファイルのインターフェイス名（`CloudflareBindings` か `Env`）を確認し、以降の `new Hono<{ Bindings: ... }>()` に合わせる。

**`src/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/d1'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'

// D1版・libsql版どちらの drizzle インスタンスもこの型に代入できる
export type Db = BaseSQLiteDatabase<'async', any, typeof schema>

export const createDb = (d1: D1Database): Db => drizzle(d1, { schema })
```

---

## Phase 5：ユーザ画面（一覧 / 詳細）

`src/server.tsx` のルートに追加（最終形は Phase 7 で `c.get('db')` 化）。

```tsx
import { desc, eq } from 'drizzle-orm'
import { createDb } from './db'
import { posts } from './db/schema'

const app = new Hono<{ Bindings: CloudflareBindings }>()
app.use(inertia({ version: '1', rootView }))

const routes = app
  .get('/', (c) => c.render('Home', { message: 'Hono x Inertia' }))
  .get('/posts', async (c) => {
    const db = createDb(c.env.DB)
    const list = await db.select().from(posts).orderBy(desc(posts.createdAt))
    return c.render('Posts/Index', { posts: list })
  })
  .get('/posts/:id', async (c) => {
    const db = createDb(c.env.DB)
    const id = Number(c.req.param('id'))
    const post = await db.select().from(posts).where(eq(posts.id, id)).get()
    if (!post) return c.notFound()
    return c.render('Posts/Show', { post })
  })

export default routes
```

**`src/pages/Posts/Index.tsx`**

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'
import Layout from '../../components/Layout'
import type { Post } from '../../db/schema'

export default function Index({ posts }: { posts: Post[] }) {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">記事一覧</h1>
      {posts.length === 0 ? (
        <p class="mt-6 text-gray-500">まだ記事がありません。</p>
      ) : (
        <ul class="mt-6 space-y-3">
          {posts.map((post) => (
            <li key={post.id} class="rounded-lg border bg-white p-4 transition hover:shadow-sm">
              <Link href={`/posts/${post.id}`} class="text-lg font-semibold text-blue-700 hover:underline">
                {post.title}
              </Link>
              <p class="mt-1 line-clamp-2 text-sm text-gray-600">{post.body}</p>
              <p class="mt-2 text-xs text-gray-400">{post.createdAt}</p>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}
```

**`src/pages/Posts/Show.tsx`**

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'
import Layout from '../../components/Layout'
import type { Post } from '../../db/schema'

export default function Show({ post }: { post: Post }) {
  return (
    <Layout>
      <article>
        <h1 class="text-3xl font-bold text-gray-900">{post.title}</h1>
        <p class="mt-2 text-sm text-gray-400">{post.createdAt}</p>
        <div class="mt-6 whitespace-pre-wrap leading-relaxed text-gray-800">{post.body}</div>
      </article>
      <Link href="/posts" class="mt-8 inline-block text-blue-700 hover:underline">← 一覧へ戻る</Link>
    </Layout>
  )
}
```

> `import type { Post }` は **type だけのインポート**でコンパイル時に消えるため、Drizzle のランタイムコードがクライアントバンドルに混入しない。値（`posts` テーブルや `createDb`）はクライアントページから絶対に import しないこと。

---

## Phase 6：管理画面 CRUD

`app.route('/admin/posts', adminPosts)` でリソースを分離（Rails の `resources` 相当）。

```bash
pnpm add @hono/zod-validator zod
```

### バリデーションエラーの扱い（重要）
Inertia は 422 を返さず、`page.props.errors` の有無でバリデーションエラーを判定する。`@hono/inertia` にはセッション flash も共有 props ヘルパーも無いので、Laravel 流の「リダイレクトバック + セッション flash」は使えない。代わりに**失敗時は同じフォームを `errors` 付きで再レンダリング**する。

### Content-Type の注意（重要）
Inertia の `useForm.post()` は、ファイルが無ければボディを **JSON**（`Content-Type: application/json`）で送る。よって `zValidator` は **`'json'`** を使う（`'form'` だと form-urlencoded を読むので値が `undefined` になる）。

**`src/routes/admin/posts.tsx`**（最終形：`c.get('db')` + `setFlash`）

```tsx
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql, desc, eq } from 'drizzle-orm'
import { posts } from '../../db/schema'
import type { Db } from '../../db'
import { setFlash } from '../../flash'

const postSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(120, 'タイトルは120文字以内です'),
  body: z.string().min(1, '本文は必須です'),
})

// ZodError → Inertia の errors prop ( { field: message } )
const toErrors = (err: z.ZodError) => {
  const errors: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? 'form')
    errors[key] ??= issue.message
  }
  return errors
}

const adminPosts = new Hono<{ Bindings: CloudflareBindings; Variables: { db: Db } }>()

adminPosts
  // 管理一覧
  .get('/', async (c) => {
    const list = await c.get('db').select().from(posts).orderBy(desc(posts.createdAt))
    return c.render('Admin/Posts/Index', { posts: list })
  })
  // 新規フォーム
  .get('/new', (c) => c.render('Admin/Posts/New', {}))
  // 作成
  .post(
    '/',
    zValidator('json', postSchema, (result, c) => {
      if (!result.success) {
        return c.render('Admin/Posts/New', { errors: toErrors(result.error) })
      }
    }),
    async (c) => {
      const { title, body } = c.req.valid('json')
      await c.get('db').insert(posts).values({ title, body })
      setFlash(c, '投稿を作成しました')
      return c.redirect('/admin/posts', 303)
    }
  )
  // 編集フォーム
  .get('/:id/edit', async (c) => {
    const id = Number(c.req.param('id'))
    const post = await c.get('db').select().from(posts).where(eq(posts.id, id)).get()
    if (!post) return c.notFound()
    return c.render('Admin/Posts/Edit', { post })
  })
  // 更新（失敗時は Edit が post を必要とするので引き直す）
  .put(
    '/:id',
    zValidator('json', postSchema, async (result, c) => {
      if (!result.success) {
        const id = Number(c.req.param('id'))
        const post = await c.get('db').select().from(posts).where(eq(posts.id, id)).get()
        return c.render('Admin/Posts/Edit', { post, errors: toErrors(result.error) })
      }
    }),
    async (c) => {
      const { title, body } = c.req.valid('json')
      const id = Number(c.req.param('id'))
      await c.get('db').update(posts)
        .set({ title, body, updatedAt: sql`(current_timestamp)` })
        .where(eq(posts.id, id))
      setFlash(c, '投稿を更新しました')
      return c.redirect('/admin/posts', 303)
    }
  )
  // 削除
  .delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    await c.get('db').delete(posts).where(eq(posts.id, id))
    setFlash(c, '投稿を削除しました')
    return c.redirect('/admin/posts', 303)
  })

export default adminPosts
```

> 成功時は **303** リダイレクト（Inertia は PUT/DELETE のリダイレクトに 303 を要求。302 だと一部ブラウザでメソッドが維持される）。

**`src/components/PostForm.tsx`**（新規・編集共通）

```tsx
import { useForm } from '@ts-76/inertia-hono-jsx'

type Props = {
  action: string
  method: 'post' | 'put'
  initial?: { title: string; body: string }
  submitLabel: string
}

export default function PostForm({ action, method, initial, submitLabel }: Props) {
  const form = useForm({
    title: initial?.title ?? '',
    body: initial?.body ?? '',
  })

  const submit = (e: Event) => {
    e.preventDefault()
    if (method === 'post') form.post(action)
    else form.put(action)
  }

  return (
    <form onSubmit={submit} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700">タイトル</label>
        <input
          type="text"
          value={form.data.title}
          onInput={(e) => form.setData('title', (e.target as HTMLInputElement).value)}
          class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {form.errors.title && <p class="mt-1 text-sm text-red-600">{form.errors.title}</p>}
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">本文</label>
        <textarea
          rows={8}
          value={form.data.body}
          onInput={(e) => form.setData('body', (e.target as HTMLTextAreaElement).value)}
          class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {form.errors.body && <p class="mt-1 text-sm text-red-600">{form.errors.body}</p>}
      </div>
      <button type="submit" disabled={form.processing}
        class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
        {submitLabel}
      </button>
    </form>
  )
}
```

`useForm` は Inertia 標準 API（`data` / `errors` / `processing` / `setData` / `post`/`put`/`delete`）。`form.errors` はサーバが返した `props.errors` を自動で拾う。

**管理ページ3枚**

```tsx
// src/pages/Admin/Posts/Index.tsx
import { Link, router } from '@ts-76/inertia-hono-jsx'
import Layout from '../../../components/Layout'
import type { Post } from '../../../db/schema'

export default function Index({ posts }: { posts: Post[] }) {
  const onDelete = (id: number) => {
    if (confirm('この投稿を削除しますか？')) router.delete(`/admin/posts/${id}`)
  }
  return (
    <Layout>
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">投稿管理</h1>
        <Link href="/admin/posts/new" class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">新規作成</Link>
      </div>
      <table class="mt-6 w-full text-left text-sm">
        <thead>
          <tr class="border-b text-gray-500">
            <th class="py-2">ID</th><th class="py-2">タイトル</th><th class="py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} class="border-b">
              <td class="py-2">{post.id}</td>
              <td class="py-2">{post.title}</td>
              <td class="space-x-3 py-2 text-right">
                <Link href={`/admin/posts/${post.id}/edit`} class="text-blue-700 hover:underline">編集</Link>
                <button onClick={() => onDelete(post.id)} class="text-red-600 hover:underline">削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  )
}
```

```tsx
// src/pages/Admin/Posts/New.tsx
import Layout from '../../../components/Layout'
import PostForm from '../../../components/PostForm'

export default function New() {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">新規投稿</h1>
      <div class="mt-6"><PostForm action="/admin/posts" method="post" submitLabel="作成する" /></div>
    </Layout>
  )
}
```

```tsx
// src/pages/Admin/Posts/Edit.tsx
import Layout from '../../../components/Layout'
import PostForm from '../../../components/PostForm'
import type { Post } from '../../../db/schema'

export default function Edit({ post }: { post: Post }) {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">投稿を編集</h1>
      <div class="mt-6">
        <PostForm action={`/admin/posts/${post.id}`} method="put"
          initial={{ title: post.title, body: post.body }} submitLabel="更新する" />
      </div>
    </Layout>
  )
}
```

削除は `router.delete()` を使う（HTMLフォームのメソッド偽装は不要。Inertia は fetch で実 DELETE を送り Hono が直接受ける）。

---

## Phase 7：テスト（libsql インメモリ + 素の Vitest）

「D1 に依存しているが、テストまで D1 / workerd に依存したくない」方針。ルートを `c.env.DB` 直参照から **`c.get('db')`（DI）** に寄せ、本番は D1、テストは **libsql のインメモリ** を注入する。

> better-sqlite3 ではなく **libsql** を採用：ネイティブビルド不要（プレビルド配布）で、D1 と同じ**非同期**なので `Db` 型の共通化が素直。インメモリ（`:memory:`）はテストごとに新品 DB が生まれ、各テストが完全に独立する。

```bash
pnpm add -D vitest @libsql/client
```

### DI 化（Phase 5/6 のリファクタ）

**`src/server.tsx`** を `createApp(dbProvider?)` ファクトリ化（最終形）

```tsx
import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { rootView } from './root-view'
import { flash } from './flash'
import { createDb, type Db } from './db'
import { posts } from './db/schema'
import { desc, eq } from 'drizzle-orm'
import adminPosts from './routes/admin/posts'

type Env = {
  Bindings: CloudflareBindings
  Variables: { db: Db }
}

// dbProvider 省略時は D1 から。テストではインメモリ libsql を渡す。
export function createApp(dbProvider?: (c: any) => Db) {
  const app = new Hono<Env>()

  app.use(inertia({ version: '1', rootView }))
  app.use(flash())                                          // Phase 8-a
  app.use(async (c, next) => {
    c.set('db', dbProvider ? dbProvider(c) : createDb(c.env.DB))
    await next()
  })

  const routes = app
    .get('/', (c) => c.render('Home', { message: 'Hono x Inertia' }))
    .get('/posts', async (c) => {
      const list = await c.get('db').select().from(posts).orderBy(desc(posts.createdAt))
      return c.render('Posts/Index', { posts: list })
    })
    .get('/posts/:id', async (c) => {
      const id = Number(c.req.param('id'))
      const post = await c.get('db').select().from(posts).where(eq(posts.id, id)).get()
      if (!post) return c.notFound()
      return c.render('Posts/Show', { post })
    })
    .route('/admin/posts', adminPosts)

  return app
}

export default createApp()
```

各ハンドラの `createDb(c.env.DB)` を **`c.get('db')`** に置換（admin 側も同様、Hono ジェネリクスに `Variables: { db: Db }` を追加）。`app.use` は `.route()` より前に置くこと（親のミドルウェアがサブアプリにも適用される）。

### テスト

**`test/db.ts`**

```ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../src/db/schema'
import type { Db } from '../src/db'

export async function createTestDb(): Promise<Db> {
  const client = createClient({ url: ':memory:' })                 // 新品のインメモリ
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle/migrations' })  // 本番と同じ migration を適用
  return db
}
```

**`test/posts.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createApp } from '../src/server'
import { createTestDb } from './db'
import { posts } from '../src/db/schema'
import type { Db } from '../src/db'

let db: Db
let app: ReturnType<typeof createApp>

beforeEach(async () => {
  db = await createTestDb()      // 毎テスト新品のインメモリDB
  app = createApp(() => db)      // そのDBを注入したアプリ（c.env 不要）
})

const inertiaHeaders = {
  'Content-Type': 'application/json',
  'X-Inertia': 'true',
  'X-Inertia-Version': '1',
}

describe('ユーザ画面', () => {
  it('GET /posts は 200', async () => {
    const res = await app.request('/posts')
    expect(res.status).toBe(200)
  })
})

describe('管理 CRUD：作成', () => {
  it('正しい入力で作成され 303', async () => {
    const res = await app.request('/admin/posts', {
      method: 'POST', headers: inertiaHeaders,
      body: JSON.stringify({ title: 'テスト投稿', body: '本文です' }),
    })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/admin/posts')

    const all = await db.select().from(posts)
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('テスト投稿')
  })

  it('タイトル空でバリデーションエラー、保存されない', async () => {
    const res = await app.request('/admin/posts', {
      method: 'POST', headers: inertiaHeaders,
      body: JSON.stringify({ title: '', body: '本文' }),
    })
    const page = await res.json() as { props: { errors?: Record<string, string> } }
    expect(page.props.errors?.title).toBeTruthy()

    const all = await db.select().from(posts)
    expect(all).toHaveLength(0)
  })
})
```

**`vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'hono/jsx' },
})
```

**`package.json`**

```jsonc
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

```bash
pnpm test          # 1回だけ実行
pnpm test:watch    # 監視モード
```

> この構成の良い点：**本番は D1・テストは libsql** の二刀流が、`c.get('db')` という1つの seam に寄せたおかげでハンドラ側のコードを一切変えずに成立する。

---

## Phase 8-a：フラッシュメッセージ

`@hono/inertia` にはセッションも共有 props ヘルパーも無いので、**Cookie ベースの簡易 flash** を実装。`c.render` をラップして全ページに `flash` prop を注入する。

**`src/flash.ts`**

```ts
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

const FLASH = 'flash'

// 成功メッセージをセット（リダイレクト前に呼ぶ）
export const setFlash = (c: Context, message: string) => {
  setCookie(c, FLASH, encodeURIComponent(message), {
    path: '/', httpOnly: true, sameSite: 'Lax', maxAge: 60,
  })
}

// Cookie を読んで c.render に flash を注入し、Cookie を消す
export const flash = (): MiddlewareHandler => async (c, next) => {
  const raw = getCookie(c, FLASH)
  const message = raw ? decodeURIComponent(raw) : null
  if (raw) deleteCookie(c, FLASH, { path: '/' })

  const render = c.render
  ;(c as any).render = (component: any, props?: any) =>
    render(component, { ...(props ?? {}), flash: message })

  await next()
}
```

`createApp` 内で `inertia()` の**後**（c.render が用意された後）に `app.use(flash())` を差し込む（Phase 7 の `createApp` に記載済み）。各 mutation のリダイレクト直前で `setFlash(c, '...')` を呼ぶ（Phase 6 の admin/posts.tsx に記載済み）。

**`src/components/Layout.tsx`**（flash トースト対応版・最終形）

```tsx
import { useEffect, useState } from 'hono/jsx'
import { Link, usePage } from '@ts-76/inertia-hono-jsx'

export default function Layout({ children }: { children: unknown }) {
  const page = usePage()
  const flash = (page.props as { flash?: string | null }).flash ?? null
  const [show, setShow] = useState(false)

  useEffect(() => {
    window.HSStaticMethods?.autoInit()
  }, [])

  useEffect(() => {
    if (!flash) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <div class="min-h-screen bg-gray-50">
      <header class="border-b bg-white">
        <nav class="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <Link href="/" class="font-bold text-gray-900">Blog</Link>
          <Link href="/posts" class="text-gray-600 hover:text-gray-900">記事一覧</Link>
          <Link href="/admin/posts" class="text-gray-600 hover:text-gray-900">管理</Link>
        </nav>
      </header>

      {show && flash && (
        <div class="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg">
          <span>{flash}</span>
          <button onClick={() => setShow(false)} class="text-white/80 hover:text-white">×</button>
        </div>
      )}

      <main class="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
```

### 仕組み
リダイレクト前に `setFlash` で Cookie をセット → クライアントが 303 を辿って `/admin/posts` を GET → その時に flash ミドルウェアが Cookie を読んで `flash` prop に載せ、Cookie を消す。だから**一度だけ**表示される。Workers にセッションが無いので Cookie を「一回限りの受け渡し」に使うのが肝。

---

## Phase 8-b：SSR（Worker 内で in-process）

`@ts-76/inertia-hono-jsx` の `createInertiaApp` は **SSR オーバーロード**を持ち、`render`（`hono/jsx/dom/server` の `renderToString`）を渡すと `{ head, body }` を返す。`body` には「page-object の script」と「サーバ描画済みの `<div id="app">...</div>`」が両方入っている。`RootView` 型は `(page, c) => string | Promise<string>` で**非同期対応**なので、サイドカー無しで Worker 内 SSR が可能。

変更は実質2ファイル。**クライアント（`client.tsx`）は変更不要**（既存の `render(<App/>, el)` が `data-server-rendered` をハイドレート）。

**`src/ssr.tsx`**（新規）

```tsx
import { createInertiaApp } from '@ts-76/inertia-hono-jsx'
import { renderToString } from 'hono/jsx/dom/server'
import type { PageObject } from '@hono/inertia'

export async function render(page: PageObject) {
  return createInertiaApp({
    page: page as any,
    resolve: async (name: string) => {
      const pages = import.meta.glob('./pages/**/*.tsx')
      const mod = (await pages[`./pages/${name}.tsx`]()) as { default: unknown }
      return mod.default
    },
    render: renderToString,
  })
}
```

**`src/root-view.ts`**（非同期 SSR 版・最終形）

```ts
import type { RootView } from '@hono/inertia'
import { render } from './ssr'

export const rootView: RootView = async (page) => {
  const { head, body } = await render(page)
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${head.join('\n')}
    <script type="module" src="/src/client.tsx"></script>
  </head>
  <body>
    ${body}
  </body>
</html>`
}
```

### 動作の流れ
- **初回（フルページ）リクエスト**：`@hono/inertia` が非 Inertia リクエストと判定 → 非同期 rootView → Worker 内で `renderToString` して HTML に本文を埋め込み → ブラウザは最初から中身入りの HTML を受け取る。
- **クライアント起動**：`data-page` を読んでコンポーネントを解決し、SSR 済み DOM をハイドレート。
- **以降の `<Link>` 遷移**：これまで通り XHR + JSON（クライアント描画）。SSR は初回だけ。

### 確認・注意
- `/posts` の「ページのソースを表示」で `<div id="app">` 内に一覧 HTML がサーバ描画済みで入っている（CSR の頃は空）。
- dev では CSS が `client.tsx` 経由（JS 注入）なので SSR 直後の JS 読み込み前は未スタイル（FOUC）。本番では `<head>` にビルド済み CSS を `<link>` する。
- 初回に一瞬チラついたら `render` がハイドレートでなく再描画している可能性。機能的には動く（SSR 表示 → クライアント再描画）。
- 各ページで `<Head title="...">`（`@ts-76/inertia-hono-jsx` がエクスポート）を使うと SSR の `head` に反映される。

---

## ハマりどころ集（実際に遭遇した解決）

| 症状 | 原因 | 解決 |
|---|---|---|
| `No migrations present at .../migrations` | `migrations apply` の DB 名引数が `database_name` と不一致 → デフォルトフォルダにフォールバック | コマンドの DB 名を `wrangler.jsonc` の `database_name` と一致させる |
| `migrations_dir` が効かない | `d1_databases` オブジェクトの外に書いた | 各バインディングオブジェクト**の中**に書く |
| migrations apply で OAuth が開く | `--local` を付け忘れた | ローカル操作には常に `--local` を付ける |
| バリデーションで `expected string, received undefined` | `zValidator('form')` だが Inertia は JSON 送信 | `zValidator('json')` + `c.req.valid('json')` にする |
| `@cloudflare/vitest-pool-workers` が重い | workerd ダウンロード + migrations recipe 配線 | テストは libsql インメモリ + DI（`c.get('db')`）に切り替え |
| `better-sqlite3` がインストールできない | ネイティブビルド（node-gyp）が新しい Node でコンパイルに落ちる | プレビルド配布の `@libsql/client` を使う |
| `className` が効かない | hono/jsx は `class` | `class` を使う |

---

## 設計判断まとめ

- **ローカル限定 D1**：`wrangler d1 create`（リモート操作）を避け、バインディング手書き + `--local`。公開時のみ `d1 create` → `database_id` 差し替え → `--remote`。
- **マイグレーション**：Drizzle で生成 → wrangler で適用（`drizzle-kit migrate` のローカルパス脆さを回避）。
- **バリデーションエラー**：`@hono/inertia` に flash が無いので「同じフォームを `errors` 付きで再レンダリング」。Cookie flash を拡張すれば「303 でフォームに戻す」正攻法にもできる。
- **DI（`c.get('db')`）**：本番 D1・テスト libsql の二刀流を1つの seam で成立させる。`Db = BaseSQLiteDatabase<'async', any, typeof schema>` が両ドライバの共通型。
- **テスト DB**：libsql `:memory:`。ネイティブビルド不要・非同期で D1 に近い・テストごとに独立。
- **SSR**：`createInertiaApp` の SSR モード + 非同期 rootView で Worker 内 in-process 実行（サイドカー不要）。

## 発展課題（未実施）

- **本番デプロイ**：`wrangler d1 create` → `database_id` 差し替え → `wrangler d1 migrations apply blog --remote` → `vite build` → `wrangler deploy`。rootView の `/src/client.tsx` をビルド済みアセット（ハッシュ付き）に解決させる配線、`<head>` への CSS link が必要。
- **エラー flash**：Cookie flash でバリデーションエラーを redirect-back し、URL を綺麗に保つ。
- **404 ページ**：`c.render('Errors/NotFound', {})`。
- **per-page タイトル**：各ページで `<Head title="...">`。
