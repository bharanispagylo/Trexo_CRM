-- Drop the table if it exists to ensure a clean state
DROP TABLE IF EXISTS public.reports CASCADE;

-- Create reports table in public schema
CREATE TABLE public.reports (
    id TEXT PRIMARY KEY,
    task_no TEXT,
    title TEXT NOT NULL,
    company_name TEXT,
    project_name TEXT,
    project_id TEXT,
    client_id TEXT,
    assignees TEXT,
    billable_hours DOUBLE PRECISION DEFAULT 0.0,
    already_billed DOUBLE PRECISION DEFAULT 0.0,
    delivered_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_reports_delivered_date ON public.reports (delivered_date);
CREATE INDEX IF NOT EXISTS idx_reports_client_id ON public.reports (client_id);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON public.reports (project_id);
