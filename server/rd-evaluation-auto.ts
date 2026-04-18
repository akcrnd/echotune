import { storage } from "./storage";

// 자격증 점수 자동 계산 함수 (detailedCriteria 기반)
export function calculateCertificationScore(cert: any, detailedCriteria: any): number {
  // detailedCriteria에서 자격증 점수 기준 로드
  const certCriteria = detailedCriteria?.technical_competency?.certifications || {};
  
  // 자격증명으로 직접 매칭
  const certName = cert.name || '';
  if (certCriteria[certName]) {
    return certCriteria[certName];
  }
  
  // level로 매칭
  const certLevel = cert.level || '';
  if (certCriteria[certLevel]) {
    return certCriteria[certLevel];
  }
  
  // 기본 하드코딩 로직 (fallback)
  const name = certName.toLowerCase();
  const level = certLevel.toLowerCase();
  if (name.includes('기술사') || level.includes('expert')) return 20;
  if ((name.includes('기사') && !name.includes('산업기사')) || level.includes('advanced')) return 10;
  if (name.includes('산업기사') || level.includes('intermediate')) return 5;
  return 3;
}

// 점수 환산 함수 (scoringRanges 적용)
function convertScore(
  competencyKey: string, 
  rawScore: number, 
  rdEvaluationCriteria: any
): number {
  const criteriaItem = rdEvaluationCriteria?.[competencyKey];
  const scoringRanges = criteriaItem?.scoringRanges;
  
  if (!scoringRanges || scoringRanges.length === 0) {
    return rawScore;
  }
  
  const sortedRanges = [...scoringRanges].sort((a: any, b: any) => a.min - b.min);
  
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
    const last = sortedRanges[sortedRanges.length - 1];
    return last.converted;
  }
  
  return sortedRanges[0].converted;
}

// 직원의 6대 역량 자동 평가 실행
export async function calculateAutoRdEvaluation(employeeId: string, evaluationYear: number = new Date().getFullYear(), startDate?: string, endDate?: string) {
  try {
    const employee = await storage.getEmployee(employeeId);
    const rdEvaluationCriteria = await storage.getAppSetting("rdEvaluationCriteria");
    const detailedCriteria = await storage.getAppSetting("detailedCriteria");

    if (!employee) {
      throw new Error("직원을 찾을 수 없습니다.");
    }
    
    // 관련 데이터 조회 (날짜 필터 적용)
    const relatedData = await getRelatedData(employeeId, startDate, endDate);
    
    // 6대 역량별 점수 계산 (maxScore 제한 적용된 점수)
    const scores = {
      technicalCompetency: 0,
      projectExperience: 0,
      rdAchievement: 0,
      globalCompetency: 0,
      knowledgeSharing: 0,
      innovationProposal: 0
    };
    
    // 원점수 저장 (maxScore 제한 적용 전)
    const rawScores = {
      technicalCompetency: 0,
      projectExperience: 0,
      rdAchievement: 0,
      globalCompetency: 0,
      knowledgeSharing: 0,
      innovationProposal: 0
    };
    
    const details = {
      technicalCompetency: "",
      projectExperience: "",
      rdAchievement: "",
      globalCompetency: "",
      knowledgeSharing: "",
      innovationProposal: ""
    };
    
    // 각 역량별 점수 계산 (수동으로 계산)
    
    // 1. 전문기술 역량 계산
    let technicalScore = 0;
    if (employee.education === 'bachelor') technicalScore += 10;
    if (employee.education === 'master') technicalScore += 20;
    if (employee.education === 'doctor') technicalScore += 30;
    
    // 경력 계산 (사내 근속 + 이전 경력 반영)
    const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;
    const inCompanyYears = hireDate ? ((Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0;
    const prevYears = Number(employee.previousExperienceYears || 0);
    const prevMonths = Number(employee.previousExperienceMonths || 0);
    const totalYears = inCompanyYears + prevYears + (prevMonths / 12);
    if (totalYears >= 15) technicalScore += 50;
    else if (totalYears >= 10) technicalScore += 40;
    else if (totalYears >= 5) technicalScore += 30;
    else technicalScore += 20;
    
    // 자격증 점수 계산 (detailedCriteria 기반)
    const getCertificationPoint = (cert: any): number => {
      // scoreAtAcquisition이 있으면 우선 사용 (영구 반영)
      if (cert.useFixedScore && cert.scoreAtAcquisition !== null && cert.scoreAtAcquisition !== undefined) {
        return cert.scoreAtAcquisition;
      }
      
      // detailedCriteria에서 자격증 점수 기준 로드
      const certCriteria = detailedCriteria?.technical_competency?.certifications || {};
      
      // 자격증명으로 직접 매칭
      const certName = cert.name || '';
      if (certCriteria[certName]) {
        return certCriteria[certName];
      }
      
      // level로 매칭
      const certLevel = cert.level || '';
      if (certCriteria[certLevel]) {
        return certCriteria[certLevel];
      }
      
      // 기본 하드코딩 로직 (fallback)
      const name = certName.toLowerCase();
      const level = certLevel.toLowerCase();
      if (name.includes('기술사') || level.includes('expert')) return 20;
      if ((name.includes('기사') && !name.includes('산업기사')) || level.includes('advanced')) return 10;
      if (name.includes('산업기사') || level.includes('intermediate')) return 5;
      return 3;
    };
    
    if (relatedData.certifications?.length) {
      for (const cert of relatedData.certifications) {
        technicalScore += getCertificationPoint(cert);
      }
    }
    
    // 원점수 저장
    rawScores.technicalCompetency = technicalScore;
    
    // maxScore 적용
    const tcMaxScore = rdEvaluationCriteria?.technical_competency?.maxScore || 100;
    scores.technicalCompetency = Math.min(technicalScore, tcMaxScore);
    
    // 2. 프로젝트 수행 경험 계산 - 완전 동적 처리
    let projectScore = 0;
    if (relatedData.projects && relatedData.projects.length > 0) {
      // detailedCriteria에서 프로젝트 점수 기준 로드
      const projectCriteria = detailedCriteria?.project_experience || {};
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
      
      // 역할별 점수 매핑 함수 - 완전 동적
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
      
      // 프로젝트별 점수 계산 (역할에 따라)
      relatedData.projects.forEach((p: any) => {
        projectScore += getRoleScore(p.role);
      });
      
      // 개수 보너스 - 완전 동적 처리
      const count = relatedData.projects.length;
      
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
          projectScore += rule.score;
          break;
        } else if (!rule.isOrMore && count === rule.threshold) {
          projectScore += rule.score;
          break;
        }
      }
    }
    
    // 원점수 저장
    rawScores.projectExperience = projectScore;
    
    // maxScore 적용
    const pjMaxScore = rdEvaluationCriteria?.project_experience?.maxScore || 100;
    scores.projectExperience = Math.min(projectScore, pjMaxScore);
    
    // 3. 연구개발 성과 계산
    let rdScore = 0;
    if (relatedData.patents && relatedData.patents.length > 0) {
      rdScore += relatedData.patents.length * 10; // 특허당 10점
    }
    if (relatedData.publications && relatedData.publications.length > 0) {
      rdScore += relatedData.publications.length * 15; // 논문당 15점
    }
    if (relatedData.awards && relatedData.awards.length > 0) {
      rdScore += relatedData.awards.length * 20; // 수상당 20점
    }
    
    // 원점수 저장
    rawScores.rdAchievement = rdScore;
    
    // maxScore 적용
    const rdMaxScore = rdEvaluationCriteria?.rd_achievement?.maxScore || 100;
    scores.rdAchievement = Math.min(rdScore, rdMaxScore);
    
    // 4. 글로벌 역량 계산
    let globalScore = 0;
    if (relatedData.languages && relatedData.languages.length > 0) {
      // detailedCriteria에서 글로벌 역량 기준 가져오기
      const globalCriteria = detailedCriteria?.global_competency || {};
      
      for (const lang of relatedData.languages) {
        // 영어 점수 계산 (TOEIC)
        if (lang.language === 'English' && lang.testType === 'TOEIC') {
          const score = lang.score || 0;
          const toeicCriteria = globalCriteria["영어 TOEIC"] || {};
          
          // 점수 범위에 따른 점수 계산
          for (const [range, points] of Object.entries(toeicCriteria)) {
            if (range.includes('-')) {
              const [min, max] = range.split('-').map(Number);
              if (score >= min && score <= max) {
                globalScore += points;
                break;
              }
            } else if (range.includes('미만')) {
              const max = parseInt(range);
              if (score < max) {
                globalScore += points;
                break;
              }
            }
          }
        }
        
        // 일본어 점수 계산 (JLPT)
        if (lang.language === 'Japanese' && lang.testType === 'JLPT') {
          const jlptCriteria = globalCriteria["일본어 JLPT"] || {};
          
          // testLevel이 있으면 우선 사용 (N1, N2 등)
          if (lang.testLevel) {
            globalScore += jlptCriteria[lang.testLevel] || 0;
          } else {
            // testLevel이 없으면 proficiencyLevel 사용
            if (lang.proficiencyLevel === 'advanced') globalScore += jlptCriteria["N1"] || 0;
            else if (lang.proficiencyLevel === 'intermediate') globalScore += jlptCriteria["N2"] || 0;
            else if (lang.proficiencyLevel === 'beginner') globalScore += jlptCriteria["N3"] || 0;
          }
        }
        
        // 중국어 점수 계산 (HSK)
        if (lang.language === 'Chinese' && lang.testType === 'HSK' && lang.testLevel) {
          const hskCriteria = globalCriteria["중국어 HSK"] || {};
          globalScore += hskCriteria[lang.testLevel] || 0;
        }
      }
    }
    
    // 원점수 저장
    rawScores.globalCompetency = globalScore;
    
    // maxScore 적용
    const globalMaxScore = rdEvaluationCriteria?.global_competency?.maxScore || 10;
    scores.globalCompetency = Math.min(globalScore, globalMaxScore);
    
    // 5. 기술 확산 및 자기계발 계산
    let knowledgeScore = 0;
    
    // 교육이수 점수 (수강생 역할만) - 원점수 계산
    if (relatedData.trainingHistory && relatedData.trainingHistory.length > 0) {
      const studentTrainings = relatedData.trainingHistory.filter((training: any) => 
        training.status === 'completed' && 
        (training.instructorRole === null || training.instructorRole === undefined)
      );
      const totalHours = studentTrainings.reduce((sum: number, training: any) => sum + (training.duration || 0), 0);
      
      if (totalHours >= 40) knowledgeScore += 5;
      else if (totalHours >= 20) knowledgeScore += 3;
      else if (totalHours >= 10) knowledgeScore += 2;
    }
    
    // 신규 자격증 점수 (평가 기간 내 발급) - 원점수 계산
    if (relatedData.certifications && relatedData.certifications.length > 0) {
      const newCerts = relatedData.certifications.filter((cert: any) => {
        if (!cert.issueDate) return false;
        const issueDate = new Date(cert.issueDate);
        const start = startDate ? new Date(startDate) : new Date(evaluationYear, 0, 1);
        const end = endDate ? new Date(endDate) : new Date(evaluationYear, 11, 31);
        return issueDate >= start && issueDate <= end;
      });
      knowledgeScore += Math.min(newCerts.length * 5, 25);
    }
    
    // 멘토링 활동 점수 - 원점수 계산
    let mentoringCount = 0;
    let lectureCount = 0;
    
    if (relatedData.trainingHistory && relatedData.trainingHistory.length > 0) {
      mentoringCount = relatedData.trainingHistory.filter((training: any) => 
        training.status === 'completed' && training.instructorRole === 'mentor'
      ).length;
      knowledgeScore += Math.min(mentoringCount * 3, 15);
      
      // 강의 활동 점수 - 원점수 계산
      lectureCount = relatedData.trainingHistory.filter((training: any) => 
        training.status === 'completed' && training.instructorRole === 'instructor'
      ).length;
      
      if (lectureCount >= 3) knowledgeScore += 15;
      else if (lectureCount >= 2) knowledgeScore += 10;
      else if (lectureCount >= 1) knowledgeScore += 5;
    }
    
    // 원점수 저장
    rawScores.knowledgeSharing = knowledgeScore;
    
    // maxScore 적용
    const ksMaxScore = rdEvaluationCriteria?.knowledge_sharing?.maxScore || 100;
    scores.knowledgeSharing = Math.min(knowledgeScore, ksMaxScore);
    
    
    // 6. 업무개선 및 혁신 제안 계산
    let innovationScore = 0;
    if (relatedData.proposals && relatedData.proposals.length > 0) {
      innovationScore += relatedData.proposals.length * 10; // 제안당 10점
    }
    
    // 원점수 저장
    rawScores.innovationProposal = innovationScore;
    
    // maxScore 적용
    const ipMaxScore = rdEvaluationCriteria?.innovation_proposal?.maxScore || 100;
    scores.innovationProposal = Math.min(innovationScore, ipMaxScore);
    
    
    // 상세 설명 생성
    const totalYearsText = (Math.round(totalYears * 10) / 10).toFixed(1);
    const inCompanyYearsText = (Math.round(inCompanyYears * 10) / 10).toFixed(1);
    details.technicalCompetency = `학력: ${employee.education || '미입력'}, 경력: ${totalYearsText}년(사내 ${inCompanyYearsText}년 + 이전 ${prevYears}년 ${prevMonths}개월), 자격증: ${relatedData.certifications.length}개`;
    details.projectExperience = `프로젝트: ${relatedData.projects?.length || 0}개 (PL: ${relatedData.projects?.filter((p: any) => p.role === 'PL').length || 0}개)`;
    details.rdAchievement = `특허: ${relatedData.patents?.length || 0}건, 논문: ${relatedData.publications?.length || 0}편, 수상: ${relatedData.awards?.length || 0}건`;
    details.globalCompetency = `어학능력: ${relatedData.languages?.length || 0}개 언어`;
    // 기술확산 상세 정보 생성
    const studentTrainings = relatedData.trainingHistory?.filter((t: any) => 
      t.status === 'completed' && (t.instructorRole === null || t.instructorRole === undefined)
    ) || [];
    const newCertsCount = relatedData.certifications?.filter((cert: any) => {
      if (!cert.issueDate) return false;
      const issueDate = new Date(cert.issueDate);
      const start = startDate ? new Date(startDate) : new Date(evaluationYear, 0, 1);
      const end = endDate ? new Date(endDate) : new Date(evaluationYear, 11, 31);
      return issueDate >= start && issueDate <= end;
    }).length || 0;
    
    const totalStudentHours = studentTrainings.reduce((sum: number, t: any) => sum + (t.duration || 0), 0);
    details.knowledgeSharing = `교육이수: ${totalStudentHours}시간, 신규자격증: ${newCertsCount}개, 멘토링: ${mentoringCount}회, 강의: ${lectureCount}회`;
    details.innovationProposal = `제안제도: ${relatedData.proposals?.length || 0}건`;
    
    // 환산 점수 계산
    const convertedScores = {
      tc: convertScore('technical_competency', scores.technicalCompetency, rdEvaluationCriteria),
      pj: convertScore('project_experience', scores.projectExperience, rdEvaluationCriteria),
      rd: convertScore('rd_achievement', scores.rdAchievement, rdEvaluationCriteria),
      gl: convertScore('global_competency', scores.globalCompetency, rdEvaluationCriteria),
      ks: convertScore('knowledge_sharing', scores.knowledgeSharing, rdEvaluationCriteria),
      ip: convertScore('innovation_proposal', scores.innovationProposal, rdEvaluationCriteria)
    };

    // 가중치 동적 로드 (rdEvaluationCriteria에서)
    const weights = {
      tc: (rdEvaluationCriteria?.technical_competency?.weight || 25) / 100,
      pj: (rdEvaluationCriteria?.project_experience?.weight || 20) / 100,
      rd: (rdEvaluationCriteria?.rd_achievement?.weight || 25) / 100,
      gl: (rdEvaluationCriteria?.global_competency?.weight || 10) / 100,
      ks: (rdEvaluationCriteria?.knowledge_sharing?.weight || 10) / 100,
      ip: (rdEvaluationCriteria?.innovation_proposal?.weight || 10) / 100
    };

    // 종합 점수 계산 (환산 점수 × 가중치)
    const totalScore = 
      (convertedScores.tc * weights.tc) +
      (convertedScores.pj * weights.pj) +
      (convertedScores.rd * weights.rd) +
      (convertedScores.gl * weights.gl) +
      (convertedScores.ks * weights.ks) +
      (convertedScores.ip * weights.ip);

    
    // 등급 계산
    const grade = getGrade(totalScore);
    
    return {
      employeeId,
      evaluationYear,
      scores,
      rawScores,
      maxRawScores: {
        technicalCompetency: rdEvaluationCriteria?.technical_competency?.maxScore || 25,
        projectExperience: rdEvaluationCriteria?.project_experience?.maxScore || 20,
        rdAchievement: rdEvaluationCriteria?.rd_achievement?.maxScore || 25,
        globalCompetency: rdEvaluationCriteria?.global_competency?.maxScore || 10,
        knowledgeSharing: rdEvaluationCriteria?.knowledge_sharing?.maxScore || 10,
        innovationProposal: rdEvaluationCriteria?.innovation_proposal?.maxScore || 10
      },
      details,
      totalScore,
      grade,
      calculatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("자동 평가 계산 오류:", error);
    throw error;
  }
}

// 날짜 필터링 헬퍼 함수
function filterByDateRange(items: any[], dateField: string, startDate?: string, endDate?: string): any[] {
  if (!startDate && !endDate) return items;
  
  return items.filter(item => {
    const itemDate = item[dateField];
    if (!itemDate) return false; // 날짜가 없는 항목은 제외
    
    const itemDateObj = new Date(itemDate);
    if (isNaN(itemDateObj.getTime())) return false; // 유효하지 않은 날짜는 제외
    
    if (startDate && itemDateObj < new Date(startDate)) return false;
    if (endDate && itemDateObj > new Date(endDate)) return false;
    
    return true;
  });
}

// 관련 데이터 조회 (data.json에서)
async function getRelatedData(employeeId: string, startDate?: string, endDate?: string) {
  const results: any = {
    certifications: [],
    languages: [],
    projects: [],
    patents: [],
    publications: [],
    awards: [],
    trainingHistory: [],
    proposals: []
  };

  try {
    results.certifications = (await storage.getCertificationsByEmployee(employeeId)).filter((item: any) => item.isActive !== false);
    results.languages = (await storage.getLanguagesByEmployee(employeeId)).filter((item: any) => item.isActive !== false);
    results.trainingHistory = filterByDateRange(
      (await storage.getTrainingHistoryByEmployee(employeeId)).filter((item: any) => item.status === 'completed'),
      'completionDate',
      startDate,
      endDate
    );
    results.projects = filterByDateRange(await storage.getProjectsByEmployee(employeeId), 'startDate', startDate, endDate);
    results.patents = filterByDateRange(await storage.getPatentsByEmployee(employeeId), 'applicationDate', startDate, endDate);
    results.publications = filterByDateRange(await storage.getPublicationsByEmployee(employeeId), 'publicationDate', startDate, endDate);
    results.awards = filterByDateRange(await storage.getAwardsByEmployee(employeeId), 'awardDate', startDate, endDate);
    results.proposals = filterByDateRange(await storage.getProposals({ employeeId, startDate, endDate }), 'submissionDate', startDate, endDate);
  } catch (error) {
    console.error("?? ??? ?? ??:", error);
  }

  return results;
}

// 상세 설명 생성
function generateDetailDescription(criteria: any, data: any): string {
  const descriptions: string[] = [];
  
  switch (criteria.category) {
    case 'technical_competency':
      if (data.certifications?.length > 0) {
        descriptions.push(`자격증 ${data.certifications.length}개 보유`);
      }
      if (data.employee?.education) {
        descriptions.push(`최종학력: ${data.employee.education}`);
      }
      if (data.employee?.hireDate) {
        const years = Math.floor((new Date().getTime() - new Date(data.employee.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
        descriptions.push(`경력: ${years}년`);
      }
      break;
      
    case 'project_experience':
      if (data.projects?.length > 0) {
        const leaderCount = data.projects.filter((p: any) => p.role === 'Project Leader').length;
        descriptions.push(`프로젝트 ${data.projects.length}개 참여 (리더 ${leaderCount}개)`);
      }
      break;
      
    case 'rd_achievement':
      if (data.patents?.length > 0) {
        const grantedCount = data.patents.filter((p: any) => p.status === 'granted').length;
        descriptions.push(`특허 ${data.patents.length}건 (등록 ${grantedCount}건)`);
      }
      if (data.publications?.length > 0) {
        descriptions.push(`논문 ${data.publications.length}편`);
      }
      if (data.awards?.length > 0) {
        descriptions.push(`수상 ${data.awards.length}건`);
      }
      break;
      
    case 'global_competency':
      if (data.languages?.length > 0) {
        const englishLang = data.languages.find((l: any) => l.language === 'English');
        if (englishLang) {
          descriptions.push(`영어 ${englishLang.score}점 (${englishLang.testType})`);
        }
        const otherLangs = data.languages.filter((l: any) => l.language !== 'English');
        if (otherLangs.length > 0) {
          descriptions.push(`기타 언어 ${otherLangs.length}개`);
        }
      }
      break;
      
    case 'knowledge_sharing':
      if (data.trainingHistory?.length > 0) {
        const totalHours = data.trainingHistory.reduce((sum: number, t: any) => sum + (t.duration || 0), 0);
        descriptions.push(`교육 이수 ${totalHours}시간`);
      }
      // 멘토링 활동 (교육 진행 포함)
      if (data.trainingHistory?.length > 0) {
        const instructorCount = data.trainingHistory.filter((t: any) => t.role === 'instructor' || t.role === 'mentor').length;
        if (instructorCount > 0) {
          descriptions.push(`멘토링/교육진행 ${instructorCount}회`);
        }
      }
      break;
      
    case 'innovation_proposal':
      if (data.proposals?.length > 0) {
        const approvedCount = data.proposals.filter((p: any) => p.status === 'approved' || p.status === 'implemented').length;
        const totalReward = data.proposals.reduce((sum: number, p: any) => sum + (p.rewardAmount || 0), 0);
        descriptions.push(`제안 ${data.proposals.length}건 (채택 ${approvedCount}건)`);
        if (totalReward > 0) {
          descriptions.push(`포상금액 ${totalReward.toLocaleString()}원`);
        }
      } else {
        descriptions.push("제안제도 참여 없음");
      }
      break;
  }
  
  return descriptions.join(", ") || "데이터 없음";
}

// 등급 계산
function getGrade(score: number): string {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

// 1. 전문기술 최대값 계산
function calculateTechnicalMax(detailedCriteria: any): number {
  const criteria = detailedCriteria?.technical_competency || {};
  let maxScore = 0;
  
  // 학력 최대값
  const educationScores = Object.values(criteria.education || {}) as number[];
  if (educationScores.length > 0) {
    maxScore += Math.max(...educationScores); // 30 (박사)
  }
  
  // 경력 최대값
  const experienceScores = Object.values(criteria.experience || {}) as number[];
  if (experienceScores.length > 0) {
    maxScore += Math.max(...experienceScores); // 50 (15년 이상)
  }
  
  // 자격증: 무제한이므로 합리적 상한 설정 (예: 기술사 5개)
  const certScores = Object.values(criteria.certifications || {}) as number[];
  if (certScores.length > 0) {
    maxScore += Math.max(...certScores) * 5; // 100 (기술사 20×5)
  }
  
  return maxScore || 100; // 기본값
}

// 2. 프로젝트 최대값 계산
function calculateProjectMax(detailedCriteria: any): number {
  const criteria = detailedCriteria?.project_experience || {};
  let maxScore = 0;
  
  // 리더십 역할: 무제한이므로 합리적 상한 (예: PL 10개)
  const leadershipScores = Object.values(criteria.leadership || {}) as number[];
  if (leadershipScores.length > 0) {
    maxScore += Math.max(...leadershipScores) * 10; // 150 (PL 15×10)
  }
  
  // 프로젝트 개수 추가점수 최대값
  const countScores = Object.values(criteria.count || {}) as number[];
  if (countScores.length > 0) {
    maxScore += Math.max(...countScores); // 30 (3개 이상)
  }
  
  return maxScore || 100;
}

// 3. 연구성과 최대값 계산
function calculateRdMax(detailedCriteria: any): number {
  const criteria = detailedCriteria?.rd_achievement || {};
  let maxScore = 0;
  
  // 특허: 무제한, 합리적 상한 (예: 등록 10건)
  const patentScores = Object.values(criteria.patents || {}) as number[];
  if (patentScores.length > 0) {
    maxScore += Math.max(...patentScores) * 10; // 200 (등록 20×10)
  }
  
  // 논문: 무제한, 합리적 상한 (예: SCI 5편)
  const pubScores = Object.values(criteria.publications || {}) as number[];
  if (pubScores.length > 0) {
    maxScore += Math.max(...pubScores) * 5; // 125 (SCI 25×5)
  }
  
  // 수상: 무제한, 합리적 상한 (예: 국제 3건)
  const awardScores = Object.values(criteria.awards || {}) as number[];
  if (awardScores.length > 0) {
    maxScore += Math.max(...awardScores) * 3; // 45 (국제 15×3)
  }
  
  return maxScore || 100;
}

// 4. 글로벌 최대값 계산
function calculateGlobalMax(detailedCriteria: any): number {
  const criteria = detailedCriteria?.global_competency || {};
  let maxScore = 0;
  
  // 영어: 모든 시험 중 최대값 1개만 (중복 불가)
  const toeicScores = Object.values(criteria["영어 TOEIC"] || {}) as number[];
  const toeflScores = Object.values(criteria["영어 TOEFL"] || {}) as number[];
  const ieltsScores = Object.values(criteria["영어 IELTS"] || {}) as number[];
  const tepsScores = Object.values(criteria["영어 TEPS"] || {}) as number[];
  
  const englishMax = Math.max(
    toeicScores.length > 0 ? Math.max(...toeicScores) : 0,
    toeflScores.length > 0 ? Math.max(...toeflScores) : 0,
    ieltsScores.length > 0 ? Math.max(...ieltsScores) : 0,
    tepsScores.length > 0 ? Math.max(...tepsScores) : 0
  );
  maxScore += englishMax;
  
  // 일본어: 모든 시험 중 최대값 1개만
  const jlptScores = Object.values(criteria["일본어 JLPT"] || {}) as number[];
  const jptScores = Object.values(criteria["일본어 JPT"] || {}) as number[];
  
  const japaneseMax = Math.max(
    jlptScores.length > 0 ? Math.max(...jlptScores) : 0,
    jptScores.length > 0 ? Math.max(...jptScores) : 0
  );
  maxScore += japaneseMax;
  
  // 중국어: 모든 시험 중 최대값 1개만
  const hskScores = Object.values(criteria["중국어 HSK"] || {}) as number[];
  const tocflScores = Object.values(criteria["중국어 TOCFL"] || {}) as number[];
  
  const chineseMax = Math.max(
    hskScores.length > 0 ? Math.max(...hskScores) : 0,
    tocflScores.length > 0 ? Math.max(...tocflScores) : 0
  );
  maxScore += chineseMax;
  
  return maxScore || 25;
}

// 5. 기술확산 최대값 계산
function calculateKnowledgeMax(detailedCriteria: any): number {
  const criteria = detailedCriteria?.knowledge_sharing || {};
  let maxScore = 0;
  
  // 교육 이수 최대값
  const trainingScores = Object.values(criteria.training || {}) as number[];
  if (trainingScores.length > 0) {
    maxScore += Math.max(...trainingScores); // 5
  }
  
  // 신규 자격증: 무제한, 합리적 상한 (예: 5개)
  const certScores = Object.values(criteria.certifications || {}) as number[];
  if (certScores.length > 0) {
    maxScore += Math.max(...certScores) * 5; // 25
  }
  
  // 멘토링: 무제한, 합리적 상한 (예: 5명)
  const mentoringScores = Object.values(criteria.mentoring || {}) as number[];
  if (mentoringScores.length > 0) {
    maxScore += Math.max(...mentoringScores) * 5; // 15
  }
  
  // 강의 최대값
  const instructorScores = Object.values(criteria.instructor || {}) as number[];
  if (instructorScores.length > 0) {
    maxScore += Math.max(...instructorScores); // 15
  }
  
  return maxScore || 60;
}

// 6. 혁신제안 최대값 계산
function calculateInnovationMax(detailedCriteria: any): number {
  const criteria = detailedCriteria?.innovation_proposal || {};
  let maxScore = 0;
  
  // 포상 최대값 (1개 가정)
  const awardScores = Object.values(criteria.awards || {}) as number[];
  if (awardScores.length > 0) {
    maxScore += Math.max(...awardScores); // 80 (최우수상)
  }
  
  // 채택: 무제한, 합리적 상한 (예: 10건)
  const adoptionScores = Object.values(criteria.adoption || {}) as number[];
  if (adoptionScores.length > 0) {
    maxScore += Math.max(...adoptionScores) * 10; // 50 (채택 5×10)
  }
  
  return maxScore || 100;
}

// 모든 직원의 자동 평가 실행
export async function calculateAllEmployeesRdEvaluation(evaluationYear: number = new Date().getFullYear()) {
  try {
    // 모든 활성 직원 조회
    const employeesQuery = `SELECT id FROM employees WHERE is_active = true`;
    const employeesResult = await storage.query(employeesQuery);
    
    const results = [];
    
    for (const employee of employeesResult.rows) {
      try {
        const evaluation = await calculateAutoRdEvaluation(employee.id, evaluationYear);
        results.push(evaluation);
      } catch (error) {
        console.error(`직원 ${employee.id} 평가 오류:`, error);
      }
    }
    
    return results;
  } catch (error) {
    console.error("전체 직원 평가 오류:", error);
    throw error;
  }
}

// 평가 결과를 DB에 저장
export async function saveRdEvaluationResult(evaluation: any) {
  try {
    const insertQuery = `
      INSERT INTO rd_evaluations (
        employee_id, evaluation_year, evaluation_period,
        technical_competency_score, technical_competency_details,
        project_experience_score, project_experience_details,
        rd_achievement_score, rd_achievement_details,
        global_competency_score, global_competency_details,
        knowledge_sharing_score, knowledge_sharing_details,
        innovation_proposal_score, innovation_proposal_details,
        total_score, grade, status, evaluated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `;
    
    const result = await storage.query(insertQuery, [
      evaluation.employeeId,
      evaluation.evaluationYear,
      'annual',
      evaluation.scores.technicalCompetency,
      evaluation.details.technicalCompetency,
      evaluation.scores.projectExperience,
      evaluation.details.projectExperience,
      evaluation.scores.rdAchievement,
      evaluation.details.rdAchievement,
      evaluation.scores.globalCompetency,
      evaluation.details.globalCompetency,
      evaluation.scores.knowledgeSharing,
      evaluation.details.knowledgeSharing,
      evaluation.scores.innovationProposal,
      evaluation.details.innovationProposal,
      evaluation.totalScore,
      evaluation.grade,
      'auto_calculated',
      'system'
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error("평가 결과 저장 오류:", error);
    throw error;
  }
}
