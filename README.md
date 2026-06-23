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
  index.tsx           # Worker エントリ
  server.tsx          # createApp: ミドルウェア + ルート定義
  root-view.ts        # 初期 HTML シェル（SSR 対応・非同期）
  ssr.tsx             # SSR 描画エントリ
  client.tsx          # クライアント起動（createInertiaApp）
  flash.ts            # Cookie ベースのフラッシュメッセージ
  style.css           # Tailwind CSS
  db/
    index.ts          # Db 型 + createDb（D1）
    schema.ts         # posts テーブル定義
  routes/
    admin/posts.tsx   # 管理 CRUD サブアプリ
  components/
    Layout.tsx        # 共通レイアウト（ナビ + トースト）
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
drizzle/
  migrations/         # drizzle-kit が生成したマイグレーション
seeds/
  dev.sql             # ローカル開発用シードデータ
test/
  db.ts               # インメモリ D1 ヘルパー
  posts.test.ts       # Vitest テスト
```

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
pnpm install
```

### 2. D1 マイグレーションの適用

> ⚠️ ローカル操作には必ず `--local` を付けてください。付けないとリモート（Cloudflare アカウント）が対象になります。

```bash
# スキーマを変更した場合のみ実行（初回は不要）
pnpm exec drizzle-kit generate

# ローカル D1 にマイグレーションを適用
pnpm exec wrangler d1 migrations apply hono-inatia-blog-sample --local
```

### 3. シードデータの投入（任意）

```bash
pnpm exec wrangler d1 execute hono-inatia-blog-sample --local --file ./seeds/dev.sql
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

---

## ハンズオン手順書

ゼロからの構築手順（各フェーズの解説・つまずきポイントも含む）は  
👉 [docs/hono-inertia-blog-handson.md](./docs/hono-inertia-blog-handson.md) を参照してください。
