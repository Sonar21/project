(Firebase image upload — minimal test setup)

Steps to try the image upload component locally:

- Install Firebase Web SDK (v9 modular):

```powershell
npm install firebase
```

- Add Firebase environment variables to a `.env.local` file at the project root (example):

```
NEXT_PUBLIC_FIREBASE_API_KEY=yourApiKey
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=yourProject.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=yourProjectId
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=yourProject.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=yourSenderId
NEXT_PUBLIC_FIREBASE_APP_ID=yourAppId
```

- Enable Firebase Storage in the Firebase Console for the project. For quick local testing you can temporarily set Storage rules to allow open access (DO NOT use in production):

```rules
rules_version = '2';
service firebase.storage {
	match /b/{bucket}/o {
		match /{allPaths=**} {
			allow read, write: if true;
		}
	}
}
```

- Files added to this repo for the test upload:
	- `src/firebase/firebase.js` — initializes Firebase app and exports `storage` (v9 modular).
	- `src/components/ImageUpload.jsx` — client React component to pick an image, upload to Storage, show progress and the download URL.

- Usage: import and render the component in any client page. Example (Next.js `app` directory page):

```jsx
import ImageUpload from "../components/ImageUpload"; // adjust path as needed

export default function Page() {
	return <ImageUpload />;
}
```

Notes:
- This is a minimal example for development/testing. For production, lock down Storage rules, secure uploads (validate file type/size server-side or via Firebase Security Rules), and consider using `next/image` for optimized image delivery in Next.js.

