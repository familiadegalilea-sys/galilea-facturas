// Configuración de Supabase y de la app

const SUPABASE_URL = 'https://lcbgqqojbehfqgklpehv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZR-_1AtnCkw_TP434LlFAg_3amfzfTP';

// Clave de acceso simple (cambiar antes de usar)
const PALABRA_CLAVE = 'CAMBIAR_CLAVE';

// Inicializar cliente de Supabase (el CDN expone window.supabase)
const _supabaseLib = window.supabase;
window.supabase = _supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
