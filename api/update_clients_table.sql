-- Create clients table in public schema if not exists
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    client_type TEXT DEFAULT 'Direct',
    parent_agency_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    address TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for parent agency mapping
CREATE INDEX IF NOT EXISTS idx_clients_parent_agency_id ON public.clients (parent_agency_id);
