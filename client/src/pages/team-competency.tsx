import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Award, BriefcaseBusiness, CheckCircle2, ClipboardCheck, Plus, Save, ShieldCheck, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function TeamCompetency() {
  const { toast } = useToast();
  const [selectedTeamCode, setSelectedTeamCode] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [detail, setDetail] = useState<TeamCompetencyDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");

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
    const scores = detail.requirements.flatMap((requirement) => requirement.scores ?? []);
    const numericScores = scores
      .filter((score) => score.score !== null && score.score !== undefined && score.score !== "")
      .map((score) => Number(score.score))
      .filter((score) => Number.isFinite(score));
    const total = detail.requirements.length * detail.teamMembers.length;
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
    setDetail((current) =>
      current
        ? {
            ...current,
            workCategories: [
              ...current.workCategories,
              {
                id: makeLocalId("work"),
                categoryNo: String(current.workCategories.length + 1),
                categoryName: "",
                majorFunctions: "",
                controlItems: "",
                relatedDocs: "",
                cooperatingTeam: "",
                cooperatingWork: "",
                displayOrder: current.workCategories.length,
              },
            ],
          }
        : current,
    );
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
      const nextScore = {
        ...(scoreIndex >= 0 ? scores[scoreIndex] : {}),
        employeeId: member.id,
        employeeName: member.name,
        score: value,
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

  const scoreNumberFor = (requirement: Requirement, memberId?: string | null) => {
    if (!memberId) return null;
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
    const requiredLevels = detail.requirements.map((requirement) => levelNumber(requirement.minimumLevel));
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
      <div className="relative w-[300px] rounded-sm border border-slate-400 bg-white shadow-sm">
        <div className="border-b border-slate-400 bg-slate-100 px-2 py-1">
          <Input
            value={row.roleTitle ?? ""}
            onChange={(event) => updateArrayRow<Assignment>("assignments", rowIndex, { roleTitle: event.target.value })}
            placeholder="담당직무"
            className="h-8 border-0 bg-transparent px-1 text-center font-semibold shadow-none focus-visible:ring-1"
          />
        </div>
        <div className="grid grid-cols-[92px_1fr] border-b border-slate-400 text-sm">
          <div className="flex items-center justify-center border-r border-slate-400 px-2 py-1 font-medium">
            {member?.position ?? row.positionTitle ?? "-"}
          </div>
          <div className="px-2 py-1 text-center">
            <div className="font-medium">{member?.name ?? row.employeeName ?? "-"}</div>
            <div className="text-[11px] text-muted-foreground">{member?.employeeNumber ?? "조직도 미연동"}</div>
          </div>
        </div>
        <div className="space-y-2 px-2 py-2">
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">상세 담당 업무</div>
            <Textarea
              value={row.responsibilities ?? ""}
              onChange={(event) => updateArrayRow<Assignment>("assignments", rowIndex, { responsibilities: event.target.value })}
              placeholder={"1. 담당 업무\n2. 담당 업무"}
              className="min-h-[116px] resize-y rounded-sm border-slate-300 text-xs leading-relaxed"
            />
          </div>
        </div>
        <div className="grid grid-cols-[82px_1fr] border-t border-slate-400 text-xs">
          <div className="border-r border-slate-400 bg-slate-50 px-2 py-1 font-medium">업무대리인</div>
          <Input
            value={row.deputyName ?? ""}
            onChange={(event) => updateArrayRow<Assignment>("assignments", rowIndex, { deputyName: event.target.value })}
            placeholder="이름 / 직급"
            className="h-7 rounded-none border-0 px-2 text-xs shadow-none focus-visible:ring-1"
          />
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-2 py-1 text-[11px] text-muted-foreground">
          <span>상위자: {member?.managerName ?? "-"}</span>
          <span>증빙 {evidenceCount}건</span>
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
    <div className="p-6 space-y-5" data-testid="team-competency-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">팀 적격성 관리</h1>
          <p className="text-sm text-muted-foreground">
            팀별 조직, 업무분류, 요구기준, 평가현황, 요구자격 보유 현황을 한 곳에서 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTeamCode}
            onChange={(event) => setSelectedTeamCode(event.target.value)}
            className="h-10 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
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
            className="w-28"
            data-testid="input-team-competency-year"
          />
          <Button onClick={() => ensureReportMutation.mutate()} disabled={!selectedTeam || ensureReportMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            보고서 준비
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!detail || isReportLocked || saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            저장
          </Button>
        </div>
      </div>

      {detail ? (
        <>
          {isReportLocked && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              승인된 보고서입니다. 조직 정보와 평가 내용은 읽기 전용으로 잠겨 있습니다.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm font-medium">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  팀원
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{detail.teamMembers.length}</div>
                <p className="text-xs text-muted-foreground">현재 활성 팀원 기준</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm font-medium">
                  <BriefcaseBusiness className="mr-2 h-4 w-4 text-muted-foreground" />
                  업무분류
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{detail.workCategories.length}</div>
                <p className="text-xs text-muted-foreground">관리 업무 카테고리</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm font-medium">
                  <ClipboardCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                  평가 입력
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {scoreStats.entered}/{scoreStats.total}
                </div>
                <p className="text-xs text-muted-foreground">평균 {scoreStats.average.toFixed(1)}점</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm font-medium">
                  <Award className="mr-2 h-4 w-4 text-muted-foreground" />
                  요구자격/증빙
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{detail.qualifications.length}</div>
                <p className="text-xs text-muted-foreground">
                  증빙 {evidenceTotal}건
                </p>
              </CardContent>
            </Card>
          </div>

          {operationalStats && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex items-center">
                    <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                    운영 점검
                  </span>
                  <Badge variant={operationalStats.readinessPercent >= 85 ? "default" : "secondary"}>
                    {operationalStats.statusLabel}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-2xl font-bold">{operationalStats.readinessPercent}%</div>
                    <p className="text-xs text-muted-foreground">조직 연동, 템플릿, 평가, 자격 증빙 기준</p>
                  </div>
                  <Progress value={operationalStats.readinessPercent} className="h-2 sm:max-w-sm" />
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      조직도 연동
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detail.teamMembers.length}명 / 조직도 순서 기준
                    </p>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {operationalStats.missingResponsibilities === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      담당업무
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      미입력 {operationalStats.missingResponsibilities}건
                    </p>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {operationalStats.missingScores === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      평가 매트릭스
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      미평가 {operationalStats.missingScores}칸
                    </p>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {operationalStats.missingQualificationHolders === 0 && evidenceTotal > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      자격/증빙
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      보유자 미입력 {operationalStats.missingQualificationHolders}건 · 직원 증빙 {evidenceTotal}건
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <TextCell disabled={isReportLocked} value={detail.report.revision} onChange={(value) => updateReport("revision", value)} placeholder="Rev.00" />
            <TextCell disabled={isReportLocked} value={detail.report.preparedBy} onChange={(value) => updateReport("preparedBy", value)} placeholder="작성" />
            <TextCell disabled={isReportLocked} value={detail.report.checkedBy} onChange={(value) => updateReport("checkedBy", value)} placeholder="검토" />
            <TextCell disabled={isReportLocked} value={detail.report.approvedBy} onChange={(value) => updateReport("approvedBy", value)} placeholder="승인" />
            <select
              value={detail.report.status}
              onChange={(event) => updateReport("status", event.target.value)}
              disabled={isReportLocked}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="draft">작성중</option>
              <option value="review">검토중</option>
              <option value="approved">승인</option>
            </select>
          </div>

          <Tabs defaultValue="organization" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="organization">조직 및 업무분장</TabsTrigger>
              <TabsTrigger value="competency">업무/요구기준 평가</TabsTrigger>
              <TabsTrigger value="qualifications">요구자격 보유현황</TabsTrigger>
            </TabsList>

            <TabsContent value="organization" className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{detail.report.teamName} / {detail.report.evaluationYear}</Badge>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant="secondary">조직도 기준 자동 정렬</Badge>
                  {operationalStats && operationalStats.missingResponsibilities > 0 && (
                    <Badge variant="outline">담당업무 미입력 {operationalStats.missingResponsibilities}건</Badge>
                  )}
                </div>
              </div>
              <fieldset disabled={isReportLocked} className="contents">
                <div className="overflow-x-auto rounded-lg border bg-slate-50/70 p-4" data-testid="team-competency-org-chart">
                  <div className="flex min-w-max items-start justify-center gap-8 px-4 py-2">
                    {orgAssignmentTree.map((node) => renderOrgAssignmentNode(node))}
                  </div>
                </div>
              </fieldset>
            </TabsContent>

            <TabsContent value="competency" className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">업무 영역 {detail.workCategories.length}개</Badge>
                  <Badge variant="outline">세부 업무 {detail.requirements.length}개</Badge>
                  <Badge variant="outline">평가 {scoreStats.entered}/{scoreStats.total}</Badge>
                  {operationalStats && operationalStats.missingScores > 0 && (
                    <Badge variant="secondary">미평가 {operationalStats.missingScores}칸</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm font-medium">팀원 선택</label>
                  <select
                    value={selectedMember?.id ?? ""}
                    onChange={(event) => setSelectedMemberId(event.target.value)}
                    className="h-10 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
                    data-testid="select-team-competency-member"
                  >
                    {detail.teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} {member.position}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" onClick={addWorkCategory} disabled={isReportLocked}>
                    <Plus className="mr-2 h-4 w-4" />
                    업무 추가
                  </Button>
                  <Button variant="outline" size="sm" onClick={addRequirement} disabled={isReportLocked}>
                    <Plus className="mr-2 h-4 w-4" />
                    기준 추가
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs font-medium text-muted-foreground">전체 업무 영역</div>
                  <div className="mt-2 text-2xl font-bold text-blue-700">{detail.workCategories.length}개</div>
                  <div className="mt-1 text-xs text-muted-foreground">대분류</div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs font-medium text-muted-foreground">전체 세부 업무</div>
                  <div className="mt-2 text-2xl font-bold text-blue-700">{detail.requirements.length}개</div>
                  <div className="mt-1 text-xs text-muted-foreground">요구기준 항목</div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs font-medium text-muted-foreground">평균 요구 수준</div>
                  <div className="mt-2 text-2xl font-bold">{formatAverage(competencyStats.requiredAverage)} / 5</div>
                  <div className="mt-1 text-xs text-muted-foreground">필수 수준 평균</div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs font-medium text-muted-foreground">현재 평균 수준</div>
                  <div className="mt-2 text-2xl font-bold">{formatAverage(competencyStats.selectedAverage)} / 5</div>
                  <div className="mt-1 text-xs text-muted-foreground">{selectedMember?.name ?? "선택 인원"} 기준</div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs font-medium text-muted-foreground">평균 GAP</div>
                  <div className={`mt-2 text-2xl font-bold ${competencyStats.averageGap !== null && competencyStats.averageGap < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {gapLabel(competencyStats.averageGap)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">현재 - 요구</div>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">역량 수준 분포</div>
                    <div className="text-xs text-muted-foreground">{selectedMember?.name ?? "선택 인원"} 현재 수준 기준</div>
                  </div>
                  <Badge variant="outline">팀 평균 {formatAverage(competencyStats.teamAverage)} / 5</Badge>
                </div>
                <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">
                  {selectedLevelTotal === 0 ? (
                    <div className="h-full w-full bg-slate-200" />
                  ) : (
                    selectedLevelDistribution.map((bucket, index) => (
                      <div
                        key={bucket.level}
                        className={["bg-red-500", "bg-orange-400", "bg-amber-300", "bg-emerald-500", "bg-blue-600"][index]}
                        style={{ width: `${(bucket.count / selectedLevelTotal) * 100}%` }}
                      />
                    ))
                  )}
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
                  {selectedLevelDistribution.map((bucket) => (
                    <div key={bucket.level}>
                      <div className="font-semibold">Lv.{bucket.level}</div>
                      <div className="text-muted-foreground">
                        {bucket.count}개 ({selectedLevelTotal ? Math.round((bucket.count / selectedLevelTotal) * 100) : 0}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <fieldset disabled={isReportLocked} className="contents">
                <div className="overflow-x-auto rounded-lg border bg-white" data-testid="team-competency-merged-matrix">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="min-w-[260px]">대분류</TableHead>
                        <TableHead className="min-w-[240px]">세부 업무</TableHead>
                        <TableHead className="min-w-[260px]">주요 업무 기능</TableHead>
                        <TableHead className="min-w-[120px] text-center">필수 수준</TableHead>
                        <TableHead className="min-w-[120px] text-center">팀 평균</TableHead>
                        <TableHead className="min-w-[150px] text-center">선택 인원</TableHead>
                        <TableHead className="min-w-[100px] text-center">GAP</TableHead>
                        <TableHead className="min-w-[120px] text-center">육성 필요도</TableHead>
                        <TableHead className="min-w-[260px]">관련 교육 / Tool</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competencyGroups.map((group) =>
                        group.rows.map(({ row, index }, rowIndex) => {
                          const categoryIndex = group.workCategoryIndex;
                          const category = group.workCategory;
                          const requiredLevel = levelNumber(row.minimumLevel);
                          const teamAverage = average(detail.teamMembers.map((member) => scoreNumberFor(row, member.id)));
                          const selectedScore = selectedMember ? scoreNumberFor(row, selectedMember.id) : null;
                          const gap = selectedScore !== null && requiredLevel !== null ? selectedScore - requiredLevel : null;
                          const need = needSummary(gap);
                          const majorFunction = numberedLine(category?.majorFunctions, row.subNo) || row.subName || "";
                          const toolHint = numberedLine(category?.controlItems, row.subNo);

                          return (
                            <TableRow key={row.id ?? index} className={gap !== null && gap < 0 ? "bg-red-50/30" : undefined}>
                              {rowIndex === 0 && (
                                <TableCell rowSpan={Math.max(group.rows.length, 1)} className="align-top border-r bg-slate-50/70">
                                  <div className="space-y-3">
                                    <div className="flex gap-2">
                                      <TextCell
                                        value={category?.categoryNo ?? group.majorNo}
                                        onChange={(value) =>
                                          categoryIndex !== undefined
                                            ? updateArrayRow<WorkCategory>("workCategories", categoryIndex, { categoryNo: value })
                                            : updateArrayRow<Requirement>("requirements", index, { majorNo: value })
                                        }
                                        placeholder="No"
                                        className="w-16"
                                      />
                                      <TextCell
                                        value={category?.categoryName ?? group.majorName}
                                        onChange={(value) =>
                                          categoryIndex !== undefined
                                            ? updateArrayRow<WorkCategory>("workCategories", categoryIndex, { categoryName: value })
                                            : updateArrayRow<Requirement>("requirements", index, { majorName: value })
                                        }
                                        placeholder="대분류"
                                        className="min-w-[160px]"
                                      />
                                    </div>
                                    <Badge variant="outline">{group.rows.length}개 세부 업무</Badge>
                                    {categoryIndex !== undefined && (
                                      <>
                                        <TextAreaCell
                                          value={category?.majorFunctions}
                                          onChange={(value) => updateArrayRow<WorkCategory>("workCategories", categoryIndex, { majorFunctions: value })}
                                          placeholder="주요 업무 기능"
                                          className="min-w-[220px]"
                                        />
                                        <TextAreaCell
                                          value={category?.controlItems}
                                          onChange={(value) => updateArrayRow<WorkCategory>("workCategories", categoryIndex, { controlItems: value })}
                                          placeholder="중점관리 항목 / Tool"
                                          className="min-w-[220px]"
                                        />
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              <TableCell className="align-top">
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <TextCell value={row.subNo} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { subNo: value })} placeholder="No" className="w-16" />
                                    <TextCell value={row.subName} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { subName: value })} placeholder="업무명" className="min-w-[160px]" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <TextCell value={row.requiredMajor} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredMajor: value })} placeholder="전공" className="min-w-[110px]" />
                                    <TextCell value={row.requiredCertification} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredCertification: value })} placeholder="자격증" className="min-w-[110px]" />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <Textarea
                                  value={majorFunction}
                                  readOnly
                                  placeholder="주요 업무 기능"
                                  className="min-h-[64px] min-w-[240px] resize-y bg-slate-50"
                                />
                              </TableCell>
                              <TableCell className="text-center align-top">
                                <div className="space-y-2">
                                  <TextCell value={row.minimumLevel} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { minimumLevel: value })} placeholder="Lv" className="mx-auto w-20 text-center" />
                                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${levelBadgeClass(requiredLevel)}`}>
                                    {formatLevel(row.minimumLevel)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center align-top">
                                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${levelBadgeClass(teamAverage, requiredLevel)}`}>
                                  {formatLevel(teamAverage)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center align-top">
                                {selectedMember ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    max="5"
                                    step="0.5"
                                    value={scoreFor(row, selectedMember.id)}
                                    onChange={(event) => updateScore(index, selectedMember, event.target.value)}
                                    disabled={isReportLocked}
                                    className={`mx-auto w-20 text-center ${selectedScore === null ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50/40"}`}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center align-top">
                                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${gap !== null && gap < 0 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                                  {gapLabel(gap)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center align-top">
                                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${need.className}`}>
                                  {need.label}
                                </span>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="space-y-2">
                                  <TextAreaCell
                                    value={row.requiredTraining}
                                    onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredTraining: value })}
                                    placeholder="관련 교육 / Tool"
                                    className="min-w-[240px]"
                                  />
                                  {toolHint && <div className="rounded-md bg-slate-50 px-2 py-1 text-xs text-muted-foreground">{toolHint}</div>}
                                  <div className="grid grid-cols-2 gap-2">
                                    <TextCell value={row.proficiencyPeriod} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { proficiencyPeriod: value })} placeholder="숙달기간" className="min-w-[110px]" />
                                    <TextCell value={row.languageRequirement} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { languageRequirement: value })} placeholder="언어/수준" className="min-w-[110px]" />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <Button variant="ghost" size="sm" onClick={() => removeArrayRow("requirements", index)} disabled={isReportLocked}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        }),
                      )}
                    </TableBody>
                  </Table>
                </div>
              </fieldset>
            </TabsContent>

            <TabsContent value="qualifications" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">자격 {evidenceStats.certifications}건</Badge>
                  <Badge variant="outline">스킬 {evidenceStats.skills}건</Badge>
                  <Badge variant="outline">언어 {evidenceStats.languages}건</Badge>
                  <Badge variant="outline">교육 {evidenceStats.trainings}건</Badge>
                  {operationalStats && operationalStats.missingQualificationHolders > 0 && (
                    <Badge variant="secondary">보유자 미입력 {operationalStats.missingQualificationHolders}건</Badge>
                  )}
                  {operationalStats && operationalStats.missingQualificationPlans > 0 && (
                    <Badge variant="outline">계획 미입력 {operationalStats.missingQualificationPlans}건</Badge>
                  )}
                  {evidenceTotal === 0 && (
                    <Badge variant="secondary">직원 증빙 데이터 미입력</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={addQualification} disabled={isReportLocked}>
                  <Plus className="mr-2 h-4 w-4" />
                  자격 추가
                </Button>
              </div>
              <fieldset disabled={isReportLocked} className="contents">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>요구 항목</TableHead>
                    <TableHead>기준/자격명</TableHead>
                    <TableHead>등급</TableHead>
                    <TableHead>보유자 현황</TableHead>
                    <TableHead>계획/비고</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.qualifications.map((row, index) => (
                    <TableRow key={row.id ?? index}>
                      <TableCell>
                        <TextCell value={row.itemNo} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { itemNo: value })} className="w-20" />
                      </TableCell>
                      <TableCell>
                        <TextCell value={row.requirementItem} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { requirementItem: value })} />
                      </TableCell>
                      <TableCell>
                        <TextAreaCell value={row.requirementName} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { requirementName: value })} />
                      </TableCell>
                      <TableCell>
                        <TextCell value={row.requiredGrade} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { requiredGrade: value })} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <TextAreaCell value={row.holderSummary} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { holderSummary: value })} placeholder="보유자 명" />
                          {!row.holderSummary && <Badge variant="secondary">보유자 증빙 미입력</Badge>}
                          <TextCell value={row.heldQualification} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { heldQualification: value })} placeholder="해당자격명/등급" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <TextAreaCell value={row.plan} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { plan: value })} placeholder="계획" />
                          <TextAreaCell value={row.remarks} onChange={(value) => updateArrayRow<Qualification>("qualifications", index, { remarks: value })} placeholder="비고" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeArrayRow("qualifications", index)} disabled={isReportLocked}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </fieldset>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed bg-muted/20">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-semibold">팀 적격성 보고서를 준비해 주세요</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              팀과 연도를 선택한 뒤 보고서를 준비하면 현재 팀원을 기준으로 입력 화면이 생성됩니다.
            </p>
            <Button className="mt-4" onClick={() => ensureReportMutation.mutate()} disabled={!selectedTeam || isLoadingDetail}>
              <Plus className="mr-2 h-4 w-4" />
              보고서 준비
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
