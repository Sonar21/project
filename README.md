<<<<<<< HEAD
=======
Payedu

Payedu は、コース・学生・支払いを一元管理する
Next.js + Firebase ベースの Web アプリケーションです。
管理者・教師・学生向けの 役割別ダッシュボード を提供します。

Firebase Cloud Functions と
データ移行・保守用ユーティリティスクリプト も同梱されています。

🔧 技術スタック
フロントエンド

Next.js（App Router / app ディレクトリ）

Tailwind CSS

バックエンド

Firebase Firestore

Firebase Cloud Functions（Node.js）

認証

NextAuth

✨ 主な機能
役割別ダッシュボード
管理者
教師
学生
支払いスケジュール管理
領収書管理

管理用 API

コース管理

ユーザー管理

データ移行・クリーンアップ用スクリプト

依存関係のインストール

⚠️ Vercel では Yarn 推奨
package-lock.json がある場合は削除してください。

Yarn（推奨）
yarn install

npm（ローカルのみ）
npm install

🔐 環境変数設定

プロジェクトルートに .env.local を作成：

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"


⚠️ FIREBASE_PRIVATE_KEY  は必須です

🚀 開発サーバー起動
npm run dev

または
yarn dev

🏗️ 本番ビルド & 起動
npm run build
npm start

また
yarn build
yarn start

☁️ デプロイ（Vercel）

main ブランチのみがデプロイ対象

Next.js は 常に最新安定版 を使用してください

package-lock.json は 削除

⚠️ 注意点（重要）

Vercel は main ブランチのみをデプロイ

ローカル修正は commit + push しないと反映されない

Next.js の脆弱バージョンは 自動ブロック される

🔗 デモ

👉https://pay-edu-vast.vercel.app/
>>>>>>> d03c640af1a397c4e4cdc9ab4e1f0f307a44fe23
