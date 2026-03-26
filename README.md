# Zenn Content - AI支援型技術記事システム

AI・フロントエンド技術に特化した日英両対応の技術記事を効率的に執筆・公開するシステム。

## 仕組み

```
トピック選択 → AI下書き生成 → GitHub PR作成 → 自分で加筆・編集 → マージ → Zenn自動公開
```

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env にAPIキーを設定

# Zennプレビュー
npx zenn preview
```

## 使い方

### トピック一覧を確認

```bash
node scripts/generate-article.js --list
```

### 記事の下書きを生成

```bash
# 日英両方
node scripts/generate-article.js --topic ai-001

# 日本語のみ
node scripts/generate-article.js --topic ai-001 --lang ja

# 英語のみ
node scripts/generate-article.js --topic ai-001 --lang en
```

### GitHub Actionsから生成（推奨）

1. リポジトリの Actions タブを開く
2. "Zenn Article Pipeline" を選択
3. "Run workflow" でトピックIDと言語を指定
4. 自動でドラフトPRが作成される
5. PRを確認・加筆してマージ → Zenn自動公開

## ディレクトリ構成

```
zenn-content/
├── articles/          # Zenn記事（Markdown）
├── books/             # Zenn有料Book
├── scripts/           # 自動化スクリプト
│   └── generate-article.js
├── prompts/           # AI記事生成用プロンプト
│   ├── article-ja.md
│   └── article-en.md
├── .github/workflows/ # GitHub Actions
│   └── zenn-pipeline.yml
├── topics.json        # トピック管理
└── .env.example       # 環境変数テンプレート
```

## マネタイズ戦略

- **無料記事**: バッジ（投げ銭）＋認知拡大＋SEO
- **有料Book**: 体系的コンテンツを200〜5,000円で販売
- **導線**: 無料記事 → 関連する有料Bookへ誘導

## 注意事項

- AI生成の下書きは必ず自分で確認・加筆してから公開する
- `published: false` のままでは非公開（安全装置）
- Zennの利用規約を遵守し、AI量産コンテンツにしない

## 参考

- [Zenn CLI ガイド](https://zenn.dev/zenn/articles/zenn-cli-guide)
- [GitHub連携](https://zenn.dev/zenn/articles/connect-to-github)