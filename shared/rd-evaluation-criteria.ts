// R&D 역량평가 기준 타입 정의 (하드코딩된 기본값은 제거됨)
// 실제 기준은 런타임 저장소(app settings)에서 관리됨

export interface RdEvaluationCriteria {
  id: string;
  category: string;
  name: string;
  description: string;
  weight: number; // 가중치 (0-1)
  maxScore: number; // 최대 점수
  scoringMethod: 'auto' | 'manual' | 'hybrid';
  rules: EvaluationRule[];
  isActive: boolean;
}

export interface EvaluationRule {
  id: string;
  name: string;
  description: string;
  condition: string; // SQL 조건 또는 JavaScript 표현식
  score: number; // 부여할 점수
  dataSource: string; // 데이터 소스 테이블
  dataField: string; // 데이터 필드
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'count' | 'sum';
  value?: any; // 비교값
  maxScore?: number; // 최대 점수 (count, sum 연산용)
}

// 하드코딩된 기본값은 제거됨 - 런타임 저장소의 detailedCriteria 사용
export const RD_EVALUATION_CRITERIA: RdEvaluationCriteria[] = [];

// 이 파일의 함수들은 더 이상 사용되지 않음
// 실제 점수 계산은 server/rd-evaluation-auto.ts에서 런타임 저장소의 detailedCriteria를 사용
