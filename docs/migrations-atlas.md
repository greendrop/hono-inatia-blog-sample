# マイグレーション運用ガイド（Atlas + wrangler）

## 役割分担

```
src/db/schema.ts          ← あなたが書く「あるべき姿」(TypeScript)
        │  pnpm db:diff <name>
        │  ↑ Atlas が drizzle-kit export を呼び、前回との差分 SQL を生成
        ▼
atlas/migrations/
  20260625000610_init.sql ← タイムスタンプ命名（連番衝突なし）
  20260625012345_add_x.sql
  atlas.sum               ← 整合性ハッシュ（git 管理必須）
        │  pnpm db:apply:local  / db:apply:remote
        │  ↑ wrangler d1 migrations apply（SQL を実 DB に流す）
        ▼
D1（ローカル / リモート）  ← d1_migrations テーブルで適用済みを管理
```

**Atlas は生成担当。適用は wrangler。** Atlas が D1 へ直接接続しない構成なので、ローカル完結（Cloudflare アカウント不要）を維持できる。

---

## Atlas のインストール

Atlas は Go バイナリのため、npm 依存に含まれない。各開発者・CI に別途インストールが必要。

### macOS（Homebrew）
```bash
brew install ariga/tap/atlas
```

### mise（推奨）
```bash
mise use atlas
```
mise は aqua backend（`aqua:ariga/atlas`）で GitHub Releases の標準ビルドを取得する。`diff`/`apply`/`hash` 等の日常操作はこれで完全に動く。

### Linux / CI（curl）
```bash
curl -sSf https://atlasgo.sh | sh
```

### バージョン確認
```bash
atlas version
```

### GitHub Actions での例
```yaml
- uses: ariga/setup-atlas@v0
```

### Atlas の無料範囲について

本プロジェクトで使う `migrate diff`・`apply`・`hash`・`status` は**無料・オフライン・アカウント不要**。

`migrate lint`（破壊的変更の自動チェック）は標準ビルドでは **無料の `atlas login`（Atlas Cloud 無料アカウント）でロック解除**できる。Pro が要るのはさらに高度な解析ルールのみ。なお Community Edition（`curl https://atlasgo.sh | sh -s -- --community`）は lint コマンド自体を持たない。

本プロジェクトは lint を使わず、生成 SQL の目視確認（③）で安全性を担保している。lint が欲しくなったときは `atlas login`（無料）で有効化できる。

---

## 日常フロー（スキーマを変えるとき）

**① `src/db/schema.ts` を編集**（カラム追加など）

**② 差分 SQL を生成**
```bash
pnpm db:diff <わかりやすい名前>
# 例: pnpm db:diff add_published_to_posts
```
→ `atlas/migrations/<timestamp>_<name>.sql` と `atlas.sum` が更新される。

**③ 生成 SQL を目視確認**（一番重要）
```bash
cat atlas/migrations/$(ls atlas/migrations/*.sql | tail -1 | xargs basename)
```
意図通りの ALTER になっているか、DROP が混ざっていないかを必ず確認。

**④ ローカル D1 に適用**
```bash
pnpm db:apply:local
```

> ⚠️ `--local` を付け忘れるとリモート（Cloudflare アカウント）が対象になる。

**⑥ 動作確認 → コミット**
```bash
# schema.ts と atlas/migrations/ を両方セットでコミット
git add src/db/schema.ts atlas/migrations/
```

**⑦ 本番（リモート）へ反映**（デプロイ時）
```bash
pnpm db:apply:remote
```

---

## `atlas.sum` とは

`atlas.sum` はマイグレーションディレクトリ内の全ファイルの整合性ハッシュ。

- **git 管理必須**。`.gitignore` に入れてはいけない。
- ファイルが手書きで改ざんされたり、途中のファイルが消えたりすると `atlas migrate diff` や `atlas migrate apply` が検知してエラーになる。
- 意図的に修正した場合は `atlas migrate hash` で再生成できる。

---

## タイムスタンプ採番が連番衝突を防ぐ理由

旧 `drizzle-kit` 方式は `0001_`、`0002_` という連番で、異なるブランチで同時に生成すると同じ番号が衝突した。  
Atlas のタイムスタンプ命名（`20260625012345_name.sql`）は生成時刻をベースにするため、**同時刻に生成しない限り衝突しない**。

### マージ後に衝突した場合の対処

`atlas.sum` の不整合で `atlas migrate diff` がエラーを出す場合:

1. 相手のブランチの migration を取り込んだ状態で最新にする。
2. 自分のスキーマ変更をもう一度 `pnpm db:diff <name>` で生成し直す（新しいタイムスタンプになる）。
3. 古い（重複した）自分の migration ファイルを削除し、`atlas migrate hash` で `atlas.sum` を再生成。

「捨てて再 diff」が最も安全。

---

## よく使うコマンド一覧

| コマンド | 内容 |
|---|---|
| `pnpm db:diff <name>` | schema.ts から差分 migration を生成 |
| `pnpm db:apply:local` | ローカル D1 にマイグレーションを適用 |
| `pnpm db:apply:remote` | リモート D1 にマイグレーションを適用 |
| `pnpm db:seed:local` | ローカル D1 にシードデータを投入 |
| `atlas migrate hash` | atlas.sum を手動で再生成 |
| `atlas migrate status --env local --url "sqlite://<path>"` | 適用状況を確認 |

---

## ローカル D1 のリセット

`.wrangler/state/v3/d1/` を削除すればまっさら。その後 `pnpm db:apply:local` で作り直し。

```bash
rm -rf .wrangler/state/v3/d1
pnpm db:apply:local
pnpm db:seed:local  # 任意
```

---

## トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| `atlas.sum` mismatch | マイグレーションファイルが手書き変更された | `atlas migrate hash` で再生成 |
| `No migrations present` | `wrangler.jsonc` の `migrations_dir` が `atlas/migrations` になっていない | `wrangler.jsonc` の D1 バインディング内を確認 |
| `--local` を忘れて OAuth が開く | リモート扱いになっている | ローカル操作には常に `--local` を付ける |
