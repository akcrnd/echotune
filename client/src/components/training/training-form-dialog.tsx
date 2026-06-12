import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Employee, TrainingHistory } from "@shared/schema";

const trainingTypes = [
  { value: "required", label: "필수" },
  { value: "optional", label: "선택" },
  { value: "certification", label: "자격증" },
] as const;

const trainingStatuses = [
  { value: "planned", label: "예정" },
  { value: "ongoing", label: "진행중" },
  { value: "completed", label: "완료" },
  { value: "cancelled", label: "취소" },
] as const;

const trainingCategories = [
  { value: "technical", label: "기술" },
  { value: "quality", label: "품질" },
  { value: "safety", label: "안전" },
  { value: "compliance", label: "컴플라이언스" },
  { value: "leadership", label: "리더십" },
  { value: "communication", label: "커뮤니케이션" },
  { value: "security", label: "보안" },
  { value: "language", label: "어학" },
  { value: "other", label: "기타" },
] as const;

const optionalNumberString = z
  .string()
  .optional()
  .refine((value) => !value || !Number.isNaN(Number(value)), "숫자로 입력하세요.");

const trainingFormSchema = z
  .object({
    employeeId: z.string().min(1, "직원을 선택하세요."),
    courseName: z.string().trim().min(1, "교육과정명을 입력하세요."),
    provider: z.string().trim().min(1, "교육기관을 입력하세요."),
    type: z.enum(["required", "optional", "certification"]),
    category: z.string().min(1, "카테고리를 선택하세요."),
    startDate: z.string().optional(),
    completionDate: z.string().optional(),
    duration: optionalNumberString,
    score: optionalNumberString,
    status: z.enum(["planned", "ongoing", "completed", "cancelled"]),
    instructorRole: z.enum(["student", "instructor", "mentor"]).optional(),
    certificateUrl: z.string().trim().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => !data.startDate || !data.completionDate || data.completionDate >= data.startDate,
    {
      path: ["completionDate"],
      message: "완료일은 시작일 이후여야 합니다.",
    },
  );

type TrainingFormData = z.infer<typeof trainingFormSchema>;

interface TrainingFormDialogProps {
  children: ReactNode;
  defaultEmployeeId?: string;
  training?: TrainingHistory | null;
  onSaved?: (training: TrainingHistory) => void;
}

function toDateInputValue(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toApiDate(value?: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
}

function toFormDefaults(training?: TrainingHistory | null, defaultEmployeeId?: string): TrainingFormData {
  return {
    employeeId: training?.employeeId ?? defaultEmployeeId ?? "",
    courseName: training?.courseName ?? "",
    provider: training?.provider ?? "",
    type: (training?.type as TrainingFormData["type"]) ?? "optional",
    category: training?.category ?? "technical",
    startDate: toDateInputValue(training?.startDate),
    completionDate: toDateInputValue(training?.completionDate),
    duration: training?.duration != null ? String(training.duration) : "",
    score: training?.score != null ? String(training.score) : "",
    status: (training?.status as TrainingFormData["status"]) ?? "planned",
    instructorRole: training?.instructorRole === "instructor" || training?.instructorRole === "mentor"
      ? training.instructorRole
      : "student",
    certificateUrl: training?.certificateUrl ?? "",
    notes: training?.notes ?? "",
  };
}

function toPayload(data: TrainingFormData) {
  return {
    employeeId: data.employeeId,
    courseName: data.courseName.trim(),
    provider: data.provider.trim(),
    type: data.type,
    category: data.category,
    startDate: toApiDate(data.startDate),
    completionDate: toApiDate(data.completionDate),
    duration: data.duration ? Number.parseInt(data.duration, 10) : null,
    score: data.score ? Number.parseFloat(data.score) : null,
    status: data.status,
    instructorRole: data.instructorRole === "student" ? null : data.instructorRole ?? null,
    certificateUrl: data.certificateUrl?.trim() || null,
    notes: data.notes?.trim() || null,
  };
}

export default function TrainingFormDialog({
  children,
  defaultEmployeeId,
  training,
  onSaved,
}: TrainingFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(training?.id);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const form = useForm<TrainingFormData>({
    resolver: zodResolver(trainingFormSchema),
    defaultValues: toFormDefaults(training, defaultEmployeeId),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormDefaults(training, defaultEmployeeId));
    }
  }, [defaultEmployeeId, form, open, training]);

  const saveTrainingMutation = useMutation({
    mutationFn: async (data: TrainingFormData) => {
      const response = await apiRequest(
        isEditMode ? "PUT" : "POST",
        isEditMode ? `/api/training/${training!.id}` : "/api/training",
        toPayload(data),
      );
      return response.json() as Promise<TrainingHistory>;
    },
    onSuccess: (savedTraining) => {
      toast({
        title: isEditMode ? "교육 수정 완료" : "교육 추가 완료",
        description: isEditMode
          ? "교육과정 정보가 저장되었습니다."
          : "새로운 교육과정이 등록되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-history"] });
      onSaved?.(savedTraining);
      setOpen(false);
      if (!isEditMode) {
        form.reset(toFormDefaults(null, defaultEmployeeId));
      }
    },
    onError: (error) => {
      toast({
        title: isEditMode ? "교육 수정 실패" : "교육 추가 실패",
        description: error instanceof Error ? error.message : "교육 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "교육과정 수정" : "새 교육 추가"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "등록된 교육과정의 대상자, 일정, 이수 상태와 세부 정보를 수정합니다."
              : "새로운 교육과정을 등록합니다. 대상 직원과 과정 정보를 입력하세요."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => saveTrainingMutation.mutate(data))} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>직원</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue placeholder="직원을 선택하세요" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name} · {employee.department ?? "부서 미지정"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>상태</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="상태 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainingStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="courseName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>교육과정명</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="예: ALV Regulation 교육"
                        data-testid="input-course-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>교육기관</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="예: 사내교육, 외부기관명"
                        data-testid="input-provider"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>교육 유형</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-training-type">
                          <SelectValue placeholder="유형 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainingTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>카테고리</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="카테고리 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainingCategories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instructorRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>참여 역할</FormLabel>
                    <Select value={field.value ?? "student"} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-instructor-role">
                          <SelectValue placeholder="역할 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="student">수강생</SelectItem>
                        <SelectItem value="instructor">강사</SelectItem>
                        <SelectItem value="mentor">멘토</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>시작일</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid="input-start-date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="completionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>완료일</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid="input-completion-date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>교육시간</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="시간"
                        data-testid="input-duration"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>점수</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="점수"
                        data-testid="input-score"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="certificateUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>수료증 URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://..."
                      data-testid="input-certificate-url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="교육 목적, 산출물, 특이사항 등을 입력하세요."
                      data-testid="textarea-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
                취소
              </Button>
              <Button type="submit" disabled={saveTrainingMutation.isPending} data-testid="button-submit">
                {saveTrainingMutation.isPending
                  ? "저장 중..."
                  : isEditMode
                    ? "수정 저장"
                    : "등록"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
