import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Award, BriefcaseBusiness, CheckCircle2, ClipboardCheck, Pencil, Plus, Save, ShieldCheck, Trash2, Users, ChevronDown, ChevronUp, LayoutGrid, GitMerge, Check, BookOpen, FileText, Sparkles, TrendingUp, TrendingDown, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Team = {
  code: string;
  name: string;
  departmentCode?: string;
};

type TeamMember = {
  id: string;
  employeeNumber: string;
  name: string;
  position: string;
  team: string | null;
  teamCode: string | null;
  managerId?: string | null;
  managerName?: string | null;
  orgDepth?: number;
  orgOrder?: number;
};

type Report = {
  id: string;
  teamCode: string;
  teamName: string;
  evaluationYear: number;
  revision: string | null;
  roleSummary: string | null;
  preparedBy: string | null;
  checkedBy: string | null;
  approvedBy: string | null;
  status: string;
  notes: string | null;
};

type Assignment = {
  id?: string;
  roleGroup?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  positionTitle?: string | null;
  roleTitle?: string | null;
  responsibilities?: string | null;
  jobDescription?: string | null;
  deputyEmployeeId?: string | null;
  deputyName?: string | null;
  displayOrder?: number;
};

type AssignmentRow = Assignment & { originalIndex: number };

type OrgAssignmentNode = {
  row: AssignmentRow;
  children: OrgAssignmentNode[];
};

type WorkCategory = {
  id?: string;
  categoryNo?: string | null;
  categoryName?: string | null;
  majorFunctions?: string | null;
  controlItems?: string | null;
  specialNotes?: string | null;
  relatedDocs?: string | null;
  cooperatingTeam?: string | null;
  cooperatingWork?: string | null;
  displayOrder?: number;
};

type RequirementScore = {
  employeeId?: string | null;
  employeeName?: string | null;
  score?: number | string | null;
  notes?: string | null;
};

type Requirement = {
  id?: string;
  majorNo?: string | null;
  majorName?: string | null;
  subNo?: string | null;
  subName?: string | null;
  requiredMajor?: string | null;
  requiredCertification?: string | null;
  minKnowledge?: string | null;
  proficiencyPeriod?: string | null;
  requiredTraining?: string | null;
  languageRequirement?: string | null;
  deptHeadLevel?: string | null;
  managerLevel?: string | null;
  staffLevel?: string | null;
  minimumLevel?: string | null;
  displayOrder?: number;
  scores: RequirementScore[];
};

type Qualification = {
  id?: string;
  itemNo?: string | null;
  requirementItem?: string | null;
  requirementName?: string | null;
  requiredGrade?: string | null;
  holderSummary?: string | null;
  heldQualification?: string | null;
  plan?: string | null;
  remarks?: string | null;
  displayOrder?: number;
};

type TeamCompetencyDetail = {
  report: Report;
  teamMembers: TeamMember[];
  memberEvidence?: MemberEvidence[];
  assignments: Assignment[];
  workCategories: WorkCategory[];
  requirements: Requirement[];
  qualifications: Qualification[];
};

type MemberEvidence = {
  employeeId: string;
  certifications: number;
  skills: number;
  languages: number;
  trainings: number;
};

const currentYear = new Date().getFullYear();

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return response.json();
}

function makeLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasText(value?: string | number | null) {
  return String(value ?? "").trim().length > 0;
}

function percentValue(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function levelNumber(value?: string | number | null) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLevel(value?: string | number | null) {
  const parsed = levelNumber(value);
  if (parsed === null) return "-";
  return `Lv.${Number.isInteger(parsed) ? parsed : parsed.toFixed(1)}`;
}

function average(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (numericValues.length === 0) return null;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function formatAverage(value: number | null) {
  return value === null ? "-" : value.toFixed(1);
}

function normalizeKey(value?: string | number | null) {
  return String(value ?? "").trim().toLowerCase();
}

function numberedLine(value?: string | null, no?: string | null) {
  const lines = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  const normalizedNo = String(no ?? "").trim();
  const matched = lines.find((line) => normalizedNo && new RegExp(`^${normalizedNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[.)]\\s*`).test(line));
  return matched ?? lines[0] ?? "";
}

function parseScoreNotes(notes?: string | null) {
  if (!hasText(notes)) return { applicable: true, note: "" };
  try {
    const parsed = JSON.parse(String(notes));
    if (parsed && typeof parsed === "object") {
      return {
        applicable: parsed.applicable !== false,
        note: typeof parsed.note === "string" ? parsed.note : "",
      };
    }
  } catch {
    return { applicable: true, note: String(notes ?? "") };
  }
  return { applicable: true, note: String(notes ?? "") };
}

function scoreIsApplicable(score?: RequirementScore) {
  return parseScoreNotes(score?.notes).applicable;
}

function serializeScoreNotes(applicable: boolean, notes?: string | null) {
  const parsed = parseScoreNotes(notes);
  if (applicable && !parsed.note) return null;
  return JSON.stringify({ applicable, note: parsed.note || undefined });
}

function requirementGroupForMember(member?: TeamMember | null) {
  const position = member?.position ?? "";
  if (position.includes("그룹장") || position.includes("팀장")) {
    return { key: "leader" as const, label: "팀장·그룹장" };
  }
  if (position.includes("책임")) {
    return { key: "senior" as const, label: "책임 이상" };
  }
  return { key: "staff" as const, label: "책임 미만" };
}

function requirementLevelForMember(requirement: Requirement, member?: TeamMember | null) {
  const group = requirementGroupForMember(member);
  const groupValue =
    group.key === "leader"
      ? requirement.deptHeadLevel
      : group.key === "senior"
        ? requirement.managerLevel
        : requirement.staffLevel;
  return levelNumber(groupValue) === null ? requirement.minimumLevel : groupValue;
}

function TextCell({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "min-w-[120px]",
}: {
  value?: string | number | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Input
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}

function TextAreaCell({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "min-w-[220px]",
}: {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Textarea
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`min-h-[64px] resize-y ${className}`}
    />
  );
}

// Beautiful Custom Score Selector Component
function ScoreSelector({
  value,
  onChange,
  disabled
}: {
  value: string | number;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const currentVal = value !== "" && value !== null && value !== undefined ? Number(value) : null;
  const levels = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex items-center justify-center gap-1">
      {levels.map((lvl) => {
        const isSelected = currentVal !== null && Math.floor(currentVal) === lvl;
        const isExact = currentVal !== null && currentVal === lvl;
        return (
          <button
            key={lvl}
            type="button"
            disabled={disabled}
            onClick={() => onChange(String(lvl))}
            className={`w-7 h-7 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
              isExact
                ? "bg-primary text-primary-foreground shadow-md scale-110 ring-2 ring-primary/20"
                : isSelected
                  ? "bg-primary/60 text-primary-foreground shadow-sm scale-105"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
            } disabled:opacity-50`}
          >
            {lvl}
          </button>
        );
      })}
      <div className="flex flex-col gap-0.5 ml-1">
        <button
          type="button"
          disabled={disabled || currentVal === null || currentVal >= 5}
          onClick={() => {
            if (currentVal !== null) {
              onChange(String(Math.min(5, currentVal + 0.5)));
            }
          }}
          className="px-1.5 py-0.5 text-[9px] font-bold bg-white hover:bg-slate-50 border border-slate-200 rounded shadow-sm cursor-pointer disabled:opacity-40"
        >
          +0.5
        </button>
        <button
          type="button"
          disabled={disabled || currentVal === null || currentVal <= 0}
          onClick={() => {
            if (currentVal !== null) {
              onChange(String(Math.max(0, currentVal - 0.5)));
            }
          }}
          className="px-1.5 py-0.5 text-[9px] font-bold bg-white hover:bg-slate-50 border border-slate-200 rounded shadow-sm cursor-pointer disabled:opacity-40"
        >
          -0.5
        </button>
      </div>
    </div>
  );
}

export default function TeamCompetency() {
  const { toast } = useToast();
  const [selectedTeamCode, setSelectedTeamCode] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [detail, setDetail] = useState<TeamCompetencyDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  // Custom UI State
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCategoryNo, setSelectedCategoryNo] = useState("");
  const [orgViewMode, setOrgViewMode] = useState<"tree" | "list">("tree");

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const selectedTeam = teams.find((team) => team.code === selectedTeamCode);
  const selectedMember = detail?.teamMembers.find((member) => member.id === selectedMemberId) ?? detail?.teamMembers[0];

  useEffect(() => {
    if (!selectedTeamCode && teams.length > 0) {
      setSelectedTeamCode(teams[0].code);
    }
  }, [selectedTeamCode, teams]);

  useEffect(() => {
    if (!detail?.teamMembers.length) {
      setSelectedMemberId("");
      return;
    }
    if (!detail.teamMembers.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(detail.teamMembers[0].id);
    }
  }, [detail, selectedMemberId]);

  // Default selectedCategoryNo when categories loaded
  useEffect(() => {
    if (detail?.workCategories && detail.workCategories.length > 0) {
      const validNos = detail.workCategories.map((c) => c.categoryNo).filter(Boolean) as string[];
      if (!selectedCategoryNo || !validNos.includes(selectedCategoryNo)) {
        setSelectedCategoryNo(validNos[0] || "");
      }
    } else {
      setSelectedCategoryNo("");
    }
  }, [detail, selectedCategoryNo]);

  useEffect(() => {
    if (!selectedTeamCode) return;

    let cancelled = false;
    const loadExistingReport = async () => {
      setIsLoadingDetail(true);
      try {
        const reports = await fetchJson<Report[]>(
          `/api/team-competency/reports?teamCode=${encodeURIComponent(selectedTeamCode)}&year=${selectedYear}`,
        );
        if (cancelled) return;
        if (reports[0]) {
          const nextDetail = await fetchJson<TeamCompetencyDetail>(`/api/team-competency/reports/${reports[0].id}`);
          if (!cancelled) setDetail(nextDetail);
        } else {
          setDetail(null);
        }
      } catch (error) {
        if (!cancelled) {
          setDetail(null);
          toast({
            title: "팀 적격성 자료를 불러오지 못했습니다",
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    };

    loadExistingReport();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamCode, selectedYear, toast]);

  const ensureReportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeam) throw new Error("팀을 선택해 주세요.");
      return fetchJson<TeamCompetencyDetail>("/api/team-competency/reports/ensure", {
        method: "POST",
        body: JSON.stringify({
          teamCode: selectedTeam.code,
          teamName: selectedTeam.name,
          evaluationYear: selectedYear,
          revision: "Rev.00",
        }),
      });
    },
    onSuccess: (data) => {
      setDetail(data);
      toast({ title: "팀 적격성 보고서를 준비했습니다" });
    },
    onError: (error) => {
      toast({
        title: "보고서를 만들지 못했습니다",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("저장할 보고서가 없습니다.");
      return fetchJson<TeamCompetencyDetail>(`/api/team-competency/reports/${detail.report.id}`, {
        method: "PUT",
        body: JSON.stringify(detail),
      });
    },
    onSuccess: (data) => {
      setDetail(data);
      toast({ title: "팀 적격성 자료를 저장했습니다" });
    },
    onError: (error) => {
      toast({
        title: "저장하지 못했습니다",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
  });

  const scoreStats = useMemo(() => {
    if (!detail) return { entered: 0, total: 0, average: 0 };
    const scoreRows = detail.requirements.flatMap((requirement) =>
      detail.teamMembers.map((member) => requirement.scores?.find((score) => score.employeeId === member.id)),
    );
    const applicableScores = scoreRows.filter((score) => scoreIsApplicable(score));
    const numericScores = applicableScores
      .filter((score) => score?.score !== null && score?.score !== undefined && score?.score !== "")
      .map((score) => Number(score?.score))
      .filter((score) => Number.isFinite(score));
    const total = applicableScores.length;
    const average = numericScores.length
      ? numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length
      : 0;
    return { entered: numericScores.length, total, average };
  }, [detail]);

  const evidenceStats = useMemo(() => {
    const rows = detail?.memberEvidence ?? [];
    return rows.reduce(
      (summary, row) => ({
        certifications: summary.certifications + row.certifications,
        skills: summary.skills + row.skills,
        languages: summary.languages + row.languages,
        trainings: summary.trainings + row.trainings,
      }),
      { certifications: 0, skills: 0, languages: 0, trainings: 0 },
    );
  }, [detail]);
  const evidenceTotal = evidenceStats.certifications + evidenceStats.skills + evidenceStats.languages + evidenceStats.trainings;

  const teamMembersById = useMemo(() => {
    const map = new Map<string, TeamMember>();
    for (const member of detail?.teamMembers ?? []) map.set(member.id, member);
    return map;
  }, [detail]);

  const memberEvidenceById = useMemo(() => {
    const map = new Map<string, MemberEvidence>();
    for (const row of detail?.memberEvidence ?? []) map.set(row.employeeId, row);
    return map;
  }, [detail]);

  const evidenceTotalForMember = (memberId?: string | null) => {
    if (!memberId) return 0;
    const row = memberEvidenceById.get(memberId);
    return row ? row.certifications + row.skills + row.languages + row.trainings : 0;
  };

  const sortedAssignments = useMemo<AssignmentRow[]>(() => {
    if (!detail) return [];
    return detail.assignments
      .map((assignment, index) => ({ ...assignment, originalIndex: index }))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [detail]);

  const orgAssignmentTree = useMemo<OrgAssignmentNode[]>(() => {
    const assignmentsByEmployeeId = new Map<string, AssignmentRow>();
    for (const row of sortedAssignments) {
      if (row.employeeId) assignmentsByEmployeeId.set(row.employeeId, row);
    }

    const childrenByManagerId = new Map<string, AssignmentRow[]>();
    const roots: AssignmentRow[] = [];

    for (const row of sortedAssignments) {
      const member = row.employeeId ? teamMembersById.get(row.employeeId) : undefined;
      const managerId = member?.managerId;
      if (managerId && assignmentsByEmployeeId.has(managerId)) {
        const rows = childrenByManagerId.get(managerId) ?? [];
        rows.push(row);
        childrenByManagerId.set(managerId, rows);
      } else {
        roots.push(row);
      }
    }

    const sortRows = (rows: AssignmentRow[]) =>
      [...rows].sort((a, b) => {
        const memberA = a.employeeId ? teamMembersById.get(a.employeeId) : undefined;
        const memberB = b.employeeId ? teamMembersById.get(b.employeeId) : undefined;
        const orderA = memberA?.orgOrder ?? a.displayOrder ?? a.originalIndex;
        const orderB = memberB?.orgOrder ?? b.displayOrder ?? b.originalIndex;
        if (orderA !== orderB) return orderA - orderB;
        return String(memberA?.name ?? a.employeeName ?? "").localeCompare(String(memberB?.name ?? b.employeeName ?? ""), "ko");
      });

    const buildNode = (row: AssignmentRow, path = new Set<string>()): OrgAssignmentNode => {
      const key = row.employeeId ?? row.id ?? String(row.originalIndex);
      if (path.has(key)) return { row, children: [] };

      const nextPath = new Set(path);
      nextPath.add(key);
      const childRows = row.employeeId ? childrenByManagerId.get(row.employeeId) ?? [] : [];
      return {
        row,
        children: sortRows(childRows).map((child) => buildNode(child, nextPath)),
      };
    };

    return sortRows(roots).map((row) => buildNode(row));
  }, [sortedAssignments, teamMembersById]);

  const operationalStats = useMemo(() => {
    if (!detail) return null;
    const missingResponsibilities = detail.assignments.filter(
      (row) => !hasText(row.roleTitle) || !hasText(row.responsibilities),
    ).length;
    const missingQualificationHolders = detail.qualifications.filter((row) => !hasText(row.holderSummary)).length;
    const missingQualificationPlans = detail.qualifications.filter((row) => !hasText(row.plan)).length;
    const missingScores = Math.max(scoreStats.total - scoreStats.entered, 0);
    const templateReady = detail.workCategories.length > 0 && detail.requirements.length > 0 && detail.qualifications.length > 0;
    const checks = [
      detail.teamMembers.length > 0,
      templateReady,
      missingResponsibilities === 0,
      scoreStats.total > 0 && missingScores === 0,
      detail.qualifications.length > 0 && missingQualificationHolders === 0,
      evidenceTotal > 0,
    ];
    const readinessPercent = percentValue(checks.filter(Boolean).length, checks.length);
    const statusLabel = readinessPercent >= 85 ? "검토 가능" : readinessPercent >= 50 ? "보완 진행" : "초기 정비";

    return {
      missingResponsibilities,
      missingQualificationHolders,
      missingQualificationPlans,
      missingScores,
      templateReady,
      readinessPercent,
      statusLabel,
    };
  }, [detail, evidenceTotal, scoreStats.entered, scoreStats.total]);

  const updateReport = (field: keyof Report, value: string) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            report: { ...current.report, [field]: value },
          }
        : current,
    );
  };

  const updateArrayRow = <T,>(
    key: "assignments" | "workCategories" | "requirements" | "qualifications",
    index: number,
    patch: Partial<T>,
  ) => {
    setDetail((current) => {
      if (!current) return current;
      const rows = [...(current[key] as any[])];
      rows[index] = { ...rows[index], ...patch };
      return { ...current, [key]: rows };
    });
  };

  const removeArrayRow = (key: "assignments" | "workCategories" | "requirements" | "qualifications", index: number) => {
    setDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: (current[key] as any[]).filter((_, rowIndex) => rowIndex !== index),
      };
    });
  };

  const addWorkCategory = () => {
    setDetail((current) => {
      if (!current) return current;
      const categoryNo = String(current.workCategories.length + 1);
      return {
        ...current,
        workCategories: [
          ...current.workCategories,
          {
            id: makeLocalId("work"),
            categoryNo,
            categoryName: "",
            majorFunctions: "",
            controlItems: "",
            relatedDocs: "",
            cooperatingTeam: "",
            cooperatingWork: "",
            displayOrder: current.workCategories.length,
          },
        ],
        requirements: [
          ...current.requirements,
          {
            id: makeLocalId("requirement"),
            majorNo: categoryNo,
            majorName: "",
            subNo: "1",
            subName: "",
            requiredMajor: "",
            requiredCertification: "",
            minKnowledge: "",
            proficiencyPeriod: "",
            requiredTraining: "",
            languageRequirement: "",
            deptHeadLevel: "",
            managerLevel: "",
            staffLevel: "",
            minimumLevel: "",
            displayOrder: current.requirements.length,
            scores: [],
          },
        ],
      };
    });
  };

  const addRequirement = () => {
    setDetail((current) =>
      current
        ? {
            ...current,
            requirements: [
              ...current.requirements,
              {
                id: makeLocalId("requirement"),
                majorNo: "",
                majorName: "",
                subNo: "",
                subName: "",
                requiredMajor: "",
                requiredCertification: "",
                minKnowledge: "",
                proficiencyPeriod: "",
                requiredTraining: "",
                languageRequirement: "",
                deptHeadLevel: "",
                managerLevel: "",
                staffLevel: "",
                minimumLevel: "",
                displayOrder: current.requirements.length,
                scores: [],
              },
            ],
          }
        : current,
    );
  };

  const addRequirementForCategory = (majorNo?: string | null, majorName?: string | null, nextSubNo?: number) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            requirements: [
              ...current.requirements,
              {
                id: makeLocalId("requirement"),
                majorNo: majorNo ?? "",
                majorName: majorName ?? "",
                subNo: nextSubNo ? String(nextSubNo) : "",
                subName: "",
                requiredMajor: "",
                requiredCertification: "",
                minKnowledge: "",
                proficiencyPeriod: "",
                requiredTraining: "",
                languageRequirement: "",
                deptHeadLevel: "",
                managerLevel: "",
                staffLevel: "",
                minimumLevel: "",
                displayOrder: current.requirements.length,
                scores: [],
              },
            ],
          }
        : current,
    );
  };

  const addQualification = () => {
    setDetail((current) =>
      current
        ? {
            ...current,
            qualifications: [
              ...current.qualifications,
              {
                id: makeLocalId("qualification"),
                itemNo: String(current.qualifications.length + 1),
                requirementItem: "",
                requirementName: "",
                requiredGrade: "",
                holderSummary: "",
                heldQualification: "",
                plan: "",
                remarks: "",
                displayOrder: current.qualifications.length,
              },
            ],
          }
        : current,
    );
  };

  const updateScore = (requirementIndex: number, member: TeamMember, value: string) => {
    setDetail((current) => {
      if (!current) return current;
      const requirements = [...current.requirements];
      const requirement = { ...requirements[requirementIndex] };
      const scores = [...(requirement.scores ?? [])];
      const scoreIndex = scores.findIndex((score) => score.employeeId === member.id);
      const previousScore = scoreIndex >= 0 ? scores[scoreIndex] : {};
      const nextScore = {
        ...previousScore,
        employeeId: member.id,
        employeeName: member.name,
        score: value,
        notes: hasText(value) ? serializeScoreNotes(true, previousScore.notes) : previousScore.notes,
      };
      if (scoreIndex >= 0) {
        scores[scoreIndex] = nextScore;
      } else {
        scores.push(nextScore);
      }
      requirements[requirementIndex] = { ...requirement, scores };
      return { ...current, requirements };
    });
  };

  const updateScoreApplicability = (requirementIndex: number, member: TeamMember, applicable: boolean) => {
    setDetail((current) => {
      if (!current) return current;
      const requirements = [...current.requirements];
      const requirement = { ...requirements[requirementIndex] };
      const scores = [...(requirement.scores ?? [])];
      const scoreIndex = scores.findIndex((score) => score.employeeId === member.id);
      const previousScore = scoreIndex >= 0 ? scores[scoreIndex] : {};
      const nextScore = {
        ...previousScore,
        employeeId: member.id,
        employeeName: member.name,
        score: applicable ? previousScore.score ?? "" : "",
        notes: serializeScoreNotes(applicable, previousScore.notes),
      };

      if (scoreIndex >= 0) {
        scores[scoreIndex] = nextScore;
      } else {
        scores.push(nextScore);
      }
      requirements[requirementIndex] = { ...requirement, scores };
      return { ...current, requirements };
    });
  };

  const scoreFor = (requirement: Requirement, memberId: string) =>
    requirement.scores?.find((score) => score.employeeId === memberId)?.score ?? "";

  const scoreRowFor = (requirement: Requirement, memberId?: string | null) =>
    memberId ? requirement.scores?.find((score) => score.employeeId === memberId) : undefined;

  const scoreApplicableFor = (requirement: Requirement, memberId?: string | null) =>
    scoreIsApplicable(scoreRowFor(requirement, memberId));

  const scoreNumberFor = (requirement: Requirement, memberId?: string | null) => {
    if (!memberId) return null;
    if (!scoreApplicableFor(requirement, memberId)) return null;
    return levelNumber(scoreFor(requirement, memberId));
  };

  const workCategoryLookup = useMemo(() => {
    const byNo = new Map<string, { row: WorkCategory; index: number }>();
    const byName = new Map<string, { row: WorkCategory; index: number }>();
    const rows = detail?.workCategories ?? [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (hasText(row.categoryNo)) byNo.set(normalizeKey(row.categoryNo), { row, index });
      if (hasText(row.categoryName)) byName.set(normalizeKey(row.categoryName), { row, index });
    }
    return { byNo, byName };
  }, [detail]);

  const getWorkCategoryForRequirement = (requirement: Requirement) =>
    workCategoryLookup.byNo.get(normalizeKey(requirement.majorNo)) ??
    workCategoryLookup.byName.get(normalizeKey(requirement.majorName));

  const requirementRows = useMemo(() => {
    if (!detail) return [];
    return detail.requirements
      .map((row, index) => ({ row, index }))
      .sort((a, b) => (a.row.displayOrder ?? a.index) - (b.row.displayOrder ?? b.index));
  }, [detail]);

  const competencyGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        majorNo?: string | null;
        majorName?: string | null;
        workCategory?: WorkCategory;
        workCategoryIndex?: number;
        rows: Array<{ row: Requirement; index: number }>;
      }
    >();

    for (const item of requirementRows) {
      const matchedCategory = getWorkCategoryForRequirement(item.row);
      const key = normalizeKey(matchedCategory?.row.categoryNo ?? item.row.majorNo ?? item.row.majorName ?? item.index);
      const group = groups.get(key) ?? {
        key,
        majorNo: matchedCategory?.row.categoryNo ?? item.row.majorNo,
        majorName: matchedCategory?.row.categoryName ?? item.row.majorName,
        workCategory: matchedCategory?.row,
        workCategoryIndex: matchedCategory?.index,
        rows: [],
      };
      group.rows.push(item);
      groups.set(key, group);
    }

    return Array.from(groups.values());
  }, [requirementRows, workCategoryLookup]);

  const selectedGroup = useMemo(() => {
    if (!detail) return null;

    const selectedKey = normalizeKey(selectedCategoryNo);
    const selectedCategoryEntry = detail.workCategories
      .map((row, index) => ({ row, index }))
      .find(({ row }) => normalizeKey(row.categoryNo) === selectedKey);

    if (selectedCategoryEntry) {
      const matchedGroup = competencyGroups.find(
        (group) =>
          normalizeKey(group.majorNo) === normalizeKey(selectedCategoryEntry.row.categoryNo) ||
          normalizeKey(group.majorName) === normalizeKey(selectedCategoryEntry.row.categoryName),
      );

      return {
        key: normalizeKey(selectedCategoryEntry.row.categoryNo ?? selectedCategoryEntry.row.categoryName ?? selectedCategoryEntry.index),
        majorNo: selectedCategoryEntry.row.categoryNo,
        majorName: selectedCategoryEntry.row.categoryName,
        workCategory: selectedCategoryEntry.row,
        workCategoryIndex: selectedCategoryEntry.index,
        rows: matchedGroup?.rows ?? [],
      };
    }

    return (
      competencyGroups.find((group) => group.key === selectedKey || normalizeKey(group.majorNo) === selectedKey) ??
      competencyGroups[0] ??
      null
    );
  }, [competencyGroups, detail, selectedCategoryNo]);

  const competencyStats = useMemo(() => {
    if (!detail) {
      return {
        requiredAverage: null,
        selectedAverage: null,
        teamAverage: null,
        averageGap: null,
        selectedScores: [] as number[],
      };
    }
    const requiredLevels = detail.requirements.map((requirement) => levelNumber(requirementLevelForMember(requirement, selectedMember)));
    const selectedScores = selectedMember
      ? detail.requirements.map((requirement) => scoreNumberFor(requirement, selectedMember.id))
      : [];
    const teamScores = detail.requirements.flatMap((requirement) =>
      detail.teamMembers.map((member) => scoreNumberFor(requirement, member.id)),
    );
    const requiredAverage = average(requiredLevels);
    const selectedAverage = average(selectedScores);
    const teamAverage = average(teamScores);
    const averageGap = requiredAverage !== null && selectedAverage !== null ? selectedAverage - requiredAverage : null;

    return {
      requiredAverage,
      selectedAverage,
      teamAverage,
      averageGap,
      selectedScores: selectedScores.filter((value): value is number => value !== null),
    };
  }, [detail, selectedMember]);

  const selectedLevelDistribution = useMemo(() => {
    const buckets = [1, 2, 3, 4, 5].map((level) => ({ level, count: 0 }));
    for (const score of competencyStats.selectedScores) {
      const bucket = buckets[Math.min(Math.max(Math.round(score), 1), 5) - 1];
      bucket.count += 1;
    }
    return buckets;
  }, [competencyStats.selectedScores]);

  const selectedLevelTotal = selectedLevelDistribution.reduce((sum, bucket) => sum + bucket.count, 0);

  const levelBadgeClass = (value: number | null, required?: number | null) => {
    if (value === null) return "border-slate-200 bg-slate-50 text-slate-500";
    if (required !== undefined && required !== null) {
      if (value < required) return "border-red-200 bg-red-50 text-red-700";
      if (value > required) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    return "border-amber-200 bg-amber-50 text-amber-700";
  };

  const gapLabel = (gap: number | null) => {
    if (gap === null) return "-";
    if (gap > 0) return `+${gap.toFixed(1)}`;
    return gap.toFixed(1);
  };

  const needSummary = (gap: number | null) => {
    if (gap === null) return { label: "미평가", className: "border-slate-200 bg-slate-50 text-slate-600" };
    if (gap <= -2) return { label: "매우 높음", className: "border-red-200 bg-red-50 text-red-700" };
    if (gap < 0) return { label: "높음", className: "border-rose-200 bg-rose-50 text-rose-700" };
    if (gap === 0) return { label: "보통", className: "border-amber-200 bg-amber-50 text-amber-700" };
    return { label: "양호", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  };

  const isReportLocked = detail?.report.status === "approved";

  const renderOrgAssignmentCard = (row: AssignmentRow) => {
    const member = row.employeeId ? teamMembersById.get(row.employeeId) : undefined;
    const rowIndex = row.originalIndex;
    const evidenceCount = evidenceTotalForMember(member?.id);

    return (
      <div className="relative w-[300px] rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300">
        {/* Left position accent line */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${
          member?.position?.includes("팀장") || member?.position?.includes("그룹장")
            ? "bg-gradient-to-b from-indigo-500 to-violet-600"
            : member?.position?.includes("책임")
              ? "bg-gradient-to-b from-blue-400 to-indigo-500"
              : "bg-slate-300"
        }`} />

        <div className="pl-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              member?.position?.includes("팀장") || member?.position?.includes("그룹장")
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                : member?.position?.includes("책임")
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}>
              {member?.position ?? row.positionTitle ?? "직급 미정"}
            </span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-slate-200 bg-white/80">
              증빙 {evidenceCount}건
            </Badge>
          </div>

          <div className="flex items-baseline gap-2">
            <h4 className="text-base font-bold text-slate-800">{member?.name ?? row.employeeName ?? "미지정"}</h4>
            <span className="text-[10px] text-slate-400">{member?.employeeNumber ?? "조직도 미연동"}</span>
          </div>

          <div className="space-y-1 bg-white/60 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100/80">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">담당 직무</span>
            {isEditMode ? (
              <Input
                value={row.roleTitle ?? ""}
                onChange={(event) => updateArrayRow<Assignment>("assignments", rowIndex, { roleTitle: event.target.value })}
                placeholder="담당직무 입력"
                className="h-8 mt-1 border-slate-200 text-xs shadow-none focus-visible:ring-1 bg-white"
              />
            ) : (
              <p className="text-xs font-semibold text-slate-700">{row.roleTitle || "직무 미입력"}</p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">상세 담당 업무</span>
            {isEditMode ? (
              <Textarea
                value={row.responsibilities ?? ""}
                onChange={(event) => updateArrayRow<Assignment>("assignments", rowIndex, { responsibilities: event.target.value })}
                placeholder={"1. 업무내용\n2. 업무내용"}
                className="min-h-[90px] mt-1 resize-y border-slate-200 text-xs leading-relaxed bg-white"
              />
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap min-h-[60px] bg-slate-50/50 p-2 rounded border border-slate-100/50">
                {row.responsibilities || "등록된 상세 업무가 없습니다."}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
            <span className="text-slate-400">대리인:</span>
            {isEditMode ? (
              <Input
                value={row.deputyName ?? ""}
                onChange={(event) => updateArrayRow<Assignment>("assignments", rowIndex, { deputyName: event.target.value })}
                placeholder="대리인 이름/직급"
                className="h-7 w-32 border-slate-200 text-xs shadow-none focus-visible:ring-1 bg-white"
              />
            ) : (
              <span className="font-medium text-slate-700">{row.deputyName || "-"}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderOrgAssignmentNode = (node: OrgAssignmentNode) => {
    const nodeKey = node.row.employeeId ?? node.row.id ?? node.row.originalIndex;

    return (
      <div key={nodeKey} className="relative inline-flex flex-col items-center align-top">
        {renderOrgAssignmentCard(node.row)}
        {node.children.length > 0 && (
          <div className="relative mt-10 inline-flex items-start justify-center gap-6">
            <div className="absolute -top-10 left-1/2 h-5 w-px bg-slate-300" />
            {node.children.length > 1 && <div className="absolute -top-5 left-[150px] right-[150px] h-px bg-slate-300" />}
            {node.children.map((child) => (
              <div key={child.row.employeeId ?? child.row.id ?? child.row.originalIndex} className="relative inline-flex">
                <div className="absolute -top-5 left-1/2 h-5 w-px bg-slate-300" />
                {renderOrgAssignmentNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="team-competency-page">
      {/* Top Header Section */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 bg-clip-text text-transparent flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-indigo-600" />
            팀 적격성 관리
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
             Ashimori 팀별 조직도, 직무 요건, 역량 평가 매트릭스 및 자격 증빙을 통합 관리합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200/50">
            <select
              value={selectedTeamCode}
              onChange={(event) => setSelectedTeamCode(event.target.value)}
              className="h-8 min-w-[150px] rounded-md border-0 bg-transparent px-2 text-xs font-semibold focus-visible:ring-0 cursor-pointer"
              data-testid="select-team-competency-team"
            >
              {isLoadingTeams && <option>팀 불러오는 중</option>}
              {teams.map((team) => (
                <option key={team.code} value={team.code}>
                  {team.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="w-20 h-8 border-0 bg-white shadow-none text-xs font-bold text-center"
              data-testid="input-team-competency-year"
            />
          </div>

          <Button
            size="sm"
            onClick={() => ensureReportMutation.mutate()}
            disabled={!selectedTeam || ensureReportMutation.isPending}
            className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200/60 shadow-none font-bold text-xs h-8"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            보고서 준비
          </Button>

          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!detail || isReportLocked || saveMutation.isPending}
            className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-8 shadow-sm"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            저장
          </Button>

          {detail && (
            <div className="flex items-center gap-1.5 ml-2 border-l pl-3 border-slate-200">
              <Button
                type="button"
                size="sm"
                variant={isEditMode ? "default" : "outline"}
                onClick={() => setIsEditMode(!isEditMode)}
                className={`h-8 font-bold text-xs transition-all ${
                  isEditMode
                    ? "bg-amber-500 hover:bg-amber-600 border-amber-600 text-white"
                    : "text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Settings className={`h-3.5 w-3.5 mr-1.5 ${isEditMode ? "animate-spin" : ""}`} />
                {isEditMode ? "편집 완료" : "정보 수정"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {detail ? (
        <>
          {isReportLocked && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>승인된 보고서입니다. 조직 정보와 평가 내용은 읽기 전용으로 잠겨 있습니다. 수정을 원하시면 결재 상태를 변경해 주세요.</span>
            </div>
          )}

          {/* Stat Summary Row and Corporate Signature Box */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Stat Cards Grid */}
            <div className="xl:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">팀원 수</p>
                    <p className="text-2xl font-black text-slate-800">{detail.teamMembers.length}</p>
                    <p className="text-[9px] text-slate-400">현재 활성 멤버</p>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100/50">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">업무분류</p>
                    <p className="text-2xl font-black text-slate-800">{detail.workCategories.length}</p>
                    <p className="text-[9px] text-slate-400">관리 대분류 영역</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100/50">
                    <BriefcaseBusiness className="w-5 h-5 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">평가율</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-black text-slate-800">
                        {percentValue(scoreStats.entered, scoreStats.total)}%
                      </p>
                      <span className="text-[10px] text-slate-400">({scoreStats.entered}/{scoreStats.total})</span>
                    </div>
                    <p className="text-[9px] text-emerald-600 font-semibold">평균 {scoreStats.average.toFixed(1)}점</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100/50">
                    <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">자격/증빙</p>
                    <p className="text-2xl font-black text-slate-800">{detail.qualifications.length}</p>
                    <p className="text-[9px] text-violet-600 font-semibold">증빙 데이터 {evidenceTotal}건</p>
                  </div>
                  <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center border border-violet-100/50">
                    <Award className="w-5 h-5 text-violet-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Corporate Signature Line Block */}
            <div className="xl:col-span-1">
              <Card className="overflow-hidden border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <div className="bg-slate-50/50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">문서 승인 결재선</span>
                  <Badge variant={
                    detail.report.status === "approved" ? "default" :
                    detail.report.status === "review" ? "secondary" : "outline"
                  } className={`text-[10px] ${
                    detail.report.status === "approved" ? "bg-emerald-500 hover:bg-emerald-600 text-white" :
                    detail.report.status === "review" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
                  }`}>
                    {detail.report.status === "approved" ? "승인 완료" :
                     detail.report.status === "review" ? "검토 진행중" : "작성중"}
                  </Badge>
                </div>
                <CardContent className="p-3 grid grid-cols-5 gap-2">
                  <div className="flex flex-col items-center justify-center p-2 bg-slate-50/70 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-bold text-slate-400">Rev</span>
                    {isEditMode ? (
                      <Input
                        disabled={isReportLocked}
                        value={detail.report.revision ?? ""}
                        onChange={(e) => updateReport("revision", e.target.value)}
                        placeholder="Rev.00"
                        className="mt-1 h-6 text-center text-[10px] w-full bg-white px-1 py-0.5 rounded border border-slate-200"
                      />
                    ) : (
                      <span className="mt-1 text-xs font-bold text-slate-700">{detail.report.revision || "Rev.00"}</span>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center p-2 bg-slate-50/70 rounded-xl border border-slate-100 text-center relative overflow-hidden">
                    <span className="text-[9px] font-bold text-slate-400">작성</span>
                    {isEditMode ? (
                      <Input
                        disabled={isReportLocked}
                        value={detail.report.preparedBy ?? ""}
                        onChange={(e) => updateReport("preparedBy", e.target.value)}
                        placeholder="작성자"
                        className="mt-1 h-6 text-center text-[10px] w-full bg-white px-1 py-0.5 rounded border border-slate-200"
                      />
                    ) : (
                      <div className="mt-1 flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-full">{detail.report.preparedBy || "-"}</span>
                        {detail.report.preparedBy && (
                          <div className="absolute right-0.5 bottom-0.5 text-[7px] border border-red-200 text-red-500 rounded px-0.5 rotate-12 bg-white/90 font-serif font-black scale-90">
                            작성
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center p-2 bg-slate-50/70 rounded-xl border border-slate-100 text-center relative overflow-hidden">
                    <span className="text-[9px] font-bold text-slate-400">검토</span>
                    {isEditMode ? (
                      <Input
                        disabled={isReportLocked}
                        value={detail.report.checkedBy ?? ""}
                        onChange={(e) => updateReport("checkedBy", e.target.value)}
                        placeholder="검토자"
                        className="mt-1 h-6 text-center text-[10px] w-full bg-white px-1 py-0.5 rounded border border-slate-200"
                      />
                    ) : (
                      <div className="mt-1 flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-full">{detail.report.checkedBy || "-"}</span>
                        {detail.report.checkedBy && (
                          <div className="absolute right-0.5 bottom-0.5 text-[7px] border border-blue-200 text-blue-500 rounded px-0.5 rotate-12 bg-white/90 font-serif font-black scale-90">
                            검토
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center p-2 bg-slate-50/70 rounded-xl border border-slate-100 text-center relative overflow-hidden">
                    <span className="text-[9px] font-bold text-slate-400">승인</span>
                    {isEditMode ? (
                      <Input
                        disabled={isReportLocked}
                        value={detail.report.approvedBy ?? ""}
                        onChange={(e) => updateReport("approvedBy", e.target.value)}
                        placeholder="승인자"
                        className="mt-1 h-6 text-center text-[10px] w-full bg-white px-1 py-0.5 rounded border border-slate-200"
                      />
                    ) : (
                      <div className="mt-1 flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-full">{detail.report.approvedBy || "-"}</span>
                        {detail.report.approvedBy && (
                          <div className="absolute right-0.5 bottom-0.5 text-[7px] border border-emerald-200 text-emerald-500 rounded px-0.5 rotate-12 bg-white/90 font-serif font-black scale-90">
                            승인
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center p-2 bg-slate-50/70 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-bold text-slate-400">상태</span>
                    {isEditMode ? (
                      <select
                        value={detail.report.status}
                        onChange={(event) => updateReport("status", event.target.value)}
                        disabled={isReportLocked}
                        className="mt-1 h-6 rounded border border-slate-200 bg-white px-1 text-[10px] w-full"
                      >
                        <option value="draft">작성중</option>
                        <option value="review">검토중</option>
                        <option value="approved">승인</option>
                      </select>
                    ) : (
                      <span className="mt-1 text-xs font-semibold text-slate-700 truncate max-w-full">
                        {detail.report.status === "approved" ? "승인완료" :
                         detail.report.status === "review" ? "검토중" : "작성중"}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Operational Health Center */}
          {operationalStats && (
            <Card className="border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/30 border-b border-slate-100">
                <CardTitle className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                    보고서 정합성 및 건강도 점검
                  </span>
                  <Badge variant={operationalStats.readinessPercent >= 85 ? "default" : "secondary"} className="text-[10px]">
                    {operationalStats.statusLabel}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-indigo-600">{operationalStats.readinessPercent}%</span>
                      <span className="text-xs text-muted-foreground">정비도</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">조직도 연동, 역할 분장, 평가 매트릭스 입력 및 자격 매칭 기준</p>
                  </div>
                  <div className="w-full sm:max-w-md bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${operationalStats.readinessPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className={`rounded-xl border p-3 flex flex-col justify-between transition-all hover:bg-slate-50/30 ${
                    detail.teamMembers.length > 0 ? "border-emerald-100 bg-emerald-50/10" : "border-slate-200"
                  }`}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>조직도 정렬 연동</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {detail.teamMembers.length}명 팀원 / 깊이 순서 자동 매칭
                    </p>
                  </div>

                  <div className={`rounded-xl border p-3 flex flex-col justify-between transition-all hover:bg-slate-50/30 ${
                    operationalStats.missingResponsibilities === 0 ? "border-emerald-100 bg-emerald-50/10" : "border-amber-100 bg-amber-50/10"
                  }`}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>역할 및 담당 업무</span>
                      {operationalStats.missingResponsibilities === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {operationalStats.missingResponsibilities === 0
                        ? "모든 임직원 역할 기재 완료"
                        : `미작성 역할 요약 ${operationalStats.missingResponsibilities}건`}
                    </p>
                  </div>

                  <div className={`rounded-xl border p-3 flex flex-col justify-between transition-all hover:bg-slate-50/30 ${
                    operationalStats.missingScores === 0 ? "border-emerald-100 bg-emerald-50/10" : "border-amber-100 bg-amber-50/10"
                  }`}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>평가 매트릭스 채우기</span>
                      {operationalStats.missingScores === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {operationalStats.missingScores === 0
                        ? "요구조건 평가 매칭률 100%"
                        : `미평가 요구 수준 ${operationalStats.missingScores}칸 존재`}
                    </p>
                  </div>

                  <div className={`rounded-xl border p-3 flex flex-col justify-between transition-all hover:bg-slate-50/30 ${
                    operationalStats.missingQualificationHolders === 0 && evidenceTotal > 0 ? "border-emerald-100 bg-emerald-50/10" : "border-amber-100 bg-amber-50/10"
                  }`}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>요구자격 및 증빙</span>
                      {operationalStats.missingQualificationHolders === 0 && evidenceTotal > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      보유자 미입력 {operationalStats.missingQualificationHolders}건 · 증빙 연동 {evidenceTotal}건
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Working Tabs */}
          <Tabs defaultValue="organization" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
              <TabsTrigger value="organization" className="rounded-lg font-bold text-xs">조직 및 업무분장</TabsTrigger>
              <TabsTrigger value="competency" className="rounded-lg font-bold text-xs">업무/요구기준 평가</TabsTrigger>
              <TabsTrigger value="qualifications" className="rounded-lg font-bold text-xs">요구자격 보유현황</TabsTrigger>
            </TabsList>

            {/* Tab 1: Organization & Responsibilities */}
            <TabsContent value="organization" className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-white/80">{detail.report.teamName} / {detail.report.evaluationYear}</Badge>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setOrgViewMode("tree")}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                        orgViewMode === "tree" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-muted-foreground hover:text-slate-700"
                      }`}
                    >
                      <GitMerge className="h-3 w-3" />
                      조직도
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrgViewMode("list")}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                        orgViewMode === "list" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-muted-foreground hover:text-slate-700"
                      }`}
                    >
                      <LayoutGrid className="h-3 w-3" />
                      카드 목록
                    </button>
                  </div>
                </div>
              </div>

              <fieldset disabled={isReportLocked} className="contents">
                {orgViewMode === "tree" ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/40 p-6 shadow-inner" data-testid="team-competency-org-chart">
                    <div className="flex min-w-max items-start justify-center gap-8 px-4 py-2">
                      {orgAssignmentTree.map((node) => renderOrgAssignmentNode(node))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40">
                    {sortedAssignments.map((row) => (
                      <div key={row.employeeId ?? row.id ?? row.originalIndex}>
                        {renderOrgAssignmentCard(row)}
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            </TabsContent>

            {/* Tab 2: Work Categories & Requirements Matrix */}
            <TabsContent value="competency" className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/60">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="bg-white/80">업무 영역 {detail.workCategories.length}개</Badge>
                  <Badge variant="outline" className="bg-white/80">세부 요구사항 {detail.requirements.length}개</Badge>
                  <Badge variant="outline" className="bg-white/80">매칭도 {scoreStats.entered}/{scoreStats.total}</Badge>
                  {operationalStats && operationalStats.missingScores > 0 && (
                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">미평가 {operationalStats.missingScores}칸</Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
                    <label className="text-[11px] font-bold text-muted-foreground px-1.5 uppercase">임직원 평가</label>
                    <select
                      value={selectedMember?.id ?? ""}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      className="h-7 min-w-[130px] rounded-md border-0 bg-transparent px-1.5 text-xs font-semibold focus-visible:ring-0 cursor-pointer"
                      data-testid="select-team-competency-member"
                    >
                      {detail.teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} {member.position}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addWorkCategory}
                    disabled={isReportLocked}
                    className="text-xs h-8 border-slate-200 hover:bg-slate-50 font-bold"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    대분류 추가
                  </Button>
                </div>
              </div>

              {/* Grid of stats for Selected Member */}
              {selectedMember && (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <Card className="border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.01)] bg-slate-50/20">
                    <CardContent className="p-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">대상 임직원</div>
                      <div className="mt-1 font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Users className="h-4.5 w-4.5 text-indigo-500" />
                        {selectedMember.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{selectedMember.position}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.01)] bg-slate-50/20">
                    <CardContent className="p-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">평균 요구 수준</div>
                      <div className="mt-1 text-base font-black text-slate-800">
                        {formatAverage(competencyStats.requiredAverage)} <span className="text-xs text-muted-foreground font-normal">/ 5</span>
                      </div>
                      <div className="text-[9px] text-indigo-600 font-semibold mt-0.5">{requirementGroupForMember(selectedMember).label} 요건</div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.01)] bg-slate-50/20">
                    <CardContent className="p-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">현재 평가 수준</div>
                      <div className="mt-1 text-base font-black text-slate-800">
                        {formatAverage(competencyStats.selectedAverage)} <span className="text-xs text-muted-foreground font-normal">/ 5</span>
                      </div>
                      <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">{selectedMember.name} 임직원 기준</div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.01)] bg-slate-50/20">
                    <CardContent className="p-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">GAP 분석</div>
                      <div className={`mt-1 text-base font-black flex items-center gap-1 ${
                        competencyStats.averageGap !== null && competencyStats.averageGap < 0 ? "text-red-500" : "text-emerald-500"
                      }`}>
                        {competencyStats.averageGap !== null && competencyStats.averageGap < 0 ? (
                          <TrendingDown className="h-4.5 w-4.5" />
                        ) : (
                          <TrendingUp className="h-4.5 w-4.5" />
                        )}
                        {gapLabel(competencyStats.averageGap)}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">요구대비 미달/초과 격차</div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.01)] bg-slate-50/20">
                    <CardContent className="p-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">역량 보유율</div>
                      <div className="mt-1 text-base font-black text-slate-800">
                        {selectedLevelTotal > 0
                          ? Math.round((competencyStats.selectedScores.filter(s => s >= 3).length / selectedLevelTotal) * 100)
                          : 0}%
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Lv.3 이상 확보 수준</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Member competency level distribution */}
              {selectedMember && selectedLevelTotal > 0 && (
                <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                  <div className="p-3 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-700">개인 역량 분포 그래프</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">{selectedMember.name}의 현재 직무수행 레벨 개수</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white text-indigo-600 border-indigo-100">
                      팀 평균 {formatAverage(competencyStats.teamAverage)}점
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 border border-slate-200/30">
                      {selectedLevelDistribution.map((bucket, index) => (
                        <div
                          key={bucket.level}
                          className={["bg-rose-400", "bg-orange-300", "bg-amber-300", "bg-emerald-400", "bg-indigo-500"][index]}
                          style={{ width: `${(bucket.count / selectedLevelTotal) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[10px]">
                      {selectedLevelDistribution.map((bucket, index) => (
                        <div key={bucket.level} className="p-1.5 bg-slate-50/50 rounded-lg border border-slate-100">
                          <div className="font-bold flex items-center justify-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${["bg-rose-400", "bg-orange-300", "bg-amber-300", "bg-emerald-400", "bg-indigo-500"][index]}`} />
                            Lv.{bucket.level}
                          </div>
                          <div className="text-muted-foreground font-semibold mt-0.5">
                            {bucket.count}개 ({selectedLevelTotal ? Math.round((bucket.count / selectedLevelTotal) * 100) : 0}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Split Workspace Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Panel: Category Navigator */}
                <div className="lg:col-span-1 space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">업무 영역 (대분류)</h3>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {detail.workCategories.map((cat, idx) => {
                      const catNo = cat.categoryNo ?? "";
                      const catName = cat.categoryName ?? "대분류 미입력";
                      const isSelected = selectedCategoryNo === catNo;

                      // Find requirements matching this category
                      const matchedGroup = competencyGroups.find(
                        (g) => normalizeKey(g.majorNo) === normalizeKey(catNo)
                      );
                      const totalReqs = matchedGroup ? matchedGroup.rows.length : 0;

                      // Calculate completion rate
                      let completedReqs = 0;
                      if (matchedGroup && selectedMember) {
                        matchedGroup.rows.forEach(({ row }) => {
                          const hasVal = scoreFor(row, selectedMember.id);
                          if (hasVal !== "" && hasVal !== null && hasVal !== undefined) {
                            completedReqs++;
                          }
                        });
                      }
                      const completionRate = totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 0;

                      return (
                        <div
                          key={cat.id ?? idx}
                          onClick={() => setSelectedCategoryNo(catNo)}
                          className={`group relative flex flex-col p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-50/50 border-indigo-500 shadow-sm"
                              : "bg-white border-slate-200/80 hover:bg-slate-50/50 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                              isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
                            }`}>
                              {catNo || `No.${idx + 1}`}
                            </span>
                            {totalReqs > 0 && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                {completedReqs}/{totalReqs} 평가
                              </span>
                            )}
                          </div>

                          <div className="mt-2 font-bold text-xs text-slate-800 line-clamp-1 pr-6">
                            {catName}
                          </div>

                          {totalReqs > 0 && (
                            <div className="mt-3 w-full bg-slate-100 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full transition-all duration-300 ${
                                  completionRate === 100 ? "bg-emerald-500" : "bg-indigo-500"
                                }`}
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                          )}

                          {/* Hover Actions inside Navigator */}
                          <div className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                            <Dialog>
                              <DialogTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </DialogTrigger>
                              <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>대분류 업무영역 수정</DialogTitle>
                                  <DialogDescription>
                                    대분류 코드 번호 및 영역 명칭을 변경합니다.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                  <div className="grid grid-cols-4 gap-2">
                                    <div className="col-span-1">
                                      <label className="text-[10px] font-bold text-slate-400">No (대분류코드)</label>
                                      <Input
                                        disabled={isReportLocked}
                                        value={cat.categoryNo ?? ""}
                                        onChange={(e) => updateArrayRow<WorkCategory>("workCategories", idx, { categoryNo: e.target.value })}
                                      />
                                    </div>
                                    <div className="col-span-3">
                                      <label className="text-[10px] font-bold text-slate-400">대분류 명칭</label>
                                      <Input
                                        disabled={isReportLocked}
                                        value={cat.categoryName ?? ""}
                                        onChange={(e) => updateArrayRow<WorkCategory>("workCategories", idx, { categoryName: e.target.value })}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400">주요 업무 기능</label>
                                    <Textarea
                                      disabled={isReportLocked}
                                      value={cat.majorFunctions ?? ""}
                                      onChange={(e) => updateArrayRow<WorkCategory>("workCategories", idx, { majorFunctions: e.target.value })}
                                      rows={3}
                                      className="text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400">중점관리 항목 / Tool</label>
                                    <Textarea
                                      disabled={isReportLocked}
                                      value={cat.controlItems ?? ""}
                                      onChange={(e) => updateArrayRow<WorkCategory>("workCategories", idx, { controlItems: e.target.value })}
                                      rows={3}
                                      className="text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400">관련 문서/법규</label>
                                    <Textarea
                                      disabled={isReportLocked}
                                      value={cat.relatedDocs ?? ""}
                                      onChange={(e) => updateArrayRow<WorkCategory>("workCategories", idx, { relatedDocs: e.target.value })}
                                      rows={2}
                                      className="text-xs"
                                    />
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeArrayRow("workCategories", idx);
                              }}
                              disabled={isReportLocked}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Panel: Selected Category Detail Matrix Table */}
                <div className="lg:col-span-3 space-y-4">
                  {selectedGroup ? (
                    <Card className="border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
                      {/* Active category details card */}
                      <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="text-xs bg-indigo-500 text-white font-black px-2 py-0.5 rounded">
                              {selectedGroup.majorNo}
                            </span>
                            {selectedGroup.majorName || "대분류 정보 없음"}
                          </h2>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addRequirementForCategory(selectedGroup.majorNo, selectedGroup.majorName, selectedGroup.rows.length + 1)}
                              disabled={isReportLocked}
                              className="text-[11px] h-7 font-bold border-slate-200"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              세부업무 추가
                            </Button>
                          </div>
                        </div>

                        {(selectedGroup.workCategory?.majorFunctions || selectedGroup.workCategory?.controlItems) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-3 bg-white rounded-xl border border-slate-100 text-[11px] leading-relaxed">
                            {selectedGroup.workCategory.majorFunctions && (
                              <div className="space-y-1">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">주요 기능</span>
                                <p className="text-slate-600 whitespace-pre-wrap">{selectedGroup.workCategory.majorFunctions}</p>
                              </div>
                            )}
                            {selectedGroup.workCategory.controlItems && (
                              <div className="space-y-1">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">중점 관리 / Tool</span>
                                <p className="text-slate-600 whitespace-pre-wrap">{selectedGroup.workCategory.controlItems}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <fieldset disabled={isReportLocked} className="contents">
                        <div className="overflow-x-auto" data-testid="team-competency-merged-matrix">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50 text-[11px] font-bold">
                                <TableHead className="w-[200px]">세부 업무 요건</TableHead>
                                <TableHead className="min-w-[150px]">지식 / 경험 요건</TableHead>
                                <TableHead className="w-[120px] text-center">요구수준 / 팀평균</TableHead>
                                <TableHead className="w-[80px] text-center">해당 여부</TableHead>
                                <TableHead className="w-[230px] text-center">수행 역량 평가 (임직원)</TableHead>
                                <TableHead className="w-[80px] text-center">GAP</TableHead>
                                <TableHead className="w-[90px] text-center">필요도</TableHead>
                                <TableHead className="min-w-[150px]">교육 및 어학 요건</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedGroup.rows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
                                    이 대분류 영역에 아직 세부 업무 요건이 없습니다.
                                    <br />
                                    위의 '세부업무 추가' 버튼을 눌러 첫 항목을 작성해 주세요.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                selectedGroup.rows.map(({ row, index }) => {
                                  const category = selectedGroup.workCategory;
                                  const selectedRequirementGroup = requirementGroupForMember(selectedMember);
                                  const selectedRequirementValue = requirementLevelForMember(row, selectedMember);
                                  const requiredLevel = levelNumber(selectedRequirementValue);
                                  const teamAverage = average(detail.teamMembers.map((member) => scoreNumberFor(row, member.id)));
                                  const selectedApplicable = selectedMember ? scoreApplicableFor(row, selectedMember.id) : true;
                                  const selectedScore = selectedMember && selectedApplicable ? scoreNumberFor(row, selectedMember.id) : null;
                                  const gap = selectedApplicable && selectedScore !== null && requiredLevel !== null ? selectedScore - requiredLevel : null;
                                  const need = selectedApplicable
                                    ? needSummary(gap)
                                    : { label: "비해당", className: "border-slate-100 bg-slate-50/50 text-slate-400" };
                                  const toolHint = numberedLine(category?.controlItems, row.subNo);

                                  return (
                                    <TableRow key={row.id ?? index} className={`text-xs hover:bg-slate-50/30 ${
                                      gap !== null && gap < 0 ? "bg-rose-50/10" : ""
                                    }`}>
                                      {/* 세부 업무 */}
                                      <TableCell className="align-top font-medium">
                                        {isEditMode ? (
                                          <div className="space-y-2">
                                            <div className="flex items-start gap-1.5">
                                              <TextCell value={row.subNo} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { subNo: value })} placeholder="No" className="w-12 h-8 text-xs text-center" />
                                              <TextCell value={row.subName} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { subName: value })} placeholder="세부업무명" className="h-8 text-xs w-full" />
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeArrayRow("requirements", index)}
                                                disabled={isReportLocked}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <TextCell value={row.requiredMajor} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredMajor: value })} placeholder="권장 전공" className="h-7 text-[10px] w-full" />
                                              <TextCell value={row.requiredCertification} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredCertification: value })} placeholder="권장 자격증" className="h-7 text-[10px] w-full" />
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-1.5">
                                            <div className="flex items-start gap-1">
                                              <span className="text-[10px] bg-slate-100 font-bold px-1 rounded text-slate-600 shrink-0 mt-0.5">
                                                {row.subNo || "-"}
                                              </span>
                                              <span className="font-semibold text-slate-800">{row.subName || "업무명 미입력"}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pl-4">
                                              {row.requiredMajor && (
                                                <Badge variant="outline" className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1 py-0 border-slate-200">
                                                  {row.requiredMajor}
                                                </Badge>
                                              )}
                                              {row.requiredCertification && (
                                                <Badge variant="secondary" className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border-indigo-100/50 px-1 py-0">
                                                  {row.requiredCertification}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </TableCell>

                                      {/* 지식 / 경험 요건 */}
                                      <TableCell className="align-top">
                                        {isEditMode ? (
                                          <div className="space-y-2">
                                            <TextAreaCell
                                              value={row.minKnowledge}
                                              onChange={(value) => updateArrayRow<Requirement>("requirements", index, { minKnowledge: value })}
                                              placeholder="최소 실무지식 / 경력 기준"
                                              className="min-h-[50px] text-xs w-full"
                                            />
                                            <TextCell
                                              value={row.proficiencyPeriod}
                                              onChange={(value) => updateArrayRow<Requirement>("requirements", index, { proficiencyPeriod: value })}
                                              placeholder="숙달 기간 (예: 12개월)"
                                              className="h-7 text-[10px] w-full"
                                            />
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{row.minKnowledge || "-"}</p>
                                            {row.proficiencyPeriod && (
                                              <p className="text-[9px] text-slate-400 font-semibold">숙달소요: {row.proficiencyPeriod}</p>
                                            )}
                                          </div>
                                        )}
                                      </TableCell>

                                      {/* 요구수준 / 팀 평균 */}
                                      <TableCell className="text-center align-top">
                                        <div className="flex flex-col items-center gap-1.5">
                                          <div className="flex items-center gap-1">
                                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${levelBadgeClass(requiredLevel)}`}>
                                              요구 {formatLevel(selectedRequirementValue)}
                                            </span>
                                          </div>
                                          <span className="text-[9px] text-slate-400 font-medium">
                                            {selectedRequirementGroup.label}
                                          </span>
                                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${levelBadgeClass(teamAverage, requiredLevel)}`}>
                                            평균 {formatLevel(teamAverage)}
                                          </span>

                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <Button variant="ghost" size="sm" className="h-6 w-full text-[9px] font-bold border border-dashed border-slate-200 text-slate-500 hover:bg-slate-50">
                                                기준 변경
                                              </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-md">
                                              <DialogHeader>
                                                <DialogTitle>직급 그룹별 요구수준 설정</DialogTitle>
                                                <DialogDescription>{row.subName || "세부업무"}의 등급 요구치</DialogDescription>
                                              </DialogHeader>
                                              <div className="grid gap-3 py-2">
                                                <div className="grid grid-cols-3 items-center gap-3">
                                                  <label className="text-xs font-bold text-slate-600">책임 미만 (Staff)</label>
                                                  <TextCell
                                                    value={row.staffLevel}
                                                    onChange={(value) => updateArrayRow<Requirement>("requirements", index, { staffLevel: value })}
                                                    placeholder="Lv 또는 N/A"
                                                    disabled={isReportLocked}
                                                    className="col-span-2"
                                                  />
                                                </div>
                                                <div className="grid grid-cols-3 items-center gap-3">
                                                  <label className="text-xs font-bold text-slate-600">책임 이상 (Senior)</label>
                                                  <TextCell
                                                    value={row.managerLevel}
                                                    onChange={(value) => updateArrayRow<Requirement>("requirements", index, { managerLevel: value })}
                                                    placeholder="Lv 또는 N/A"
                                                    disabled={isReportLocked}
                                                    className="col-span-2"
                                                  />
                                                </div>
                                                <div className="grid grid-cols-3 items-center gap-3">
                                                  <label className="text-xs font-bold text-slate-600">팀장·그룹장</label>
                                                  <TextCell
                                                    value={row.deptHeadLevel}
                                                    onChange={(value) => updateArrayRow<Requirement>("requirements", index, { deptHeadLevel: value })}
                                                    placeholder="Lv 또는 N/A"
                                                    disabled={isReportLocked}
                                                    className="col-span-2"
                                                  />
                                                </div>
                                                <div className="grid grid-cols-3 items-center gap-3 rounded-lg bg-yellow-50/50 p-2 border border-yellow-100">
                                                  <label className="text-xs font-bold text-yellow-800">최소 한계수준</label>
                                                  <TextCell
                                                    value={row.minimumLevel}
                                                    onChange={(value) => updateArrayRow<Requirement>("requirements", index, { minimumLevel: value })}
                                                    placeholder="Lv"
                                                    disabled={isReportLocked}
                                                    className="col-span-2 bg-white"
                                                  />
                                                </div>
                                              </div>
                                            </DialogContent>
                                          </Dialog>
                                        </div>
                                      </TableCell>

                                      {/* 해당 여부 */}
                                      <TableCell className="text-center align-top">
                                        {selectedMember ? (
                                          <div className="flex flex-col items-center gap-1 justify-center pt-2">
                                            <Checkbox
                                              checked={selectedApplicable}
                                              onCheckedChange={(checked) => updateScoreApplicability(index, selectedMember, checked === true)}
                                              disabled={isReportLocked}
                                              aria-label={`${row.subName ?? "세부업무"} 해당 여부`}
                                              className="border-slate-300"
                                            />
                                            <span className={`text-[10px] font-bold ${selectedApplicable ? "text-indigo-600" : "text-slate-400"}`}>
                                              {selectedApplicable ? "해당" : "비해당"}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                      </TableCell>

                                      {/* 수행 역량 평가 */}
                                      <TableCell className="text-center align-top">
                                        {selectedMember ? (
                                          <div className="space-y-2 py-1">
                                            <ScoreSelector
                                              value={scoreFor(row, selectedMember.id)}
                                              onChange={(val) => updateScore(index, selectedMember, val)}
                                              disabled={isReportLocked || !selectedApplicable}
                                            />
                                            <div className="flex items-center justify-between px-4 text-[9px] text-muted-foreground font-bold">
                                              <span>미흡</span>
                                              <span>보통</span>
                                              <span>우수</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                      </TableCell>

                                      {/* GAP */}
                                      <TableCell className="text-center align-top">
                                        <div className="pt-2">
                                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                                            gap !== null && gap < 0
                                              ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20"
                                              : gap !== null && gap > 0
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20"
                                                : "border-slate-200 bg-slate-50 text-slate-600 dark:bg-slate-800"
                                          }`}>
                                            {gapLabel(gap)}
                                          </span>
                                        </div>
                                      </TableCell>

                                      {/* 필요도 */}
                                      <TableCell className="text-center align-top">
                                        <div className="pt-2">
                                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${need.className}`}>
                                            {need.label}
                                          </span>
                                        </div>
                                      </TableCell>

                                      {/* 교육 및 어학 요건 */}
                                      <TableCell className="align-top">
                                        {isEditMode ? (
                                          <div className="space-y-2">
                                            <TextAreaCell
                                              value={row.requiredTraining}
                                              onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredTraining: value })}
                                              placeholder="교육 / Tool 조건"
                                              className="min-h-[50px] text-xs w-full"
                                            />
                                            <TextCell
                                              value={row.languageRequirement}
                                              onChange={(value) => updateArrayRow<Requirement>("requirements", index, { languageRequirement: value })}
                                              placeholder="어학 요건 (예: TOEIC 600)"
                                              className="h-7 text-[10px] w-full"
                                            />
                                          </div>
                                        ) : (
                                          <div className="space-y-1.5 text-[11px]">
                                            <p className="text-slate-600 leading-relaxed font-semibold">{row.requiredTraining || "-"}</p>
                                            {toolHint && (
                                              <p className="text-[10px] text-indigo-600 bg-indigo-50/30 px-1.5 py-0.5 rounded border border-indigo-100/30 inline-block font-semibold">
                                                중점: {toolHint}
                                              </p>
                                            )}
                                            {row.languageRequirement && (
                                              <p className="text-[9px] text-slate-400 font-bold">어학: {row.languageRequirement}</p>
                                            )}
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </fieldset>
                    </Card>
                  ) : (
                    <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed bg-slate-50/20 text-center p-6 text-slate-400">
                      <div>
                        <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="font-semibold text-slate-500">대분류가 등록되지 않았거나 선택되지 않았습니다</h4>
                        <p className="text-xs text-muted-foreground mt-1">좌측 대분류 리스트에서 관리할 대분류 영역을 클릭하거나 업무를 추가해 주세요.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Required Qualifications Status */}
            <TabsContent value="qualifications" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <Badge variant="outline" className="bg-white/80 text-slate-600">자격 {evidenceStats.certifications}건</Badge>
                  <Badge variant="outline" className="bg-white/80 text-slate-600">스킬 {evidenceStats.skills}건</Badge>
                  <Badge variant="outline" className="bg-white/80 text-slate-600">어학 {evidenceStats.languages}건</Badge>
                  <Badge variant="outline" className="bg-white/80 text-slate-600">사외교육 {evidenceStats.trainings}건</Badge>
                  {operationalStats && operationalStats.missingQualificationHolders > 0 && (
                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">보유자 미입력 {operationalStats.missingQualificationHolders}건</Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addQualification}
                  disabled={isReportLocked}
                  className="text-xs font-bold border-slate-200 h-8 hover:bg-slate-50"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  자격 요구 추가
                </Button>
              </div>

              <fieldset disabled={isReportLocked} className="contents">
                <Card className="border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 text-[11px] font-bold">
                          <TableHead className="w-[80px]">No</TableHead>
                          <TableHead className="min-w-[150px]">요구 항목 (분야)</TableHead>
                          <TableHead className="min-w-[200px]">자격 및 기준 명칭</TableHead>
                          <TableHead className="w-[100px]">요구 등급</TableHead>
                          <TableHead className="min-w-[200px]">보유자 / 자격 현황</TableHead>
                          <TableHead className="min-w-[200px]">향후 확보 계획 / 비고</TableHead>
                          {isEditMode && <TableHead className="w-[60px]"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.qualifications.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isEditMode ? 7 : 6} className="text-center py-10 text-xs text-muted-foreground">
                              등록된 필수 요구자격 항목이 없습니다.
                              <br />
                              우측 상단의 '자격 요구 추가' 버튼을 눌러 필수 자격을 설정하세요.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detail.qualifications.map((row, index) => (
                            <TableRow key={row.id ?? index} className="text-xs hover:bg-slate-50/30">
                              {/* No */}
                              <TableCell className="align-top font-bold text-slate-500">
                                {isEditMode ? (
                                  <TextCell value={row.itemNo} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { itemNo: value })} className="w-16 h-8 text-center text-xs" />
                                ) : (
                                  <span className="inline-block bg-slate-100 px-2 py-0.5 rounded mt-1">{row.itemNo || index + 1}</span>
                                )}
                              </TableCell>

                              {/* 요구 항목 */}
                              <TableCell className="align-top font-bold text-slate-700">
                                {isEditMode ? (
                                  <TextCell value={row.requirementItem} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { requirementItem: value })} className="h-8 text-xs w-full" />
                                ) : (
                                  <span className="mt-1 block">{row.requirementItem || "-"}</span>
                                )}
                              </TableCell>

                              {/* 기준/자격명 */}
                              <TableCell className="align-top">
                                {isEditMode ? (
                                  <TextAreaCell value={row.requirementName} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { requirementName: value })} className="min-h-[40px] text-xs w-full" />
                                ) : (
                                  <p className="mt-1 leading-relaxed text-slate-600 font-semibold whitespace-pre-wrap">{row.requirementName || "-"}</p>
                                )}
                              </TableCell>

                              {/* 등급 */}
                              <TableCell className="align-top">
                                {isEditMode ? (
                                  <TextCell value={row.requiredGrade} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { requiredGrade: value })} className="h-8 text-xs w-full" />
                                ) : (
                                  <span className="mt-1 inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 rounded px-2 py-0.5 font-bold text-[10px]">
                                    {row.requiredGrade || "-"}
                                  </span>
                                )}
                              </TableCell>

                              {/* 보유자 현황 */}
                              <TableCell className="align-top">
                                {isEditMode ? (
                                  <div className="space-y-2">
                                    <TextAreaCell value={row.holderSummary} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { holderSummary: value })} placeholder="보유자 명단 기재" className="min-h-[40px] text-xs w-full" />
                                    <TextCell value={row.heldQualification} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { heldQualification: value })} placeholder="취득 자격등급" className="h-8 text-xs w-full" />
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 mt-1">
                                    {row.holderSummary ? (
                                      <div className="flex flex-wrap gap-1">
                                        {row.holderSummary.split(/[\s,]+/).filter(Boolean).map((name, nIdx) => (
                                          <Badge key={nIdx} variant="secondary" className="bg-emerald-50 border-emerald-100 text-emerald-700 text-[10px] font-bold">
                                            {name}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className="bg-rose-50 border-rose-100 text-rose-600 text-[9px] font-bold">
                                        보유자 공란
                                      </Badge>
                                    )}
                                    {row.heldQualification && (
                                      <p className="text-[10px] text-slate-400 font-medium italic">자격내용: {row.heldQualification}</p>
                                    )}
                                  </div>
                                )}
                              </TableCell>

                              {/* 계획/비고 */}
                              <TableCell className="align-top">
                                {isEditMode ? (
                                  <div className="space-y-2">
                                    <TextAreaCell value={row.plan} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { plan: value })} placeholder="향후 확보 계획" className="min-h-[40px] text-xs w-full" />
                                    <TextAreaCell value={row.remarks} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { remarks: value })} placeholder="비고" className="min-h-[40px] text-xs w-full" />
                                  </div>
                                ) : (
                                  <div className="space-y-1 mt-1 text-[11px] leading-relaxed">
                                    {row.plan && (
                                      <p className="text-slate-600"><span className="font-bold text-slate-400 text-[10px] mr-1">[계획]</span>{row.plan}</p>
                                    )}
                                    {row.remarks && (
                                      <p className="text-slate-400"><span className="font-bold text-slate-400 text-[10px] mr-1">[비고]</span>{row.remarks}</p>
                                    )}
                                    {!row.plan && !row.remarks && <span className="text-slate-400 font-medium">-</span>}
                                  </div>
                                )}
                              </TableCell>

                              {/* 삭제 버튼 */}
                              {isEditMode && (
                                <TableCell className="align-top">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeArrayRow("qualifications", index)}
                                    disabled={isReportLocked}
                                    className="h-8 w-8 text-slate-400 hover:text-destructive shrink-0 mt-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </fieldset>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/15">
          <div className="max-w-md text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto shadow-sm">
              <ClipboardCheck className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-800">팀 적격성 보고서를 준비해 주세요</h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                선택한 팀과 연도의 평가 데이터가 아직 생성되지 않았습니다. 아래 '보고서 준비' 버튼을 누르면 현재 팀원을 기준으로 입력 화면이 즉시 구성됩니다.
              </p>
            </div>
            <Button className="font-bold text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => ensureReportMutation.mutate()} disabled={!selectedTeam || isLoadingDetail}>
              <Plus className="mr-1.5 h-4 w-4" />
              보고서 준비
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
