'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type Job, type Application, type TailorResult, type OutreachDraftResult } from '@/lib/api';

const STATUSES = ['new', 'favorited', 'applied', 'rejected', 'archived'] as const;

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${className}`}>
      {children}
    </span>
  );
}

function ATSBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 65 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-zinc-300 w-8 text-right">{pct}%</span>
    </div>
  );
}

function ResumePreview({ resume }: { resume: TailorResult['tailored_resume'] }) {
  return (
    <div className="space-y-4 text-sm">
      {/* Summary */}
      {resume.summary && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Summary</h4>
          <p className="text-zinc-300 leading-relaxed text-xs">{resume.summary}</p>
        </div>
      )}

      {/* Experience */}
      {resume.experience?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Experience</h4>
          <div className="space-y-3">
            {resume.experience.map((role) => (
              <div key={role.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">{role.title}</span>
                  <span className="text-xs text-zinc-600 shrink-0">{role.dates}</span>
                </div>
                <p className="text-xs text-zinc-500 mb-1">{role.company}</p>
                <ul className="space-y-0.5">
                  {role.bullets.map((b, i) => (
                    <li key={i} className="text-xs text-zinc-400 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-zinc-600">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {resume.skills?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Skills</h4>
          <div className="flex flex-wrap gap-1">
            {resume.skills.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobDetail() {
  const params = useParams();
  const router = useRouter();
  const jobId = Number(params.id);

  const [job, setJob] = useState<Job | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume' | 'cover' | 'ats'>('resume');

  // Outreach
  const [recipientName, setRecipientName] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('');
  const [recipientType, setRecipientType] = useState('recruiter');
  const [messageType, setMessageType] = useState('connection_request');
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<OutreachDraftResult | null>(null);
  const [draftError, setDraftError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(jobId)) return;
    setLoading(true);
    Promise.all([
      api.getJob(jobId).catch(() => null),
      api.getApplication(jobId),
    ]).then(([j, app]) => {
      setJob(j);
      setApplication(app);
    }).catch(console.error).finally(() => setLoading(false));
  }, [jobId]);

  async function handleTailor() {
    if (!job?.description) return;
    setTailoring(true);
    setTailorError('');
    try {
      const result = await api.tailorResume(jobId, job.description, job.company);
      setTailorResult(result);
      const app = await api.getApplication(jobId);
      setApplication(app);
    } catch (e) {
      setTailorError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setTailoring(false);
    }
  }

  async function handleStatus(status: string) {
    if (!job) return;
    setStatusUpdating(true);
    try {
      await api.updateJobStatus(jobId, status);
      setJob({ ...job, status });
    } catch (e) {
      console.error(e);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleDraftOutreach() {
    if (!recipientName.trim() || !recipientTitle.trim()) return;
    setDrafting(true);
    setDraftError('');
    try {
      const result = await api.draftOutreach({
        job_id: jobId,
        recipient_name: recipientName.trim(),
        recipient_title: recipientTitle.trim(),
        recipient_type: recipientType,
        message_type: messageType,
      });
      setDraftResult(result);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDrafting(false);
    }
  }

  function handleCopy() {
    if (!draftResult?.message) return;
    navigator.clipboard.writeText(draftResult.message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-800 rounded w-64" />
          <div className="h-4 bg-zinc-800 rounded w-40" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">Job not found.</p>
        <button onClick={() => router.back()} className="text-sm text-indigo-400 mt-2">← Back</button>
      </div>
    );
  }

  const hasApplication = application || tailorResult;
  const resume = tailorResult?.tailored_resume ?? (application?.tailored_resume_json ? JSON.parse(application.tailored_resume_json) : null);
  const coverLetter = tailorResult?.cover_letter ?? application?.cover_letter ?? null;
  const atsScore = tailorResult?.ats_analysis?.score ?? application?.ats_score ?? null;
  const atsMatched: string[] = tailorResult?.ats_analysis?.keywords_matched ?? (application?.ats_keywords_matched ? JSON.parse(application.ats_keywords_matched) : []);
  const atsMissing: string[] = tailorResult?.ats_analysis?.keywords_missing ?? (application?.ats_keywords_missing ? JSON.parse(application.ats_keywords_missing) : []);

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <button onClick={() => router.back()} className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 flex items-center gap-1 transition-colors">
        ← Jobs
      </button>

      {/* Job header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{job.title}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{job.company}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {job.location && <Pill className="border-zinc-800 text-zinc-500">{job.location}</Pill>}
            {job.salary_min && job.salary_max && (
              <Pill className="border-zinc-800 text-zinc-400">
                ${(job.salary_min / 1000).toFixed(0)}k – ${(job.salary_max / 1000).toFixed(0)}k
              </Pill>
            )}
            {job.score != null && (
              <Pill className="border-indigo-500/30 text-indigo-400">
                {Math.round(job.score * 100)}% match
              </Pill>
            )}
          </div>
        </div>

        {/* Status + Apply */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
          >
            Apply ↗
          </a>
          <select
            value={job.status}
            onChange={e => handleStatus(e.target.value)}
            disabled={statusUpdating}
            className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 rounded px-2 py-1 cursor-pointer"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Job description */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Job Description</h2>
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{job.description || 'No description available.'}</p>
          </div>
        </div>

        {/* Right: Tailored materials */}
        <div>
          {!hasApplication ? (
            <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30 flex flex-col items-center justify-center text-center min-h-48">
              <p className="text-sm text-zinc-400 mb-1">No tailored materials yet</p>
              <p className="text-xs text-zinc-600 mb-4">Claude will tailor your resume and write a cover letter for this role.</p>
              <button
                onClick={handleTailor}
                disabled={tailoring || !job.description}
                className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {tailoring ? 'Generating…' : 'Generate Tailored Resume + Cover Letter'}
              </button>
              {tailorError && <p className="text-xs text-red-400 mt-3">{tailorError}</p>}
            </div>
          ) : (
            <div>
              {/* Tabs */}
              <div className="flex gap-1 mb-4">
                {(['resume', 'cover', 'ats'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs px-3 py-1 rounded-md capitalize transition-colors ${
                      activeTab === tab ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab === 'ats' ? 'ATS Analysis' : tab === 'cover' ? 'Cover Letter' : 'Resume'}
                  </button>
                ))}
              </div>

              <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30 max-h-[60vh] overflow-y-auto">
                {activeTab === 'resume' && resume && <ResumePreview resume={resume} />}

                {activeTab === 'cover' && (
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {coverLetter || 'No cover letter generated.'}
                  </p>
                )}

                {activeTab === 'ats' && (
                  <div className="space-y-4">
                    {atsScore != null && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">ATS Match Score</p>
                        <ATSBar score={atsScore} />
                      </div>
                    )}
                    {atsMatched.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">Keywords Matched</p>
                        <div className="flex flex-wrap gap-1">
                          {atsMatched.map(k => (
                            <span key={k} className="text-xs px-2 py-0.5 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 rounded">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {atsMissing.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">Keywords Missing</p>
                        <div className="flex flex-wrap gap-1">
                          {atsMissing.map(k => (
                            <span key={k} className="text-xs px-2 py-0.5 bg-red-400/10 border border-red-400/20 text-red-400 rounded">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {tailorResult?.tailoring_notes && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">Tailoring Notes</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">{tailorResult.tailoring_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Re-tailor button + download */}
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleTailor}
                  disabled={tailoring}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  {tailoring ? 'Regenerating…' : 'Regenerate'}
                </button>
                {(tailorResult?.docx_path || application?.tailored_resume_path) && (
                  <a
                    href={`http://localhost:8000/api/applications/${jobId}/download`}
                    download
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    ↓ Download .docx
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Outreach */}
      <div className="mt-8 border-t border-zinc-800 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">Outreach</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Recipient name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-3 py-1.5 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Title</label>
                <input
                  type="text"
                  value={recipientTitle}
                  onChange={e => setRecipientTitle(e.target.value)}
                  placeholder="Senior Recruiter"
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-3 py-1.5 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">They are a</label>
                <select
                  value={recipientType}
                  onChange={e => setRecipientType(e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 rounded px-3 py-1.5 cursor-pointer focus:outline-none focus:border-zinc-600"
                >
                  <option value="recruiter">Recruiter</option>
                  <option value="hiring_manager">Hiring Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Message type</label>
                <select
                  value={messageType}
                  onChange={e => setMessageType(e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 rounded px-3 py-1.5 cursor-pointer focus:outline-none focus:border-zinc-600"
                >
                  <option value="connection_request">Connection request (280 chars)</option>
                  <option value="follow_up">Follow-up (500 chars)</option>
                  <option value="inmail">InMail (1900 chars)</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleDraftOutreach}
              disabled={drafting || !recipientName.trim() || !recipientTitle.trim()}
              className="text-sm px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 rounded-md transition-colors"
            >
              {drafting ? 'Drafting…' : 'Draft Message'}
            </button>
            {draftError && <p className="text-xs text-red-400">{draftError}</p>}
          </div>

          {/* Drafted message */}
          <div>
            {draftResult ? (
              <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-600">
                    {draftResult.message.length}/
                    {messageType === 'connection_request' ? 280 : messageType === 'follow_up' ? 500 : 1900} chars
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                  {draftResult.message}
                </p>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30 flex items-center justify-center min-h-32">
                <p className="text-xs text-zinc-600">Message will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
