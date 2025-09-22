/*
  # Update user creation trigger to handle admin roles

  1. Updates the trigger function to properly assign admin roles
  2. Ensures admin emails get admin role automatically
  3. Creates proper user profiles in the users table
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT := 'filmmaker';
BEGIN
  -- Check if this is an admin email
  IF NEW.email IN (
    'nancycriss@yahoo.com',
    'sherri@olivebranch.tv', 
    'nancy@olivebranch.tv',
    'info@olivebranchfilmstudios.com',
    'mail@nandarpictures.com'
  ) OR NEW.email LIKE '%@nandarpictures.com' THEN
    user_role := 'admin';
  END IF;

  -- Override with role from metadata if provided
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    user_role := NEW.raw_user_meta_data->>'role';
  END IF;

  -- Insert user profile
  INSERT INTO public.users (
    id,
    email,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    user_role,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();