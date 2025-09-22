import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateFilmmakerRequest {
  email: string
  first_name: string
  last_name: string
}

Deno.serve(async (req) => {
  console.log('Create filmmaker function called with method:', req.method)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log('Method not allowed:', req.method)
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey
    })

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.log('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    console.log('Supabase clients created')

    // Verify the requesting user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('Auth check result:', { hasUser: !!user, authError: authError?.message })
    
    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('Profile check result:', { profile, profileError: profileError?.message })

    if (profileError || profile?.role !== 'admin') {
      console.error('Admin check failed:', { profileError, role: profile?.role })
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    let requestBody: CreateFilmmakerRequest
    try {
      requestBody = await req.json()
      console.log('Request body parsed:', { email: requestBody.email, hasFirstName: !!requestBody.first_name, hasLastName: !!requestBody.last_name })
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { email, first_name, last_name } = requestBody

    // Validate required fields
    if (!email || !first_name || !last_name) {
      console.log('Missing required fields:', { email: !!email, first_name: !!first_name, last_name: !!last_name })
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, first_name, last_name' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user already exists
    console.log('Checking if user already exists...')
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .single()

    if (existingUserError && existingUserError.code !== 'PGRST116') {
      console.error('Error checking existing user:', existingUserError)
      return new Response(
        JSON.stringify({ error: 'Error checking existing user' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingUser) {
      console.log('User already exists:', existingUser)
      return new Response(
        JSON.stringify({ 
          error: `User with email ${email} already exists with role: ${existingUser.role}`,
          existing_user: {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role
          }
        }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate a temporary password
    const tempPassword = 'TempPass123!'
    console.log('Generated temporary password')

    // Create the user using admin API
    console.log('Creating auth user...')
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role: 'filmmaker'
      }
    })

    if (createError) {
      console.error('Error creating auth user:', createError)
      return new Response(
        JSON.stringify({ 
          error: `Failed to create auth user: ${createError.message}`,
          details: createError
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!newUser.user) {
      console.error('No user returned from auth creation')
      return new Response(
        JSON.stringify({ error: 'Failed to create user - no user returned' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Auth user created successfully with ID:', newUser.user.id)

    // Insert user profile into users table using service role
    console.log('Creating user profile...')
    const { data: insertedUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email,
        first_name,
        last_name,
        role: 'filmmaker'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting user profile:', insertError)
      
      // Try to clean up the auth user if profile creation failed
      console.log('Attempting to clean up auth user...')
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        console.log('Successfully cleaned up auth user')
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to create user profile: ${insertError.message}`,
          details: insertError
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Successfully created filmmaker profile:', insertedUser)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        email,
        first_name,
        last_name,
        temporary_password: tempPassword,
        message: 'Filmmaker created successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in create-filmmaker function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})