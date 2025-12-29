# How to Configure "Deploy from GitHub" (Hostinger)

I have set up a **GitHub Action** that will automatically build and deploy your app whenever you push to the `main` branch.

## 1. Get FTP Credentials from Hostinger
1.  Log in to **Hostinger hPanel**.
2.  Go to **Files** -> **FTP Accounts**.
3.  You will need:
    *   **FTP Host** (e.g., `ftp.yourdomain.com` or an IP address)
    *   **FTP Username** (e.g., `u123456789`)
    *   **FTP Password** (The one you set for this user)

## 2. Add Secrets to GitHub
1.  Go to your GitHub Repository.
2.  Click **Settings** -> **Secrets and variables** -> **Actions**.
3.  Click **New repository secret**.
4.  Add the following three secrets:
    *   `FTP_SERVER` : (Your Hostinger FTP Host)
    *   `FTP_USERNAME` : (Your Hostinger FTP User)
    *   `FTP_PASSWORD` : (Your Hostinger FTP Password)

## 3. First Deployment
1.  Once secrets are added, push a change or go to **Actions** tab in GitHub.
2.  Select **Deploy to Hostinger** workflow.
3.  Click **Run workflow**.

## 4. Final Step on Hostinger (Important!)
After the files are uploaded by GitHub:
1.  Go to Hostinger **hPanel** -> **Advanced** -> **Node.js App**.
2.  Ensure "Application Root" points to where files were uploaded (e.g., `public_html`).
3.  Click **NPM Install** button (This installs `server/node_modules`).
4.  Click **Restart**.

## Summary of what happens
*   GitHub builds your React App (`client/dist`).
*   GitHub uploads the Server code and the React Build to Hostinger.
*   It skips `node_modules` (because they are huge) and `virtualoffice.db` (to protect your data).
*   You trigger the final "Install" on Hostinger to get the server running.
