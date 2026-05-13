
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

const cloud_name = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const cloud_key = process.env.REACT_APP_CLOUDINARY_CLOUD_KEY;

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase