import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Edit, Mail, Phone, Calendar, MapPin, Users, Award, BookOpen, TrendingUp, FileText, Trophy, Lightbulb, GraduationCap, Building, CalendarIcon, CalendarClock } from "lucide-react";
import RdCapabilityBarChart from "@/components/charts/rd-capability-bar-chart";
import SimpleBarChart from "@/components/charts/simple-bar-chart";
import SimpleRadarChart from "@/components/charts/simple-radar-chart";
import EmployeeEditModal from "@/components/employees/employee-edit-modal";
import SkillEditModal from "@/components/employees/skill-edit-modal";
import TrainingEditModal from "@/components/employees/training-edit-modal";
import ProjectEditModal from "@/components/employees/project-edit-modal";
import AchievementsEditModal from "@/components/employees/achievements-edit-modal";
import AwardsEditModal from "@/components/employees/awards-edit-modal";
import CertificationEditModal from "@/components/employees/certification-edit-modal";
import LanguageEditModal from "@/components/employees/language-edit-modal";
import ProposalEditModal from "@/components/employees/proposal-edit-modal";
import type { Employee, Patent, Publication, Award as AwardType, Project } from "@shared/schema";
import type { ProposalFormData } from "@/types/employee";

interface EmployeeDetailProps {
  employeeId?: string;
}

export default function EmployeeDetail({ employeeId: propEmployeeId }: EmployeeDetailProps = {}) {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);
  const [isAwardsModalOpen, setIsAwardsModalOpen] = useState(false);
  const [isCertificationModalOpen, setIsCertificationModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

  // 날짜 필터 상태 관리
  const [dateFilter, setDateFilter] = useState<'1year' | '3years' | '5years' | 'all' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  
  // 회계연도 기준 설정 (localStorage에서 로드)
  const [useFiscalYear, setUseFiscalYear] = useState(() => {
    const saved = localStorage.getItem('useFiscalYear');
    return saved === 'true';
  });

  // props로 받은 employeeId가 있으면 사용, 없으면 URL에서 가져오기
  const employeeId = propEmployeeId || location.split('/').pop() || "emp1";

  // 회계연도 설정 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('useFiscalYear', useFiscalYear.toString());
  }, [useFiscalYear]);

  // 실제 직원 데이터 상태 관리
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(true);

  // 실제 스킬 데이터 상태 관리
  const [skills, setSkills] = useState<Array<{
    skillName: string;
    skillType: string;
    proficiencyLevel: number;
  }>>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  // 제안제도 데이터 상태 관리
  const [proposals, setProposals] = useState<ProposalFormData[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);

  // R&D 역량평가 데이터 상태 관리
  const [rdEvaluation, setRdEvaluation] = useState<{
    scores: {
      technicalCompetency: number;
      projectExperience: number;
      rdAchievement: number;
      globalCompetency: number;
      knowledgeSharing: number;
      innovationProposal: number;
    };
    rawScores: {
      technicalCompetency: number;
      projectExperience: number;
      rdAchievement: number;
      globalCompetency: number;
      knowledgeSharing: number;
      innovationProposal: number;
    };
    maxRawScores: {
      technicalCompetency: number;
      projectExperience: number;
      rdAchievement: number;
      globalCompetency: number;
      knowledgeSharing: number;
      innovationProposal: number;
    };
    totalScore: number;
    grade: string;
  } | null>(null);
  const [rdEvaluationLoading, setRdEvaluationLoading] = useState(true);
  
  // R&D 역량평가 기준 데이터 상태 관리
  const [rdEvaluationCriteria, setRdEvaluationCriteria] = useState<any>(null);
  const [rdEvaluationCriteriaLoading, setRdEvaluationCriteriaLoading] = useState(true);
  
  // 선택된 역량 상태 관리
  const [selectedCompetency, setSelectedCompetency] = useState<string>('knowledge_sharing');

  // 직원 데이터 로드
  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const response = await fetch(`/api/employees/${employeeId}`);
        if (response.ok) {
          const data = await response.json();
          setEmployee(data);
        } else {
          setEmployee(null);
        }
      } catch (error) {
        console.error('직원 데이터 로드 오류:', error);
        setEmployee(null);
      } finally {
        setEmployeeLoading(false);
      }
    };

    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId]);

  // 스킬 데이터 로드
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await fetch(`/api/skills?employeeId=${employeeId}`);
        if (response.ok) {
          const data = await response.json();
          setSkills(data);
        } else {
          setSkills([]);
        }
      } catch (error) {
        console.error('스킬 데이터 로드 오류:', error);
        setSkills([]);
      } finally {
        setSkillsLoading(false);
      }
    };

    if (employeeId) {
      loadSkills();
    }
  }, [employeeId]);

  // 실제 교육 데이터 상태 관리
  const [trainings, setTrainings] = useState<Array<{
    courseName: string;
    completionDate?: string;
    startDate?: string;
    score?: number;
    status: string;
    duration?: number;
    instructorRole?: 'instructor' | 'mentor' | null;
  }>>([]);
  const [trainingsLoading, setTrainingsLoading] = useState(true);

  // 교육 데이터 로드
  useEffect(() => {
    const loadTrainings = async () => {
      try {
        const { startDate, endDate } = getDateRange();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
        if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
        
        const response = await fetch(`/api/training-history?employeeId=${employeeId}&${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const formattedTrainings = data.map((training: any) => ({
            courseName: training.courseName,
            completionDate: training.completionDate,
            startDate: training.startDate,
            score: training.score,
            status: training.status,
            duration: training.duration,
            instructorRole: training.instructorRole || null
          }));
          setTrainings(formattedTrainings);
        } else {
          setTrainings([]);
        }
      } catch (error) {
        console.error('교육 데이터 로드 오류:', error);
        setTrainings([]);
      } finally {
        setTrainingsLoading(false);
      }
    };

    if (employeeId) {
      loadTrainings();
    }
  }, [employeeId, dateFilter, customStartDate, customEndDate, useFiscalYear]);

  // 제안제도 데이터 로드
  useEffect(() => {
    const loadProposals = async () => {
      try {
        const { startDate, endDate } = getDateRange();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
        if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
        
        const response = await fetch(`/api/proposals?employeeId=${employeeId}&${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setProposals(data);
        } else {
          setProposals([]);
        }
      } catch (error) {
        console.error('제안제도 데이터 로드 오류:', error);
        setProposals([]);
      } finally {
        setProposalsLoading(false);
      }
    };

    if (employeeId) {
      loadProposals();
    }
  }, [employeeId, dateFilter, customStartDate, customEndDate, useFiscalYear]);

  // R&D 역량평가 데이터 로드
  useEffect(() => {
    const loadRdEvaluation = async () => {
      try {
        const { startDate, endDate } = getDateRange();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
        if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
        
        const response = await fetch(`/api/rd-evaluations/test/${employeeId}?${params.toString()}`);
        
        if (response.ok) {
          const data = await response.json();
          setRdEvaluation(data);
        } else {
          // 기본값 설정
          setRdEvaluation({
            scores: {
              technicalCompetency: 0,
              projectExperience: 0,
              rdAchievement: 0,
              globalCompetency: 0,
              knowledgeSharing: 0,
              innovationProposal: 0
            },
            rawScores: {
              technicalCompetency: 0,
              projectExperience: 0,
              rdAchievement: 0,
              globalCompetency: 0,
              knowledgeSharing: 0,
              innovationProposal: 0
            },
            maxRawScores: {
              technicalCompetency: 100,
              projectExperience: 100,
              rdAchievement: 100,
              globalCompetency: 25,
              knowledgeSharing: 60,
              innovationProposal: 100
            },
            totalScore: 0,
            grade: 'D'
          });
        }
      } catch (error) {
        console.error('R&D 역량평가 데이터 로드 오류:', error);
        // 기본값 설정
        setRdEvaluation({
          scores: {
            technicalCompetency: 0,
            projectExperience: 0,
            rdAchievement: 0,
            globalCompetency: 0,
            knowledgeSharing: 0,
            innovationProposal: 0
          },
          rawScores: {
            technicalCompetency: 0,
            projectExperience: 0,
            rdAchievement: 0,
            globalCompetency: 0,
            knowledgeSharing: 0,
            innovationProposal: 0
          },
          maxRawScores: {
            technicalCompetency: 100,
            projectExperience: 100,
            rdAchievement: 100,
            globalCompetency: 25,
            knowledgeSharing: 60,
            innovationProposal: 100
          },
          totalScore: 0,
          grade: 'D'
        });
      } finally {
        setRdEvaluationLoading(false);
      }
    };

    if (employeeId) {
      loadRdEvaluation();
    }
  }, [employeeId, dateFilter, customStartDate, customEndDate, useFiscalYear]);

  // R&D 역량평가 기준 데이터 로드
  useEffect(() => {
    
    const loadRdEvaluationCriteria = async () => {
      try {
        
        const response = await fetch('/api/rd-evaluations/criteria');
        
        if (response.ok) {
          const data = await response.json();
          
          // 응답 구조에 따라 데이터 추출 (criteria 또는 rdEvaluationCriteria)
          const criteriaData = data.criteria || data.rdEvaluationCriteria;
          
          // competencyItems가 있는 경우 그것을 사용, 없으면 전체 데이터 사용
          const rawFinal = criteriaData?.competencyItems || criteriaData;
          
          // detailedCriteria도 함께 저장
          const finalData = {
            ...rawFinal,
            detailedCriteria: data.detailedCriteria
          };
          
          // 키 정규화: camelCase/snake_case/중첩 모두 지원
          const normalizeKeys = (src: any) => {
            if (!src || typeof src !== 'object') return null;
            const pick = (obj: any, keys: string[]) => keys.find(k => obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k]);
            const tc = pick(src, ['technical_competency', 'technicalCompetency']);
            const pj = pick(src, ['project_experience', 'projectExperience']);
            const rd = pick(src, ['rd_achievement', 'rdAchievement']);
            const gl = pick(src, ['global_competency', 'globalCompetency']);
            const ks = pick(src, ['knowledge_sharing', 'knowledgeSharing']);
            const ip = pick(src, ['innovation_proposal', 'innovationProposal']);
            const result: any = {};
            if (tc) result.technical_competency = tc;
            if (pj) result.project_experience = pj;
            if (rd) result.rd_achievement = rd;
            if (gl) result.global_competency = gl;
            if (ks) result.knowledge_sharing = ks;
            if (ip) result.innovation_proposal = ip;
            // 일부 API가 criteria 아래 competencyItems로 감쌀 수도 있음
            if (Object.keys(result).length === 0 && src?.competencyItems) {
              return normalizeKeys(src.competencyItems);
            }
            return Object.keys(result).length > 0 ? result : src;
          };
          const finalCriteriaData = normalizeKeys(finalData);
          
          // detailedCriteria가 사라지지 않도록 명시적으로 추가
          if (data.detailedCriteria) {
            finalCriteriaData.detailedCriteria = data.detailedCriteria;
          }
          
          setRdEvaluationCriteria(finalCriteriaData);
        } else {
          setRdEvaluationCriteria(null);
        }
      } catch (error) {
        console.error('❌ R&D 역량평가 기준 데이터 로드 오류:', error);
        setRdEvaluationCriteria(null);
      } finally {
        setRdEvaluationCriteriaLoading(false);
      }
    };

    loadRdEvaluationCriteria();
  }, []);

  // R&D 역량평가 기준 상태 변화 감지
  useEffect(() => {
  }, [rdEvaluationCriteria]);

  // 실제 프로젝트 데이터 상태 관리
  const [projects, setProjects] = useState<Array<{
    projectName: string;
    role: string;
    startDate: string;
    endDate?: string;
    status: string;
  }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // 프로젝트 데이터 로드
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { startDate, endDate } = getDateRange();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
        if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
        
        const response = await fetch(`/api/projects?employeeId=${employeeId}&${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        } else {
          setProjects([]);
        }
      } catch (error) {
        console.error('프로젝트 데이터 로드 오류:', error);
        setProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    };

    if (employeeId) {
      loadProjects();
    }
  }, [employeeId, dateFilter, customStartDate, customEndDate, useFiscalYear]);

  // 실제 성과 데이터 상태 관리
  const [patents, setPatents] = useState<Array<{
    title: string;
    applicationNumber?: string;
    applicationDate?: string;
    status: string;
  }>>([]);
  const [publications, setPublications] = useState<Array<{
    title: string;
    authors?: string;
    journal?: string;
    conference?: string;
    publicationDate?: string;
    type: string;
  }>>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

  // 성과 데이터 로드
  useEffect(() => {
    const loadAchievements = async () => {
      try {
        
        const { startDate, endDate } = getDateRange();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
        if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
        
        // 특허와 논문을 병렬로 로드
        const [patentsResponse, publicationsResponse] = await Promise.all([
          fetch(`/api/patents?employeeId=${employeeId}&${params.toString()}`),
          fetch(`/api/publications?employeeId=${employeeId}&${params.toString()}`)
        ]);

        if (patentsResponse.ok) {
          const patentsData = await patentsResponse.json();
          setPatents(patentsData);
        } else {
          setPatents([]);
        }

        if (publicationsResponse.ok) {
          const publicationsData = await publicationsResponse.json();
          setPublications(publicationsData);
        } else {
          setPublications([]);
        }
      } catch (error) {
        console.error('🔍 성과 데이터 로드 오류:', error);
        setPatents([]);
        setPublications([]);
      } finally {
        setAchievementsLoading(false);
      }
    };

    if (employeeId) {
      loadAchievements();
    }
  }, [employeeId, dateFilter, customStartDate, customEndDate, useFiscalYear]);

  // 실제 수상 데이터 상태 관리
  const [awards, setAwards] = useState<Array<{
    title: string;
    organization: string;
    awardDate: string;
    category: string;
    description?: string;
    level: string;
  }>>([]);
  const [awardsLoading, setAwardsLoading] = useState(true);

  // 실제 자격증 데이터 상태 관리
  const [certifications, setCertifications] = useState<Array<{
    name: string;
    issuer: string;
    issueDate: string;
    expiryDate?: string;
    score?: number;
    status: string;
    category: string;
  }>>([]);
  const [certificationsLoading, setCertificationsLoading] = useState(true);

  // 실제 어학능력 데이터 상태 관리
  const [languages, setLanguages] = useState<Array<{
    language: string;
    proficiencyLevel: string;
    testType?: string;
    testLevel?: string;
    score?: number;
    maxScore?: number;
    testDate?: string;
    certificateUrl?: string;
    isActive: boolean;
  }>>([]);
  const [languagesLoading, setLanguagesLoading] = useState(true);


  // 수상 데이터 로드
  useEffect(() => {
    const loadAwards = async () => {
      try {
        const { startDate, endDate } = getDateRange();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
        if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
        
        const response = await fetch(`/api/awards?employeeId=${employeeId}&${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setAwards(data);
        } else {
          setAwards([]);
        }
      } catch (error) {
        console.error('🔍 수상 데이터 로드 오류:', error);
        setAwards([]);
      } finally {
        setAwardsLoading(false);
      }
    };

    if (employeeId) {
      loadAwards();
    }
  }, [employeeId, dateFilter, customStartDate, customEndDate, useFiscalYear]);

  // 자격증 데이터 로드
  useEffect(() => {
    const loadCertifications = async () => {
      try {
        const { startDate, endDate } = getDateRange();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
        if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
        
        const response = await fetch(`/api/certifications?employeeId=${employeeId}&${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setCertifications(data);
        } else {
          setCertifications([]);
        }
      } catch (error) {
        console.error('🔍 자격증 데이터 로드 오류:', error);
        setCertifications([]);
      } finally {
        setCertificationsLoading(false);
      }
    };

    if (employeeId) {
      loadCertifications();
    }
  }, [employeeId, dateFilter, customStartDate, customEndDate, useFiscalYear]);

  // 어학능력 데이터 로드
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await fetch(`/api/language-skills?employeeId=${employeeId}`);
        if (response.ok) {
          const data = await response.json();
          setLanguages(data);
        } else {
          setLanguages([]);
        }
      } catch (error) {
        console.error('🔍 어학능력 데이터 로드 오류:', error);
        setLanguages([]);
      } finally {
        setLanguagesLoading(false);
      }
    };

    if (employeeId) {
      loadLanguages();
    }
  }, [employeeId]);


  // R&D 역량평가 기준에 따른 점수 환산 함수 (단순화)
  const convertScore = (category: string, rawScore: number): number => {
    if (!rdEvaluationCriteria) {
      return rawScore;
    }
    
    // 카테고리 매핑
    const competencyKey = {
      '전문기술': 'technical_competency',
      '프로젝트': 'project_experience',
      '연구성과': 'rd_achievement',
      '글로벌': 'global_competency',
      '기술확산': 'knowledge_sharing',
      '혁신제안': 'innovation_proposal'
    }[category];
    
    if (!competencyKey) return rawScore;
    
    const criteriaItem = rdEvaluationCriteria[competencyKey];
    const scoringRanges = criteriaItem?.scoringRanges;
    
    if (!scoringRanges || scoringRanges.length === 0) return rawScore;
    
    // 정렬 (min 기준 오름차순)
    const sortedRanges = [...scoringRanges].sort((a: any, b: any) => a.min - b.min);
    
    // 범위 내 점수
    for (const range of sortedRanges) {
      if (rawScore >= range.min && rawScore <= range.max) {
        return range.converted;
      }
    }
    
    // 범위 밖 처리
    if (rawScore < sortedRanges[0].min) {
      return sortedRanges[0].converted;
    }
    
    if (rawScore > sortedRanges[sortedRanges.length - 1].max) {
      return sortedRanges[sortedRanges.length - 1].converted;
    }
    
    // 범위 사이 빈틈
    return sortedRanges[0].converted;
  };

  // R&D 역량평가 기반 종합능력치 계산
  const calculateOverallSkill = () => {
    if (!rdEvaluation || rdEvaluationLoading) return 0;
    
    // 서버에서 이미 계산된 totalScore를 그대로 사용
    return Math.round(rdEvaluation.totalScore || 0);
  };
  
  const overallSkill = calculateOverallSkill();
  
  // 레이더 차트용 점수 변환 함수 (서버의 maxRawScores 기준으로 백분율 계산)
  const getRadarChartValue = (rawScore: number, competencyKey: string): number => {
    
    if (!rdEvaluation?.maxRawScores) {
      return rawScore; // 기준 없으면 원점수 사용
    }
    
    // 서버에서 받은 maxRawScores 사용
    const maxRawScore = rdEvaluation.maxRawScores[competencyKey as keyof typeof rdEvaluation.maxRawScores] || 100;
    const result = Math.min((rawScore / maxRawScore) * 100, 100);
    
    return result;
  };
  
  // 각 역량별 세부 점수 계산 함수들 (서버 로직과 일치)
  const getTechnicalDetails = () => {
    if (!employee) return [];
    
    const details: Array<{label: string, value: string, score: number}> = [];
    
    // 학위 점수 (서버 로직과 동일)
    let educationScore = 0;
    if (employee.education === 'bachelor') educationScore = 10;
    else if (employee.education === 'master') educationScore = 20;
    else if (employee.education === 'doctor') educationScore = 30;
    
    if (educationScore > 0) {
      details.push({
        label: '학위',
        value: employee.education || '미입력',
        score: educationScore
      });
    }
    
    // 경력 점수 (서버 로직과 동일)
    const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;
    const inCompanyYears = hireDate ? ((Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0;
    const prevYears = Number(employee.previousExperienceYears || 0);
    const prevMonths = Number(employee.previousExperienceMonths || 0);
    const totalYears = inCompanyYears + prevYears + (prevMonths / 12);
    
    let experienceScore = 0;
    if (totalYears >= 15) experienceScore = 50;
    else if (totalYears >= 10) experienceScore = 40;
    else if (totalYears >= 5) experienceScore = 30;
    else experienceScore = 20;
    
    details.push({
      label: '경력',
      value: `${totalYears.toFixed(1)}년`,
      score: experienceScore
    });
    
    // 자격증 점수 (서버 로직과 동일)
    const getCertificationPoint = (cert: any): number => {
      const name = (`${cert.name || ''}`).toLowerCase();
      const level = (`${cert.level || ''}`).toLowerCase();
      if (name.includes('기술사') || level.includes('expert')) return 20;
      if ((name.includes('기사') && !name.includes('산업기사')) || level.includes('advanced')) return 10;
      if (name.includes('산업기사') || level.includes('intermediate')) return 5;
      return 3;
    };
    
    let totalCertScore = 0;
    certifications.forEach(cert => {
      totalCertScore += getCertificationPoint(cert);
    });
    
    if (totalCertScore > 0) {
      details.push({
        label: '자격증',
        value: `${certifications.length}개`,
        score: totalCertScore
      });
    }
    
    return details;
  };
  
  const getProjectDetails = () => {
    const details: Array<{label: string, value: string, score: number}> = [];
    
    if (!projects || projects.length === 0) {
      return details;
    }
    
    // detailedCriteria에서 프로젝트 점수 기준 로드
    const projectCriteria = rdEvaluationCriteria?.detailedCriteria?.project_experience || {};
    const roleMapping = projectCriteria.roleMapping || {};
    const leadershipScores = projectCriteria.leadership || {};
    const countBonus = projectCriteria.count || {};
    
    // 기본 roleMapping (사용자가 설정하지 않은 경우)
    const defaultRoleMapping = {
      "project_leader": "Project Leader",
      "PL": "Project Leader",
      "lead": "Project Leader",
      "core_member": "핵심 멤버",
      "member": "일반 멤버"
    };
    
    const finalRoleMapping = Object.keys(roleMapping).length > 0 ? roleMapping : defaultRoleMapping;
    
    // 역할별 점수 매핑 함수 - 서버와 동일한 로직
    const getRoleScore = (role: string): number => {
      // 1. 정확히 매핑된 역할이 있으면 사용
      if (finalRoleMapping[role]) {
        const mappedRole = finalRoleMapping[role];
        return leadershipScores[mappedRole] || 0;
      }
      
      // 2. roleMapping에 없으면 직접 leadership에서 찾기
      if (leadershipScores[role]) {
        return leadershipScores[role];
      }
      
      // 3. 부분 매칭 시도 (소문자 변환하여 비교)
      const roleLower = role.toLowerCase();
      for (const [key, value] of Object.entries(finalRoleMapping)) {
        if (key.toLowerCase() === roleLower) {
          return leadershipScores[value as string] || 0;
        }
      }
      
      // 4. 기본값 - leadership의 마지막 항목 또는 0
      const defaultRole = Object.keys(leadershipScores).pop();
      return defaultRole ? leadershipScores[defaultRole] : 0;
    };
    
    // 역할별 점수 계산 및 표시
    const roleScores: {[key: string]: {count: number, score: number}} = {};
    
    projects.forEach((p: any) => {
      const roleScore = getRoleScore(p.role);
      const mappedRole = finalRoleMapping[p.role] || p.role;
      
      if (!roleScores[mappedRole]) {
        roleScores[mappedRole] = { count: 0, score: roleScore };
      }
      roleScores[mappedRole].count++;
    });
    
    // 역할별 세부 점수 표시
    Object.entries(roleScores).forEach(([role, data]) => {
      if (data.count > 0) {
        details.push({
          label: role,
          value: `${data.count}개`,
          score: data.count * data.score
        });
      }
    });
    
    // 개수 보너스 - 완전 동적 처리
    const count = projects.length;
    
    // countBonus 객체를 파싱하여 규칙 생성
    const bonusRules = Object.entries(countBonus).map(([key, score]) => {
      const isOrMore = key.includes("이상");
      const numMatch = key.match(/(\d+)/);
      const threshold = numMatch ? parseInt(numMatch[1]) : 0;
      return { threshold, score: score as number, isOrMore };
    }).sort((a, b) => b.threshold - a.threshold); // 큰 숫자부터 정렬
    
    // 조건에 맞는 첫 번째 보너스 적용
    for (const rule of bonusRules) {
      if (rule.isOrMore && count >= rule.threshold) {
        details.push({
          label: '프로젝트 보너스',
          value: `${count}개`,
          score: rule.score
        });
        break;
      } else if (!rule.isOrMore && count === rule.threshold) {
        details.push({
          label: '프로젝트 보너스',
          value: `${count}개`,
          score: rule.score
        });
        break;
      }
    }
    
    return details;
  };
  
  const getRdAchievementDetails = () => {
    const details: Array<{label: string, value: string, score: number}> = [];
    
    // 서버 로직과 동일한 계산
    if (patents.length > 0) {
      details.push({
        label: '특허',
        value: `${patents.length}건`,
        score: patents.length * 10  // 서버: 특허당 10점
      });
    }
    
    if (publications.length > 0) {
      details.push({
        label: '논문',
        value: `${publications.length}편`,
        score: publications.length * 15  // 서버: 논문당 15점
      });
    }
    
    if (awards.length > 0) {
      details.push({
        label: '수상',
        value: `${awards.length}건`,
        score: awards.length * 20  // 서버: 수상당 20점
      });
    }
    
    return details;
  };
  
  const getGlobalDetails = () => {
    const details: Array<{label: string, value: string, score: number}> = [];
    
    // 서버 로직과 동일한 계산 (간소화된 버전)
    languages.forEach(lang => {
      let score = 0;
      if (lang.language === 'English' && lang.testType === 'TOEIC') {
        const scoreValue = lang.score || 0;
        // 서버의 detailedCriteria 기준에 맞춰 점수 계산 (간소화)
        if (scoreValue >= 950) score = 10;
        else if (scoreValue >= 900) score = 8;
        else if (scoreValue >= 800) score = 6;
        else if (scoreValue >= 700) score = 4;
        else score = 2;
        
        details.push({
          label: '영어',
          value: `TOEIC ${scoreValue}점`,
          score: score
        });
      } else if (lang.language === 'Japanese' && lang.testType === 'JLPT') {
        // testLevel이 있으면 우선 사용 (N1, N2 등)
        if (lang.testLevel) {
          // testLevel에 따른 점수 계산 (서버 로직과 동일)
          const levelScores: {[key: string]: number} = {
            'N1': 10, 'N2': 7, 'N3': 4, 'N4': 2, 'N5': 1
          };
          score = levelScores[lang.testLevel] || 0;
          
          details.push({
            label: '일본어',
            value: `JLPT ${lang.testLevel}`,
            score: score
          });
        } else {
          // testLevel이 없으면 proficiencyLevel 사용
          if (lang.proficiencyLevel === 'advanced') score = 10;
          else if (lang.proficiencyLevel === 'intermediate') score = 7;
          else if (lang.proficiencyLevel === 'beginner') score = 4;
          
          details.push({
            label: '일본어',
            value: `JLPT ${lang.proficiencyLevel}`,
            score: score
          });
        }
      } else if (lang.language === 'Chinese' && lang.testType === 'HSK' && lang.testLevel) {
        // 중국어 HSK 등급 표시 (서버 로직과 동일)
        const levelScores: {[key: string]: number} = {
          '6급': 10, '5급': 8, '4급': 6, '3급': 4, '2급': 2, '1급': 1
        };
        score = levelScores[lang.testLevel] || 0;
        
        details.push({
          label: '중국어',
          value: `HSK ${lang.testLevel}`,
          score: score
        });
      }
    });
    
    return details;
  };
  
  const getKnowledgeSharingDetails = () => {
    const details: Array<{label: string, value: string, score: number}> = [];
    
    // 교육이수 (서버 로직과 동일 - 수강생 역할만)
    const studentTrainings = trainings.filter(t => 
      t.status === 'completed' && 
      (t.instructorRole === null || t.instructorRole === undefined)
    );
    const totalHours = studentTrainings.reduce((sum, t) => sum + (t.duration || 0), 0);
    let educationScore = 0;
    if (totalHours >= 40) educationScore = 5;
    else if (totalHours >= 20) educationScore = 3;
    else if (totalHours >= 10) educationScore = 2;
    
    if (educationScore > 0) {
      details.push({
        label: '교육이수',
        value: `${totalHours}시간`,
        score: educationScore
      });
    }
    
    // 신규자격증 (서버 로직과 동일 - 평가 기간 내 발급)
    const currentYear = new Date().getFullYear();
    const newCerts = certifications.filter(cert => {
      if (!cert.issueDate) return false;
      const issueDate = new Date(cert.issueDate);
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      return issueDate >= start && issueDate <= end;
    });
    
    if (newCerts.length > 0) {
      const newCertScore = Math.min(newCerts.length * 5, 25); // 서버: 최대 25점
      details.push({
        label: '신규자격증',
        value: `${newCerts.length}개`,
        score: newCertScore
      });
    }
    
    // 멘토링 (서버 로직과 동일)
    const mentoringCount = trainings.filter(t => 
      t.status === 'completed' && t.instructorRole === 'mentor'
    ).length;
    
    if (mentoringCount > 0) {
      const mentoringScore = Math.min(mentoringCount * 3, 15); // 서버: 최대 15점
      details.push({
        label: '멘토링',
        value: `${mentoringCount}회`,
        score: mentoringScore
      });
    }
    
    // 강의 (서버 로직과 동일)
    const lectureCount = trainings.filter(t => 
      t.status === 'completed' && t.instructorRole === 'instructor'
    ).length;
    
    if (lectureCount > 0) {
      let lectureScore = 0;
      if (lectureCount >= 3) lectureScore = 15;
      else if (lectureCount >= 2) lectureScore = 10;
      else if (lectureCount >= 1) lectureScore = 5;
      
      details.push({
        label: '강의',
        value: `${lectureCount}회`,
        score: lectureScore
      });
    }
    
    return details;
  };
  
  const getInnovationDetails = () => {
    const details: Array<{label: string, value: string, score: number}> = [];
    
    // 서버 로직과 동일한 계산
    if (proposals.length > 0) {
      details.push({
        label: '제안 제출',
        value: `${proposals.length}건`,
        score: proposals.length * 10  // 서버: 제안당 10점
      });
    }
    
    return details;
  };
  
  // 선택된 역량의 세부 점수 가져오기
  const getCompetencyDetails = (competency: string) => {
    switch(competency) {
      case 'technical_competency': return getTechnicalDetails();
      case 'project_experience': return getProjectDetails();
      case 'rd_achievement': return getRdAchievementDetails();
      case 'global_competency': return getGlobalDetails();
      case 'knowledge_sharing': return getKnowledgeSharingDetails();
      case 'innovation_proposal': return getInnovationDetails();
      default: return [];
    }
  };

  // 세부 점수 합계가 rawScores와 일치하는지 검증
  const validateDetailScores = (competency: string) => {
    if (!rdEvaluation?.rawScores) return true;
    
    const details = getCompetencyDetails(competency);
    const calculatedTotal = details.reduce((sum, detail) => sum + detail.score, 0);
    
    const competencyKey = competency.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) as keyof typeof rdEvaluation.rawScores;
    const serverRawScore = rdEvaluation.rawScores[competencyKey];
    
    // 5점 이내 차이는 허용 (날짜 필터링 등으로 인한 미세한 차이)
    return Math.abs(calculatedTotal - serverRawScore) <= 5;
  };
  
  // 역량 이름 매핑
  const getCompetencyName = (competency: string) => {
    const names: Record<string, string> = {
      'technical_competency': '전문기술',
      'project_experience': '프로젝트',
      'rd_achievement': '연구성과',
      'global_competency': '글로벌',
      'knowledge_sharing': '기술확산',
      'innovation_proposal': '혁신제안'
    };
    return names[competency] || competency;
  };
  
  // 총 경력 계산 (이전 경력 + 현재 회사 경력)
  const calculateTotalExperience = () => {
    if (!employee) return { years: 0, months: 0 };
    
    let totalYears = 0;
    let totalMonths = 0;
    
    // 이전 경력 추가
    if (employee.previousExperienceYears) {
      totalYears += employee.previousExperienceYears;
    }
    if (employee.previousExperienceMonths) {
      totalMonths += employee.previousExperienceMonths;
    }
    
    // 현재 회사 경력 계산
    if (employee.hireDate) {
      const hireDate = new Date(employee.hireDate);
      const currentDate = new Date();
      
      let years = currentDate.getFullYear() - hireDate.getFullYear();
      let months = currentDate.getMonth() - hireDate.getMonth();
      
      if (months < 0) {
        years--;
        months += 12;
      }
      
      // 일 단위로 더 정확한 계산
      if (currentDate.getDate() < hireDate.getDate()) {
        months--;
        if (months < 0) {
          years--;
          months += 12;
        }
      }
      
      totalYears += years;
      totalMonths += months;
    }
    
    // 월이 12개월 이상이면 년으로 변환
    if (totalMonths >= 12) {
      totalYears += Math.floor(totalMonths / 12);
      totalMonths = totalMonths % 12;
    }
    
    return { years: totalYears, months: totalMonths };
  };
  
  const totalExperience = calculateTotalExperience();

  // 날짜 범위 계산 헬퍼 함수
  const getDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    // 회계연도 계산 (4월~3월) - 동적으로 계산
    const getFiscalYearRange = (yearsBack: number) => {
      let fiscalYear = currentYear;
      // 4월(3) 이전이면 전 회계연도
      if (currentMonth < 3) {
        fiscalYear--;
      }
      
      const start = new Date(fiscalYear - yearsBack, 3, 1); // 4월 1일
      const end = new Date(fiscalYear + 1, 2, 31); // 3월 31일
      return { start, end };
    };

    // 연도 계산 (1월~12월) - 동적으로 계산
    const getCalendarYearRange = (yearsBack: number) => {
      const start = new Date(currentYear - yearsBack, 0, 1); // 1월 1일
      const end = new Date(currentYear - 1, 11, 31); // 작년 12월 31일
      return { start, end };
    };

    switch(dateFilter) {
      case '1year':
        if (useFiscalYear) {
          const { start, end } = getFiscalYearRange(1);
          startDate = start;
          endDate = end;
        } else {
          const { start, end } = getCalendarYearRange(1);
          startDate = start;
          endDate = end;
        }
        break;
      case '3years':
        if (useFiscalYear) {
          const { start, end } = getFiscalYearRange(3);
          startDate = start;
          endDate = end;
        } else {
          const { start, end } = getCalendarYearRange(3);
          startDate = start;
          endDate = end;
        }
        break;
      case '5years':
        if (useFiscalYear) {
          const { start, end } = getFiscalYearRange(5);
          startDate = start;
          endDate = end;
        } else {
          const { start, end } = getCalendarYearRange(5);
          startDate = start;
          endDate = end;
        }
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      case 'all':
      default:
        startDate = undefined;
        endDate = undefined;
    }

    return { startDate, endDate };
  };

  // 로딩 상태 또는 직원 데이터가 없는 경우
  if (employeeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">직원 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }
  
  if (!employee || employee === null || employee === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">직원을 찾을 수 없습니다</h1>
          <p className="text-gray-600 mb-6">요청하신 직원 정보가 존재하지 않습니다.</p>
          <Button onClick={() => setLocation('/employees')}>
            직원 목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setLocation("/employees")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{employee?.name || '이름 없음'}</h1>
            <p className="text-muted-foreground">{employee?.position || '직급 없음'} • {employee?.department || '부서 없음'}</p>
          </div>
        </div>
        <Button onClick={() => setIsEditModalOpen(true)}>
          <Edit className="w-4 h-4 mr-2" />
          정보 수정
        </Button>
      </div>

      {/* Employee Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start space-x-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={employee?.photoUrl || undefined} />
              <AvatarFallback className="text-lg">
                {employee?.name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{employee?.email || '이메일 없음'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{employee?.phone || '전화번호 없음'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">입사일: {employee?.hireDate ? new Date(employee.hireDate).toLocaleDateString() : '미정'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">총 경력: {totalExperience.years}년 {totalExperience.months}개월</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">종합 능력치: {overallSkill}%</span>
                  </div>
                </div>
              </div>
              
              {/* 학력 정보 */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">학력 정보</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                          <span>최종학력: {employee?.education || '미입력'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                          <span>전공: {employee?.major || '미입력'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span>학교: {employee?.school || '미입력'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>졸업년도: {employee?.graduationYear || '미입력'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Badge variant="secondary">{employee?.department || '부서 없음'}</Badge>
                {employee?.team && <Badge variant="outline">{employee.team}</Badge>}
                <Badge variant="default">{employee?.position || '직급 없음'}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs key={employeeId} value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="skills">스킬</TabsTrigger>
          <TabsTrigger value="training">교육</TabsTrigger>
          <TabsTrigger value="projects">프로젝트</TabsTrigger>
          <TabsTrigger value="achievements">성과</TabsTrigger>
          <TabsTrigger value="certifications">자격증</TabsTrigger>
          <TabsTrigger value="languages">어학능력</TabsTrigger>
          <TabsTrigger value="proposals">제안제도</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  성과 요약
                </CardTitle>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* 회계연도 토글 */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={useFiscalYear}
                            onCheckedChange={setUseFiscalYear}
                            id="fiscal-year-mode"
                          />
                          <Label htmlFor="fiscal-year-mode" className="hidden sm:inline cursor-pointer">
                            회계연도 기준 (4월~3월)
                          </Label>
                          <CalendarClock className="sm:hidden w-4 h-4" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>회계연도 기준 (4월~3월)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <div className="flex items-center gap-2">
                    {/* 버튼 그룹 */}
                    <div className="flex border rounded-md">
                      <Button 
                        variant={dateFilter === '1year' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('1year')}
                        className="rounded-r-none"
                      >
                        1년
                      </Button>
                      <Button 
                        variant={dateFilter === '3years' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('3years')}
                        className="rounded-none"
                      >
                        3년
                      </Button>
                      <Button 
                        variant={dateFilter === '5years' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('5years')}
                        className="rounded-none"
                      >
                        5년
                      </Button>
                      <Button 
                        variant={dateFilter === 'all' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('all')}
                        className="rounded-l-none"
                      >
                        전체
                      </Button>
                    </div>
                    {/* 날짜 선택기 */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setDateFilter('custom')}
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          기간 선택
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">시작일</label>
                            <DatePicker
                              date={customStartDate}
                              onDateChange={setCustomStartDate}
                              placeholder="시작일 선택"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">종료일</label>
                            <DatePicker
                              date={customEndDate}
                              onDateChange={setCustomEndDate}
                              placeholder="종료일 선택"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setCustomStartDate(undefined);
                                setCustomEndDate(undefined);
                                setDateFilter('all');
                              }}
                            >
                              초기화
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => setDateFilter('custom')}
                            >
                              적용
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>종합 능력치</span>
                  <span className="font-semibold">{overallSkill}%</span>
                </div>
                <Progress value={overallSkill} className="w-full" />
                
                <div className="flex justify-between">
                  <span>완료한 교육</span>
                  <span className="font-semibold">{trainings.filter(t => t.status === 'completed').length}개</span>
                </div>
                
                <div className="flex justify-between">
                  <span>참여 프로젝트</span>
                  <span className="font-semibold">{projects.length}개</span>
                </div>
                
                <div className="flex justify-between">
                  <span>특허출원</span>
                  <span className="font-semibold">{patents.length}건</span>
                </div>
                
                <div className="flex justify-between">
                  <span>논문투고</span>
                  <span className="font-semibold">{publications.length}편</span>
                </div>
                
                <div className="flex justify-between">
                  <span>수상이력</span>
                  <span className="font-semibold">{awards.length}건</span>
                </div>
                
                <div className="flex justify-between">
                  <span>자격증</span>
                  <span className="font-semibold">{certifications.length}개</span>
                </div>
                
                <div className="flex justify-between">
                  <span>어학능력</span>
                  <span className="font-semibold">{languages.length}개</span>
                </div>
                
                <div className="flex justify-between">
                  <span>제안제도</span>
                  <span className="font-semibold">{proposals.length}건</span>
                </div>
                
                <div className="flex justify-between">
                  <span>보유 스킬</span>
                  <span className="font-semibold">{skills.length}개</span>
                </div>
                
                <div className="flex justify-between">
                  <span>이전 경력</span>
                  <span className="font-semibold">
                    {employee?.previousExperienceYears && employee.previousExperienceYears > 0 || employee?.previousExperienceMonths && employee.previousExperienceMonths > 0 
                      ? `${employee.previousExperienceYears || 0}년 ${employee.previousExperienceMonths || 0}개월`
                      : '없음'
                    }
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span>현재 회사 경력</span>
                  <span className="font-semibold">
                    {employee?.hireDate 
                      ? (() => {
                          const hireDate = new Date(employee.hireDate);
                          const currentDate = new Date();
                          let years = currentDate.getFullYear() - hireDate.getFullYear();
                          let months = currentDate.getMonth() - hireDate.getMonth();
                          
                          if (months < 0) {
                            years--;
                            months += 12;
                          }
                          
                          if (currentDate.getDate() < hireDate.getDate()) {
                            months--;
                            if (months < 0) {
                              years--;
                              months += 12;
                            }
                          }
                          
                          return `${years}년 ${months}개월`;
                        })()
                      : '미정'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    R&D 역량평가
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setLocation('/rd-evaluation')}>
                    설정
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* R&D 역량평가 결과 - 간단한 테스트 */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">6대 역량 평가</h4>
                  {rdEvaluationLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-muted-foreground text-sm">R&D 역량평가 데이터 로딩 중...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* R&D 역량 레이더차트 */}
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <p className="text-sm font-semibold mb-2 text-center">R&D 역량 레이더차트:</p>
                        {rdEvaluationCriteriaLoading || !rdEvaluationCriteria ? (
                          <div className="flex items-center justify-center" style={{ height: 400 }}>
                            <p className="text-muted-foreground">평가 기준 로딩 중...</p>
                          </div>
                        ) : (
                          <SimpleRadarChart
                            data={(() => {
                              const radarData = [
                                { name: '전문기술', value: getRadarChartValue(rdEvaluation?.scores?.technicalCompetency || 0, 'technicalCompetency') },
                                { name: '프로젝트', value: getRadarChartValue(rdEvaluation?.scores?.projectExperience || 0, 'projectExperience') },
                                { name: '연구성과', value: getRadarChartValue(rdEvaluation?.scores?.rdAchievement || 0, 'rdAchievement') },
                                { name: '글로벌', value: getRadarChartValue(rdEvaluation?.scores?.globalCompetency || 0, 'globalCompetency') },
                                { name: '기술확산', value: getRadarChartValue(rdEvaluation?.scores?.knowledgeSharing || 0, 'knowledgeSharing') },
                                { name: '혁신제안', value: getRadarChartValue(rdEvaluation?.scores?.innovationProposal || 0, 'innovationProposal') }
                              ];
                              return radarData;
                            })()}
                            size={400}
                          onLabelClick={(label) => {
                            const competencyMap: Record<string, string> = {
                              '전문기술': 'technical_competency',
                              '프로젝트': 'project_experience',
                              '연구성과': 'rd_achievement',
                              '글로벌': 'global_competency',
                              '기술확산': 'knowledge_sharing',
                              '혁신제안': 'innovation_proposal'
                            };
                            setSelectedCompetency(competencyMap[label] || 'knowledge_sharing');
                          }}
                          selectedLabel={getCompetencyName(selectedCompetency)}
                        />
                        )}
                      </div>
                      
                      {/* 선택된 역량의 세부 점수 표시 */}
                      <div className="p-3 bg-white rounded border border-slate-200">
                        <div className="mb-2">
                          <h5 className="text-sm font-semibold text-blue-700 mb-1">
                            {getCompetencyName(selectedCompetency)} 세부 점수
                          </h5>
                          <p className="text-xs text-gray-500">
                            레이더차트의 라벨을 클릭하여 다른 역량의 세부 점수를 확인할 수 있습니다.
                          </p>
                          {!validateDetailScores(selectedCompetency) && (
                            <p className="text-xs text-orange-600 mt-1">
                              ⚠️ 세부 점수 합계가 서버 원점수와 다를 수 있습니다.
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {getCompetencyDetails(selectedCompetency).map((detail, index) => (
                            <div key={index} className="flex justify-between">
                              <span>{detail.label}:</span>
                              <span className="font-medium">
                                {detail.value} ({detail.score}점)
                              </span>
                            </div>
                          ))}
                          {getCompetencyDetails(selectedCompetency).length === 0 && (
                            <div className="col-span-2 text-center text-gray-500 text-xs py-2">
                              해당 역량의 세부 데이터가 없습니다.
                            </div>
                          )}
                        </div>
                        {/* 원점수 표시 */}
                        {rdEvaluation?.rawScores && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-600">
                              서버 원점수: {rdEvaluation.rawScores[selectedCompetency.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) as keyof typeof rdEvaluation.rawScores]}점
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">종합 점수</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">
                              {(rdEvaluation?.totalScore?.toFixed(1) || 0) + '점'}
                            </span>
                            <Badge variant={
                              rdEvaluation?.grade === 'S' ? 'default' :
                              rdEvaluation?.grade === 'A' ? 'default' :
                              rdEvaluation?.grade === 'B' ? 'secondary' :
                              rdEvaluation?.grade === 'C' ? 'destructive' : 'destructive'
                            }>
                              {rdEvaluation?.grade || 'D'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
              <CardTitle>스킬 레벨</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSkillModalOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  스킬 수정
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
             {skillsLoading ? (
               <p className="text-muted-foreground text-center py-8">스킬 데이터 로딩 중...</p>
             ) : skills.length === 0 ? (
               <p className="text-muted-foreground text-center py-8">등록된 스킬이 없습니다.</p>
             ) : (
               skills.map((skill, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                       <span className="font-medium">{skill.skillName}</span>
                       <Badge variant="outline" className="ml-2">{skill.skillType}</Badge>
                    </div>
                     <span className="text-sm font-semibold">{skill.proficiencyLevel}%</span>
                  </div>
                   <Progress value={skill.proficiencyLevel} className="w-full" />
                </div>
               ))
             )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                교육 이력
              </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsTrainingModalOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  교육 이력 수정
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trainingsLoading ? (
                  <p className="text-muted-foreground text-center py-8">교육 데이터 로딩 중...</p>
                ) : trainings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">등록된 교육이 없습니다.</p>
                ) : (
                  trainings.map((training, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                        <div className="font-medium">{training.courseName}</div>
                        <div className="text-sm text-muted-foreground">{training.completionDate || training.startDate}</div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {training.score && (
                        <div className="text-sm">
                          <span className="font-semibold">{training.score}점</span>
                        </div>
                      )}
                      <Badge 
                          variant={training.status === 'completed' ? 'default' : 
                                  training.status === 'ongoing' ? 'secondary' : 'outline'}
                      >
                          {training.status === 'completed' ? '완료' : training.status === 'ongoing' ? '진행중' : '예정'}
                      </Badge>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
              <CardTitle>프로젝트 참여 이력</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsProjectModalOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  프로젝트 수정
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectsLoading ? (
                  <p className="text-muted-foreground text-center py-8">프로젝트 데이터 로딩 중...</p>
                ) : projects.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">등록된 프로젝트가 없습니다.</p>
                ) : (
                  projects.map((project, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                          <div className="font-medium">{project.projectName}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                            역할: {project.role} • 기간: {project.startDate} ~ {project.endDate || '진행중'}
                          </div>
                        </div>
                        <Badge 
                          variant={project.status === 'completed' ? 'default' : 
                                  project.status === 'active' ? 'secondary' : 'outline'}
                        >
                          {project.status === 'completed' ? '완료' : project.status === 'active' ? '진행중' : '예정'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsAchievementsModalOpen(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              성과 수정
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 특허출원 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  특허출원
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {achievementsLoading ? (
                    <p className="text-muted-foreground text-center py-4">특허 데이터 로딩 중...</p>
                  ) : patents.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">등록된 특허가 없습니다.</p>
                  ) : (
                    patents.map((patent, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{patent.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                              {patent.applicationNumber && `출원번호: ${patent.applicationNumber}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                              {patent.applicationDate && `출원일: ${patent.applicationDate}`}
                            </div>
                          </div>
                          <Badge 
                            variant={patent.status === 'granted' ? 'default' : 
                                    patent.status === 'pending' ? 'secondary' : 'outline'}
                          >
                            {patent.status === 'granted' ? '등록' : patent.status === 'pending' ? '출원' : '기타'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 논문투고 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  논문투고
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {achievementsLoading ? (
                    <p className="text-muted-foreground text-center py-4">논문 데이터 로딩 중...</p>
                  ) : publications.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">등록된 논문이 없습니다.</p>
                  ) : (
                    publications.map((publication, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{publication.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                              {publication.authors && `저자: ${publication.authors}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {publication.journal || publication.conference}
                          </div>
                            <div className="text-sm text-muted-foreground">
                              {publication.publicationDate && `발행일: ${publication.publicationDate}`}
                            </div>
                        </div>
                        <Badge 
                            variant={publication.type === 'journal' ? 'default' : 'secondary'}
                        >
                            {publication.type === 'journal' ? '저널' : '학회'}
                        </Badge>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 수상이력 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  수상이력
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {achievementsLoading ? (
                    <p className="text-muted-foreground text-center py-4">수상 데이터 로딩 중...</p>
                  ) : awards.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">등록된 수상이 없습니다.</p>
                  ) : (
                    awards.map((award, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{award.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                              {award.organization && `수여기관: ${award.organization}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                              {award.awardDate && `수상일: ${award.awardDate}`}
                          </div>
                          {award.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {award.description}
                            </div>
                          )}
                        </div>
                        <Badge 
                          variant={award.level === 'international' ? 'default' : 
                                  award.level === 'national' ? 'secondary' : 'outline'}
                        >
                          {award.level === 'international' ? '국제' : 
                           award.level === 'national' ? '국가' : 
                           award.level === 'company' ? '회사' : '부서'}
                        </Badge>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        {/* Certifications Tab */}
        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Award className="w-5 h-5 mr-2" />
                  자격증 보유 현황
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsCertificationModalOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  자격증 수정
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {certificationsLoading ? (
                  <p className="text-muted-foreground text-center py-8">자격증 데이터 로딩 중...</p>
                ) : certifications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">등록된 자격증이 없습니다.</p>
                ) : (
                  certifications.map((cert, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{cert.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            발급기관: {cert.issuer}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            발급일: {cert.issueDate}
                          </div>
                          {cert.expiryDate && (
                            <div className="text-sm text-muted-foreground">
                              만료일: {cert.expiryDate}
                            </div>
                          )}
                          {cert.score && (
                            <div className="text-sm text-muted-foreground">
                              점수: {cert.score}점
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge 
                            variant={cert.status === 'active' ? 'default' : 'secondary'}
                          >
                            {cert.status === 'active' ? '유효' : '만료'}
                          </Badge>
                          <Badge variant="outline">{cert.category}</Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Languages Tab */}
        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  어학능력 현황
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsLanguageModalOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  어학능력 수정
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {languagesLoading ? (
                  <p className="text-muted-foreground text-center py-8">어학능력 데이터 로딩 중...</p>
                ) : languages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">등록된 어학능력이 없습니다.</p>
                ) : (
                  languages.map((lang, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{lang.language}</div>
                          <div className="text-sm text-muted-foreground mt-2">
                            <div>수준: {lang.proficiencyLevel}</div>
                            {lang.testType && (
                              <div>시험 유형: {lang.testType}</div>
                            )}
                            {lang.testLevel && (
                              <div>등급: {lang.testLevel}</div>
                            )}
                          </div>
                          {lang.score && (
                            <div className="text-sm text-muted-foreground">
                              점수: {lang.score}점
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge variant="default">{lang.proficiencyLevel}</Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2" />
                  제안제도 현황
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsProposalModalOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  제안 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proposalsLoading ? (
                  <p className="text-muted-foreground text-center py-8">제안제도 데이터 로딩 중...</p>
                ) : proposals.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">등록된 제안이 없습니다.</p>
                ) : (
                  proposals.map((proposal, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{proposal.title}</div>
                          <div className="text-sm text-muted-foreground mt-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>카테고리: {proposal.category}</div>
                              <div>제출일: {proposal.submissionDate ? new Date(proposal.submissionDate).toLocaleDateString() : '날짜 없음'}</div>
                              <div>상태: {proposal.status}</div>
                              <div>영향도: {proposal.impactLevel}</div>
                            </div>
                          </div>
                          {proposal.description && (
                            <div className="text-sm text-muted-foreground mt-2">
                              내용: {proposal.description}
                            </div>
                          )}
                          {proposal.adoptionDate && (
                            <div className="text-sm text-muted-foreground mt-2">
                              채택일: {proposal.adoptionDate.toLocaleDateString()}
                            </div>
                          )}
                          {proposal.rewardAmount && proposal.rewardAmount > 0 && (
                            <div className="text-sm text-muted-foreground mt-2">
                              포상금액: {proposal.rewardAmount.toLocaleString()}원
                            </div>
                          )}
                          {proposal.notes && (
                            <div className="text-sm text-muted-foreground mt-2">
                              비고: {proposal.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge 
                            variant={
                              proposal.status === 'approved' ? 'default' :
                              proposal.status === 'implemented' ? 'default' :
                              proposal.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {proposal.status === 'submitted' ? '제출' :
                             proposal.status === 'under_review' ? '검토중' :
                             proposal.status === 'approved' ? '승인' :
                             proposal.status === 'rejected' ? '반려' :
                             proposal.status === 'implemented' ? '구현완료' : proposal.status}
                          </Badge>
                          {proposal.impactLevel && (
                            <Badge variant="outline">
                              {proposal.impactLevel === 'high' ? '높음' :
                               proposal.impactLevel === 'medium' ? '보통' :
                               proposal.impactLevel === 'low' ? '낮음' : proposal.impactLevel}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      
      {/* Employee Edit Modal */}
      <EmployeeEditModal
        employee={employee}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={(updatedEmployee) => setEmployee(updatedEmployee)}
      />

      {/* Skill Edit Modal */}
      <SkillEditModal
        employeeId={employeeId}
        isOpen={isSkillModalOpen}
        onClose={() => {
          setIsSkillModalOpen(false);
          // 스킬 데이터 다시 로드
          const loadSkills = async () => {
            try {
              const response = await fetch(`/api/skills?employeeId=${employeeId}`);
              if (response.ok) {
                const data = await response.json();
                setSkills(data);
              }
            } catch (error) {
              console.error('스킬 데이터 재로드 오류:', error);
            }
          };
          loadSkills();
        }}
      />

      {/* Training Edit Modal */}
      <TrainingEditModal
        employeeId={employeeId}
        isOpen={isTrainingModalOpen}
        onClose={() => {
          setIsTrainingModalOpen(false);
          // 교육 데이터 다시 로드
          const loadTrainings = async () => {
            try {
              const response = await fetch(`/api/training-history?employeeId=${employeeId}`);
              if (response.ok) {
                const data = await response.json();
                setTrainings(data);
              }
            } catch (error) {
              console.error('교육 데이터 재로드 오류:', error);
            }
          };
          loadTrainings();
        }}
      />

      {/* Project Edit Modal */}
      <ProjectEditModal
        employeeId={employeeId}
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          // 프로젝트 데이터 다시 로드
          const loadProjects = async () => {
            try {
              const response = await fetch(`/api/projects?employeeId=${employeeId}`);
              if (response.ok) {
                const data = await response.json();
                setProjects(data);
              }
            } catch (error) {
              console.error('프로젝트 데이터 재로드 오류:', error);
            }
          };
          loadProjects();
        }}
      />

      {/* Achievements Edit Modal */}
      <AchievementsEditModal
        employeeId={employeeId}
        isOpen={isAchievementsModalOpen}
        onClose={() => {
          setIsAchievementsModalOpen(false);
          // 성과 데이터 다시 로드
          const loadAchievements = async () => {
            try {
              const [patentsResponse, publicationsResponse] = await Promise.all([
                fetch(`/api/patents?employeeId=${employeeId}`),
                fetch(`/api/publications?employeeId=${employeeId}`)
              ]);

              if (patentsResponse.ok) {
                const patentsData = await patentsResponse.json();
                setPatents(patentsData);
              }

              if (publicationsResponse.ok) {
                const publicationsData = await publicationsResponse.json();
                setPublications(publicationsData);
              }
            } catch (error) {
              console.error('성과 데이터 재로드 오류:', error);
            }
          };
          loadAchievements();
        }}
      />

      {/* Awards Edit Modal */}
      <AwardsEditModal
        employeeId={employeeId}
        isOpen={isAwardsModalOpen}
        onClose={() => {
          setIsAwardsModalOpen(false);
          // 수상 데이터 다시 로드
          const loadAwards = async () => {
            try {
              const response = await fetch(`/api/awards?employeeId=${employeeId}`);
              if (response.ok) {
                const data = await response.json();
                setAwards(data);
              }
            } catch (error) {
              console.error('수상 데이터 재로드 오류:', error);
            }
          };
          loadAwards();
        }}
      />

      {/* Certification Edit Modal */}
      <CertificationEditModal
        employeeId={employeeId}
        isOpen={isCertificationModalOpen}
        onClose={() => {
          setIsCertificationModalOpen(false);
          // 자격증 데이터 다시 로드
          const loadCertifications = async () => {
            try {
              const response = await fetch(`/api/certifications?employeeId=${employeeId}`);
              if (response.ok) {
                const data = await response.json();
                setCertifications(data);
              }
            } catch (error) {
              console.error('자격증 데이터 재로드 오류:', error);
            }
          };
          loadCertifications();
        }}
      />

      {/* Language Edit Modal */}
      <LanguageEditModal
        employeeId={employeeId}
        isOpen={isLanguageModalOpen}
        onClose={() => {
          setIsLanguageModalOpen(false);
          // 어학능력 데이터 다시 로드
          const loadLanguages = async () => {
            try {
              const response = await fetch(`/api/language-skills?employeeId=${employeeId}`);
              if (response.ok) {
                const data = await response.json();
                setLanguages(data);
              }
            } catch (error) {
              console.error('어학능력 데이터 재로드 오류:', error);
            }
          };
          loadLanguages();
        }}
      />

      {/* Proposal Edit Modal */}
      <ProposalEditModal
        employeeId={employeeId}
        isOpen={isProposalModalOpen}
        onClose={() => {
          setIsProposalModalOpen(false);
          // 제안제도 데이터 다시 로드
          const loadProposals = async () => {
            try {
              const response = await fetch(`/api/proposals?employeeId=${employeeId}`);
              if (response.ok) {
                const data = await response.json();
                setProposals(data);
              }
            } catch (error) {
              console.error('제안제도 데이터 재로드 오류:', error);
            }
          };
          loadProposals();
        }}
      />
    </div>
  );
}
