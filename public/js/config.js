/* Where the public site reads its content and photos from.
   Admin edits are committed to the "content" branch of this GitHub repo, and visitors' browsers read them straight
   from GitHub (raw.githubusercontent.com), so Vercel storage and Vercel functions are not used for visitors.
   Change the address if the repo or the branch name changes. Set it to "" to read from /api/content instead. */
var CONTENT_BASE = "https://raw.githubusercontent.com/kedaagency/unisteel/content/";
