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
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
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

type InboxData = { jobs: Job[]; profile: Profile; sources: Source[]; generationAvailable?: boolean };
const emptyManualJob = {
  url: "",
};
const stages = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "applied", label: "Applied", icon: CheckCheck },
  { id: "passed", label: "Passed", icon: X },
  { id: "flagged", label: "Flagged", icon: Flag },
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
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState<Profile>(defaultProfile);
  const [sourceDialog, setSourceDialog] = useState(false);
  const [company, setCompany] = useState("");
  const [boardUrl, setBoardUrl] = useState("");
  const [reasonDialog, setReasonDialog] = useState<{
    id: string;
    status: "passed" | "flagged";
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
    (j.source === "manual" || matchesLocationPreference(j, data.profile)),
  );
  const visible = scored.filter(
    (j) =>
      j.status === tab &&
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
  function askReason(id: string, status: "passed" | "flagged") {
    setReason("");
    setReasonDialog({ id, status });
  }
  async function refresh(one?: Source) {
    setRefreshing(true);
    setError("");
    const list = one
      ? [one]
      : [...data.sources].sort(
          (a, b) => Number(a.provider === "linkedin") - Number(b.provider === "linkedin"),
        );
    let failed = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        setProgress(`Checking ${list[i].company} · ${i + 1} of ${list.length}`);
        try {
          await request("/api/refresh", { source: list[i].id });
        } catch (e) {
          failed++;
          toast.error((e as Error).message);
        }
      }
      await load();
      setProgress(
        failed
          ? `${list.length - failed} sources checked; ${failed} need attention in Sources.`
          : `${list.length} search sources checked just now.`,
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
          <span className="avatar">GR</span>
        </div>
      </header>
      <main className="page">
        <div className="intro">
          <div>
            <div className="eyebrow">Workspace overview</div>
            <h1>Job search activity</h1>
            <p>
              {loading
                ? "Loading your latest search activity…"
                : latestSourceCheck
                  ? `Sources last checked ${dateLabel(latestSourceCheck)}.`
                  : "Run your first source check to find current roles."}
            </p>
          </div>
          <div className="stats">
            <div className="stat">
              <strong>
                {loading
                  ? "—"
                  : eligible.length}
              </strong>
              <span>active listings found</span>
            </div>
            <div className="stat">
              <strong>
                {loading
                  ? "—"
                  : data.jobs.filter((j) => j.status === "passed").length}
              </strong>
              <span>passed on</span>
            </div>
            <div className="stat">
              <strong>
                {loading
                  ? "—"
                  : data.jobs.filter((j) => j.status === "applied").length}
              </strong>
              <span>applications tracked</span>
            </div>
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
            <TabsList>
              {stages.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>
                  <s.icon size={15} />
                  {s.label}
                  <span className="tabcount">
                    {s.id === "inbox"
                      ? eligible.length
                      : data.jobs.filter((j) => j.status === s.id).length}
                  </span>
                </TabsTrigger>
              ))}
              <TabsTrigger value="sources">
                <Globe2 size={15} />
                Sources
              </TabsTrigger>
              <TabsTrigger value="profile">
                <Settings2 size={15} />
                Preferences
              </TabsTrigger>
            </TabsList>
            <div className="nav-actions">
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
          <div className="statusline" role="status">
            <span className="dot" />
            {progress ||
              (loading
                ? "Opening your inbox…"
                : "Market-wide discovery · Best-fit ranking · No automatic applications")}
          </div>
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
                                className={`badge ${!j.active || j.score.quality < data.profile.minQuality ? "warn" : ""}`}
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
                                    ? "Market listing found"
                                    : "No longer in feed"}
                              </span>
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
                                j.status === "passed" || j.status === "flagged"
                                  ? changeStatus(j.id, "inbox")
                                  : askReason(j.id, "passed")
                              }
                            >
                              {j.status === "passed" ||
                              j.status === "flagged" ? (
                                <ArrowRight size={14} />
                              ) : (
                                <X size={14} />
                              )}{" "}
                              {j.status === "passed" || j.status === "flagged"
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
                              ? "Check company sources or broaden your preferences."
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
          <TabsContent value="sources">
            <section className="content-panel">
              <div className="panel-heading">
                <div>
                  <h2>Go straight to the source.</h2>
                  <p className="subtle">
                    Three market-wide searches discover roles without a company
                    list. Add interesting LinkedIn roles by URL; Signal imports,
                    scores, and de-duplicates them. Employer ATS links verify
                    matches when available.
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
                {data.sources.map((s) => (
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
                Greenhouse, Lever, and Ashby are supported. A failed check keeps
                existing listings. A successful check marks missing requisitions
                as no longer in the feed. Repeated requisition IDs are updated
                in place.
              </p>
            </section>
          </TabsContent>
          <TabsContent value="profile">
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
          </TabsContent>
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
                <span className={`badge ${selected.active ? "" : "warn"}`}>
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
                      ? "Found in market search"
                      : "No longer in latest feed"}
                </span>
              </div>
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
                      selected.status === "applied" ? "inbox" : "applied",
                    )
                  }
                >
                  <Check size={15} />
                  {selected.status === "applied"
                    ? "Undo applied"
                    : "Mark applied"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => askReason(selected.id, "passed")}
                >
                  Pass
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => askReason(selected.id, "flagged")}
                >
                  <Flag size={14} />
                  Flag
                </Button>
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
            {reasonDialog?.status === "flagged"
              ? "Flag this listing"
              : "Pass on this job"}
          </DialogTitle>
          <DialogDescription>
            {reasonDialog?.status === "flagged"
              ? "Keep a note about what looks wrong. A flag is your assessment, not a verified fraud finding."
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
                  reasonDialog?.status === "flagged"
                    ? "For example: posting contradicts the careers page"
                    : "For example: onsite requirement, wrong level, or low pay"
                }
              />
            </div>
            <Button type="submit" className="mt-5" disabled={!!pending}>
              {reasonDialog?.status === "flagged"
                ? "Flag listing"
                : "Pass on job"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Toaster theme="light" position="bottom-right" richColors />
    </>
  );
}
