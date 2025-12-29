# How to Deploy to Hostinger Business Hosting (Node.js)

Since you are using Hostinger Business Plan, you likely have access to **hPanel** and the **Node.js App** installer.

Follow these steps to deploy your application.

## 1. Prepare the Application for Production

We need to build the React frontend and bundle it with the server.

### Step 1: Build the Frontend
Open your terminal (in VS Code) and run:
```bash
cd client
npm install
npm run build
cd ..
```
This will create a `dist` folder inside `client/` containing your optimized website.

### Step 2: Prepare the Server Files
Your server is already configured to serve the `client/dist` folder.
Ensure your `server/package.json` has a start script:
```json
"scripts": {
  "start": "node index.js"
}
```

## 2. Upload to Hostinger

1.  **Log in to Hostinger hPanel**.
2.  Go to **Websites** -> **Manage**.
3.  Search for **Files** -> **File Manager**.
4.  Navigate to `public_html`.
5.  **Create a folder** named `app` (or whatever you prefer).
6.  **Upload the following**:
    *   The entire `server` folder contents (excluding `node_modules`).
    *   The `client/dist` folder (upload `dist` and rename it to `../client/dist` structure OR just put the contents of `dist` inside a folder named `public` and update the path in `index.js`).
    *   *Simplest Way*: Upload the ENTIRE `TASK2` folder (excluding `node_modules` in both client and server), then inside Hostinger, run `npm install`.

### Recommended Structure on Hostinger
```
/domains/yourdomain.com/public_html/
  ├── server/
  │    ├── index.js
  │    ├── package.json
  │    ├── .env
  │    ├── virtualoffice.db
  │    └── ... other backend files
  └── client/
       └── dist/      <-- The built React files
            ├── index.html
            └── assets/
```

## 3. Configure Node.js in hPanel

1.  Go to **Advanced** -> **Node.js App**.
2.  **Application Root**: `public_html/server` (or wherever you put `index.js`).
3.  **Application Startup File**: `index.js`.
4.  **Application URL**: Leave as default (root domain).
5.  **Node.js Version**: Select 18 or 20 (Generic).
6.  **Environment Variables**:
    *   Add yours if needed (e.g. `SESSION_SECRET`).
    *   `PORT`: Hostinger handles this automatically, but `index.js` expects it.
7.  Click **Create**.

## 4. Install Dependencies

1.  Once created, clicking **Enter Control Panel** or using SSH is best.
2.  If using the button **"NPM Install"** in the Node.js view, it will look for `package.json` in your Application Root (`server/`).
    *   Make sure `server/package.json` lists all dependencies correctly.

## 5. Enable the App

1.  Click **Restart** or **Start**.
2.  Visit your website URL.
    *   It should serve the React App.
    *   API calls to `/api/...` should work.

## Troubleshooting

*   **Database**: SQLite (`virtualoffice.db`) works fine on files, but if the app restarts and overwrites files, you might lose data.
    *   *Hostinger Persistence*: Usually fine in persistent folders.
    *   *Permission*: Ensure `virtualoffice.db` has Write permissions (chmod 666 or 777).
*   **API Errors**: Check the `error_log` in File Manager.
*   **White Screen**: Open Console (F12). If you see 404s for `.js` files, check that `index.js` is pointing to the correct `client/dist` path.

## Important Note for Hostinger User
Since Hostinger shares resources, using `sqlite3` is okay for low traffic. For high traffic, you should switch to using Hostinger's **MySQL Database**.
*   Create a MySQL Database in hPanel.
*   Update `server/db.js` to use `mysql2` or `sequelize` instead of `sqlite3`.
*   (This requires code changes. Let me know if you want to switch to MySQL).
