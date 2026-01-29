# Payedu
### Payedu は、コース・学生・支払いを一元管理する
Next.js + Firebase ベースの Web アプリケーションです。
管理者・教師・学生向けの 役割別ダッシュボード を提供します。

Firebase Cloud Functions と
データ移行・保守用ユーティリティスクリプト も同梱されています。
## 🎬 Demo
![デモGIF](public/images/demo_pic.png)

## 🔧 技術スタック
フロントエンド

- Next.js（App Router / app ディレクトリ）
- Tailwind CSS
 - バックエンド
- Firebase Firestore
- Firebase Cloud Functions（Node.js）
- 認証
- NextAuth

## ✨ 主な機能

### ダッシュボード
- 管理者

### 管理機能
- 管理用 API  
- コース管理  
- ユーザー管理  

### メンテナンス
- データ移行・クリーンアップ用スクリプト

## 📦 依存関係のインストール

#### ⚠️ Vercel では Yarn 推奨  
`package-lock.json` がある場合は削除してください。

#### ⚠️ FIREBASE_PRIVATE_KEY  は必須です


## インストール・セットアップ
### 前提条件
- Node.js 16.1.2
- npm 10.9.2
 #### 🚀 開発サーバー起動
npm run dev

または
yarn dev

  #### 🏗️ 本番ビルド & 起動
npm run build
npm start

また
yarn build
yarn start

  #### ☁️ デプロイ（Vercel）

main ブランチのみがデプロイ対象

Next.js は 常に最新安定版 を使用してください

package-lock.json は 削除

 #### ⚠️ 注意点（重要）

Vercel は main ブランチのみをデプロイ

ローカル修正は commit + push しないと反映されない

Next.js の脆弱バージョンは 自動ブロック される

### インストール手順
```bash
# 1. リポジトリをクローン
git clone https://github.com/Sonar21/project.git
cd [repository]

# 2. 依存関係をインストール
npm install

# 3. 環境変数を設定
cp .env.example .env
# .envファイルを編集して必要な値を設定
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# 4. 開発サーバー起動
npm run dev
```
 ### 🔗 デモ

👉https://pay-edu-vast.vercel.app/


