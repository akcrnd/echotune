import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DepartmentTeamManager, type Department, type Team } from "@/lib/departments-teams";
import { useToast } from "@/hooks/use-toast";
import type { InsertEmployee } from "@shared/schema";

interface EmployeeCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmployeeCreateModal({ isOpen, onClose }: EmployeeCreateModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<Partial<InsertEmployee>>({
    isActive: true,
    isDepartmentHead: false
  });
  const [education, setEducation] = useState({
    degree: '',
    major: '',
    school: '',
    graduationYear: ''
  });
  const [previousExperience] = useState({
    years: 0,
    months: 0
  });
  const [date, setDate] = useState<Date | undefined>();
  const [birthDate, setBirthDate] = useState<Date | undefined>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // 부서/팀 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      if (isOpen) {
        try {
          const [deptData, teamData] = await Promise.all([
            DepartmentTeamManager.getAllDepartments(),
            DepartmentTeamManager.getAllTeams()
          ]);
          setDepartments(deptData);
          setTeams(teamData);
        } catch (error) {
          console.error('부서/팀 데이터 로드 실패:', error);
        }
      }
    };
    loadData();
  }, [isOpen]);

  // 모달이 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setFormData({
        isActive: true,
        isDepartmentHead: false
      });
      setEducation({
        degree: '',
        major: '',
        school: '',
        graduationYear: ''
      });
      setDate(undefined);
      setBirthDate(undefined);
      setSelectedDepartment("");
    }
  }, [isOpen]);

  // 직원 생성 mutation
  const createEmployeeMutation = useMutation({
    mutationFn: async (data: InsertEmployee) => {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create employee');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: "직원 등록 완료",
        description: `${data.name}님이 성공적으로 등록되었습니다.`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "직원 등록 실패",
        description: error.message || "직원 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!formData.name || !formData.position || !formData.employeeNumber || !formData.departmentCode) {
      toast({
        title: "입력 오류",
        description: "필수 항목을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const submitData: InsertEmployee = {
      employeeNumber: formData.employeeNumber!,
      departmentCode: formData.departmentCode!,
      teamCode: formData.teamCode || null,
      name: formData.name!,
      position: formData.position!,
      department: formData.department!,
      team: formData.team || null,
      email: formData.email || null,
      phone: formData.phone || null,
      hireDate: date ?? null,
      birthDate: birthDate ?? null,
      managerId: formData.managerId || null,
      photoUrl: formData.photoUrl || null,
      education: education.degree, // 문자열로 전송 (객체가 아닌)
      major: education.major,
      school: education.school,
      graduationYear: education.graduationYear ? parseInt(education.graduationYear) : undefined,
      previousExperienceYears: Number(previousExperience.years), // 숫자로 변환
      previousExperienceMonths: Number(previousExperience.months), // 숫자로 변환
      isDepartmentHead: formData.isDepartmentHead || false,
      isActive: formData.isActive ?? true
    };

    createEmployeeMutation.mutate(submitData);
  };

  const handleInputChange = (field: keyof InsertEmployee, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>새 직원 등록</DialogTitle>
          <DialogDescription>
            새로운 직원의 기본 정보와 조직 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">기본 정보</h3>
              
              <div>
                <Label htmlFor="employeeNumber">사원번호 *</Label>
                <Input
                  id="employeeNumber"
                  value={formData.employeeNumber || ""}
                  onChange={(e) => handleInputChange("employeeNumber", e.target.value)}
                  placeholder="예: EMP001"
                  required
                />
              </div>

              <div>
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="이름을 입력하세요"
                  required
                />
              </div>

              <div>
                <Label htmlFor="position">직책 *</Label>
                <Input
                  id="position"
                  value={formData.position || ""}
                  onChange={(e) => handleInputChange("position", e.target.value)}
                  placeholder="예: 주임, 대리, 과장"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="email@company.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">전화번호</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="010-1234-5678"
                />
              </div>

              <div>
                <Label htmlFor="birthDate">생년월일</Label>
                <DatePicker
                  date={birthDate}
                  onDateChange={setBirthDate}
                  placeholder="생년월일을 선택하세요"
                />
              </div>

              {/* 학력 정보 */}
              <div className="mt-6">
                <h4 className="text-md font-semibold mb-3">학력 정보</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="degree">최종학력</Label>
                    <Select
                      value={education.degree}
                      onValueChange={(value) => setEducation(prev => ({ ...prev, degree: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="학력 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high_school">고등학교 졸업</SelectItem>
                        <SelectItem value="associate">전문대학 졸업</SelectItem>
                        <SelectItem value="bachelor">대학교 졸업</SelectItem>
                        <SelectItem value="master">대학원 졸업</SelectItem>
                        <SelectItem value="phd">박사 졸업</SelectItem>
                        <SelectItem value="studying_high_school">고등학교 재학중</SelectItem>
                        <SelectItem value="studying_associate">전문대학 재학중</SelectItem>
                        <SelectItem value="studying_bachelor">대학교 재학중</SelectItem>
                        <SelectItem value="studying_master">대학원 재학중</SelectItem>
                        <SelectItem value="studying_phd">박사과정 재학중</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="school">학교명</Label>
                    <Input
                      id="school"
                      value={education.school}
                      onChange={(e) => setEducation(prev => ({ ...prev, school: e.target.value }))}
                      placeholder="예: 서울대학교"
                    />
                  </div>

                  <div>
                    <Label htmlFor="major">전공</Label>
                    <Input
                      id="major"
                      value={education.major}
                      onChange={(e) => setEducation(prev => ({ ...prev, major: e.target.value }))}
                      placeholder="예: 컴퓨터공학"
                    />
                  </div>

                  <div>
                    <Label htmlFor="graduationYear">졸업년도</Label>
                    <Input
                      id="graduationYear"
                      type="number"
                      value={education.graduationYear}
                      onChange={(e) => setEducation(prev => ({ ...prev, graduationYear: e.target.value }))}
                      placeholder="예: 2020"
                      min="1950"
                      max="2030"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 조직 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">조직 정보</h3>
              
              <div>
                <Label htmlFor="department">부서 *</Label>
                <Select 
                  value={selectedDepartment} 
                  onValueChange={(value) => {
                    setSelectedDepartment(value);
                    const dept = departments.find(d => d.code === value);
                    if (dept) {
                      setFormData(prev => ({
                        ...prev,
                        departmentCode: dept.code,
                        department: dept.name,
                        teamCode: null, // 부서 변경 시 팀 초기화
                        team: null
                      }));
                    }
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.code} value={dept.code}>
                        {dept.name} ({dept.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="team">팀</Label>
                <Select 
                  value={formData.teamCode || "none"} 
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData(prev => ({
                        ...prev,
                        teamCode: null,
                        team: null
                      }));
                    } else {
                      const team = teams.find(t => t.code === value);
                      if (team) {
                        setFormData(prev => ({
                          ...prev,
                          teamCode: team.code,
                          team: team.name
                        }));
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="팀 선택 (부서장은 선택하지 않음)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">팀 없음 (부서장)</SelectItem>
                    {teams
                      .filter(team => team.departmentCode === selectedDepartment)
                      .map(team => (
                        <SelectItem key={team.code} value={team.code}>
                          {team.name} ({team.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="isDepartmentHead">부문장 여부</Label>
                <div className="flex space-x-4 mt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="isDepartmentHead"
                      checked={formData.isDepartmentHead === false}
                      onChange={() => handleInputChange("isDepartmentHead", false)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">일반 직원</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="isDepartmentHead"
                      checked={formData.isDepartmentHead === true}
                      onChange={() => handleInputChange("isDepartmentHead", true)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">부문장</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">추가 정보</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hireDate">입사일</Label>
                <DatePicker
                  date={date}
                  onDateChange={setDate}
                  placeholder="입사일을 선택하세요"
                />
              </div>

              <div>
                <Label htmlFor="photoUrl">프로필 사진 URL</Label>
                <Input
                  id="photoUrl"
                  value={formData.photoUrl || ""}
                  onChange={(e) => handleInputChange("photoUrl", e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button 
              type="submit" 
              disabled={createEmployeeMutation.isPending}
            >
              {createEmployeeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              직원 등록
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
