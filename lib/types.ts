import type { UnlockType } from "@/lib/domain";

export type Profile = {
  id: string;
  display_name: string;
  role: "creator" | "recipient";
  timezone: string;
};

export type CardPreview = {
  id: string;
  creator_id: string;
  recipient_id: string;
  title: string;
  subtitle: string | null;
  emoji: string;
  unlock_type: UnlockType;
  unlock_at: string | null;
  opened_at: string | null;
  read_at: string | null;
  created_at: string;
  is_locked: boolean;
  is_mine: boolean;
  creator_name: string;
};

export type Attachment = {
  id: string;
  storage_path: string;
  type: "image" | "audio";
  alt_text: string | null;
  signed_url?: string;
};

export type Response = {
  id: string;
  user_id: string;
  message: string | null;
  mood: string | null;
  created_at: string;
  attachments: Attachment[];
};

export type Card = {
  id: string;
  creator_id: string;
  recipient_id: string;
  title: string;
  subtitle: string | null;
  emoji: string;
  content: string;
  song_url: string | null;
  unlock_type: UnlockType;
  unlock_at: string | null;
  opened_at: string | null;
  read_at: string | null;
  created_at: string;
  attachments: Attachment[];
  card_responses: Response[];
};

export type Memory = {
  id: string;
  caption: string;
  memory_date: string | null;
  location_label: string | null;
  created_at: string;
  attachments: Attachment[];
};

export type HomepagePhoto = {
  id: string;
  caption: string | null;
  alt_text: string;
  signed_url: string;
};
