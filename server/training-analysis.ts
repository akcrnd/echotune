import type { TrainingHours, TeamEmployees, Employee } from "@shared/schema";

export interface TrainingAnalysisResult {
  averageHoursPerPerson: number;
  totalHours: number;
  cumulativeEmployees: number;
  period: {
    startYear: number;
    endYear: number;
  };
  trainingTypeBreakdown?: {
    [trainingType: string]: number;
  };
  yearlyBreakdown?: {
    [year: string]: {
      totalHours: number;
      totalEmployees: number;
      averageHoursPerPerson: number;
    };
  };
}

export interface TrainingAnalysisOptions {
  startYear: number;
  endYear: number;
  includeTrainingTypeBreakdown?: boolean;
  includeYearlyBreakdown?: boolean;
  useAutoRdEmployees?: boolean; // R&D 인원 자동 계산 사용 여부
}

export class TrainingAnalysisModule {
  /**
   * 교육 시간 분석의 핵심 로직
   * 지정된 기간의 교육 시간과 인원 데이터를 기반으로 1인당 평균 교육 시간을 계산합니다.
   */
  static async analyzeTrainingHours(
    trainingHoursData: TrainingHours[],
    teamEmployeesData: TeamEmployees[],
    options: TrainingAnalysisOptions,
    allEmployees?: Employee[] // 전체 직원 데이터 (R&D 인원 자동 계산용)
  ): Promise<TrainingAnalysisResult> {
    const { startYear, endYear, includeTrainingTypeBreakdown = false, includeYearlyBreakdown = false, useAutoRdEmployees = false } = options;

    // 1. 총 교육 시간 계산
    const totalHours = this.calculateTotalTrainingHours(trainingHoursData, startYear, endYear);

    // 2. 누적 R&D 인원 계산
    let cumulativeEmployees: number;
    if (useAutoRdEmployees && allEmployees) {
      cumulativeEmployees = this.calculateAutoRdEmployees(allEmployees, startYear, endYear);
    } else {
      cumulativeEmployees = this.calculateCumulativeEmployees(teamEmployeesData, startYear, endYear);
    }

    // 3. 1인당 평균 교육 시간 계산
    const averageHoursPerPerson = cumulativeEmployees > 0 ? totalHours / cumulativeEmployees : 0;

    const result: TrainingAnalysisResult = {
      averageHoursPerPerson: Math.round(averageHoursPerPerson * 100) / 100, // 소수점 둘째 자리까지
      totalHours: Math.round(totalHours * 10) / 10, // 소수점 첫째 자리까지
      cumulativeEmployees,
      period: {
        startYear,
        endYear
      }
    };

    // 4. 부가 기능: 교육 유형별 총 시간 계산
    if (includeTrainingTypeBreakdown) {
      result.trainingTypeBreakdown = this.calculateTrainingTypeBreakdown(trainingHoursData, startYear, endYear);
    }

    // 5. 부가 기능: 연도별 분석
    if (includeYearlyBreakdown) {
      result.yearlyBreakdown =
        useAutoRdEmployees && allEmployees
          ? this.calculateYearlyBreakdownWithAutoEmployees(trainingHoursData, allEmployees, startYear, endYear)
          : this.calculateYearlyBreakdown(trainingHoursData, teamEmployeesData, startYear, endYear);
    }

    return result;
  }

  /**
   * ① 총 교육 시간 계산
   * 지정된 기간 내의 모든 교육 시간 데이터를 조회하고 합계를 계산합니다.
   */
  private static calculateTotalTrainingHours(
    trainingHoursData: TrainingHours[],
    startYear: number,
    endYear: number
  ): number {
    return trainingHoursData
      .filter(th => th.year >= startYear && th.year <= endYear)
      .reduce((sum, th) => sum + th.hours, 0);
  }

  /**
   * ② 누적 R&D 인원 계산
   * 지정된 기간 내의 모든 인원 데이터를 조회하고 합계를 계산합니다.
   */
  private static calculateCumulativeEmployees(
    teamEmployeesData: TeamEmployees[],
    startYear: number,
    endYear: number
  ): number {
    return teamEmployeesData
      .filter(te => te.year >= startYear && te.year <= endYear)
      .reduce((sum, te) => sum + te.employeeCount, 0);
  }

  /**
   * 교육 유형별 총 시간 계산 (부가 기능)
   */
  private static calculateTrainingTypeBreakdown(
    trainingHoursData: TrainingHours[],
    startYear: number,
    endYear: number
  ): { [trainingType: string]: number } {
    const breakdown: { [trainingType: string]: number } = {};
    
    trainingHoursData
      .filter(th => th.year >= startYear && th.year <= endYear)
      .forEach(th => {
        if (!breakdown[th.trainingType]) {
          breakdown[th.trainingType] = 0;
        }
        breakdown[th.trainingType] += th.hours;
      });

    return breakdown;
  }

  /**
   * 연도별 분석 (부가 기능)
   */
  private static calculateYearlyBreakdown(
    trainingHoursData: TrainingHours[],
    teamEmployeesData: TeamEmployees[],
    startYear: number,
    endYear: number
  ): { [year: string]: { totalHours: number; totalEmployees: number; averageHoursPerPerson: number } } {
    const breakdown: { [year: string]: { totalHours: number; totalEmployees: number; averageHoursPerPerson: number } } = {};

    for (let year = startYear; year <= endYear; year++) {
      const yearTrainingHours = trainingHoursData
        .filter(th => th.year === year)
        .reduce((sum, th) => sum + th.hours, 0);

      const yearEmployees = teamEmployeesData
        .filter(te => te.year === year)
        .reduce((sum, te) => sum + te.employeeCount, 0);

      const yearAverage = yearEmployees > 0 ? yearTrainingHours / yearEmployees : 0;

      breakdown[year.toString()] = {
        totalHours: Math.round(yearTrainingHours * 10) / 10,
        totalEmployees: yearEmployees,
        averageHoursPerPerson: Math.round(yearAverage * 100) / 100
      };
    }

    return breakdown;
  }

  private static calculateYearlyBreakdownWithAutoEmployees(
    trainingHoursData: TrainingHours[],
    allEmployees: Employee[],
    startYear: number,
    endYear: number
  ): { [year: string]: { totalHours: number; totalEmployees: number; averageHoursPerPerson: number } } {
    const breakdown: { [year: string]: { totalHours: number; totalEmployees: number; averageHoursPerPerson: number } } = {};

    for (let year = startYear; year <= endYear; year++) {
      const yearTrainingHours = trainingHoursData
        .filter(th => th.year === year)
        .reduce((sum, th) => sum + th.hours, 0);

      const yearEmployees = this.calculateAutoRdEmployeesByYear(allEmployees, year);
      const yearAverage = yearEmployees > 0 ? yearTrainingHours / yearEmployees : 0;

      breakdown[year.toString()] = {
        totalHours: Math.round(yearTrainingHours * 10) / 10,
        totalEmployees: yearEmployees,
        averageHoursPerPerson: Math.round(yearAverage * 100) / 100
      };
    }

    return breakdown;
  }

  /**
   * 특정 교육 유형의 총 시간 계산 (부가 기능)
   */
  static calculateTrainingHoursByType(
    trainingHoursData: TrainingHours[],
    trainingType: string,
    startYear: number,
    endYear: number
  ): number {
    return trainingHoursData
      .filter(th => 
        th.year >= startYear && 
        th.year <= endYear && 
        th.trainingType === trainingType
      )
      .reduce((sum, th) => sum + th.hours, 0);
  }

  /**
   * 특정 연도의 총 인원 조회 (부가 기능)
   */
  static getTotalEmployeesByYear(
    teamEmployeesData: TeamEmployees[],
    year: number
  ): number {
    return teamEmployeesData
      .filter(te => te.year === year)
      .reduce((sum, te) => sum + te.employeeCount, 0);
  }

  /**
   * R&D 인원 자동 계산 (기술연구소 부문 소속 직원)
   */
  private static calculateAutoRdEmployees(
    allEmployees: Employee[],
    startYear: number,
    endYear: number
  ): number {
    let cumulativeEmployees = 0;

    for (let year = startYear; year <= endYear; year++) {
      cumulativeEmployees += this.calculateAutoRdEmployeesByYear(allEmployees, year);
    }

    return cumulativeEmployees;
  }

  /**
   * 연도별 R&D 인원 자동 계산 (부가 기능)
   */
  static calculateAutoRdEmployeesByYear(
    allEmployees: Employee[],
    year: number
  ): number {
    const rdEmployees = allEmployees.filter(employee => {
      const hireYear = employee.hireDate ? new Date(employee.hireDate).getFullYear() : null;
      const isActiveInYear = !hireYear || hireYear <= year;
      
      return this.isRdEmployee(employee) && isActiveInYear;
    });

    return rdEmployees.length;
  }

  private static isRdEmployee(employee: Pick<Employee, "department" | "departmentCode" | "team">): boolean {
    const department = (employee.department ?? "").toUpperCase();
    const departmentCode = (employee.departmentCode ?? "").toUpperCase();
    const team = (employee.team ?? "").toUpperCase();

    return (
      department.includes("기술연구소") ||
      department.includes("연구개발") ||
      department.includes("연구") ||
      department.includes("R&D") ||
      department.includes("RND") ||
      departmentCode === "RD" ||
      departmentCode === "RND" ||
      team.includes("연구") ||
      team.includes("개발") ||
      team.includes("R&D") ||
      team.includes("RND")
    );
  }
}
