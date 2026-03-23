import { useState, useEffect } from 'react';

interface AnalyticsData {
  salaryTrends: { range: string; count: number; avgSalary: number }[];
  topSkills: { skill: string; count: number }[];
  hiringTrends: { date: string; count: number }[];
  remoteRatio: { remote: number; onsite: number };
  topCompanies: { company: string; jobCount: number }[];
}

interface Job {
  id: string;
  company: string;
  position: string;
  location: string;
  remote: boolean;
  salary: string;
  postedAt: string;
  tags: string[];
}

interface JobsData {
  jobs: Job[];
}

function parseSalary(salary: string): number | null {
  if (!salary) return null;
  const match = salary.match(/\$?(\d+)k?/i);
  if (!match) return null;
  return parseInt(match[1]) * (match[1].length <= 3 ? 1000 : 1);
}

export default function JobAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/claude-jobs.json')
      .then((r) => r.json())
      .then((jobsData: JobsData) => {
        const analytics = processAnalytics(jobsData.jobs);
        setData(analytics);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function processAnalytics(jobs: Job[]): AnalyticsData {
    // Salary trends
    const salaryRanges = {
      '0-100k': { count: 0, total: 0 },
      '100k-150k': { count: 0, total: 0 },
      '150k-200k': { count: 0, total: 0 },
      '200k+': { count: 0, total: 0 },
    };

    jobs.forEach(job => {
      const salary = parseSalary(job.salary);
      if (salary) {
        if (salary <= 100000) {
          salaryRanges['0-100k'].count++;
          salaryRanges['0-100k'].total += salary;
        } else if (salary <= 150000) {
          salaryRanges['100k-150k'].count++;
          salaryRanges['100k-150k'].total += salary;
        } else if (salary <= 200000) {
          salaryRanges['150k-200k'].count++;
          salaryRanges['150k-200k'].total += salary;
        } else {
          salaryRanges['200k+'].count++;
          salaryRanges['200k+'].total += salary;
        }
      }
    });

    const salaryTrends = Object.entries(salaryRanges).map(([range, data]) => ({
      range,
      count: data.count,
      avgSalary: data.count > 0 ? Math.round(data.total / data.count) : 0,
    }));

    // Top skills
    const skillCounts = new Map<string, number>();
    jobs.forEach(job => {
      job.tags.forEach(tag => {
        skillCounts.set(tag, (skillCounts.get(tag) || 0) + 1);
      });
    });

    const topSkills = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    // Remote ratio
    const remoteCount = jobs.filter(j => j.remote).length;
    const remoteRatio = {
      remote: remoteCount,
      onsite: jobs.length - remoteCount,
    };

    // Top companies
    const companyCounts = new Map<string, number>();
    jobs.forEach(job => {
      companyCounts.set(job.company, (companyCounts.get(job.company) || 0) + 1);
    });

    const topCompanies = Array.from(companyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([company, jobCount]) => ({ company, jobCount }));

    // Hiring trends (last 30 days)
    const hiringTrends: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = jobs.filter(job => {
        const jobDate = new Date(job.postedAt);
        return jobDate.toISOString().split('T')[0] === dateStr;
      }).length;
      hiringTrends.push({ date: dateStr, count });
    }

    return {
      salaryTrends,
      topSkills,
      hiringTrends,
      remoteRatio,
      topCompanies,
    };
  }

  if (loading) {
    return (
      <div className="px-6 py-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#666] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const maxSkillCount = Math.max(...data.topSkills.map(s => s.count));
  const maxSalaryCount = Math.max(...data.salaryTrends.map(s => s.count));

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Salary Trends */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#ededed] mb-3">Salary Distribution</h3>
        <div className="space-y-2">
          {data.salaryTrends.map((trend) => (
            <div key={trend.range} className="flex items-center gap-3">
              <div className="w-24 text-[12px] text-[#a1a1a1]">{trend.range}</div>
              <div className="flex-1 bg-[#1a1a1a] rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500/30 to-emerald-500/50 h-full flex items-center px-2 transition-all"
                  style={{ width: `${(trend.count / maxSalaryCount) * 100}%` }}
                >
                  <span className="text-[11px] text-emerald-400 font-medium">{trend.count} jobs</span>
                </div>
              </div>
              {trend.avgSalary > 0 && (
                <div className="w-24 text-[11px] text-[#666] text-right">
                  Avg: ${(trend.avgSalary / 1000).toFixed(0)}k
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Skills */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#ededed] mb-3">Most In-Demand Skills</h3>
        <div className="grid grid-cols-2 gap-2">
          {data.topSkills.map((skill) => (
            <div key={skill.skill} className="bg-[#111] border border-[#1f1f1f] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-[#ededed]">{skill.skill}</span>
                <span className="text-[11px] text-[#666]">{skill.count}</span>
              </div>
              <div className="bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500/50 h-full transition-all"
                  style={{ width: `${(skill.count / maxSkillCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remote vs On-site */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#ededed] mb-3">Remote vs On-site</h3>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-lg p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-blue-400">Remote</span>
                <span className="text-[12px] text-[#ededed] font-medium">{data.remoteRatio.remote}</span>
              </div>
              <div className="bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500/50 h-full transition-all"
                  style={{ width: `${(data.remoteRatio.remote / (data.remoteRatio.remote + data.remoteRatio.onsite)) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-orange-400">On-site</span>
                <span className="text-[12px] text-[#ededed] font-medium">{data.remoteRatio.onsite}</span>
              </div>
              <div className="bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-orange-500/50 h-full transition-all"
                  style={{ width: `${(data.remoteRatio.onsite / (data.remoteRatio.remote + data.remoteRatio.onsite)) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="text-[11px] text-[#666] text-center">
            {Math.round((data.remoteRatio.remote / (data.remoteRatio.remote + data.remoteRatio.onsite)) * 100)}% of jobs are remote
          </div>
        </div>
      </div>

      {/* Top Hiring Companies */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#ededed] mb-3">Top Hiring Companies</h3>
        <div className="space-y-2">
          {data.topCompanies.map((company, index) => (
            <div key={company.company} className="flex items-center gap-3">
              <div className="w-6 text-[11px] text-[#666] text-center">#{index + 1}</div>
              <div className="flex-1 bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#ededed]">{company.company}</span>
                  <span className="text-[11px] text-[#666]">{company.jobCount} {company.jobCount === 1 ? 'job' : 'jobs'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
