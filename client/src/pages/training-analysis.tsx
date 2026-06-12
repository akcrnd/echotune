import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Users, 
  Clock, 
  TrendingUp, 
  Download, 
  Plus,
  Calendar,
  Target,
  Edit
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import RdEmployeesModal from "@/components/training/rd-employees-modal";

interface TrainingAnalysisResult {
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

interface TrainingHours {
  id: string;
  year: number;
  team: string;
  trainingType: string;
  hours: number;
  description?: string;
}

interface TeamTrainingAnalysisResult {
  team: string;
  totalHours: number;
  employeeCount: number;
  averageHoursPerEmployee: number;
  trainingTypes: Record<string, number>;
  yearlyBreakdown: Record<string, number>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function TrainingAnalysis() {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear);
  const [includeTrainingTypeBreakdown, setIncludeTrainingTypeBreakdown] = useState(true);
  const [includeYearlyBreakdown, setIncludeYearlyBreakdown] = useState(true);
  const [useAutoRdEmployees, setUseAutoRdEmployees] = useState(true);
  const [isRdEmployeesModalOpen, setIsRdEmployeesModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const selectedYears = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => startYear + index);

  // 교육시간 변환 함수
  const convertTrainingToHours = async () => {
    setIsConverting(true);
    try {
      const results = [];

      for (const year of selectedYears) {
        const response = await fetch('/api/convert-training-to-hours', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ year }),
        });

        if (!response.ok) {
          throw new Error(`${year}년 교육시간 변환에 실패했습니다.`);
        }

        results.push(await response.json());
      }

      // 데이터 새로고침
      refetchAnalysis();
      refetchTeamAnalysis();
      refetchTrainingHours();

      const convertedTotal = results.reduce((sum, result) => sum + (result.convertedCount ?? 0), 0);
      alert(`${startYear}년~${endYear}년 교육시간 데이터 ${convertedTotal}개 변환 완료`);
    } catch (error) {
      console.error('교육시간 변환 오류:', error);
      alert('교육시간 변환에 실패했습니다.');
    } finally {
      setIsConverting(false);
    }
  };

  // 팀별 교육시간 분석 데이터 조회
  const { data: teamAnalysisData, isLoading: isLoadingTeamAnalysis, refetch: refetchTeamAnalysis } = useQuery<TeamTrainingAnalysisResult[]>({
    queryKey: ['/api/team-training-analysis', startYear, endYear],
    queryFn: async () => {
      const response = await fetch(`/api/team-training-analysis?startYear=${startYear}&endYear=${endYear}`);
      if (!response.ok) {
        throw new Error('Failed to fetch team training analysis');
      }
      return response.json();
    }
  });

  // 교육 시간 분석 결과 조회
  const { data: analysisResult, isLoading: isLoadingAnalysis, refetch: refetchAnalysis } = useQuery<TrainingAnalysisResult>({
    queryKey: ['/api/training-analysis', startYear, endYear, includeTrainingTypeBreakdown, includeYearlyBreakdown, useAutoRdEmployees],
    queryFn: async () => {
      const params = new URLSearchParams({
        startYear: startYear.toString(),
        endYear: endYear.toString(),
        includeTrainingTypeBreakdown: includeTrainingTypeBreakdown.toString(),
        includeYearlyBreakdown: includeYearlyBreakdown.toString(),
        useAutoRdEmployees: useAutoRdEmployees.toString()
      });
      
      const response = await fetch(`/api/training-analysis?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch training analysis');
      }
      return response.json();
    },
    enabled: false // 수동으로 실행
  });

  // 교육 시간 데이터 조회
  const { data: trainingHours, isLoading: isLoadingTrainingHours, refetch: refetchTrainingHours } = useQuery<TrainingHours[]>({
    queryKey: ['/api/training-hours', startYear, endYear],
    queryFn: async () => {
      const response = await fetch(`/api/training-hours?startYear=${startYear}&endYear=${endYear}`);
      if (!response.ok) {
        throw new Error('Failed to fetch training hours');
      }
      return response.json();
    }
  });


  const handleAnalyze = () => {
    refetchAnalysis();
  };

  const handleExportData = () => {
    // 데이터 내보내기 로직
  };

  if (isLoadingTrainingHours) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-20 bg-muted rounded"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">교육 시간 분석</h1>
          <p className="text-muted-foreground">R&D 교육 시간 분석 및 1인당 평균 교육 시간 계산</p>
        </div>
        <div className="flex space-x-2">
          {useAutoRdEmployees && (
            <Button 
              variant="outline"
              onClick={() => setIsRdEmployeesModalOpen(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              R&D 인원 관리
            </Button>
          )}
          <Button 
            onClick={convertTrainingToHours}
            disabled={isConverting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isConverting ? '변환 중...' : '교육시간 변환'}
          </Button>
          <Button onClick={handleExportData} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            데이터 내보내기
          </Button>
        </div>
      </div>

      {/* 분석 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            분석 설정
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            R&D 인원 자동 계산: 기술연구소 부문에 소속된 모든 직원을 자동으로 포함합니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="startYear">시작 연도</Label>
              <Input
                id="startYear"
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                min="2000"
                max="2030"
              />
            </div>
            <div>
              <Label htmlFor="endYear">종료 연도</Label>
              <Input
                id="endYear"
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value))}
                min="2000"
                max="2030"
              />
            </div>
            <div>
              <Label htmlFor="useAutoRdEmployees">R&D 인원 자동 계산</Label>
              <Select
                value={useAutoRdEmployees.toString()}
                onValueChange={(value) => setUseAutoRdEmployees(value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">자동 계산</SelectItem>
                  <SelectItem value="false">수동 입력</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="includeTrainingTypeBreakdown">교육 유형별 분석</Label>
              <Select
                value={includeTrainingTypeBreakdown.toString()}
                onValueChange={(value) => setIncludeTrainingTypeBreakdown(value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">포함</SelectItem>
                  <SelectItem value="false">제외</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="includeYearlyBreakdown">연도별 분석</Label>
              <Select
                value={includeYearlyBreakdown.toString()}
                onValueChange={(value) => setIncludeYearlyBreakdown(value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">포함</SelectItem>
                  <SelectItem value="false">제외</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleAnalyze} disabled={isLoadingAnalysis}>
              <BarChart3 className="w-4 h-4 mr-2" />
              {isLoadingAnalysis ? '분석 중...' : '분석 실행'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 분석 결과 */}
      {analysisResult && (
        <div className="space-y-6">
          {/* 핵심 지표 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">1인당 평균 교육 시간</p>
                    <p className="text-2xl font-bold">{analysisResult.averageHoursPerPerson}시간</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">총 교육 시간</p>
                    <p className="text-2xl font-bold">{analysisResult.totalHours}시간</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">누적 R&D 인원</p>
                    <p className="text-2xl font-bold">{analysisResult.cumulativeEmployees}명</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">분석 기간</p>
                    <p className="text-2xl font-bold">{analysisResult.period.startYear}-{analysisResult.period.endYear}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 상세 분석 */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">개요</TabsTrigger>
              <TabsTrigger value="teamAnalysis">팀별 분석</TabsTrigger>
              {analysisResult.trainingTypeBreakdown && (
                <TabsTrigger value="trainingType">교육 유형별</TabsTrigger>
              )}
              {analysisResult.yearlyBreakdown && (
                <TabsTrigger value="yearly">연도별</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>분석 결과 요약</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">분석 기간</Label>
                        <p className="text-lg font-semibold">
                          {analysisResult.period.startYear}년 ~ {analysisResult.period.endYear}년
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">총 교육 시간</Label>
                        <p className="text-lg font-semibold">{analysisResult.totalHours}시간</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">누적 R&D 인원</Label>
                        <p className="text-lg font-semibold">{analysisResult.cumulativeEmployees}명</p>
                        {useAutoRdEmployees && (
                          <p className="text-xs text-muted-foreground">기술연구소 부문 자동 계산</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">1인당 평균 교육 시간</Label>
                        <p className="text-lg font-semibold text-blue-600">{analysisResult.averageHoursPerPerson}시간</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teamAnalysis" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>팀별 교육시간 분석</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    각 팀별 총 교육시간, 인원수, 1인당 평균 교육시간을 분석합니다.
                  </p>
                </CardHeader>
                <CardContent>
                  {isLoadingTeamAnalysis ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : teamAnalysisData && teamAnalysisData.length > 0 ? (
                    <div className="space-y-4">
                      {/* 팀별 요약 통계 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {teamAnalysisData.length}
                          </div>
                          <div className="text-sm text-blue-600">분석된 팀 수</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {teamAnalysisData.reduce((sum, team) => sum + team.totalHours, 0).toFixed(1)}시간
                          </div>
                          <div className="text-sm text-green-600">총 교육시간</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {teamAnalysisData.reduce((sum, team) => sum + team.employeeCount, 0)}명
                          </div>
                          <div className="text-sm text-purple-600">총 R&D 인원</div>
                        </div>
                      </div>

                      {/* 팀별 상세 테이블 */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">팀명</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">총 교육시간</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">인원수</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">1인당 평균</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">교육 유형</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {teamAnalysisData.map((team, index) => (
                              <tr key={team.team} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {team.team}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-900">
                                  {team.totalHours}시간
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-900">
                                  {team.employeeCount}명
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-900">
                                  <span className={`font-medium ${team.averageHoursPerEmployee > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                    {team.averageHoursPerEmployee > 0 ? `${team.averageHoursPerEmployee}시간` : '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(team.trainingTypes).map(([type, hours]) => (
                                      <span key={type} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                        {type}: {hours}시간
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 팀별 교육시간 차트 */}
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={teamAnalysisData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="team" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              fontSize={12}
                            />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: number, name: string) => [
                                `${value}시간`,
                                name === 'totalHours' ? '총 교육시간' : '1인당 평균'
                              ]}
                              labelFormatter={(label: string) => `팀: ${label}`}
                            />
                            <Legend />
                            <Bar dataKey="totalHours" fill="#8884d8" name="총 교육시간" />
                            <Bar dataKey="averageHoursPerEmployee" fill="#82ca9d" name="1인당 평균" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>팀별 교육시간 데이터가 없습니다</p>
                        <p className="text-sm">교육 시간 데이터를 추가하면 분석 결과가 표시됩니다</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {analysisResult.trainingTypeBreakdown && (
              <TabsContent value="trainingType" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>교육 유형별 분석</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(analysisResult.trainingTypeBreakdown).map(([type, hours]) => ({
                              name: type,
                              value: hours
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.entries(analysisResult.trainingTypeBreakdown).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value}시간`, '교육 시간']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {analysisResult.yearlyBreakdown && (
              <TabsContent value="yearly" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>연도별 분석</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(analysisResult.yearlyBreakdown).map(([year, data]) => ({
                          year,
                          totalHours: data.totalHours,
                          averageHoursPerPerson: data.averageHoursPerPerson
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="totalHours" fill="#8884d8" name="총 교육 시간" />
                          <Bar dataKey="averageHoursPerPerson" fill="#82ca9d" name="1인당 평균 교육 시간" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {/* 데이터 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>데이터 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <h4 className="font-semibold mb-2">교육 시간 데이터</h4>
              <p className="text-sm text-muted-foreground mb-4">
                현재 {trainingHours?.length || 0}개의 교육 시간 데이터가 있습니다.
              </p>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                교육 시간 추가
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* R&D 인원 관리 모달 */}
      <RdEmployeesModal
        isOpen={isRdEmployeesModalOpen}
        onClose={() => setIsRdEmployeesModalOpen(false)}
        onSave={() => {
          refetchAnalysis();
        }}
      />
    </div>
  );
}
