const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  url: string;
  source: string | null;
  posted_date: string | null;
  score: number | null;
  score_breakdown: string | null;
  status: string;
  discovered_at: string;
  updated_at: string;
}

export interface Application {
  id: number;
  job_id: number;
  tailored_resume_json: string | null;
  tailored_resume_path: string | null;
  cover_letter: string | null;
  ats_score: number | null;
  ats_keywords_matched: string | null;
  ats_keywords_missing: string | null;
  status: string;
  created_at: string;
}

export interface TailorResult {
  application_id: number;
  docx_path: string;
  tailored_resume: {
    contact: Record<string, string>;
    summary: string;
    experience: Array<{
      id: string;
      title: string;
      company: string;
      dates: string;
      location: string;
      bullets: string[];
    }>;
    skills: string[];
  };
  ats_analysis: {
    score: number;
    keywords_matched: string[];
    keywords_missing: string[];
    suggestions: string[];
  };
  tailoring_notes: string;
  cover_letter: string;
}

export interface DiscoveryResult {
  found: number;
  saved: number;
  top_jobs: Array<{ title: string; company: string; score: number }>;
}

export interface OutreachDraftResult {
  outreach_id: number;
  message: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getJobs: (status?: string): Promise<{ jobs: Job[]; count: number }> => {
    const qs = status ? `?status=${status}` : '';
    return apiFetch(`/api/jobs${qs}`);
  },

  getJob: (jobId: number): Promise<Job> =>
    apiFetch(`/api/jobs/${jobId}`),

  updateJobStatus: (jobId: number, status: string): Promise<{ ok: boolean }> =>
    apiFetch(`/api/jobs/${jobId}/status?status=${status}`, { method: 'POST' }),

  runDiscovery: (): Promise<DiscoveryResult> =>
    apiFetch('/api/jobs/discover', { method: 'POST' }),

  getApplication: async (jobId: number): Promise<Application | null> => {
    const res = await fetch(`${API_BASE}/api/applications/${jobId}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  },

  tailorResume: (
    jobId: number,
    jobDescription: string,
    companyInfo?: string,
  ): Promise<TailorResult> =>
    apiFetch('/api/applications/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        job_description: jobDescription,
        company_info: companyInfo ?? '',
      }),
    }),

  draftOutreach: (params: {
    job_id: number;
    recipient_name: string;
    recipient_title: string;
    recipient_type: string;
    message_type: string;
    recipient_linkedin_url?: string;
  }): Promise<OutreachDraftResult> =>
    apiFetch('/api/outreach/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }),
};
