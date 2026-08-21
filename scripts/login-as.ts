import { createAdminClient } from "../lib/supabase/admin";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("usage: npm run login-as -- her@example.com");

const admin = createAdminClient();
const { data: allowed, error: allowlistError } = await admin
  .from("allowed_emails")
  .select("email")
  .eq("email", email)
  .maybeSingle();
if (allowlistError) throw new Error("the allowlist could not be checked.");
if (!allowed) throw new Error("that email is not allowlisted.");

const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error || !data.properties.hashed_token) throw new Error("the local sign-in link could not be generated.");

const link = new URL("http://localhost:3000/auth/callback");
link.searchParams.set("token_hash", data.properties.hashed_token);
console.log("open this one-time link in an incognito window:\n");
console.log(link.toString());
