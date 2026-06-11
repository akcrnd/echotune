import { Button } from "@/components/ui/button";
import { Download, Wifi } from "lucide-react";
import { useLocation } from "wouter";

const pageInfo = {
  "/": { title: "종합 대시보드", description: "전사 교육 이력 및 역량 현황" },
  "/dashboard": { title: "종합 대시보드", description: "전사 교육 이력 및 역량 현황" },
  "/orgchart": { title: "조직도", description: "인터랙티브 조직도 및 직원 정보" },
  "/employees": { title: "직원 관리", description: "직원 정보 및 역량 관리" },
  "/training": { title: "교육 관리", description: "교육 과정 및 이수 현황 관리" },
  "/achievements": { title: "성과관리", description: "특허, 논문, 수상 등 성과 이력" },
  "/rd-evaluation": { title: "R&D 역량평가", description: "R&D 역량 평가 및 분석" },
  "/team-competency": { title: "팀 적격성 관리", description: "팀별 조직, 업무, 요구기준, 자격 현황 관리" },
  "/reports": { title: "보고서 및 분석", description: "교육 및 역량 현황 분석" },
};

export default function TopBar() {
  const [location] = useLocation();
  const currentPage = pageInfo[location as keyof typeof pageInfo] || pageInfo["/"];

  const handleExportData = () => {
    // Export behavior is implemented per reporting page.
  };

  return (
    <div className="bg-card border-b border-border px-6 py-4" data-testid="topbar">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="page-title">
            {currentPage.title}
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="page-description">
            {currentPage.description}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleExportData} data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            데이터 내보내기
          </Button>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <Wifi className="w-4 h-4" />
              <span>Google Sheets 연결됨</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
