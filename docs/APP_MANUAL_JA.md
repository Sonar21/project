\*\*アプリケーション操作マニュアル（`src/app`）

このドキュメントは Next.js（App Router）プロジェクトの `src/app` 配下のファイル／フォルダの役割、担当処理、他マシンで使う際の注意点、機能追加時に変更すべき箇所をまとめた操作マニュアルです。CSS ファイルは除外しています。初心者にもわかるよう、やさしい日本語・箇条書き中心で説明します。

**目次**

- **ルートと共通レイアウト**: `layout.js`, `page.js`, `providers/Providers.jsx`, `error.js`
- **認証関連**: `auth/`（`error/page.jsx`, `redirect/page.jsx`）
- **学生向け画面**: `student/dashboard/*`
- **教員向け画面**: `teacher/dashboard/*`
- **管理画面（簡易）**: `admin/users/page.jsx`
- **API ルート**: `api/*`（重要なエンドポイントの説明）
- **よくある変更点（環境）**
- **コース追加の手順（詳細）**

---

**ルートと共通レイアウト**

- **`layout.js`**: サイト全体のルートレイアウトを定義しています。

  - 目的: すべてのページに共通の HTML 構造と `Providers`、`Footer` を挿入します。
  - 担当: ページ全体の共通ヘッダー／フッターや meta（viewport）を設定。
  - 他の PC での注意点: 特になし。`Providers` がセッションの設定を利用するため、認証を正しく動かすには環境変数が必要。
  - 変更時: 共通のナビゲーションを変える場合はここを編集（例えば Footer を差し替える）。

- **`page.js`**: ルート（ホーム）ページのコンポーネント。

  - 目的: 初期画面（ログインフォームを表示）を担当。
  - 担当: `LoginForm` を埋め込んでいるだけなので、デザインやログイン案内を変えたい場合はここを編集。
  - 他の PC での注意点: 特になし。
  - 変更時: ホームの文言や初期導線を変えるときに編集。

- **`providers/Providers.jsx`**: アプリ全体で使う React コンテキストをまとめる場所。

  - 目的: `next-auth` の `SessionProvider` と共通 `Header` をラップ。
  - 担当: 認証セッションをページで利用できるようにする。ヘッダの常時表示。
  - 他の PC での注意点: `next-auth` の設定（`authOptions`）に依存するため、OAuth のクライアント ID/SECRET 等が必要。
  - 変更時: セッションの初期化方法を変えたり、共通コンテキストを追加する場合に編集。

- **`error.js`**: アプリケーションレベルのエラーページ（サーバーエラー等）。
  - 目的: エラー発生時に表示される簡易ページ。
  - 担当: ユーザーにエラーを示す。デバッグ向けの情報を追加してもよい。
  - 他の PC での注意点: 特になし。
  - 変更時: エラーメッセージやデザインを変更する場合に編集。

---

**認証関連 (`auth/`)**

- **`auth/error/page.jsx`**

  - 目的: NextAuth のサインイン失敗時に表示するエラーページ。
  - 担当: `error` クエリを読み取り、わかりやすい日本語メッセージにマッピングして表示。
  - 他の PC での注意点: メッセージの文言は自由に編集できます。
  - 変更時: エラーコードの追加対応やリンク先変更はここを編集。

- **`auth/redirect/page.jsx`**
  - 目的: サインイン後にユーザーを適切なダッシュボードへリダイレクトするサーバー実行ページ。
  - 担当: `getServerSession` を呼び、`role` に応じて `/teacher/dashboard` または `/student/dashboard` へリダイレクト。
  - 他の PC での注意点: `authOptions`（`src/app/api/auth/[...nextauth]/route.js`）が正しく設定されている必要があります。
  - 変更時: ロールの追加や別の遷移先を追加する場合はここを編集。

---

**学生向け画面 (`student/dashboard`)**

- **`student/dashboard/page.jsx`**

  - 目的: ログインした学生向けのメインダッシュボード（クライアントコンポーネント）。
  - 担当: 学生の Firestore `students` ドキュメントをリアルタイム監視し、支払い状況、コース情報、支払い履歴、レシートアップロード、リマインダー送信などを表示・操作する。
  - 他の PC での注意点:
    - Firebase のクライアント設定（`NEXT_PUBLIC_FIREBASE_...`）が `.env.local` に必要。
    - `next-auth` のサインインが使えないと学生情報の自動登録が動かない。
  - 変更時: 学生向けの UI を変更する／新しいフィールドを表示する場合はこのファイルと、必要に応じて `components/PaymentSchedule.jsx` などを編集。
  - 補足: コース情報は `courses` コレクションを参照して表示を決めるロジックがあり、学年（EN/JP）の判定やフォールバック探索が含まれます。

- **`student/dashboard/[id]/page.jsx`**
  - 目的: パスに `id` を含む場合に表示する学生詳細ページ（教師・管理者が他の学生のデータを確認・操作する想定）。
  - 担当: `routeId` をキーに学生情報を読み込み、支払い情報や割引（discounts）管理、年度移行処理を実行できる。
  - 他の PC での注意点: `migrateRemainingToNextYear` 等のライブラリ関数や Firebase 認証の権限が必要。
  - 変更時: 学生の編集 UI、割引ロジック、年度移行の挙動を変える場合はここを修正。

---

**教員向け画面 (`teacher/dashboard`)**

- **`teacher/dashboard/course/page.jsx`**

  - 目的: コースの一覧表示と新規追加・削除・編集へのリンクを提供する画面（クライアントコンポーネント）。
  - 担当:
    - `courses` コレクションをリアルタイムで監視して一覧表示。
    - 新しいコースを追加するフォーム（モーダル）を提供し、Firestore にドキュメントを追加する。
    - `determineCourseKey` で日本語/英語どちらのコース名からも `courseKey` を自動判定する。
  - 他の PC での注意点:
    - Firestore の書き込み権限が必要（ローカルではエミュレータや開発用権限で動作）。
  - 変更時:
    - コース追加時に必要なフィールドを増やしたい場合はここと `courses` コレクションのスキーマを合わせて編集。
    - 月別テンプレートの扱いは `monthlyTemplate` として保存されるため、読み取り側（例: 支払い移行 API）も更新が必要。

- **`teacher/dashboard/payment/page.jsx`**

  - 目的: 全ての支払いを一覧し、コース別・月別の集計を表示する管理画面。
  - 担当: `payments` コレクションを読み、学生データ（`students`）を参照してコース別集計や月別グラフを作成する。
  - 他の PC での注意点: 大量データを扱う可能性があり、Firestore の課金やインデックス設定に注意。
  - 変更時: 表示／フィルタの追加はここを修正。

- その他: `teacher/dashboard/course/[id]/page.jsx`（個別コースページ）など、コース詳細や編集用のページが配置されています。編集画面がある場合は該当ファイルを編集してください。

---

**管理画面（簡易）**

- **`admin/users/page.jsx`**
  - 目的: 管理者向けのユーザー一覧・ロール変更・学生のコース変更インターフェース。
  - 担当:
    - `/api/admin/users` と `/api/admin/courses` を呼んで一覧を取得。
    - ドロップダウンで学生の `courseId` を更新し、ロールの切替を行う。
  - 他の PC での注意点: `/api/admin/*` の API はサーバー側で `adminDb`（Firebase Admin SDK）を使うため、サービスアカウント情報が必要。
  - 変更時: 管理 UI の列や操作を追加する場合はこのコンポーネントを編集。

---

**API ルート（`src/app/api`）**

- 共通の注意事項（API 全般）:

  - サーバーサイドで Firebase 管理機能を使うファイルは `src/firebase/adminApp.js` を読み、環境変数 `FIREBASE_SERVICE_ACCOUNT` または `GOOGLE_APPLICATION_CREDENTIALS` を参照します。
  - `next-auth` を使う API は `getServerSession(authOptions)` を呼んでおり、`authOptions` は `src/app/api/auth/[...nextauth]/route.js` に定義されています。

- **`api/auth/[...nextauth]/route.js`**

  - 目的: NextAuth による認証プロバイダー（Google, Credentials）を定義し、サインイン時のフックで Firestore に学生ドキュメントを作成したり、コースのカウントを更新します。
  - 担当:
    - Google OAuth の `clientId` / `clientSecret` を `process.env` から読み込みます（`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`）。
    - サインイン時に `adminDb` を用いて Firestore の学生ドキュメントを作成／更新します。
  - 他の PC での注意点:
    - Google OAuth の環境変数が必須（`.env.local` に設定）。
    - Firebase 管理用のサービスアカウントも必要（サーバー側）。
  - 変更時: サインイン時の挙動やコールバック（role メタデータ付与など）を変えたいときに編集。

- **`api/admin/courses/route.js`**

  - 目的: サーバー側のコース一覧取得、新規追加、更新、削除を取り扱う（管理向け API）。
  - 担当:
    - `GET` → in-memory の `listCourses()` を返す（開発用）。
    - `POST` → `addCourse()` を呼んで in-memory に追加し、Firestore の `courses` ドキュメントも書き込む。
    - `PUT` → `updateCourse()` を呼び in-memory を更新し、Firestore にもマージ更新する。
    - `DELETE` → `deleteCourse()` を呼び、Firestore のドキュメントを削除する。
  - 他の PC での注意点:
    - Firestore に書き込むためにサービスアカウントが必要。ローカル開発ではエミュレータやサービスアカウント JSON を用いる。
  - 変更時: 管理 API の認可や入力バリデーションを強化するならこのファイルを中心に編集。

- **`api/admin/users/route.js`**

  - 目的: in-memory のユーザー一覧取得とユーザー情報（role / courseId / name / email）の更新処理。
  - 担当: POST で `updateUserRole` または `updateUser` を呼び、必要なら Firestore の `students` ドキュメントをマージ更新する。
  - 他の PC での注意点: Firestore の書き込み権限が必要。
  - 変更時: ユーザー属性を増やす／権限チェックを厳密化する場合は編集。

- **`api/admin/migrate-year/route.js`**

  - 目的: ある学生の前年度（fromYear）の未払い残を次年度の支払いスケジュールに振り替える処理。
  - 担当: Firestore の `students/{id}/paymentSchedules` を読み取り、残額を計算して次年度分のスケジュールをバッチで作成／更新する。
  - 他の PC での注意点: 実行は認証済みで、`teacher` ロールまたは管理者である必要がある。Firestore の読み書き権限が必要。
  - 変更時: 年度の計算方法や配分方法を変えるときはこのファイルを修正。

- **`api/teacher/payments/decision/route.js`**

  - 目的: 教員が支払いを「承認」「却下」する操作をサーバー側で受けて支払いドキュメントを更新する。
  - 担当: `payments/{paymentId}` ドキュメントに `status` や `verified`、`approvedBy` などを書き込む。認可チェックあり（teacher か isAdmin）。
  - 他の PC での注意点: 認証が必須。
  - 変更時: 承認ワークフローを拡張する際に編集。

- **`api/student/*`**
  - **`profile/route.js`**: クエリで `email` または `studentId` を渡すと、ローカルの `data/users` の関数でユーザーを検索して返す（GET）。
  - **`payments/route.js`**: 学生ごとの支払い合計を返す（GET）／更新する（POST）シンプルな API（ローカルの `data/payments` を利用）。
  - **`reminder/route.js`**: リマインドメール送信。nodemailer を使用し、環境変数 `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `FROM_EMAIL` を参照。
  - 他の PC での注意点: メール送信は SMTP 情報が必要。開発では SMTP を設定しなくてもログに出力するフォールバックあり。

---

**他のパソコンでこのプロジェクトを使う場合に変更が必要になりやすい点（まとめ）**

- **Firebase（クライアント）**: `.env.local` に下記を設定する必要があります。
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- **Firebase（サーバー / Admin SDK）**: サーバーで Firestore を書き込む処理があるため、下記のいずれかが必要です。
  - `FIREBASE_SERVICE_ACCOUNT` に JSON をそのまま設定（環境変数）
  - または `GOOGLE_APPLICATION_CREDENTIALS` にサービスアカウント JSON のパスを設定
- **Google OAuth（NextAuth）**:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` を `.env.local` に設定
- **メール（nodemailer）**:
  - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `FROM_EMAIL` を `.env.local` に設定
  - 設定がない場合、開発環境ではログ出力にフォールバックするが本番では必須
- **NextAuth のページ設定**:
  - `authOptions.pages.signIn` は `/login` に設定されています。カスタムのサインインページを作る場合は該当ルートを用意してください。

---

**コース（"コース"）を追加したい場合 — 詳細手順**

※以下は "新しいコースをアプリに追加する" 時に必要な箇所を初心者向けにまとめたものです。UI 側（教師が追加できる）と API/データ保存の両方を扱います。

1. どの API ファイルを修正／確認するか

- **`src/app/api/admin/courses/route.js`**

  - サーバー経由でコースを追加・編集・削除したい場合、この API が使われます。
  - ここは既に `POST`（追加）と `PUT`（更新）を実装しており、in-memory の `data/courses` を更新して Firestore にも書き込む処理があります。
  - 変更点例: 新しいコースのフィールド（例: `paymentAcademicYear` や `monthlyTemplate`）を API 経由でも受け取り保存したいときは、`POST` / `PUT` 内で `body` を受け取り Firestore に書き込む `writeObj` を拡張してください。

- **（任意）`src/data/courses.js`**
  - 開発初期は in-memory でコースを保持しています。本番で Firestore を一元化する場合はここを無効化して API が Firestore を直接更新するように移行できます。

2. どの画面ファイルを修正するか（追加・編集 UI）

- **`src/app/teacher/dashboard/course/page.jsx`**

  - ここにコース追加フォーム（モーダル）があり、フォームを送信すると Firestore の `courses` コレクションに `addDoc` しています。
  - 新しい項目（例: `tuitionByYear` や `paymentAcademicYear`）を UI から入力させたい場合は：
    - モーダルのフォームに入力欄を追加する
    - `payload` に新しいフィールドを含めて Firestore に `addDoc` する
    - 保存後に `updateDoc` で `courseId` を書き込む処理があるため、必要に応じて同様のマージ処理を追加

- **`src/app/admin/users/page.jsx`**（管理画面）

  - 管理画面のコース選択ドロップダウンは `fetch("/api/admin/courses")` を使っているので、`api/admin/courses` を更新した場合はここで取得されるデータの形に合わせる。

- **学生画面の表示（必要に応じて）**
  - `src/app/student/dashboard/page.jsx` と `src/app/student/dashboard/[id]/page.jsx` は `courses` コレクションを参照して学費や月額を計算します。
  - 新しいフィールド（例: `monthlyTemplate` や `pricePerMonth`）をコースに追加した場合、これらのページ内で該当フィールドを読み取るロジックを追加／調整してください（`fetchCourse` ロジック）。

3. データ保存の注意（Firestore スキーマ）

- `teacher` の UI は直接 Firestore に `addDoc` しています。追加されるドキュメントは少なくとも以下のような形を持ちます。
  - `name`, `nameJa`, `nameEn`, `courseKey`, `fee` / `tuition`, `pricePerMonth`, `year`, `paymentAcademicYear`, `monthlyTemplate`, `students`（カウンタ）など
- 一方で `api/admin/courses` は in-memory に追加した後、`adminDb.collection("courses").doc(created.code).set(writeObj)` で Firestore にも書き込みます。両者のフィールド整合性を保ってください。

4. 関連箇所（複数ファイル）

- UI（追加/編集）: `src/app/teacher/dashboard/course/page.jsx`（必須）
- 学生表示: `src/app/student/dashboard/page.jsx` と `src/app/student/dashboard/[id]/page.jsx`（学費表示に影響するため必須で確認）
- 管理 API: `src/app/api/admin/courses/route.js`（サーバー経由で管理したい場合）
- サーバー側 Firestore 書き込み: `src/firebase/adminApp.js`（サービスアカウントの設定が必要）
- 追加で必要なら `src/data/courses.js` を更新（in-memory データと同期）

---

**開発時のよくあるトラブルと対処**

- Firestore に書き込めない／403 が出る
  - サービスアカウントが正しく設定されているか確認（`FIREBASE_SERVICE_ACCOUNT` または `GOOGLE_APPLICATION_CREDENTIALS`）。
- Google ログインが動かない
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を `.env.local` に設定し、NextAuth の `NEXTAUTH_URL` も正しく設定してください。
- メール送信が失敗する
  - `EMAIL_*` の環境変数を確認。開発では未設定でもログ出力にフォールバックします。
- コース名を日本語で追加したが学生画面で反映されない
  - 学生画面は `courseKey` と学年でコースを検索しています。`courseKey` が自動生成されるため、`nameJa` / `nameEn` を追加したら `courseKey` のルールに合わせるか、学生画面のフォールバックロジックを更新してください。

---

**最後に（次に何をするか）**

- 小さな変更なら該当のページコンポーネント（例: `teacher/dashboard/course/page.jsx`）だけ編集すれば済みます。
- サーバー側の一貫性を保つため、Firestore に保存するフィールドを増やす場合は API（`api/admin/courses/route.js`）と学生画面（`student/dashboard/*`）の両方を合わせて修正することをおすすめします。

---

このファイルは `docs/APP_MANUAL_JA.md` としてプロジェクト内に保存しました。追加で別の形式（PDF、スライド）や、もっと細かいファイル行単位の説明が必要であれば教えてください。
