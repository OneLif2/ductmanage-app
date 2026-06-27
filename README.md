# DuctManage App

MVAC air-duct installation progress web app. The app is local-first and stores progress data in the browser.

## Start The Development Service

From PowerShell:

```powershell
cd "C:\Users\d2nni\OneDrive - The University of Hong Kong - Connect\_python_test\MVAC_Duct_Progress_Tracker\ductmanage-app"
npm install
npm run dev -- --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

Keep the PowerShell window running while using the app. Stop the service with `Ctrl+C`.

## Important: Do Not Double-Click index.html

`index.html` is the Vite source entry file, not a standalone HTML app. If you open it directly from Windows Explorer, the browser uses `file://` and the app may be blank because `/src/main.tsx` and Vite modules are not served.

Use the HTTP URL after starting the service:

```text
http://127.0.0.1:5173/
```

## Production Preview

To test the built app:

```powershell
npm run build
npm run preview
```

Then open the preview URL shown in the terminal, usually:

```text
http://127.0.0.1:4173/
```

## Checks

```powershell
npm run typecheck
npm run build
npm run verify
```

