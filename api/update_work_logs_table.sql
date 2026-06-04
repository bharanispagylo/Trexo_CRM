-- Create work_logs table in public schema if not exists
CREATE TABLE IF NOT EXISTS public.work_logs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    hours_worked DOUBLE PRECISION NOT NULL,
    description TEXT,
    is_billed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for work log lookup performance
CREATE INDEX IF NOT EXISTS idx_work_logs_task_id ON public.work_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON public.work_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_log_date ON public.work_logs (log_date);
