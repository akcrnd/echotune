import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Award, BriefcaseBusiness, ClipboardCheck, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  responsibilities?: string | null;
  deputyEmployeeId?: string | null;
  deputyName?: string | null;
  displayOrder?: number;
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
  assignments: Assignment[];
  workCategories: WorkCategory[];
  requirements: Requirement[];
  qualifications: Qualification[];
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

function TextCell({
  value,
  onChange,
  placeholder,
  className = "min-w-[120px]",
}: {
  value?: string | number | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

function TextAreaCell({
  value,
  onChange,
  placeholder,
  className = "min-w-[220px]",
}: {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Textarea
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
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

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const selectedTeam = teams.find((team) => team.code === selectedTeamCode);

  useEffect(() => {
    if (!selectedTeamCode && teams.length > 0) {
      setSelectedTeamCode(teams[0].code);
    }
  }, [selectedTeamCode, teams]);

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
      .map((score) => Number(score.score))
      .filter((score) => Number.isFinite(score));
    const total = detail.requirements.length * detail.teamMembers.length;
    const average = numericScores.length
      ? numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length
      : 0;
    return { entered: numericScores.length, total, average };
  }, [detail]);

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

  const addAssignment = () => {
    setDetail((current) =>
      current
        ? {
            ...current,
            assignments: [
              ...current.assignments,
              {
                id: makeLocalId("assignment"),
                roleGroup: current.report.teamName,
                employeeName: "",
                positionTitle: "",
                responsibilities: "",
                deputyName: "",
                displayOrder: current.assignments.length,
              },
            ],
          }
        : current,
    );
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
          <Button onClick={() => saveMutation.mutate()} disabled={!detail || saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            저장
          </Button>
        </div>
      </div>

      {detail ? (
        <>
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
                  요구자격
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{detail.qualifications.length}</div>
                <p className="text-xs text-muted-foreground">법적/회사 요구자격</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <TextCell value={detail.report.revision} onChange={(value) => updateReport("revision", value)} placeholder="Rev.00" />
            <TextCell value={detail.report.preparedBy} onChange={(value) => updateReport("preparedBy", value)} placeholder="작성" />
            <TextCell value={detail.report.checkedBy} onChange={(value) => updateReport("checkedBy", value)} placeholder="검토" />
            <TextCell value={detail.report.approvedBy} onChange={(value) => updateReport("approvedBy", value)} placeholder="승인" />
            <select
              value={detail.report.status}
              onChange={(event) => updateReport("status", event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="draft">작성중</option>
              <option value="review">검토중</option>
              <option value="approved">승인</option>
            </select>
          </div>

          <Tabs defaultValue="organization" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="organization">조직 및 업무분장</TabsTrigger>
              <TabsTrigger value="work">업무분류표</TabsTrigger>
              <TabsTrigger value="requirements">요구기준 및 평가</TabsTrigger>
              <TabsTrigger value="qualifications">요구자격 보유현황</TabsTrigger>
            </TabsList>

            <TabsContent value="organization" className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{detail.report.teamName} / {detail.report.evaluationYear}</Badge>
                <Button variant="outline" size="sm" onClick={addAssignment}>
                  <Plus className="mr-2 h-4 w-4" />
                  행 추가
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>역할그룹</TableHead>
                    <TableHead>팀원</TableHead>
                    <TableHead>직급/역할</TableHead>
                    <TableHead>담당 업무</TableHead>
                    <TableHead>업무대리인</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.assignments.map((row, index) => (
                    <TableRow key={row.id ?? index}>
                      <TableCell>
                        <TextCell value={row.roleGroup} onChange={(value) => updateArrayRow<Assignment>("assignments", index, { roleGroup: value })} />
                      </TableCell>
                      <TableCell>
                        <TextCell value={row.employeeName} onChange={(value) => updateArrayRow<Assignment>("assignments", index, { employeeName: value })} />
                      </TableCell>
                      <TableCell>
                        <TextCell value={row.positionTitle} onChange={(value) => updateArrayRow<Assignment>("assignments", index, { positionTitle: value })} />
                      </TableCell>
                      <TableCell>
                        <TextAreaCell value={row.responsibilities} onChange={(value) => updateArrayRow<Assignment>("assignments", index, { responsibilities: value })} />
                      </TableCell>
                      <TableCell>
                        <TextCell value={row.deputyName} onChange={(value) => updateArrayRow<Assignment>("assignments", index, { deputyName: value })} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeArrayRow("assignments", index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="work" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={addWorkCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  업무 추가
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>대분류</TableHead>
                    <TableHead>주요 업무 기능</TableHead>
                    <TableHead>중점관리 항목</TableHead>
                    <TableHead>관련 문서/법규</TableHead>
                    <TableHead>협조팀/업무</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.workCategories.map((row, index) => (
                    <TableRow key={row.id ?? index}>
                      <TableCell>
                        <TextCell value={row.categoryNo} onChange={(value) => updateArrayRow<WorkCategory>("workCategories", index, { categoryNo: value })} className="w-20" />
                      </TableCell>
                      <TableCell>
                        <TextCell value={row.categoryName} onChange={(value) => updateArrayRow<WorkCategory>("workCategories", index, { categoryName: value })} />
                      </TableCell>
                      <TableCell>
                        <TextAreaCell value={row.majorFunctions} onChange={(value) => updateArrayRow<WorkCategory>("workCategories", index, { majorFunctions: value })} />
                      </TableCell>
                      <TableCell>
                        <TextAreaCell value={row.controlItems} onChange={(value) => updateArrayRow<WorkCategory>("workCategories", index, { controlItems: value })} />
                      </TableCell>
                      <TableCell>
                        <TextAreaCell value={row.relatedDocs} onChange={(value) => updateArrayRow<WorkCategory>("workCategories", index, { relatedDocs: value })} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <TextCell value={row.cooperatingTeam} onChange={(value) => updateArrayRow<WorkCategory>("workCategories", index, { cooperatingTeam: value })} placeholder="협조팀" />
                          <TextCell value={row.cooperatingWork} onChange={(value) => updateArrayRow<WorkCategory>("workCategories", index, { cooperatingWork: value })} placeholder="업무명" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeArrayRow("workCategories", index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={addRequirement}>
                  <Plus className="mr-2 h-4 w-4" />
                  기준 추가
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>대분류</TableHead>
                    <TableHead>중분류</TableHead>
                    <TableHead>요구조건</TableHead>
                    <TableHead>직급별 기준</TableHead>
                    {detail.teamMembers.map((member) => (
                      <TableHead key={member.id} className="min-w-[96px] text-center">
                        {member.name}
                      </TableHead>
                    ))}
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.requirements.map((row, index) => (
                    <TableRow key={row.id ?? index}>
                      <TableCell>
                        <div className="space-y-2">
                          <TextCell value={row.majorNo} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { majorNo: value })} placeholder="No" className="w-20" />
                          <TextCell value={row.majorName} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { majorName: value })} placeholder="대분류" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <TextCell value={row.subNo} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { subNo: value })} placeholder="No" className="w-20" />
                          <TextCell value={row.subName} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { subName: value })} placeholder="업무명" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <TextCell value={row.requiredMajor} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredMajor: value })} placeholder="전공" />
                          <TextCell value={row.requiredCertification} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredCertification: value })} placeholder="자격증" />
                          <TextCell value={row.minKnowledge} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { minKnowledge: value })} placeholder="최소실무지식/경력" />
                          <TextCell value={row.proficiencyPeriod} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { proficiencyPeriod: value })} placeholder="숙달기간" />
                          <TextAreaCell value={row.requiredTraining} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { requiredTraining: value })} placeholder="필수교육" />
                          <TextCell value={row.languageRequirement} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { languageRequirement: value })} placeholder="언어/수준" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid grid-cols-2 gap-2">
                          <TextCell value={row.deptHeadLevel} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { deptHeadLevel: value })} placeholder="팀장" className="w-24" />
                          <TextCell value={row.managerLevel} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { managerLevel: value })} placeholder="과장 이상" className="w-24" />
                          <TextCell value={row.staffLevel} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { staffLevel: value })} placeholder="과장 미만" className="w-24" />
                          <TextCell value={row.minimumLevel} onChange={(value) => updateArrayRow<Requirement>("requirements", index, { minimumLevel: value })} placeholder="최소" className="w-24" />
                        </div>
                      </TableCell>
                      {detail.teamMembers.map((member) => (
                        <TableCell key={member.id}>
                          <Input
                            type="number"
                            min="0"
                            max="5"
                            step="0.5"
                            value={scoreFor(row, member.id)}
                            onChange={(event) => updateScore(index, member, event.target.value)}
                            className="w-20 text-center"
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeArrayRow("requirements", index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="qualifications" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={addQualification}>
                  <Plus className="mr-2 h-4 w-4" />
                  자격 추가
                </Button>
              </div>
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
                        <Button variant="ghost" size="sm" onClick={() => removeArrayRow("qualifications", index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
