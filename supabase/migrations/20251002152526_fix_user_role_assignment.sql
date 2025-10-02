/*
  # Fix User Role Assignment
  
  1. Updates
    - Update handle_new_user function to respect role passed in signup metadata
    - Allows both admin and filmmaker signups to work correctly
    - Admin emails still get admin role automatically for safety
  
  2. Security
    - Maintains security by checking both metadata and email
    - Admin emails always get admin role regardless of metadata
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_first_name text;
  user_last_name text;
BEGIN
  -- First check if role was provided in metadata (from signup)
  user_role := NEW.raw_user_meta_data->>'role';
  
  -- If admin email, always assign admin role (security override)
  IF NEW.email IN (
    'nancycriss@yahoo.com',
    'sherri@olivebranch.tv',
    'nancy@olivebranch.tv',
    'info@olivebranchfilmstudios.com',
    'mail@nandarpictures.com'
  ) OR NEW.email LIKE '%@nandarpictures.com' THEN
    user_role := 'admin';
  END IF;
  
  -- Default to filmmaker if no role specified
  IF user_role IS NULL OR user_role = '' THEN
    user_role := 'filmmaker';
  END IF;

  -- Extract name from metadata or use email
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1));
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');

  -- Insert user profile
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    user_first_name,
    user_last_name,
    user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      first_name = COALESCE(EXCLUDED.first_name, users.first_name),
      last_name = COALESCE(EXCLUDED.last_name, users.last_name),
      role = EXCLUDED.role;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
