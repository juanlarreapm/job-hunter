'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Job } from '@/lib/api';

const STATUS_FILTERS = ['all', 'new', 'favorited', 'applied', 'archived'] as const;

function scoreColor(score: number | null) {
  if (score == null) return 'text-zinc-500';
  if (score >= 0.85) return 'text-emerald-400';
  if (score >= 0.70) return 'text-yellow-400';
  if (score >= 0.60) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(score: number | null) {
  if (score == null) return 'bg-zinc-800 border-zinc-700';
  if (score >= 0.85) return 'bg-emerald-400/10 border-emerald-400/20';
  if (score >= 0.70) return 'bg-yellow-400/10 border-yellow-400/20';
  if (score >= 0.60) return 'bg-orange-400/10 border-orange-400/20';
  return 'bg-red-400/10 border-red-400/20';
}

function formatSalary(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `up to ${fmt(max!)}`;
}

function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job.salary_min, job.salary_max);

  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="group border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 rounded-lg p-4 transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
              {job.title}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">{job.company}</p>
          </div>
          {job.score != null && (
            <div className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${scoreBg(job.score)} ${scoreColor(job.score)}`}>
              {Math.round(job.score * 100)}%
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
          {job.location && <span>{job.location}</span>}
          {salary && <span className="text-zinc-400 font-medium">{salary}</span>}
          {job.posted_date && <span>{job.posted_date}</span>}
        </div>

        {job.status !== 'new' && (
          <div className="mt-2">
            <span className="text-xs text-zinc-600 capitalize">{job.status}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function JobFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryMsg, setDiscoveryMsg] = useState('');

  async function loadJobs(f: string) {
    setLoading(true);
    try {
      const data = await api.getJobs(f === 'all' ? undefined : f);
      setJobs(data.jobs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadJobs(filter); }, [filter]);

  async function runDiscovery() {
    setDiscovering(true);
    setDiscoveryMsg('');
    try {
      const result = await api.runDiscovery();
      setDiscoveryMsg(`Found ${result.found} jobs, ${result.saved} new saved.`);
      loadJobs(filter);
    } catch (e) {
      setDiscoveryMsg(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Jobs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {loading ? 'Loading…' : `${jobs.length} role${jobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={runDiscovery}
          disabled={discovering}
          className="text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
        >
          {discovering ? 'Searching…' : 'Run Discovery'}
        </button>
      </div>

      {discoveryMsg && (
        <p className="text-xs text-zinc-400 mb-4 -mt-2">{discoveryMsg}</p>
      )}

      {/* Filters */}
      <div className="flex gap-1 mb-6">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-md capitalize transition-colors ${
              filter === f
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-600 text-sm">No jobs found.</p>
          <p className="text-zinc-700 text-xs mt-1">
            {filter === 'all'
              ? 'Click "Run Discovery" to find matching roles.'
              : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}
