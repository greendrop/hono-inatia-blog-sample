# hono-inertia-blog-sample

**Hono + Inertia(hono/jsx) + Cloudflare Workers** で作る簡易ブログのサンプル実装。  
ローカル完結（Cloudflare アカウント不要）で動作確認できます。

詳細な構築手順は [docs/hono-inertia-blog-handson.md](./docs/hono-inertia-blog-handson.md) を参照してください。

---

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| ランタイム | Cloudflare Workers（ローカル: workerd） |
| フレームワーク | Hono `^4.12.26` |
| ビュー | hono/jsx |
| ページ遷移 | `@hono/inertia`（サーバ） + `@ts-76/inertia-hono-jsx`（クライアント） |
| DB | Cloudflare D1（ローカル SQLite） |
| ORM | Drizzle ORM |
| マイグレーション | Atlas（生成）+ wrangler（適用） |
| バリデーション | zod + `@hono/zod-validator` |
| UI | Tailwind CSS v4 |
| テスト | Vitest + libsql（インメモリ） |
| ビルド | Vite + `@cloudflare/vite-plugin` |
| パッケージ管理 | pnpm |

---

## 機能

- **ユーザ画面**
  - 記事一覧 `GET /posts`
  - 記事詳細 `GET /posts/:id`
- **管理画面**（`/admin/posts`）
  - 記事の作成・編集・削除（CRUD）
  - フォームバリデーション（zod）
- フラッシュメッセージ（Cookie ベース、トースト表示）
- SSR（`renderToString` による初期 HTML 生成）

---

## ディレクトリ構成

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
atlas/
  migrations/             # Atlas が生成したマイグレーション（タイムスタンプ命名）
  migrations/atlas.sum    # 整合性ハッシュ（git 管理必須）
atlas.hcl                 # Atlas 設定（drizzle-kit export 連携）
seeds/
  dev.sql                 # ローカル開発用シードデータ
test/
  db.ts                   # インメモリ libsql ヘルパー
  posts.test.ts           # Vitest テスト
```

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
pnpm install
```

### 2. Atlas のインストール

マイグレーション生成に Atlas（Go バイナリ）を使います。npm 依存に含まれないため別途インストールが必要です。

```bash
# mise（推奨）
mise use atlas

# macOS（Homebrew）
brew install ariga/tap/atlas

# Linux / CI
curl -sSf https://atlasgo.sh | sh
```

> `diff`/`apply`/`hash` 等の日常操作は**無料・オフライン・アカウント不要**。詳細は [docs/migrations-atlas.md](./docs/migrations-atlas.md) を参照。

### 3. D1 マイグレーションの適用

> ⚠️ ローカル操作には必ず `--local` を付けてください。付けないとリモート（Cloudflare アカウント）が対象になります。

```bash
# ローカル D1 にマイグレーションを適用（初回セットアップ）
pnpm db:apply:local

# スキーマを変更した場合: 差分 migration を生成してから適用
pnpm db:diff <変更内容の名前>   # 例: pnpm db:diff add_published
pnpm db:apply:local
```

詳細な運用フローは [docs/migrations-atlas.md](./docs/migrations-atlas.md) を参照してください。

### 4. シードデータの投入（任意）

```bash
pnpm db:seed:local
```

---

## 開発コマンド

| コマンド | 説明 |
|---|---|
| `pnpm dev` | 開発サーバ起動（http://localhost:5173） |
| `pnpm build` | プロダクションビルド |
| `pnpm preview` | ビルド後にプレビューサーバ起動 |
| `pnpm test` | Vitest でテストを 1 回実行 |
| `pnpm test:watch` | Vitest を監視モードで実行 |
| `pnpm cf-typegen` | `worker-configuration.d.ts` を再生成 |
| `pnpm db:diff <name>` | schema.ts から差分マイグレーションを生成 |
| `pnpm db:apply:local` | ローカル D1 にマイグレーションを適用 |
| `pnpm db:apply:remote` | リモート D1 にマイグレーションを適用 |
| `pnpm db:seed:local` | ローカル D1 にシードデータを投入 |

---

## ハンズオン手順書

ゼロからの構築手順（各フェーズの解説・つまずきポイントも含む）は  
👉 [docs/hono-inertia-blog-handson.md](./docs/hono-inertia-blog-handson.md) を参照してください。

## マイグレーション運用

Atlas + wrangler によるマイグレーション運用の詳細（日常フロー・衝突対処・トラブルシュート）は  
👉 [docs/migrations-atlas.md](./docs/migrations-atlas.md) を参照してください。
