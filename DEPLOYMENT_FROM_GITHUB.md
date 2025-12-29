# How to Configure "Deploy from GitHub" (Hostinger)

I have set up a **GitHub Action** that will automatically build and deploy your app whenever you push to the `main` branch.

## 1. Credentials (DO NOT COMMIT THESE)
You provided these credentials. **Please enter them into GitHub Secrets immediately.**

*   **FTP Host**: `ftp.tsfci.com`
*   **FTP Username**: `u739151801.admin`
*   **FTP Password**: `(The password you provided)`

## 2. Add Secrets to GitHub
1.  Go to your GitHub Repository.
2.  Click **Settings** -> **Secrets and variables** -> **Actions**.
3.  Click **New repository secret**.
4.  Add the following three secrets:
    *   `FTP_SERVER` : `ftp.tsfci.com`
    *   `FTP_USERNAME` : `u739151801.admin`
    *   `FTP_PASSWORD` : `(Enter your password here)`

## 3. First Deployment
1.  Once secrets are added, push a change or go to **Actions** tab in GitHub.
2.  Select **Deploy to Hostinger** workflow.
3.  Click **Run workflow**.

## 4. Final Step on Hostinger (Important!)
After the files are uploaded by GitHub to `public_html/workspace/`:
1.  Go to Hostinger **hPanel** -> **Advanced** -> **Node.js App**.
2.  Ensure "Application Root" points to `public_html/workspace/server`.
3.  Click **NPM Install** button (This installs `server/node_modules`).
4.  Click **Restart**.

## Summary of what happens
*   GitHub builds your React App (`client/dist`).
*   GitHub uploads the Server code and the React Build to Hostinger (`public_html/workspace/`).
*   It skips `node_modules` (becuase they are huge) and `virtualoffice.db` (to protect your data).
*   You trigger the final "Install" on Hostinger to get the server running.
