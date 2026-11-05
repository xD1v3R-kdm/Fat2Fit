# Fat2Fit — first GitHub commit

Destination: `https://github.com/xD1v3R-kdm/Fat2Fit`

The archive includes the app and CI, but **contains no Vercel secrets**. The `.gitignore` prevents committing local `.env` files. The repo must be empty or permit a normal non-force push to `main`.

On Mac, extract the ZIP, open Terminal in the extracted directory and execute:

```bash
./publish-to-github.sh
```

If Git asks you to authenticate, follow the official GitHub browser/credential manager flow. The script will never request or print a token. If `main` is not empty and Git reports a non-fast-forward rejection, **do not force push**; we need to merge remote content first.

GitHub Actions is configured to run `npm install`, tests, TypeScript validation, and a local build. It does not inject production secrets into CI.

**Current state:** This archive is prepared for commit; the upload has not been performed by the assistant. After pushing, Vercel can link the repository; production deployment will require server-only secrets and the Telegram bot.
