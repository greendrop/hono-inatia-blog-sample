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
| テスト | Vitest + libsql インメモリ + Fishery / faker |
| パッケージ管理 | pnpm |

### なぜ hono/jsx 版か

`@hono/inertia`（サーバ側）はクライアントフレームワーク非依存で、`c.render('posts/Index', { posts })` で Inertia プロトコルを話す。クライアントだけ差し替え可能なので、React の `@inertiajs/react` の代わりに **`@ts-76/inertia-hono-jsx`** を使うと hono/jsx で書ける。

Cloudflare Workers との相性が良い理由：React 版は Edge 側にも `react-dom/server` が同梱され worker bundle が肥大化するが、hono/jsx 版にはそれが無い（worker bundle が大幅に小さい）。Edge に載せる前提なら hono/jsx は妥当な選択。

参考実装：`yusukebe/hono-inertia-example`（hono/jsx + Inertia + Cloudflare Workers）はページ構成が本ブログとほぼ 1:1。手元に開いておくと「答え合わせ」に便利。

---

## 完成後のディレクトリ構成

```
src/
  index.tsx               # Worker エントリ（server を再エクスポート）
  server.tsx              # createApp: ミドルウェア + feature ルータの mount
  client.tsx              # クライアント起動（createInertiaApp）
  style.css               # Tailwind CSS
  db/
    index.ts              # Db 型 + createDb（D1）
    schema.ts             # posts テーブル定義
  shared/
    env.ts                # AppEnv 型（Bindings + Variables.db）
    flash.ts              # Cookie ベースのフラッシュメッセージ
    components/
      Layout.tsx          # 共通レイアウト（ナビ + トースト）
    inertia/
      resolve.ts          # 共有ページリゾルバ（glob → レンダ名マップ）
      ssr.tsx             # SSR 描画エントリ
      root-view.ts        # 初期 HTML シェル（SSR 対応・非同期）
  features/
    home/
      routes.tsx          # GET /
      pages/
        Home.tsx          # レンダ名: "home/Home"
    posts/                # 公開（読み取りのみ）
      routes.tsx          # GET /posts, /posts/:id
      service.ts          # listPosts / getPost
      repository.ts       # findAll / findById
      pages/
        Index.tsx         # レンダ名: "posts/Index"
        Show.tsx          # レンダ名: "posts/Show"
    admin/
      posts/              # 管理（CRUD）
        routes.tsx        # GET|POST /admin/posts, PUT|DELETE /admin/posts/:id
        service.ts        # listPosts / getPost / createPost / updatePost / deletePost
        repository.ts     # findAll / findById / create / update / remove
        schema.ts         # zod postSchema + PostInput 型 + toErrors
        components/
          PostForm.tsx    # 新規・編集共通フォーム
        pages/
          Index.tsx       # レンダ名: "admin/posts/Index"
          New.tsx         # レンダ名: "admin/posts/New"
          Edit.tsx        # レンダ名: "admin/posts/Edit"
    errors/               # エラーページ（400/403/404/500 + 共通）
      pages/
        NotFound.tsx      # レンダ名: "errors/NotFound"
        BadRequest.tsx    # レンダ名: "errors/BadRequest"
        Forbidden.tsx     # レンダ名: "errors/Forbidden"
        ServerError.tsx   # レンダ名: "errors/ServerError"
        Error.tsx         # レンダ名: "errors/Error"（共通フォールバック）
atlas/migrations/         # Atlas が生成（タイムスタンプ命名）
atlas.hcl                 # Atlas 設定
seeds/dev.sql
test/
  db.ts                   # インメモリ libsql ヘルパー（createTestDb）
  helpers.ts              # Inertia レスポンス用ヘッダ / 型
  factories/
    post.ts               # Fishery ファクトリ（postFactory）
  features/               # src/features をミラー
    home/routes.test.ts
    posts/routes.test.ts, repository.test.ts
    admin/posts/routes.test.ts, repository.test.ts, schema.test.ts
    errors/routes.test.ts
wrangler.jsonc
drizzle.config.ts
vitest.config.ts
```

### feature ベース構成のポイント

- `features/<feature>/` に routes / service / repository / schema / components / pages が揃う（データ層が必要な feature のみ）
- Inertia のページ解決は `shared/inertia/resolve.ts` の `import.meta.glob("/src/features/**/pages/**/*.tsx")` が自動変換する（`features/posts/pages/Index.tsx` → レンダ名 `"posts/Index"`）
- `@/` パスエイリアス（`@/* → src/*`）を全体で使用
- DB（drizzle テーブル定義）は `db/` 共有層に残し、`drizzle.config.ts` / `atlas.hcl` / `test/db.ts` の参照は変更なし

---

## Phase 1：土台（Hono + Vite + Cloudflare Workers）

Inertia はクライアントビルドのために Vite が必須。`@cloudflare/vite-plugin` は Worker をローカルでも workerd 上で動かし、本番挙動に近づけてくれる。Vite を最初から噛ませる。

```bash
pnpm create hono@latest hono-inatia-blog-sample   # テンプレートは cloudflare-workers を選択
cd hono-inatia-blog-sample
pnpm add -D vite @cloudflare/vite-plugin wrangler
```

**`vite.config.ts`**

```ts
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [cloudflare()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

> `@/` エイリアスを最初から仕込んでおく（全ての `src/` 配下ファイルで使用）。

**`tsconfig.json`**

```jsonc
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ESNext"],
    "types": ["vite/client"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**`wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hono-inatia-blog-sample",
  "compatibility_date": "2025-08-03",
  "main": "./src/index.tsx"
}
```

**`src/index.tsx`**

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

**`src/shared/inertia/root-view.ts`（初期HTMLシェル / CSR版）**

> SSR を入れる Phase 8-b で非同期版に差し替える。まずは CSR 版。

```ts
import { serializePage, type RootView } from '@hono/inertia'

export const rootView: RootView = (page) => `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script type="module" src="/src/client.tsx"></script>
  </head>
  <body>
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`
```

`data-page="app"` の中に page object（コンポーネント名・props・URL・version）が JSON で埋まり、`#app` がマウント先。`createInertiaApp` の `id` デフォルトが `'app'` なので対応する。`serializePage` は `/` → `\/` のエスケープを行うので props 内に `</script>` があってもタグを抜け出せない。

**`src/shared/inertia/resolve.ts`（ページリゾルバ）**

```ts
const modules = import.meta.glob('/src/features/**/pages/**/*.tsx')

// パス → レンダ名 に変換したマップを事前構築
//   /src/features/admin/posts/pages/Edit.tsx → admin/posts/Edit
//   /src/features/home/pages/Home.tsx        → home/Home
const pages: Record<string, () => Promise<{ default: unknown }>> = {}
for (const [path, loader] of Object.entries(modules)) {
  const name = path
    .replace(/^\/src\/features\//, '')   // → admin/posts/pages/Edit.tsx
    .replace(/\/pages\//, '/')           // → admin/posts/Edit.tsx
    .replace(/\.tsx$/, '')               // → admin/posts/Edit
  pages[name] = loader as () => Promise<{ default: unknown }>
}

export async function resolvePage(name: string): Promise<unknown> {
  const loader = pages[name]
  if (!loader) throw new Error(`Page not found: ${name}`)
  return (await loader()).default
}
```

`import.meta.glob` でビルド時に全ページを収集し、`features/posts/pages/Index.tsx` → レンダ名 `"posts/Index"` のように変換する。ページを追加しても `resolve.ts` は変更不要。

**`src/client.tsx`**

```tsx
import { createInertiaApp } from '@ts-76/inertia-hono-jsx'
import { render } from 'hono/jsx/dom'
import { resolvePage } from '@/shared/inertia/resolve'

createInertiaApp({
  resolve: async (name) => resolvePage(name),
  setup({ el, App, props }) {
    render(<App {...props} />, el)
  },
})
```

> CSS インポートは Phase 3 で追加する。

React 版との違いは2点だけ：`@inertiajs/react` → `@ts-76/inertia-hono-jsx`、`createRoot(el).render(...)` → `hono/jsx/dom` の `render(<App/>, el)`。

**`src/features/home/routes.tsx`**

```tsx
import { Hono } from 'hono'
import type { AppEnv } from '@/shared/env'

const homeRoutes = new Hono<AppEnv>()

homeRoutes.get('/', (c) => c.render('home/Home', { message: 'Hono x Inertia' }))

export default homeRoutes
```

**`src/features/home/pages/Home.tsx`**

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'
import Layout from '@/shared/components/Layout'

export default function Home({ message }: { message: string }) {
  return (
    <Layout>
      <h1 class="text-2xl font-bold text-gray-900">{message}</h1>
      <p class="mt-2 text-gray-600">Hono × Inertia × hono/jsx</p>
    </Layout>
  )
}
```

**`src/shared/env.ts`**

```ts
import type { Db } from '@/db'

export type AppEnv = {
  Bindings: CloudflareBindings
  Variables: { db: Db }
}
```

**`src/server.tsx`（最小 / Phase 2 時点）**

```tsx
import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { createDb, type Db } from '@/db'
import { rootView } from '@/shared/inertia/root-view'
import type { AppEnv } from '@/shared/env'
import homeRoutes from '@/features/home/routes'

// dbProvider 省略時は D1 から。テストではインメモリ libsql を渡す。
export function createApp(dbProvider?: (c: any) => Db) {
  const app = new Hono<AppEnv>()

  app.use(inertia({ version: '1', rootView }))
  app.use(async (c, next) => {
    c.set('db', dbProvider ? dbProvider(c) : createDb(c.env.DB))
    await next()
  })

  app.route('/', homeRoutes)

  return app
}

export default createApp()
```

> `flash()` は Phase 8-a で追加する。

**`src/index.tsx`** を差し替え（server を再エクスポート）

```ts
export { default } from './server'
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
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [cloudflare(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

**`src/style.css`**

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";
```

**`src/client.tsx`** の先頭で CSS を読み込む

```tsx
import '@/style.css'
// 既存の createInertiaApp(...) はそのまま
```

**`src/shared/components/Layout.tsx`**

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

マイグレーションは **「Atlas で生成 → wrangler で適用」** 方式。Atlas はタイムスタンプ採番（`20260625..._name.sql`）を使うため、複数人で並行作業しても連番が衝突しない。Atlas が D1 へ直接接続することはなく、wrangler が適用を担うのでローカル完結（Cloudflare アカウント不要）を維持できる。

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

**`drizzle.config.ts`**（`export` コマンド用。`out` は不要）

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
})
```

**Atlas のインストール**（Go バイナリ。npm 依存に含まれないため別途インストール）

```bash
# mise（推奨）
mise use atlas

# macOS（Homebrew）
brew install ariga/tap/atlas

# Linux / CI
curl -sSf https://atlasgo.sh | sh
```

> `diff`/`apply`/`hash` 等の日常操作は無料・オフライン・アカウント不要。`migrate lint`（破壊的変更チェック）は無料の `atlas login` でロック解除できるが、本プロジェクトでは使わず SQL 目視レビューで代替する（詳細: [docs/migrations-atlas.md](./migrations-atlas.md)）。

**`atlas.hcl`**（プロジェクトルートに配置）

```hcl
data "external_schema" "drizzle" {
  program = ["pnpm", "exec", "drizzle-kit", "export"]
}

env "local" {
  dev = "sqlite://file?mode=memory&_fk=1"
  schema {
    src = data.external_schema.drizzle.url
  }
  migration {
    dir = "file://atlas/migrations"
  }
}
```

**`wrangler.jsonc`** に D1 バインディング追加（ローカル placeholder）

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hono-inatia-blog-sample",
  "compatibility_date": "2025-08-03",
  "main": "./src/index.tsx",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "hono-inatia-blog-sample",
      "database_id": "local-blog-placeholder",
      "migrations_dir": "atlas/migrations"
    }
  ]
}
```

> `migrations_dir` を Atlas の出力先（`atlas/migrations`）と一致させ、**`d1_databases` の各オブジェクトの中**に置くこと（配列の外やトップレベルだと無視される）。`database_id` はローカルなら任意の文字列でよい。

**マイグレーション生成 → ローカル適用**

```bash
atlas migrate diff init --env local     # atlas/migrations/<ts>_init.sql + atlas.sum を生成
pnpm exec wrangler d1 migrations apply hono-inatia-blog-sample --local
```

> ⚠️ `--local` を**必ず**付ける。付けないとリモート扱いになり OAuth ログインが開く。`migrations apply` も `execute` も常に `--local` を付ける癖を。
> ⚠️ コマンドの DB 名（`hono-inatia-blog-sample`）は `wrangler.jsonc` の `database_name` と**一致**させること。不一致だと wrangler は設定を見つけられずデフォルトの `migrations` フォルダにフォールバックし「No migrations present」エラーになる。

**スキーマ変更時のフロー（以降）**

```bash
# 1. src/db/schema.ts を編集
# 2. 差分 migration を生成（タイムスタンプ採番）
atlas migrate diff <名前> --env local   # 例: atlas migrate diff add_published
# 3. 生成 SQL を目視確認し、ローカルに適用
pnpm exec wrangler d1 migrations apply hono-inatia-blog-sample --local
# 4. schema.ts と atlas/migrations/ を両方コミット
```

**seed**：`seeds/dev.sql`

```sql
INSERT INTO posts (title, body) VALUES
  ('はじめての投稿', 'Hono と Inertia で作る簡易ブログです。'),
  ('2本目の記事', 'Drizzle 経由で D1 にアクセスしています。');
```

```bash
pnpm exec wrangler d1 execute hono-inatia-blog-sample --local --file ./seeds/dev.sql
pnpm exec wrangler d1 execute hono-inatia-blog-sample --local --command "SELECT id, title, created_at FROM posts"
```

**型生成**

```bash
pnpm exec wrangler types   # worker-configuration.d.ts に DB: D1Database を含む型が生成される
```

生成ファイルのインターフェイス名（`CloudflareBindings` か `Env`）を確認し、以降の `new Hono<AppEnv>()` に合わせる。

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

`src/server.tsx` に直接ルートを書くのではなく、**feature ディレクトリ**に分割して `app.route()` でマウントする。

**`src/features/posts/repository.ts`**

```ts
import type { Db } from '@/db'
import { posts } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

export const findAll = (db: Db) =>
  db.select().from(posts).orderBy(desc(posts.createdAt))

export const findById = (db: Db, id: number) =>
  db.select().from(posts).where(eq(posts.id, id)).get()
```

**`src/features/posts/service.ts`**

```ts
import type { Db } from '@/db'
import * as repository from './repository'

export const listPosts = (db: Db) => repository.findAll(db)

export const getPost = (db: Db, id: number) => repository.findById(db, id)
```

**`src/features/posts/routes.tsx`**

```tsx
import { Hono } from 'hono'
import type { AppEnv } from '@/shared/env'
import { listPosts, getPost } from './service'

const postsRoutes = new Hono<AppEnv>()

postsRoutes
  .get('/', async (c) => {
    const list = await listPosts(c.get('db'))
    return c.render('posts/Index', { posts: list })
  })
  .get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const post = await getPost(c.get('db'), id)
    if (!post) return c.notFound()
    return c.render('posts/Show', { post })
  })

export default postsRoutes
```

**`src/features/posts/pages/Index.tsx`**

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'
import Layout from '@/shared/components/Layout'
import type { Post } from '@/db/schema'

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

**`src/features/posts/pages/Show.tsx`**

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'
import Layout from '@/shared/components/Layout'
import type { Post } from '@/db/schema'

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

**`src/server.tsx`** に posts ルートを追加

```tsx
import postsRoutes from '@/features/posts/routes'

// ...
app
  .route('/', homeRoutes)
  .route('/posts', postsRoutes)
```

---

## Phase 6：管理画面 CRUD

`app.route('/admin/posts', adminPostsRoutes)` でリソースを分離（Rails の `resources` 相当）。zod バリデーション・ページスキーマ・repository を `admin/posts/` feature に閉じ込める。

```bash
pnpm add @hono/zod-validator zod
```

### バリデーションエラーの扱い（重要）
Inertia は 422 を返さず、`page.props.errors` の有無でバリデーションエラーを判定する。`@hono/inertia` にはセッション flash も共有 props ヘルパーも無いが、後述の **Phase 10（エラー flash）** で Cookie flash を拡張して `errors` / `old` を運ぶことで、Laravel 流の「303 redirect-back + withErrors + withInput」を実現する。このフェーズではまず CRUD の骨格を実装し、バリデーションエラーの扱いは Phase 10 で仕上げる。

### Content-Type の注意（重要）
Inertia の `useForm.post()` は、ファイルが無ければボディを **JSON**（`Content-Type: application/json`）で送る。よって `zValidator` は **`'json'`** を使う（`'form'` だと form-urlencoded を読むので値が `undefined` になる）。

**`src/features/admin/posts/schema.ts`**（バリデーション + エラー変換）

```ts
import { z } from 'zod'

export const postSchema = z.object({
  title: z
    .string()
    .min(1, 'タイトルは必須です')
    .max(120, 'タイトルは120文字以内です'),
  body: z.string().min(1, '本文は必須です'),
})

export type PostInput = z.infer<typeof postSchema>

// ZodError → Inertia の errors prop ( { field: message } )
export const toErrors = (err: z.ZodError) => {
  const errors: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? 'form')
    errors[key] ??= issue.message
  }
  return errors
}
```

**`src/features/admin/posts/repository.ts`**

```ts
import type { Db } from '@/db'
import { posts } from '@/db/schema'
import { sql, desc, eq } from 'drizzle-orm'
import type { PostInput } from './schema'

export const findAll = (db: Db) =>
  db.select().from(posts).orderBy(desc(posts.createdAt))

export const findById = (db: Db, id: number) =>
  db.select().from(posts).where(eq(posts.id, id)).get()

export const create = (db: Db, input: PostInput) =>
  db.insert(posts).values(input)

export const update = (db: Db, id: number, input: PostInput) =>
  db
    .update(posts)
    .set({ ...input, updatedAt: sql`(current_timestamp)` })
    .where(eq(posts.id, id))

export const remove = (db: Db, id: number) =>
  db.delete(posts).where(eq(posts.id, id))
```

**`src/features/admin/posts/service.ts`**

```ts
import type { Db } from '@/db'
import type { PostInput } from './schema'
import * as repository from './repository'

export const listPosts = (db: Db) => repository.findAll(db)
export const getPost = (db: Db, id: number) => repository.findById(db, id)
export const createPost = (db: Db, input: PostInput) => repository.create(db, input)
export const updatePost = (db: Db, id: number, input: PostInput) => repository.update(db, id, input)
export const deletePost = (db: Db, id: number) => repository.remove(db, id)
```

**`src/features/admin/posts/routes.tsx`**（最終形：`c.get('db')` + `setFlash` + `setErrors`）

```tsx
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '@/shared/env'
import { setFlash, setErrors } from '@/shared/flash'
import { postSchema, toErrors } from './schema'
import { listPosts, getPost, createPost, updatePost, deletePost } from './service'

const adminPostsRoutes = new Hono<AppEnv>()

adminPostsRoutes
  // 管理一覧
  .get('/', async (c) => {
    const list = await listPosts(c.get('db'))
    return c.render('admin/posts/Index', { posts: list })
  })
  // 新規フォーム
  .get('/new', (c) => c.render('admin/posts/New', {}))
  // 作成
  .post(
    '/',
    zValidator('json', postSchema, (result, c) => {
      if (!result.success) {
        setErrors(c, toErrors(result.error), result.data as Record<string, unknown>)
        return c.redirect('/admin/posts/new', 303)
      }
    }),
    async (c) => {
      await createPost(c.get('db'), c.req.valid('json'))
      setFlash(c, '投稿を作成しました')
      return c.redirect('/admin/posts', 303)
    }
  )
  // 編集フォーム
  .get('/:id/edit', async (c) => {
    const id = Number(c.req.param('id'))
    const post = await getPost(c.get('db'), id)
    if (!post) return c.notFound()
    return c.render('admin/posts/Edit', { post })
  })
  // 更新（失敗時は errors/old を Cookie flash して redirect-back。post は GET /:id/edit が再取得）
  .put(
    '/:id',
    zValidator('json', postSchema, (result, c) => {
      if (!result.success) {
        const id = Number(c.req.param('id'))
        setErrors(c, toErrors(result.error), result.data as Record<string, unknown>)
        return c.redirect(`/admin/posts/${id}/edit`, 303)
      }
    }),
    async (c) => {
      const id = Number(c.req.param('id'))
      await updatePost(c.get('db'), id, c.req.valid('json'))
      setFlash(c, '投稿を更新しました')
      return c.redirect('/admin/posts', 303)
    }
  )
  // 削除
  .delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    await deletePost(c.get('db'), id)
    setFlash(c, '投稿を削除しました')
    return c.redirect('/admin/posts', 303)
  })

export default adminPostsRoutes
```

> 成功時は **303** リダイレクト（Inertia は PUT/DELETE のリダイレクトに 303 を要求。302 だと一部ブラウザでメソッドが維持される）。

**`src/features/admin/posts/components/PostForm.tsx`**（新規・編集共通）

```tsx
import { useForm, usePage } from '@ts-76/inertia-hono-jsx'

type Props = {
  action: string
  method: 'post' | 'put'
  initial?: { title: string; body: string }
  submitLabel: string
}

export default function PostForm({ action, method, initial, submitLabel }: Props) {
  const page = usePage()
  const old = (page.props as { old?: { title?: string; body?: string } }).old

  const form = useForm({
    title: old?.title ?? initial?.title ?? '',
    body: old?.body ?? initial?.body ?? '',
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

`useForm` は Inertia 標準 API（`data` / `errors` / `processing` / `setData` / `post`/`put`/`delete`）。`form.errors` はサーバが返した `props.errors` を自動で拾う。`old` は Cookie flash から来る入力値の復元用（Phase 10 で整合）。優先順は **old → initial → 空文字**。

**管理ページ3枚**

```tsx
// src/features/admin/posts/pages/Index.tsx
import { Link, router } from '@ts-76/inertia-hono-jsx'
import Layout from '@/shared/components/Layout'
import type { Post } from '@/db/schema'

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
// src/features/admin/posts/pages/New.tsx
import Layout from '@/shared/components/Layout'
import PostForm from '@/features/admin/posts/components/PostForm'

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
// src/features/admin/posts/pages/Edit.tsx
import Layout from '@/shared/components/Layout'
import PostForm from '@/features/admin/posts/components/PostForm'
import type { Post } from '@/db/schema'

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

## Phase 7：テスト（libsql インメモリ + Vitest + Fishery）

「D1 に依存しているが、テストまで D1 / workerd に依存したくない」方針。ルートを `c.env.DB` 直参照から **`c.get('db')`（DI）** に寄せ、本番は D1、テストは **libsql のインメモリ** を注入する。

> better-sqlite3 ではなく **libsql** を採用：ネイティブビルド不要（プレビルド配布）で、D1 と同じ**非同期**なので `Db` 型の共通化が素直。インメモリ（`:memory:`）はテストごとに新品 DB が生まれ、各テストが完全に独立する。

```bash
pnpm add -D vitest @libsql/client fishery @faker-js/faker
```

### DI 化（Phase 5/6 のリファクタ）

**`src/server.tsx`**（最終形）

```tsx
import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { createDb, type Db } from '@/db'
import { flash } from '@/shared/flash'
import { rootView } from '@/shared/inertia/root-view'
import type { AppEnv } from '@/shared/env'
import homeRoutes from '@/features/home/routes'
import postsRoutes from '@/features/posts/routes'
import adminPostsRoutes from '@/features/admin/posts/routes'

// dbProvider 省略時は D1 から。テストではインメモリ libsql を渡す。
export function createApp(dbProvider?: (c: any) => Db) {
  const app = new Hono<AppEnv>()

  app.use(inertia({ version: '1', rootView }))
  app.use(flash())
  app.use(async (c, next) => {
    c.set('db', dbProvider ? dbProvider(c) : createDb(c.env.DB))
    await next()
  })

  app
    .route('/', homeRoutes)
    .route('/posts', postsRoutes)
    .route('/admin/posts', adminPostsRoutes)

  return app
}

export default createApp()
```

各ハンドラの `createDb(c.env.DB)` を **`c.get('db')`** に置換（admin 側も同様、Hono ジェネリクスに `AppEnv` を使用）。`app.use` は `.route()` より前に置くこと（親のミドルウェアがサブアプリにも適用される）。

### テスト

**`test/db.ts`**

```ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from '../src/db/schema'
import type { Db } from '../src/db'

const MIGRATIONS_DIR = new URL('../atlas/migrations', import.meta.url).pathname

export async function createTestDb(): Promise<Db> {
  const client = createClient({ url: ':memory:' }) // 新品のインメモリ
  // Atlas が生成した SQL を名前順（タイムスタンプ昇順）に流す
  for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await client.executeMultiple(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  }
  return drizzle(client, { schema })
}
```

> `drizzle/migrations` の `_journal.json` や `migrate()` に依存せず、Atlas が生成した `.sql` を `executeMultiple` で直接流す。Atlas バイナリを CI に入れずに済み、本番と同じマイグレーションを参照する点は変わらない。

**`test/helpers.ts`**

```ts
/**
 * GET リクエストで Inertia JSON レスポンスを得るためのヘッダ。
 * POST/PUT の JSON body を伴うリクエストにも Content-Type を加えて使用する。
 */
export const inertiaHeaders = {
  'Content-Type': 'application/json',
  'X-Inertia': 'true',
  'X-Inertia-Version': '1',
}

/** Inertia JSON レスポンスの型 */
export type InertiaPage<P = Record<string, unknown>> = {
  component: string
  props: P & { flash?: string | null }
  url: string
  version: string
}
```

**`test/factories/post.ts`**（Fishery ファクトリ）

```ts
import { Factory } from 'fishery'
import { faker } from '@faker-js/faker'
import { posts } from '../../src/db/schema'
import type { Db } from '../../src/db'
import type { NewPost, Post } from '../../src/db/schema'

/**
 * posts ファクトリ。
 * db はテストごとに作り直されるため、引数で受け取る。
 *
 * @example
 * const factory = postFactory(db)
 * const post  = await factory.create()             // 1 件挿入
 * const list  = await factory.createList(3)        // 3 件挿入
 * const attrs = factory.build({ title: '上書き' }) // 未挿入の属性オブジェクト
 */
export const postFactory = (db: Db) =>
  Factory.define<NewPost, unknown, Post>(({ sequence, onCreate }) => {
    onCreate(async (attrs) => {
      const [row] = await db.insert(posts).values(attrs).returning()
      return row
    })

    return {
      title: `投稿${sequence}`,
      body: faker.lorem.paragraph(),
    }
  })
```

FactoryBot との対応：

| Fishery | FactoryBot 相当 |
|---|---|
| `factory.create()` | `FactoryBot.create(:post)` |
| `factory.create({ title: '...' })` | `FactoryBot.create(:post, title: '...')` |
| `factory.createList(3)` | `FactoryBot.create_list(:post, 3)` |
| `factory.build()` | `FactoryBot.build(:post)` |
| `sequence` | `sequence(:title) { |n| "投稿#{n}" }` |

`.returning()` を使って挿入と同時に `id` / `createdAt` を含む `Post` 型を取得する（`seedPost` 時代の「insert → ORDER BY id DESC で再取得」回避策は不要）。

**テスト構成（`test/features/` が `src/features/` をミラー）**

`test/features/admin/posts/repository.test.ts`（抜粋）

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../../../db'
import type { Db } from '../../../../src/db'
import { postFactory } from '../../../factories/post'
import { findAll, findById, create, update, remove }
  from '../../../../src/features/admin/posts/repository'

let db: Db
let factory: ReturnType<typeof postFactory>

beforeEach(async () => {
  db = await createTestDb()
  factory = postFactory(db)   // ← db ごとにファクトリを生成（sequence も 1 に戻る）
})

describe('findById', () => {
  it('存在する id の投稿を返す', async () => {
    const seeded = await factory.create({ title: '取得対象' })

    const result = await findById(db, seeded.id)
    expect(result?.title).toBe('取得対象')
  })
})

describe('update', () => {
  it('他の投稿には影響しない', async () => {
    const post1 = await factory.create({ title: '投稿1' })
    const post2 = await factory.create({ title: '投稿2' })

    await update(db, post1.id, { title: '投稿1更新', body: '本文' })

    const unchanged = await findById(db, post2.id)
    expect(unchanged?.title).toBe('投稿2')
  })
})
```

`test/features/admin/posts/routes.test.ts`（抜粋）

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createApp } from '../../../../src/server'
import { createTestDb } from '../../../db'
import type { Db } from '../../../../src/db'
import type { Post } from '../../../../src/db/schema'
import { inertiaHeaders, type InertiaPage } from '../../../helpers'
import { postFactory } from '../../../factories/post'

let db: Db
let app: ReturnType<typeof createApp>
let factory: ReturnType<typeof postFactory>

beforeEach(async () => {
  db = await createTestDb()
  app = createApp(() => db)
  factory = postFactory(db)
})

describe('GET /admin/posts', () => {
  it('props.posts に全件が含まれる', async () => {
    await factory.createList(2)   // 2 件まとめて作成

    const res = await app.request('/admin/posts', { headers: inertiaHeaders })
    const page = (await res.json()) as InertiaPage<{ posts: Post[] }>
    expect(page.props.posts).toHaveLength(2)
  })
})

describe('PUT /admin/posts/:id', () => {
  it('バリデーション失敗で props.errors あり、DB は変わらない', async () => {
    const post = await factory.create({ title: '変更前' })

    const res = await app.request(`/admin/posts/${post.id}`, {
      method: 'PUT',
      headers: inertiaHeaders,
      body: JSON.stringify({ title: '', body: '本文' }),
    })
    const page = (await res.json()) as InertiaPage<{ post?: Post; errors?: Record<string, string> }>
    expect(page.props.errors?.title).toBeTruthy()
    expect(page.props.post?.title).toBe('変更前')
  })
})
```

**`vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // サーバ側モジュールは .tsx 拡張子だが JSX 構文は含まないので念のため設定
  esbuild: { jsx: 'automatic', jsxImportSource: 'hono/jsx' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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

**`src/shared/flash.ts`**

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
  // c.render をラップして全ページの props に flash を足す
  ;(c as any).render = (component: any, props?: any) =>
    render(component, { ...(props ?? {}), flash: message })

  await next()
}
```

`createApp` 内で `inertia()` の**後**（c.render が用意された後）に `app.use(flash())` を差し込む（Phase 7 の `createApp` に記載済み）。各 mutation のリダイレクト直前で `setFlash(c, '...')` を呼ぶ（Phase 6 の admin/posts/routes.tsx に記載済み）。

**`src/shared/components/Layout.tsx`**（flash トースト対応版・最終形）

```tsx
import { useEffect, useState } from 'hono/jsx'
import { Link, usePage } from '@ts-76/inertia-hono-jsx'

export default function Layout({ children }: { children: unknown }) {
  const page = usePage()
  const flash = (page.props as { flash?: string | null }).flash ?? null
  const [show, setShow] = useState(false)

  // flash が来たら表示 → 3秒で消す
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

      {/* トースト */}
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

**`src/shared/inertia/ssr.tsx`**（新規）

```tsx
import { createInertiaApp } from '@ts-76/inertia-hono-jsx'
import { renderToString } from 'hono/jsx/dom/server'
import type { PageObject } from '@hono/inertia'
import { resolvePage } from './resolve'

export async function render(page: PageObject) {
  return createInertiaApp({
    page: page as any,
    resolve: async (name: string) => resolvePage(name),
    render: renderToString, // hono/jsx/dom/server の renderToString
  })
}
```

**`src/shared/inertia/root-view.ts`**（非同期 SSR 版・最終形）

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

SSR には `vite-ssr-components` プラグインが必要。**`vite.config.ts`**（最終形）

```ts
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import ssrPlugin from 'vite-ssr-components/plugin'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [cloudflare(), ssrPlugin(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

```bash
pnpm add -D vite-ssr-components
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

## Phase 9：エラーページ

`@hono/inertia` の `c.render` は内部で `c.json` / `c.html` を呼ぶが、ステータスは**引数省略時に `c.status()` で設定済みの値**を使う。つまり `c.render` を呼ぶ前に `c.status(404)` などを差し込めば正しいコードで返せる。`inertia` ミドルウェアは `app.use` で全パスに適用されるため、`notFound` / `onError` ハンドラ内でも `c.render` が使える。

設計方針：**400 / 403 / 404 / 500 は専用ページ、それ以外（405 / 429 / 503 等）は `status` プロップを受け取る共通フォールバックページ**。`HTTPException` を投げれば任意のステータスが伝わり、それ以外の例外はすべて 500 として扱う。

**`src/server.tsx`**（最終形：`notFound` / `onError` 追加）

```ts
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { inertia } from '@hono/inertia'
import { createDb, type Db } from './db'
import { flash } from '@/shared/flash'
import { rootView } from '@/shared/inertia/root-view'
import type { AppEnv } from '@/shared/env'
import homeRoutes from '@/features/home/routes'
import postsRoutes from '@/features/posts/routes'
import adminPostsRoutes from '@/features/admin/posts/routes'

export function createApp(dbProvider?: (c: any) => Db) {
  const app = new Hono<AppEnv>()

  app.use(inertia({ version: '1', rootView }))
  app.use(flash())
  app.use(async (c, next) => {
    c.set('db', dbProvider ? dbProvider(c) : createDb(c.env.DB))
    await next()
  })

  app
    .route('/', homeRoutes)
    .route('/posts', postsRoutes)
    .route('/admin/posts', adminPostsRoutes)

  app.notFound((c) => {
    c.status(404)
    return c.render('errors/NotFound')
  })

  const ERROR_PAGES: Record<number, string> = {
    400: 'errors/BadRequest',
    403: 'errors/Forbidden',
    404: 'errors/NotFound',
    500: 'errors/ServerError',
  }

  app.onError((err, c) => {
    const status = err instanceof HTTPException ? err.status : 500
    c.status(status)
    const page = ERROR_PAGES[status]
    if (page) return c.render(page)
    return c.render('errors/Error', { status }) // 405 / 429 / 503 等
  })

  return app
}

export default createApp()
```

**`src/features/errors/pages/NotFound.tsx`**（新規・404 代表例）

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'
import Layout from '@/shared/components/Layout'

export default function NotFound() {
  return (
    <Layout>
      <div class="text-center">
        <p class="text-6xl font-bold text-gray-300">404</p>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">ページが見つかりません</h1>
        <p class="mt-2 text-gray-600">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link href="/" class="mt-6 inline-block text-blue-600 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </Layout>
  )
}
```

`BadRequest.tsx`（400）/ `Forbidden.tsx`（403）/ `ServerError.tsx`（500）は同じ構造で、コード番号・見出し・説明文だけ差し替えた同形。

**`src/features/errors/pages/Error.tsx`**（新規・共通フォールバック）

```tsx
import { Link } from '@ts-76/inertia-hono-jsx'
import Layout from '@/shared/components/Layout'

const MESSAGES: Record<number, string> = {
  405: '許可されていないメソッドです',
  429: 'リクエストが多すぎます',
  503: '現在ご利用いただけません',
}

export default function Error({ status }: { status: number }) {
  return (
    <Layout>
      <div class="text-center">
        <p class="text-6xl font-bold text-gray-300">{status}</p>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">
          {MESSAGES[status] ?? 'エラーが発生しました'}
        </h1>
        <Link href="/" class="mt-6 inline-block text-blue-600 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </Layout>
  )
}
```

**`test/features/errors/routes.test.ts`**（抜粋）

```ts
import { HTTPException } from 'hono/http-exception'
import { createApp } from '../../../src/server'
// ...

beforeEach(async () => {
  db = await createTestDb()
  app = createApp(() => db)

  // onError をテストするため、例外を投げるダミールートを後付け登録
  app.get('/__boom500', () => { throw new Error('boom') })
  app.get('/__boom400', () => { throw new HTTPException(400) })
  app.get('/__boom503', () => { throw new HTTPException(503) })
})

it('未定義パスは errors/NotFound を描画する', async () => {
  const res = await app.request('/this-does-not-exist', { headers: inertiaHeaders })
  expect(res.status).toBe(404)
  const page = (await res.json()) as InertiaPage
  expect(page.component).toBe('errors/NotFound')
})

it('未知の例外は errors/ServerError を描画する', async () => {
  const res = await app.request('/__boom500', { headers: inertiaHeaders })
  expect(res.status).toBe(500)
  const page = (await res.json()) as InertiaPage
  expect(page.component).toBe('errors/ServerError')
})

it('HTTPException(503) は errors/Error を描画し status プロップを持つ', async () => {
  const res = await app.request('/__boom503', { headers: inertiaHeaders })
  expect(res.status).toBe(503)
  const page = (await res.json()) as InertiaPage<{ status: number }>
  expect(page.component).toBe('errors/Error')
  expect(page.props.status).toBe(503)
})
```

> **onError テストのポイント**：`createApp()` が返した `app` は `onError` 登録済みなので、`beforeEach` 内で `app.get('/__boomXXX', ...)` のように例外を投げるルートを後付けするだけで `onError` を経由させられる。実ルートには一切手を入れない。

### 仕組み

- **`notFound`**：ルートに一致しなかったリクエストが到達する。既存の `c.notFound()`（posts / admin/posts）もこのハンドラを経由して `errors/NotFound` を描画するようになる（各ルートの変更は不要）。
- **`onError`**：ルートハンドラや他ミドルウェアで例外が上がると発火。`HTTPException` であれば `err.status` でコードを取り出し、`ERROR_PAGES` マップに載っているコードは専用ページへ、それ以外は `errors/Error` へ `status` を渡す。`HTTPException` でない例外はすべて 500。
- `inertia` ミドルウェアはルート処理より前に `c.setRenderer` を差し込むため、`notFound` / `onError` ハンドラでも `c.render` が使える。

---

## Phase 10：エラー flash（Cookie flash で redirect-back）

バリデーション失敗時も **303 でフォーム URL に戻す**（URL をきれいに保つ）。`errors` とユーザが入力した値（`old`）を Cookie flash に乗せ、リダイレクト先 GET で props に注入する。Laravel の `redirect()->back()->withErrors()->withInput()` 相当。

### 仕組み

```
POST /admin/posts （タイトル空）
  → setErrors(c, { title: "..." }, { title: "", body: "本文" })
  → 303 /admin/posts/new
      ↓ Inertia がリダイレクトを追従
GET /admin/posts/new  （Cookie: errors=...; old=...）
  → flash() ミドルウェアが Cookie を読んで props に注入、Cookie を削除
  → c.render に { errors, old } が自動付与
  → form.errors.title が表示、form.data.body が "本文" で復元
```

Cookie は**一回読んだら消す（one-shot）**ので、ページリロードしてもエラーが再表示されない。Workers にセッションが無いので Cookie が唯一の状態受け渡し手段。

### flash.ts の拡張

`setErrors` を追加し、`flash()` ミドルウェアで `errors` / `old` も読み取る。

**`src/shared/flash.ts`**

```ts
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

const FLASH = 'flash'
const ERRORS = 'errors'
const OLD = 'old'

const COOKIE_OPTIONS = {
  path: '/', httpOnly: true, sameSite: 'Lax' as const, maxAge: 60,
}

export const setFlash = (c: Context, message: string) => {
  setCookie(c, FLASH, encodeURIComponent(message), COOKIE_OPTIONS)
}

// バリデーションエラーと入力値をセット（リダイレクト前に呼ぶ）
export const setErrors = (
  c: Context,
  errors: Record<string, string>,
  old: Record<string, unknown>,
) => {
  setCookie(c, ERRORS, encodeURIComponent(JSON.stringify(errors)), COOKIE_OPTIONS)
  setCookie(c, OLD, encodeURIComponent(JSON.stringify(old)), COOKIE_OPTIONS)
}

export const flash = (): MiddlewareHandler => async (c, next) => {
  const rawFlash = getCookie(c, FLASH)
  const message = rawFlash ? decodeURIComponent(rawFlash) : null
  if (rawFlash) deleteCookie(c, FLASH, { path: '/' })

  const rawErrors = getCookie(c, ERRORS)
  const rawOld = getCookie(c, OLD)

  let errors: Record<string, string> | null = null
  let old: Record<string, unknown> | null = null

  if (rawErrors) {
    try { errors = JSON.parse(decodeURIComponent(rawErrors)) } catch { errors = null }
    deleteCookie(c, ERRORS, { path: '/' })
  }
  if (rawOld) {
    try { old = JSON.parse(decodeURIComponent(rawOld)) } catch { old = null }
    deleteCookie(c, OLD, { path: '/' })
  }

  const render = c.render
  ;(c as any).render = (component: any, props?: any) =>
    render(component, {
      ...(props ?? {}),
      flash: message,
      ...(errors ? { errors } : {}),
      ...(old ? { old } : {}),
    })

  await next()
}
```

`routes.tsx` の変更点（`setErrors` + 303 redirect-back）と `PostForm.tsx` の変更点（`usePage()` から `old` を読んで初期値に）はすでに Phase 6 のコードブロックに反映済み。

### テストの更新

失敗時は「同じ JSON レスポンスに errors」ではなく「303 + Set-Cookie」に変わる。テストを redirect-back 前提へ書き換え、Cookie を付けたフォロー GET で `errors` / `old` が props に注入されることもエンドツーエンドで検証する。

```ts
// POST バリデーション失敗
it('タイトル空でバリデーションエラー：/admin/posts/new へ redirect-back し保存されない', async () => {
  const res = await app.request('/admin/posts', {
    method: 'POST',
    headers: inertiaHeaders,
    body: JSON.stringify({ title: '', body: '本文' }),
  })
  expect(res.status).toBe(303)
  expect(res.headers.get('location')).toBe('/admin/posts/new')
  expect(res.headers.get('set-cookie')).toContain('errors=')
})

// redirect-back 後のフォーム GET（エンドツーエンド）
it('redirect-back 後の GET /admin/posts/new に errors と old が注入される', async () => {
  const postRes = await app.request('/admin/posts', {
    method: 'POST',
    headers: inertiaHeaders,
    body: JSON.stringify({ title: '', body: '本文の内容' }),
  })
  // Headers.getSetCookie() で複数の Set-Cookie を配列として取得
  const cookieHeader = postRes.headers
    .getSetCookie()
    .map((s) => s.split(';')[0].trim())
    .join('; ')

  const getRes = await app.request('/admin/posts/new', {
    headers: { ...inertiaHeaders, Cookie: cookieHeader },
  })
  const page = await getRes.json()
  expect(page.props.errors?.title).toBeTruthy()
  expect(page.props.old?.body).toBe('本文の内容')
})
```

> `Headers.getSetCookie()` は複数の `Set-Cookie` ヘッダを配列で返す標準 Fetch API。`headers.get('set-cookie')` は全値を `, ` で連結するため複数 Cookie を持つ場合に分割が難しい。

---

## ハマりどころ集（実際に遭遇した解決）

| 症状 | 原因 | 解決 |
|---|---|---|
| `No migrations present at .../migrations` | `migrations apply` の DB 名引数が `database_name` と不一致 → デフォルトフォルダにフォールバック | コマンドの DB 名を `wrangler.jsonc` の `database_name` と一致させる |
| `migrations_dir` が効かない | `d1_databases` オブジェクトの外に書いた | 各バインディングオブジェクト**の中**に書く |
| migrations apply で OAuth が開く | `--local` を付け忘れた | ローカル操作には常に `--local` を付ける |
| `atlas.sum` mismatch エラー | migration ファイルが手書き変更された | `atlas migrate hash` で再生成 |
| バリデーションで `expected string, received undefined` | `zValidator('form')` だが Inertia は JSON 送信 | `zValidator('json')` + `c.req.valid('json')` にする |
| `@cloudflare/vitest-pool-workers` が重い | workerd ダウンロード + migrations recipe 配線 | テストは libsql インメモリ + DI（`c.get('db')`）に切り替え |
| `better-sqlite3` がインストールできない | ネイティブビルド（node-gyp）が新しい Node でコンパイルに落ちる | プレビルド配布の `@libsql/client` を使う |
| `className` が効かない | hono/jsx は `class` | `class` を使う |
| テストで id が `undefined` / insert 後の再 select が必要 | `db.insert().values()` の戻り値に id が入らない | `db.insert().values(...).returning()` で insert と同時に取得（Fishery の `onCreate` 内で使用） |

---

## 設計判断まとめ

- **ローカル限定 D1**：`wrangler d1 create`（リモート操作）を避け、バインディング手書き + `--local`。公開時のみ `d1 create` → `database_id` 差し替え → `--remote`。
- **マイグレーション**：Atlas で生成（タイムスタンプ採番・連番衝突なし・`atlas.sum` で整合性保証）→ wrangler で適用。Atlas が D1 に直接接続しないためローカル完結を維持。詳細は [docs/migrations-atlas.md](./migrations-atlas.md)。
- **バリデーションエラー**：Cookie flash（`src/shared/flash.ts`）を `errors` / `old` にも対応させて拡張し、`setErrors` + 303 redirect-back で「URL をきれいに保つ正攻法」を実現（Phase 10）。`form.errors` はリダイレクト先の `props.errors` から Inertia `useForm` が自動注入し、`old` は `usePage().props.old` から `useForm` 初期値として復元する。
- **DI（`c.get('db')`）**：本番 D1・テスト libsql の二刀流を1つの seam で成立させる。`Db = BaseSQLiteDatabase<'async', any, typeof schema>` が両ドライバの共通型。
- **テスト DB**：libsql `:memory:`。ネイティブビルド不要・非同期で D1 に近い・テストごとに独立。
- **テストデータ**：Fishery + @faker-js/faker で FactoryBot 相当を実現。`postFactory(db)` が sequence / 型安全な overrides / `.returning()` を提供。`beforeEach` でファクトリを生成し直すため sequence はテストごとに 1 から始まる（決定的）。
- **SSR**：`createInertiaApp` の SSR モード + 非同期 rootView で Worker 内 in-process 実行（サイドカー不要）。

## 発展課題（未実施）

- **本番デプロイ**：`wrangler d1 create` → `database_id` 差し替え → `pnpm db:apply:remote` → `vite build` → `wrangler deploy`。rootView の `/src/client.tsx` をビルド済みアセット（ハッシュ付き）に解決させる配線、`<head>` への CSS link が必要。
- **per-page タイトル**：各ページで `<Head title="...">`。
