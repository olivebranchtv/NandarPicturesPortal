-- Add cover art, cast, and trailer fields to content table
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS cover_art_url text,
  ADD COLUMN IF NOT EXISTS cast_list text,
  ADD COLUMN IF NOT EXISTS trailer_url text;

-- Create storage bucket for title cover art (idempotent via DO block)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('title-cover-art', 'title-cover-art', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Allow authenticated users to upload to their own folder
CREATE POLICY IF NOT EXISTS "Filmmakers can upload cover art"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'title-cover-art');

-- Allow public read of cover art
CREATE POLICY IF NOT EXISTS "Cover art is publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'title-cover-art');

-- Allow authenticated users to update/delete their own uploads
CREATE POLICY IF NOT EXISTS "Filmmakers can update cover art"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'title-cover-art');

CREATE POLICY IF NOT EXISTS "Filmmakers can delete cover art"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'title-cover-art');
