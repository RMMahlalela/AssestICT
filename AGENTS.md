<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Handover data lives in Firebase Realtime Database via its REST API from server functions (src/lib/handover.functions.ts); user chose Firebase over Lovable Cloud.
- Generate approved PDFs server-side with pdf-lib and an embedded Unicode font; store PDF bytes together with the final decision using Firebase ETag conditional writes so a failed PDF cannot leave a partially approved record.
- Keep record schemas and decision rules in a client-safe module, with PDF rendering in a server-only helper, to prevent server dependencies entering browser code.
