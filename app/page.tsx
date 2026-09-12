"use client";
import { UpdateNotice } from "../components/update-notice";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock3,
  Download,
  FileText,
  Flag,
  Globe2,
  Inbox,
  LockKeyhole,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  defaultProfile,
  matchesLocationPreference,
  officialListingProvider,
  scoreJob,
  type Job,
  type Profile,
  type Source,
} from "@/lib/model";

import {inboxDecision} from "@/lib/search-policy";
import type {SearchReport} from "@/lib/brave-search";
type InboxData = { jobs: Job[]; profile: Profile; sources: Source[]; generationAvailable?: boolean };
const emptyManualJob = {
  url: "",
};
const stages = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "review", label: "Needs review", icon: Flag },
  { id: "applied", label: "Applied", icon: CheckCheck },
  { id: "rejected", label: "Rejected", icon: X },
  { id: "passed", label: "Passed", icon: X },
];
function dateLabel(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not known";
}
function checkedLabel(value: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );
  return days === 0
    ? "Checked today"
    : days === 1
      ? "Checked yesterday"
      : `Checked ${days}d ago`;
}
async function request(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data: any = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export default function Home() {
  const [data, setData] = useState<InboxData>({
    jobs: [],
    profile: defaultProfile,
    sources: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("inbox");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState("");
  const [searchInfo,setSearchInfo]=useState<{configured:boolean;usage:{remaining:number;limit:number};total:number}|null>(null);
  const [searchReports,setSearchReports]=useState<SearchReport[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState<Profile>(defaultProfile);
  const [sourceDialog, setSourceDialog] = useState(false);
  const [company, setCompany] = useState("");
  const [boardUrl, setBoardUrl] = useState("");
  const [reasonDialog, setReasonDialog] = useState<{
    id: string;
    status: "passed" | "rejected";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [coverJobId, setCoverJobId] = useState<string | null>(null);
  const [coverDraft, setCoverDraft] = useState("");
  const [manualDialog, setManualDialog] = useState(false);
  const [manualJob, setManualJob] = useState(emptyManualJob);
  async function load() {
    const next = await request("/api/inbox");
    setData(next);
    setDraft(next.profile);
    if (!next.profile.onboardingComplete) setTab("profile");
    try{const info=await request("/api/search");setSearchInfo(info);setSearchReports(info.reports||[]);}catch{setSearchInfo(null);}
    setError("");
    return next as InboxData;
  }
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const scored = useMemo(
    () =>
      data.jobs
        .map((j) => ({ ...j, score: scoreJob(j, data.profile) }))
        .sort(
          (a, b) =>
            b.score.fit - a.score.fit ||
            b.score.quality - a.score.quality ||
            b.lastSeen.localeCompare(a.lastSeen),
        ),
    [data.jobs, data.profile],
  );
  const eligible = scored.filter((j) =>
    j.status === "inbox" &&
    j.active &&
    inboxDecision(j,data.profile)==="match",
  );
  const reviewJobs=scored.filter(j=>j.status==="inbox"&&inboxDecision(j,data.profile)!=="excluded"&&(!j.active||inboxDecision(j,data.profile)==="review"));
  const visible = scored.filter(
    (j) =>
      (tab==="review"?reviewJobs.some(r=>r.id===j.id):j.status === tab) &&
      (tab !== "inbox" || eligible.some((eligibleJob) => eligibleJob.id === j.id)) &&
      `${j.title} ${j.company} ${j.location} ${j.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected = scored.find((j) => j.id === selectedId);
  const selectedSource = data.sources.find((s) => s.id === selected?.source);
  const latestSourceCheck = data.sources
    .map((source) => source.checkedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
  async function changeStatus(id: string, status: string, reasonText = "") {
    setPending(id);
    try {
      const previous = data.jobs.find((j) => j.id === id);
      await request("/api/inbox", {
        action: "status",
        id,
        status,
        reason: reasonText,
      });
      setData((d) => ({
        ...d,
        jobs: d.jobs.map((j) =>
          j.id === id ? { ...j, status, reason: reasonText } : j,
        ),
      }));
      setReasonDialog(null);
      toast.success(
        status === "inbox" ? "Returned to inbox" : `Moved to ${status}`,
        {
          action: {
            label: "Undo",
            onClick: () => {
              if (previous)
                void changeStatus(id, previous.status, previous.reason);
            },
          },
        },
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  function askReason(
    id: string,
    status: "passed" | "rejected",
  ) {
    setReason("");
    setReasonDialog({ id, status });
  }
  async function refresh(one?: Source) {
    setRefreshing(true);
    setError("");
    const list = one
      ? [one]
      : [...data.sources].filter(s=>s.provider!=="brave").sort(
          (a, b) => Number(a.provider === "linkedin") - Number(b.provider === "linkedin"),
        );
    let failed = 0;
    try {
      if(!one||one.provider==="brave"){
        try{
          const info=await request("/api/search");setSearchInfo(info);
          if(!info.configured)throw new Error("Brave is not connected; only free feeds will be checked.");
          setSearchReports([]);
          for(let index=0;index<info.total;index++){
            setProgress(`Searching the web · query ${index+1} of ${info.total}`);
            let batch:number|null=0;
            do{
              const result=await request("/api/search",{index,batch});
              setSearchReports(r=>[...r,result.report]);
              batch=result.nextBatch;
            }while(batch!==null);
          }
        }catch(e){failed++;toast.error((e as Error).message);}
      }
      const feeds=list.filter(s=>s.provider!=="brave");
      for (let i = 0; i < feeds.length; i++) {
        setProgress(`Checking ${feeds[i].company} · ${i + 1} of ${feeds.length}`);
        try {
          await request("/api/refresh", { source: feeds[i].id });
        } catch (e) {
          failed++;
          toast.error((e as Error).message);
        }
      }
      if(!one){
        try{
          const queue=await request("/api/search",{action:"followupQueue"});
          for(let i=0;i<queue.ids.length;i++){
            setProgress(`Checking employer sites · ${i+1} of ${queue.ids.length}`);
            await request("/api/search",{action:"verify",id:queue.ids[i]});
          }
          if(queue.deferred)toast.info(`${queue.deferred} employer checks deferred to a later refresh.`);
        }catch(e){failed++;toast.error((e as Error).message);}
      }
      await load();
      setProgress(
        failed
          ? `Search partially completed; ${failed} checks need attention. See Sources.`
          : "Search complete. See Sources for queries, limits, and verification details.",
      );
      if (!failed) toast.success("Source checks complete");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  async function resetSearch() {
    if (!window.confirm("Clear every discovered listing except jobs you applied to or added manually, then run a fresh search?")) return;
    setPending("reset-search");
    try {
      await request("/api/inbox", { action: "resetSearch" });
      await load();
      toast.success("Old discovered listings cleared");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setPending("profile");
    try {
      await request("/api/inbox", { action: "profile", profile: { ...draft, onboardingComplete: true } });
      setData((d) => ({ ...d, profile: { ...draft, onboardingComplete: true } }));
      setTab("inbox");
      toast.success("Preferences saved. Your inbox has been re-ranked.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setPending("source");
    try {
      await request("/api/inbox", { action: "source", company, url: boardUrl });
      await load();
      setSourceDialog(false);
      setCompany("");
      setBoardUrl("");
      toast.success("Company added. Check its feed to import jobs.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  async function addManualJob(e: React.FormEvent) {
    e.preventDefault();
    setPending("manual-job");
    try {
      const result = await request("/api/inbox", {
        action: "importJob",
        url: manualJob.url,
      });
      await load();
      setManualDialog(false);
      setManualJob(emptyManualJob);
      setTab("inbox");
      if (result.id) setSelectedId(result.id);
      toast.success("Listing details gathered and added to your inbox.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  function useResumeSkills() {
    const phrases = [
      "design systems",
      "user research",
      "interaction design",
      "B2B",
      "SaaS",
      "leadership",
      "prototyping",
      "Figma",
      "accessibility",
      "usability testing",
      "product strategy",
      "information architecture",
      "visual design",
      "management",
    ];
    const found = phrases.filter((s) =>
      draft.resume.toLowerCase().includes(s.toLowerCase()),
    );
    if (!found.length) {
      toast.info("No common skill phrases found. Add your skills directly.");
      return;
    }
    setDraft({ ...draft, skills: found.join(", ") });
    toast.success(
      "Skill phrases copied from your résumé. Review before saving.",
    );
  }
  const canGenerate = Boolean(data.generationAvailable && data.profile.evidenceApproved && data.profile.resume.trim() && data.profile.name?.trim());
  async function openCoverLetter(job: Job) {
    if (!job.coverLetter && !canGenerate) return;
    setCoverJobId(job.id);
    if (job.coverLetter) {
      setCoverDraft(job.coverLetter);
      return;
    }
    setCoverDraft("");
    setPending("cover-letter-generate");
    try {
      const result = await request("/api/cover-letter", {
        id: job.id,
        regenerate: false,
      });
      setCoverDraft(result.content);
      setData((d) => ({
        ...d,
        jobs: d.jobs.map((item) =>
          item.id === job.id ? { ...item, coverLetter: result.content } : item,
        ),
      }));
      toast.success("A tailored cover letter was generated and saved.");
    } catch (e) {
      toast.error((e as Error).message);
      setCoverJobId(null);
    } finally {
      setPending(null);
    }
  }
  async function regenerateCoverLetter() {
    if (!coverJobId || !canGenerate) return;
    setPending("cover-letter-generate");
    try {
      const result = await request("/api/cover-letter", {
        id: coverJobId,
        regenerate: true,
      });
      setCoverDraft(result.content);
      setData((d) => ({
        ...d,
        jobs: d.jobs.map((item) =>
          item.id === coverJobId
            ? { ...item, coverLetter: result.content }
            : item,
        ),
      }));
      toast.success("A new tailored version was generated and saved.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  async function saveCoverLetter() {
    if (!coverJobId) return;
    setPending("cover-letter");
    try {
      await request("/api/inbox", {
        action: "coverLetter",
        id: coverJobId,
        content: coverDraft,
      });
      setData((d) => ({
        ...d,
        jobs: d.jobs.map((j) =>
          j.id === coverJobId ? { ...j, coverLetter: coverDraft } : j,
        ),
      }));
      toast.success("Cover letter saved with this listing.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brandmark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="brand-name">
            signal<span style={{ color: "#ddf879" }}>.</span>
          </span>
          <span className="brand-descriptor">Your personal job radar</span>
        </div>
        <div className="private">
          <LockKeyhole size={14} />
          <span>Private workspace</span>
          <span className="avatar">{data.profile.name?.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "S"}</span>
        </div>
      </header>
      <main className="page">
        <div className="jobs-header">
          <div>
            <h1>Your jobs</h1>
            <p className="subtle">{loading ? "Loading…" : latestSourceCheck ? `Last checked ${dateLabel(latestSourceCheck)}` : "No searches yet"}</p>
          </div>
            <div className="nav-actions">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Settings" title="Settings" className="settings-trigger !bg-transparent !border-0 !shadow-none">
                    <Settings size={18} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="settings-menu">
                  <DropdownMenuItem onSelect={() => { setTab("sources"); setQuery(""); }}>
                    <Globe2 size={16} /> Sources
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setTab("profile"); setQuery(""); }}>
                    <SlidersHorizontal size={16} /> Preferences
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => setManualDialog(true)}>
                <Plus size={15} />
                Add job
              </Button>
              <Button
                className="refresh signal-cta"
                disabled={refreshing || loading || !data.sources.length}
                onClick={() => refresh()}
              >
                <RefreshCw
                  className={refreshing ? "btn-icon spin" : "btn-icon"}
                />
                {refreshing ? "Checking sources…" : "Check for jobs"}
              </Button>

            </div>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setQuery("");
          }}
          className="workspace-tabs"
        >
          <div className="navstrip">
            <TabsList aria-label="Filter jobs by status">
              {stages.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>
                  {s.label}
                  <span className="tabcount">
                    {s.id === "inbox"
                      ? eligible.length
                      : s.id==="review"?reviewJobs.length:data.jobs.filter((j) => j.status === s.id).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

          </div>
          {error && (
            <div className="message" role="alert">
              {error}{" "}
              <button
                className="underline"
                onClick={() => {
                  setLoading(true);
                  load()
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                }}
              >
                Retry
              </button>
              {error.includes("sign in") && (
                <a
                  className="underline ml-3"
                  href="/"
                  target="_top"
                >
                  Sign in
                </a>
              )}
            </div>
          )}
          {(progress || loading) && (
            <div className="statusline" role="status">
              {refreshing && <RefreshCw size={14} className="spin" />}
              {progress || "Opening your inbox…"}
            </div>
          )}
          {stages.map((stage) => (
            <TabsContent key={stage.id} value={stage.id}>
              <div className="workspace">
                <section aria-label={`${stage.label} jobs`}>
                  <div className="toolbar">
                    <div className="search-wrap">
                      <Search size={17} color="#718297" />
                      <input
                        aria-label="Search jobs"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search title, company, or keyword"
                      />
                    </div>
                    <span className="sort-note">
                      <ArrowDownWideNarrow
                        size={14}
                        style={{ display: "inline", marginRight: 7 }}
                      />
                      Best fit first
                    </span>
                  </div>
                  {loading ? (
                    <div className="loading">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : visible.length ? (
                    <div className="joblist">
                      {visible.map((j) => (
                        <article className="jobcard" key={j.id}>
                          <div className="company-icon" aria-hidden="true">
                            {j.company.slice(0, 2)}
                          </div>
                          <div>
                            <button
                              className="job-heading"
                              onClick={() => setSelectedId(j.id)}
                            >
                              {j.title}
                            </button>
                            <div className="company-line">{j.company}</div>
                            <div className="job-meta">
                              <span>
                                <MapPin size={14} />
                                {j.location}
                              </span>
                              <span>{j.salary}</span>
                            </div>
                            <div className="jobfoot">
                              <span
                                className={`badge ${j.active && j.verification === "employer" ? "" : "warn"}`}
                              >
                                <ShieldCheck size={12} />
                                {j.origin === "linkedin"
                                  ? officialListingProvider(j)
                                    ? "Employer listing verified"
                                    : "LinkedIn discovery · Needs verification"
                                  : j.origin === "manual"
                                  ? officialListingProvider(j)
                                    ? "Official ATS listing"
                                    : "Manually added"
                                  : j.active
                                    ? j.verification==="employer"?"Employer page checked":"Market listing found · unverified"
                                    : "Availability unknown · needs recheck"}
                              </span>
                              {j.verificationReason && j.verification !== "employer" && <span className="badge warn">{j.verificationReason}</span>}
                              {j.linkedinUrl && (
                                <span className="badge linkedin">
                                  LinkedIn + employer match
                                </span>
                              )}
                              <span className="badge neutral">
                                <Clock3 size={12} />
                                {checkedLabel(j.lastSeen)}
                              </span>
                              {!matchesLocationPreference(j, data.profile) && (
                                <span className="badge warn">
                                  Review location
                                </span>
                              )}
                              {j.reason && (
                                <span className="badge neutral">
                                  {j.reason}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="scores">
                            <div className="scorebox fit">
                              <strong>{j.score.fit}</strong>
                              <span>Fit</span>
                            </div>
                            <div className="scorebox">
                              <strong>{j.score.quality}</strong>
                              <span>Confidence</span>
                            </div>
                          </div>
                          <div className="card-actions">
                            <button
                              className="text-action"
                              disabled={pending === j.id}
                              onClick={() =>
                                j.status === "passed"
                                  ? changeStatus(j.id, "inbox")
                                  : j.status === "rejected"
                                    ? changeStatus(j.id, "applied")
                                    : j.status === "applied"
                                      ? askReason(j.id, "rejected")
                                      : askReason(j.id, "passed")
                              }
                            >
                              {j.status === "passed" ||
                              j.status === "rejected" ? (
                                <ArrowRight size={14} />
                              ) : (
                                <X size={14} />
                              )}{" "}
                              {j.status === "rejected"
                                ? "Return to applied"
                                : j.status === "applied"
                                  ? "Mark rejected"
                                : j.status === "passed"
                                  ? "Restore"
                                  : "Pass"}
                            </button>
                            <button
                              className="text-action detail"
                              onClick={() => setSelectedId(j.id)}
                            >
                              Review listing <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty className="emptybox">
                      <EmptyHeader>
                        <EmptyMedia>
                          <Inbox size={30} />
                        </EmptyMedia>
                        <EmptyTitle>
                          {stage.id === "inbox"
                            ? "Nothing in this view yet"
                            : `No ${stage.label.toLowerCase()} jobs yet`}
                        </EmptyTitle>
                        <EmptyDescription>
                          {query
                            ? "Try a different search."
                            : stage.id === "inbox"
                              ? "Check for jobs, or review listings with uncertain eligibility in Needs review."
                              : "Use the actions on a listing to move it here."}
                        </EmptyDescription>
                      </EmptyHeader>
                      {stage.id === "inbox" && (
                        <Button
                          variant="outline"
                          onClick={() => setTab("profile")}
                        >
                          Edit preferences
                        </Button>
                      )}
                    </Empty>
                  )}
                </section>
                <aside className="aside">
                  <div className="sidepanel">
                    <h2>
                      <SlidersHorizontal
                        size={17}
                        style={{ display: "inline", marginRight: 9 }}
                      />
                      Search Criteria
                    </h2>
                    <div className="side-label">Target roles</div>
                    <ul className="role-list">
                      {data.profile.roles
                        .split(",")
                        .map((role) => role.trim())
                        .filter(Boolean)
                        .map((role) => (
                          <li key={role}>{role}</li>
                        ))}
                    </ul>
                    <div className="side-section">
                      <div className="side-label">Where you work</div>
                      <p>
                        {data.profile.location === "preferred"
                          ? "Preferred locations"
                          : data.profile.location === "remote"
                            ? "Remote · all regions"
                            : "All locations"}
                      </p>
                    </div>
                    <div className="side-section">
                    <div className="side-label">Pay & listing confidence</div>
                      <p>
                        {data.profile.minSalary
                          ? `$${data.profile.minSalary.toLocaleString()} salary floor`
                          : "No salary floor set"}
                        <br />
                        Warn below confidence {data.profile.minQuality}
                      </p>
                    </div>
                    <button
                      className="side-link"
                      onClick={() => setTab("profile")}
                    >
                      Edit search criteria <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="principle">
                    <ShieldCheck size={22} />
                    <strong>Evidence over promises.</strong>An ATS listing is a
                    source check, not proof of hiring intent. Open a job to see
                    exactly what contributes to each score.
                  </div>
                  <div className="principle">
                    <Sparkles size={21} />
                    <strong>Fit is a starting point.</strong>Title, location,
                    skill phrases, and pay. This first version uses transparent
                    rules, not an AI résumé assessment.
                  </div>
                </aside>
              </div>
            </TabsContent>
          ))}
          {tab === "sources" && <section aria-label="Sources">
            <section className="content-panel">
              <p className="subtle">{searchInfo?`${searchInfo.configured?"Brave connected":"Brave not connected"} · ${searchInfo.usage.remaining} of ${searchInfo.usage.limit} app requests remaining this UTC month`:"Brave search status unavailable"}</p>
              <p className="subtle">24-hour search cache · Up to 24 discovery searches plus 20 employer follow-up searches per refresh · Up to 20 results per query, checked in batches of 6. Counts below are per-query observations, not unique jobs. Free-budget protection covers this installation only; use a dedicated key/account budget.</p>
              <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer">Powered by Brave Search</a>
              {searchReports.length>0&&<details><summary>Last search: {searchReports.length} query batches processed</summary>{searchReports.map((r,i)=><div key={i} className="side-section"><strong>{r.query} · page {r.page+1}{r.cached?" · cached":""}</strong><p>{r.returned} results · {r.checked} pages checked · {r.saved} matching · {r.review} need review · {r.excluded} excluded · {r.deferred} remaining in this query when this batch finished</p>{r.issues.map((issue,k)=><p key={k}><a href={issue.url} target="_blank" rel="noopener noreferrer">Review result</a>: {issue.reason}</p>)}</div>)}</details>}
              <div className="panel-heading">
                <div>
                  <h2>Search coverage and usage</h2>
                  <p className="subtle">
                    Brave searches by role and location, without a company list. After discovery, Signal checks application links and searches for matching employer listings for up to 20 relevant unverified jobs. Checks are cached for 24 hours and share the same monthly allowance. LinkedIn remains manual. Search absence never means a job has closed.
                  </p>
                </div>
                <div className="nav-actions">
                  <Button variant="ghost" disabled={pending === "reset-search" || refreshing} onClick={() => void resetSearch()}>
                    <Trash2 size={15} />
                    Reset search
                  </Button>
                  <Button variant="outline" onClick={() => setSourceDialog(true)}>
                    <Plus size={15} />
                    Add company
                  </Button>
                </div>
              </div>
              <div className="sourcegrid">
                {data.sources.filter((s) => s.provider !== "brave").map((s) => (
                  <article className="sourcecard" key={s.id}>
                    <div className="sourcehead">
                      <div className="company-icon">
                        {s.company.slice(0, 2)}
                      </div>
                      <div>
                        <h3>{s.company}</h3>
                        <span className="subtle">
                          {s.provider === "greenhouse"
                            ? "Greenhouse"
                            : s.provider === "ashby"
                              ? "Ashby"
                              : s.provider === "linkedin"
                                ? "LinkedIn"
                                : s.provider === "jobicy"
                                  ? "Jobicy"
                                  : s.provider === "remoteok"
                                    ? "Remote OK"
                                    : s.provider === "arbeitnow"
                                      ? "Arbeitnow"
                              : "Lever"}{" "}
                          · {s.token}
                        </span>
                      </div>
                    </div>
                    <span className={`badge ${s.error ? "warn" : "neutral"}`}>
                      {s.error
                        ? "Check failed"
                        : s.checkedAt
                          ? ["linkedin", "jobicy", "remoteok", "arbeitnow"].includes(s.provider)
                            ? `${s.count || 0} relevant listings discovered`
                            : `${s.count || 0} design listings found`
                          : "Not checked yet"}
                    </span>
                    <p className="subtle" style={{ marginTop: 12 }}>
                      Last successful check: {dateLabel(s.checkedAt)}
                    </p>
                    {s.error && <p className="subtle">{s.error}</p>}
                    <div className="sourcefooter">
                      <a
                        href={
                          s.careers ||
                          (s.provider === "greenhouse"
                            ? `https://job-boards.greenhouse.io/${s.token}`
                            : s.provider === "ashby"
                              ? `https://jobs.ashbyhq.com/${s.token}`
                              : `https://jobs.lever.co/${s.token}`)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {["jobicy", "remoteok", "arbeitnow"].includes(s.provider)
                          ? "Open source"
                          : "Open job board"} ↗
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={refreshing}
                        onClick={() => refresh(s)}
                      >
                        Check feed
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              <p className="subtle" style={{ marginTop: 24 }}>
                Greenhouse, Lever, and Ashby are supported. Existing listings
                stay in your workspace even when absent from a later search.
                Repeated requisition IDs are updated in place without changing
                your application status, notes, or cover letter.
              </p>
            </section>
          </section>}
          {tab === "profile" && <section aria-label="Preferences">
            <section className="content-panel">
              <div className="panel-heading">
                <div>
                  <h2>{data.profile.onboardingComplete ? "Make the search yours." : "Welcome to Signal"}</h2>
                  <p className="subtle">
                    Choose your target roles and locations. Add résumé evidence now or later; job tracking works without AI.
                  </p>
                </div>
              </div>
              <form onSubmit={saveProfile}>
                <div className="formgrid">
                  <div className="field full">
                    <label htmlFor="candidate-name">Your name · required for cover letters</label>
                    <Input id="candidate-name" maxLength={120} value={draft.name || ""} onChange={e=>setDraft({...draft,name:e.target.value,evidenceApproved:false})} />
                  </div>
                  <div className="field full">
                    <label htmlFor="roles">Target roles</label>
                    <Textarea
                      id="roles"
                      required
                      maxLength={1000}
                      value={draft.roles}
                      onChange={(e) =>
                        setDraft({ ...draft, roles: e.target.value })
                      }
                    />
                    <small>
                      Separate titles with commas. Title matches contribute up
                      to 40 fit points.
                    </small>
                  </div>
                  <div className="field">
                    <label htmlFor="location">Location</label>
                    <Select
                      value={draft.location}
                      onValueChange={(v) =>
                        setDraft({
                          ...draft,
                          location: v as Profile["location"],
                        })
                      }
                    >
                      <SelectTrigger id="location" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preferred">
                          Preferred locations
                        </SelectItem>
                        <SelectItem value="remote">
                          Remote · all regions
                        </SelectItem>
                        <SelectItem value="all">All locations</SelectItem>
                      </SelectContent>
                    </Select>
                    <small>
                      Location comes from the feed label. Confirm state and
                      residency restrictions in the posting.
                    </small>
                  </div>
                  <div className="field full">
                    <label htmlFor="preferred-locations">Preferred locations</label>
                    <Input id="preferred-locations" maxLength={1000} placeholder="Cities, regions, or countries, separated by commas" value={draft.preferredLocations || ""} onChange={e=>setDraft({...draft,preferredLocations:e.target.value})} />
                    <small>Used when Location is set to Preferred locations. Matches feed text; verify eligibility in the listing.</small>
                  </div>
                  <div className="field">
                    <label htmlFor="salary">Minimum annual salary (USD)</label>
                    <Input
                      id="salary"
                      type="number"
                      min="0"
                      max="1000000"
                      step="1000"
                      value={draft.minSalary}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          minSalary: Number(e.target.value),
                        })
                      }
                    />
                    <small>
                      0 means no floor. Listings stay visible; detected ranges
                      below your floor rank lower. Verify currency and pay bands.
                    </small>
                  </div>
                  <div className="field">
                    <label htmlFor="quality">
                      Low-confidence warning threshold
                    </label>
                    <Input
                      id="quality"
                      type="number"
                      min="0"
                      max="100"
                      value={draft.minQuality}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          minQuality: Number(e.target.value),
                        })
                      }
                    />
                    <small>
                      This no longer hides listings. Scores below the threshold
                      receive a warning. Source presence 50 · recent check 15 ·
                      description 15 · pay 10 · department 10.
                    </small>
                  </div>
                  <div className="field">
                    <label htmlFor="skills">Skills to look for</label>
                    <Textarea
                      id="skills"
                      maxLength={1000}
                      value={draft.skills}
                      onChange={(e) =>
                        setDraft({ ...draft, skills: e.target.value })
                      }
                    />
                    <small>
                      Comma-separated phrases. Matching is literal in this
                      version, contributing up to 25 fit points.
                    </small>
                  </div>
                  <div className="field full">
                    <label htmlFor="resume">
                      Résumé text <span className="subtle">· optional</span>
                    </label>
                    <Textarea
                      id="resume"
                      rows={8}
                      maxLength={40000}
                      placeholder="Paste your résumé here to keep it with your search and pull common skill phrases into your preferences."
                      value={draft.resume}
                      onChange={(e) =>
                        setDraft({ ...draft, resume: e.target.value, evidenceApproved: false })
                      }
                    />
                    <small>
                      Saved privately. Generating a letter sends approved résumé and portfolio text plus the selected listing to OpenAI. Review the evidence before enabling this.
                    </small>
                    <Button
                      type="button"
                      variant="outline"
                      className="self-start"
                      disabled={!draft.resume.trim()}
                      onClick={useResumeSkills}
                    >
                      Use skill phrases from résumé
                    </Button>
                  </div>
                  <div className="field full">
                    <label htmlFor="resume-file">Import résumé text (.txt, up to 100 KB)</label>
                    <Input id="resume-file" type="file" accept=".txt,text/plain" onChange={async e=>{const file=e.target.files?.[0]; if(!file)return; if(file.size>100000){toast.error("Choose a text file under 100 KB.");return;} const text=await file.text(); if(text.length>40000){toast.error("Résumé must be under 40,000 characters.");return;} setDraft(d=>({...d,resume:text,evidenceApproved:false})); e.target.value="";}} />
                    <small>For PDF or Word résumés, copy the text into the field above. Original files are not stored.</small>
                  </div>
                  <div className="field full">
                    <label htmlFor="portfolio">Portfolio evidence · optional</label>
                    <Textarea id="portfolio" rows={5} maxLength={40000} placeholder="Paste the portfolio facts and achievements you want letters to use. URLs alone are not fetched." value={draft.portfolio || ""} onChange={e=>setDraft({...draft,portfolio:e.target.value,evidenceApproved:false})} />
                  </div>
                  <div className="field full">
                    <label><input type="checkbox" checked={Boolean(draft.evidenceApproved)} onChange={e=>setDraft({...draft,evidenceApproved:e.target.checked})} /> I reviewed this evidence and allow Signal to send it with the selected listing to OpenAI when I generate a letter.</label>
                    <small>You can replace or clear this text and revoke approval at any time. Saved letters remain until you edit or clear them.</small>
                  </div>
                </div>
                <div className="form-actions">
                  <Button type="submit" disabled={pending === "profile"}>
                    {pending === "profile" ? "Saving…" : (data.profile.onboardingComplete ? "Save preferences" : "Finish setup")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDraft(data.profile)}
                  >
                    Reset unsaved changes
                  </Button>
                </div>
              </form>
            </section>
          </section>}
        </Tabs>
        {!loading && !error && !canGenerate && <p role="status" className="drawer-note">{!data.generationAvailable ? "Cover-letter generation is not configured for this instance. Job tracking is available." : "To enable cover letters, save your name, résumé, and evidence approval in Preferences."}</p>}
        {!loading && !error && <UpdateNotice />}
        <footer className="footer">
          <span>Signal · A personal job inbox</span>
          <span>Confidence ≠ hiring intent. Fit ≠ likelihood of an offer.</span>
        </footer>
      </main>
      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="drawer">
          {selected && (
            <>
              <div className="eyebrow">
                {selected.company} / {selected.department || "Role"}
              </div>
              <SheetTitle>{selected.title}</SheetTitle>
              <SheetDescription>{selected.location}</SheetDescription>
              <div className="job-meta">
                <span>{selected.salary}</span>
                <span className={`badge ${selected.active && selected.verification === "employer" ? "" : "warn"}`}>
                  <ShieldCheck size={12} />
                  {selected.origin === "linkedin"
                    ? officialListingProvider(selected)
                      ? `Verified on ${officialListingProvider(selected)}`
                      : "LinkedIn discovery · Needs verification"
                    : selected.origin === "manual"
                    ? officialListingProvider(selected)
                      ? `Verified on ${officialListingProvider(selected)}`
                      : "Manually added"
                    : selected.active
                      ? selected.verification === "employer" ? "Employer page checked" : "Market listing found · unverified"
                      : "Availability unknown · needs recheck"}
                </span>
              </div>
              {selected.verificationReason && <p className="subtle">{selected.verificationReason}</p>}
              {selected.discoveryUrl && selected.discoveryUrl !== selected.url && <a href={selected.discoveryUrl} target="_blank" rel="noopener noreferrer">Original discovery listing ↗</a>}
              <div className="detail-actions">
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${selected.title} at ${selected.company} in a new browser tab`}
                >
                  {selected.origin === "linkedin"
                    ? officialListingProvider(selected)
                      ? "Open employer listing"
                      : "Open LinkedIn listing"
                    : selected.origin === "manual"
                    ? "Open original listing"
                    : "Open employer listing"}{" "}
                  <ArrowUpRight size={15} />
                </a>
                {selected.linkedinUrl && selected.linkedinUrl !== selected.url && (
                  <a
                    className="linkedin-link"
                    href={selected.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn listing <ArrowUpRight size={15} />
                  </a>
                )}
                <Button
                  className="signal-cta"
                  disabled={!selected.coverLetter && !canGenerate}
                  onClick={() => openCoverLetter(selected)}
                >
                  <FileText size={15} />
                  {selected.coverLetter
                    ? "Edit cover letter"
                    : "Generate cover letter"}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending === selected.id}
                  onClick={() =>
                    changeStatus(
                      selected.id,
                      selected.status === "applied"
                        ? "inbox"
                        : "applied",
                    )
                  }
                >
                  <Check size={15} />
                  {selected.status === "applied"
                    ? "Undo applied"
                    : selected.status === "rejected"
                      ? "Return to applied"
                    : "Mark applied"}
                </Button>
                {selected.status === "applied" && (
                  <Button
                    variant="ghost"
                    onClick={() => askReason(selected.id, "rejected")}
                  >
                    <X size={14} />
                    Mark rejected
                  </Button>
                )}
                {selected.status !== "applied" &&
                  selected.status !== "rejected" && (
                    <Button
                      variant="ghost"
                      onClick={() => askReason(selected.id, "passed")}
                    >
                      Pass
                    </Button>
                  )}
              </div>
              <p className="external-note">
                <ArrowUpRight size={13} /> Employer links open in a new tab in
                the browser where you opened Signal.
              </p>
              <div className="signal-grid">
                <div className="signal-box">
                  <strong>
                    {selected.score.fit}
                    <span className="subtle"> / 100</span>
                  </strong>
                  <h3>Fit estimate</h3>
                  {selected.score.fitSignals.map((s, i) => (
                    <div className="signal-line" key={i}>
                      <span>{s.label}</span>
                      <span>+{s.points}</span>
                    </div>
                  ))}
                </div>
                <div className="signal-box">
                  <strong>
                    {selected.score.quality}
                    <span className="subtle"> / 100</span>
                  </strong>
                  <h3>Listing confidence</h3>
                  {selected.score.qualitySignals.map((s, i) => (
                    <div className="signal-line" key={i}>
                      <span>{s.label}</span>
                      <span>
                        {s.points >= 0 ? "+" : ""}
                        {s.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="drawer-note">
                These are heuristic scores, not probabilities. Skill phrases do
                not establish qualification. Hiring intent, applicant
                competition, and repost history are not known.
              </p>
              {selected.score.warnings.length > 0 && (
                <div className="message">
                  <strong>Worth checking</strong>
                  <ul className="list-disc pl-5 mt-2">
                    {selected.score.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <h3>Source record</h3>
              <div className="data-row">
                <span>Source</span>
                <span>
                  {selected.origin === "linkedin"
                    ? officialListingProvider(selected) || "LinkedIn discovery"
                    : selected.origin === "manual"
                    ? officialListingProvider(selected) || "Manually added"
                    : selectedSource?.provider || "ATS"} · {selected.company}
                </span>
              </div>
              <div className="data-row">
                <span>First observed by Signal</span>
                <span>{dateLabel(selected.firstSeen)}</span>
              </div>
              <div className="data-row">
                <span>Last seen in source</span>
                <span>{dateLabel(selected.lastSeen)}</span>
              </div>
              <div className="data-row">
                <span>Employer last updated</span>
                <span>{dateLabel(selected.updatedAt)}</span>
              </div>
              <div className="data-row">
                <span>Original posting date</span>
                <span>{dateLabel(selected.postedAt)}</span>
              </div>
              {selected.reason && (
                <div className="data-row">
                  <span>Your note</span>
                  <span>{selected.reason}</span>
                </div>
              )}
              <p className="drawer-note">
                An update date is not the original posting date. Repeated checks
                preserve this requisition’s first-observed date and your
                tracking status.
              </p>
              <h3>Job description</h3>
              <div className="description">
                {selected.description ||
                  "Open the employer listing to read the full description."}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!coverJobId}
        onOpenChange={(open) => {
          if (!open) setCoverJobId(null);
        }}
      >
        <DialogContent className="cover-dialog">
          <DialogTitle>Cover letter</DialogTitle>
          {!canGenerate && <p role="status">Generation is unavailable. You can still edit and export saved letters.</p>}
          <DialogDescription>
            {data.jobs.find((j) => j.id === coverJobId)?.title} ·{" "}
            {data.jobs.find((j) => j.id === coverJobId)?.company}. Tailored from
            the listing and your saved portfolio evidence; review every
            detail before using it.
          </DialogDescription>
          <Textarea
            aria-label="Cover letter text"
            className="cover-editor"
            value={coverDraft}
            onChange={(e) => setCoverDraft(e.target.value)}
            placeholder={
              pending === "cover-letter-generate"
                ? "Analyzing the listing and your qualifications…"
                : undefined
            }
            disabled={pending === "cover-letter-generate"}
            maxLength={20000}
          />
          <div className="cover-actions">
            <Button
              variant="outline"
              disabled={!canGenerate || pending === "cover-letter-generate"}
              onClick={regenerateCoverLetter}
            >
              <Sparkles size={15} />
              {pending === "cover-letter-generate"
                ? "Analyzing…"
                : "Regenerate"}
            </Button>
            <Button
              variant="outline"
              disabled={
                pending === "cover-letter" ||
                pending === "cover-letter-generate" ||
                !coverDraft.trim()
              }
              onClick={saveCoverLetter}
            >
              <Save size={15} />
              {pending === "cover-letter" ? "Saving…" : "Save draft"}
            </Button>
            <form method="post" action="/api/cover-letter/pdf">
              <input type="hidden" name="id" value={coverJobId || ""} />
              <input type="hidden" name="content" value={coverDraft} />
              <Button
                type="submit"
                disabled={
                  pending === "cover-letter-generate" || !coverDraft.trim()
                }
              >
                <Download size={15} />
                Download PDF
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent className="manual-dialog">
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>
            Paste a LinkedIn or employer listing. Signal will gather the job
            details, add it to your inbox, and score it automatically.
          </DialogDescription>
          <form onSubmit={addManualJob} className="space-y-5">
            <div className="field">
              <label htmlFor="manual-url">Job listing URL</label>
              <Input
                id="manual-url"
                type="url"
                required
                maxLength={1000}
                value={manualJob.url}
                onChange={(e) =>
                  setManualJob({ ...manualJob, url: e.target.value })
                }
                placeholder="https://www.linkedin.com/jobs/view/..."
              />
            </div>
            <p className="import-note">
              Signal looks for structured listing data first, then reads the
              page itself. Some sites may block automated access; when that
              happens, use the employer’s direct listing instead.
            </p>
            <div className="form-actions">
              <Button type="submit" disabled={pending === "manual-job"}>
                {pending === "manual-job"
                  ? "Gathering listing…"
                  : "Add job"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setManualDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={sourceDialog} onOpenChange={setSourceDialog}>
        <DialogContent>
          <DialogTitle>Add a company source</DialogTitle>
          <DialogDescription>
            Paste the company’s Greenhouse, Lever, or Ashby board URL. Confirm
            the board is linked from the employer’s own careers page.
          </DialogDescription>
          <form onSubmit={addSource} className="space-y-5">
            <div className="field">
              <label htmlFor="company">Company name</label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={80}
                required
                placeholder="Company name"
              />
            </div>
            <div className="field">
              <label htmlFor="board">Job board URL</label>
              <Input
                id="board"
                type="url"
                value={boardUrl}
                onChange={(e) => setBoardUrl(e.target.value)}
                required
                placeholder="https://jobs.ashbyhq.com/company"
              />
            </div>
            <Button type="submit" disabled={pending === "source"}>
              Add company
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!reasonDialog}
        onOpenChange={(open) => {
          if (!open) setReasonDialog(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {reasonDialog?.status === "rejected"
                ? "Mark this application as rejected"
              : "Pass on this job"}
          </DialogTitle>
          <DialogDescription>
            {reasonDialog?.status === "rejected"
                ? "Add an optional note so you can remember where the process ended."
              : "Your reason stays with the job. This version records feedback; it does not train a ranking model."}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (reasonDialog)
                void changeStatus(reasonDialog.id, reasonDialog.status, reason);
            }}
          >
            <div className="field">
              <label htmlFor="reason">
                Reason <span className="subtle">· optional</span>
              </label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder={
                  reasonDialog?.status === "rejected"
                      ? "For example: rejected after the portfolio review"
                    : "For example: onsite requirement, wrong level, or low pay"
                }
              />
            </div>
            <Button type="submit" className="mt-5" disabled={!!pending}>
              {reasonDialog?.status === "rejected"
                  ? "Mark rejected"
                : "Pass on job"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Toaster theme="light" position="bottom-right" richColors />
    </>
  );
}
