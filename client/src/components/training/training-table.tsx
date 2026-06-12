import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Award, CalendarDays, Clock, Edit, Eye, Link as LinkIcon, Search, Trash2, UserRound } from "lucide-react";
import TrainingFormDialog from "@/components/training/training-form-dialog";
import type { Employee, TrainingHistory } from "@shared/schema";

interface TrainingTableProps {
  trainings: TrainingHistory[];
  employees?: Employee[];
}

const typeLabels: Record<string, string> = {
  required: "필수",
  optional: "선택",
  certification: "자격증",
};

const statusLabels: Record<string, string> = {
  completed: "완료",
  ongoing: "진행중",
  planned: "예정",
  cancelled: "취소",
};

const categoryLabels: Record<string, string> = {
  technical: "기술",
  quality: "품질",
  safety: "안전",
  compliance: "컴플라이언스",
  leadership: "리더십",
  communication: "커뮤니케이션",
  security: "보안",
  language: "어학",
  other: "기타",
};

function formatDate(value: unknown): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

function getInstructorRoleLabel(value?: string | null): string {
  if (value === "instructor") return "강사";
  if (value === "mentor") return "멘토";
  return "수강생";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">완료</Badge>;
    case "ongoing":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">진행중</Badge>;
    case "planned":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">예정</Badge>;
    case "cancelled":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">취소</Badge>;
    default:
      return <Badge variant="secondary">{status || "미정"}</Badge>;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case "required":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">필수</Badge>;
    case "optional":
      return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">선택</Badge>;
    case "certification":
      return <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">자격증</Badge>;
    default:
      return <Badge variant="secondary">{type || "미정"}</Badge>;
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 text-base font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
}

export default function TrainingTable({ trainings, employees = [] }: TrainingTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewedTraining, setViewedTraining] = useState<TrainingHistory | null>(null);
  const [deletingTraining, setDeletingTraining] = useState<TrainingHistory | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const employeeLookup = useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]));
  }, [employees]);

  const getEmployeeLabel = (employeeId: string) => {
    const employee = employeeLookup.get(employeeId);
    if (!employee) return employeeId;
    return `${employee.name}${employee.department ? ` · ${employee.department}` : ""}`;
  };

  const filteredTrainings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return trainings
      .filter((training) => {
        const employeeLabel = getEmployeeLabel(training.employeeId).toLowerCase();
        const searchableText = [
          training.courseName,
          training.provider,
          categoryLabels[training.category] ?? training.category,
          typeLabels[training.type] ?? training.type,
          statusLabels[training.status] ?? training.status,
          employeeLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === "all" || training.status === statusFilter;
        const matchesType = typeFilter === "all" || training.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const bDate = new Date(String(b.completionDate ?? b.startDate ?? b.createdAt ?? 0)).getTime();
        const aDate = new Date(String(a.completionDate ?? a.startDate ?? a.createdAt ?? 0)).getTime();
        return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
      });
  }, [getEmployeeLabel, searchTerm, statusFilter, trainings, typeFilter]);

  const deleteTrainingMutation = useMutation({
    mutationFn: async (trainingId: string) => {
      await apiRequest("DELETE", `/api/training/${trainingId}`);
      return trainingId;
    },
    onSuccess: () => {
      toast({
        title: "교육 삭제 완료",
        description: "선택한 교육과정이 삭제되었습니다.",
      });
      setDeletingTraining(null);
      queryClient.invalidateQueries({ queryKey: ["/api/training"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-history"] });
    },
    onError: (error) => {
      toast({
        title: "교육 삭제 실패",
        description: error instanceof Error ? error.message : "교육 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4" data-testid="training-table">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="교육과정, 직원, 기관, 카테고리 검색"
            className="h-10 pl-10 text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-training-search"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-40 text-sm" data-testid="select-status-filter">
              <SelectValue placeholder="모든 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 상태</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="ongoing">진행중</SelectItem>
              <SelectItem value="planned">예정</SelectItem>
              <SelectItem value="cancelled">취소</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 w-40 text-sm" data-testid="select-type-filter">
              <SelectValue placeholder="모든 유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 유형</SelectItem>
              <SelectItem value="required">필수</SelectItem>
              <SelectItem value="optional">선택</SelectItem>
              <SelectItem value="certification">자격증</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          총 {filteredTrainings.length}개 표시 / 전체 {trainings.length}개
        </span>
        <span>보기, 수정, 삭제 버튼으로 등록 후 관리할 수 있습니다.</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px] whitespace-nowrap">교육과정</TableHead>
              <TableHead className="min-w-[190px] whitespace-nowrap">대상 직원</TableHead>
              <TableHead className="min-w-[84px] whitespace-nowrap">유형</TableHead>
              <TableHead className="min-w-[150px] whitespace-nowrap">제공기관</TableHead>
              <TableHead className="min-w-[108px] whitespace-nowrap">시작일</TableHead>
              <TableHead className="min-w-[108px] whitespace-nowrap">완료일</TableHead>
              <TableHead className="min-w-[76px] whitespace-nowrap">시간</TableHead>
              <TableHead className="min-w-[84px] whitespace-nowrap">상태</TableHead>
              <TableHead className="min-w-[130px] whitespace-nowrap text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTrainings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                    ? "검색 조건에 맞는 교육과정이 없습니다."
                    : "등록된 교육과정이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTrainings.map((training) => (
                <TableRow key={training.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900" data-testid={`training-name-${training.id}`}>
                        {training.courseName}
                      </p>
                      <div className="flex flex-wrap gap-1.5 text-sm text-muted-foreground">
                        <span>{categoryLabels[training.category] ?? training.category}</span>
                        <span>·</span>
                        <span>{getInstructorRoleLabel(training.instructorRole)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{getEmployeeLabel(training.employeeId)}</TableCell>
                  <TableCell className="whitespace-nowrap">{getTypeBadge(training.type)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{training.provider}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(training.startDate)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(training.completionDate)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {training.duration != null ? `${training.duration}h` : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{getStatusBadge(training.status)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewedTraining(training)}
                        title="상세 보기"
                        aria-label="상세 보기"
                        data-testid={`button-view-training-${training.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <TrainingFormDialog training={training}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="수정"
                          aria-label="수정"
                          data-testid={`button-edit-training-${training.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TrainingFormDialog>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="삭제"
                        aria-label="삭제"
                        onClick={() => setDeletingTraining(training)}
                        data-testid={`button-delete-training-${training.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(viewedTraining)} onOpenChange={(open) => !open && setViewedTraining(null)}>
        <DialogContent className="max-w-3xl">
          {viewedTraining && (
            <>
              <DialogHeader>
                <DialogTitle>{viewedTraining.courseName}</DialogTitle>
                <DialogDescription>
                  교육과정 상세 정보와 이수 상태를 확인합니다.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <DetailItem
                  label="대상 직원"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      {getEmployeeLabel(viewedTraining.employeeId)}
                    </span>
                  }
                />
                <DetailItem label="교육기관" value={viewedTraining.provider} />
                <DetailItem label="유형" value={getTypeBadge(viewedTraining.type)} />
                <DetailItem label="상태" value={getStatusBadge(viewedTraining.status)} />
                <DetailItem label="카테고리" value={categoryLabels[viewedTraining.category] ?? viewedTraining.category} />
                <DetailItem label="참여 역할" value={getInstructorRoleLabel(viewedTraining.instructorRole)} />
                <DetailItem
                  label="교육기간"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {formatDate(viewedTraining.startDate)} ~ {formatDate(viewedTraining.completionDate)}
                    </span>
                  }
                />
                <DetailItem
                  label="교육시간 / 점수"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {viewedTraining.duration != null ? `${viewedTraining.duration}시간` : "-"}
                      <span className="text-muted-foreground">/</span>
                      {viewedTraining.score != null ? `${viewedTraining.score}점` : "점수 없음"}
                    </span>
                  }
                />
                <DetailItem
                  label="수료증"
                  value={
                    viewedTraining.certificateUrl ? (
                      <a
                        href={viewedTraining.certificateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                      >
                        <LinkIcon className="h-4 w-4" />
                        링크 열기
                      </a>
                    ) : (
                      "등록 없음"
                    )
                  }
                />
                <DetailItem
                  label="등록일"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      {formatDateTime(viewedTraining.createdAt)}
                    </span>
                  }
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-muted-foreground">메모</p>
                <p className="mt-2 whitespace-pre-wrap text-base text-slate-800">
                  {viewedTraining.notes || "등록된 메모가 없습니다."}
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setViewedTraining(null)}>
                  닫기
                </Button>
                <TrainingFormDialog training={viewedTraining} onSaved={setViewedTraining}>
                  <Button type="button">
                    <Edit className="mr-2 h-4 w-4" />
                    수정
                  </Button>
                </TrainingFormDialog>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingTraining)}
        onOpenChange={(open) => {
          if (!open && !deleteTrainingMutation.isPending) {
            setDeletingTraining(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>교육과정을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTraining
                ? `"${deletingTraining.courseName}" 교육 이력을 삭제합니다. 삭제 후에는 목록과 직원 교육 이력에서 함께 사라집니다.`
                : "선택한 교육과정을 삭제합니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTrainingMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deletingTraining || deleteTrainingMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deletingTraining) {
                  deleteTrainingMutation.mutate(deletingTraining.id);
                }
              }}
              data-testid={deletingTraining ? `button-confirm-delete-training-${deletingTraining.id}` : "button-confirm-delete-training"}
            >
              {deleteTrainingMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
