# ResumeRefresh - User Installation

This is the production Chrome extension package. It connects to the ResumeRefresh backend hosted on Render and the configured Google Apps Script account service.

## Install for testing
1. Unzip this folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `ResumeRefresh` folder.
6. Reload the extension after any update.

## Use
Press `Ctrl+Shift+Y` to open ResumeRefresh.

The first user creates an account with a Gmail address. The account session is remembered locally on that Chrome profile. Later uses skip sign-in.

Paste the job description, upload a PDF resume, and press **Submit**. ResumeRefresh sends the resume and job description to the production backend, generates the personalized resume, and saves submission data to the owner's Google Sheet/Drive through the configured backend.

## Important
- PDF only, maximum 8 MB.
- No OpenRouter API key is stored in the extension.
- Users do not need access to the owner's Google Sheet or Drive folder.
- The ZIP is for unpacked/developer installation. General public distribution through Chrome normally uses the Chrome Web Store.
