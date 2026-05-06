/*
  # Ensure User Profile Creation on Auth Signup

  1. Issue: User profiles may not be created properly on signup
  2. Solution: Add/update trigger to automatically create user profiles
  3. Changes:
    - Ensure trigger fires on auth.users insert
    - Set correct role based on email domain
*/

-- Update the trigger function to be more robust
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
BEGIN
  user_role := 'filmmaker';
  
  -- Check if email is in admin list
  IF NEW.email IN (
    'nancycriss@yahoo.com',
    'sherri@olivebranch.tv',
    'nancy@olivebranch.tv',
    'info@olivebranchfilmstudios.com',
    'mail@nandarpictures.com'
  ) OR NEW.email LIKE '%@nandarpictures.com' THEN
    user_role := 'admin';
  END IF;

  -- Insert user profile if not exists
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    role = CASE 
      WHEN EXCLUDED.role = 'filmmaker' AND users.role = 'admin' THEN 'admin'
      ELSE COALESCE(EXCLUDED.role, users.role)
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
