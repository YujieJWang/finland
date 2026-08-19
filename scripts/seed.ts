import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,role");
if (profileError) throw profileError;
const creator = profiles?.find((profile) => profile.role === "creator");
const recipient = profiles?.find((profile) => profile.role === "recipient");
if (!creator || !recipient) throw new Error("Create both allowlisted users before running the seed.");

const examples = [
  ["💌", "Read me when you miss me", "Whenever you need a little piece of home."],
  ["🥺", "Read me when you’re homesick", "For the days when home feels very far away."],
  ["😴", "Read me when you can’t sleep", "A quiet letter for a restless night."],
  ["😭", "Read me when you’ve had a bad day", "Open this after the kind of day you’d rather forget."],
  ["🥳", "Read me when something amazing happens", "I want to celebrate every good thing with you."],
  ["🤍", "Read me when you need reassurance", "For when your thoughts are louder than my voice."],
  ["😂", "Read me when you need to laugh", "Emergency silliness, kept safely inside."],
  ["📞", "Read me when you wish I was there", "For the moments a call doesn’t feel quite close enough."],
  ["🌨️", "Read me on your first snow day", "A small celebration for a very Finnish morning."],
  ["🇫🇮", "Read me when Finland feels like home", "For the day somewhere new starts feeling familiar."],
  ["🏠", "Read me when you’re excited to come home", "The countdown is almost over."],
  ["✈️", "Read me on your flight back", "One last letter from this chapter."],
] as const;

const { data: existing } = await supabase.from("cards").select("title").eq("creator_id", creator.id);
const existingTitles = new Set((existing || []).map((card) => card.title));
const cards = examples.filter(([, title]) => !existingTitles.has(title)).map(([emoji, title, subtitle]) => ({
  creator_id: creator.id,
  recipient_id: recipient.id,
  emoji,
  title,
  subtitle,
  content: `[REPLACE ME]\n\nWrite your personal letter for “${title}” here before sharing the app.`,
  unlock_type: "immediate",
}));

if (cards.length) {
  const { error } = await supabase.from("cards").insert(cards);
  if (error) throw error;
}
console.log(`Seed complete: ${cards.length} example cards added, ${examples.length - cards.length} already existed.`);
