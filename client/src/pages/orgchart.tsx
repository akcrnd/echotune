import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import D3OrgChart from "@/components/orgchart/d3-org-chart";
import EmployeePanel from "@/components/orgchart/employee-panel";
import type { Employee } from "@shared/schema";

export default function OrgChart() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const { data: employees = [], isLoading, error, refetch } = useQuery<Employee[]>({
    queryKey: ["/api/employees"]
  });

  // 비활성 직원 필터링
  const activeEmployees = employees?.filter(employee => employee.isActive !== false) || [];
  const isEmptyOrgPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("emptyOrgPreview") === "1";
  const chartEmployees = isEmptyOrgPreview ? [] : activeEmployees;

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
  };

  const handleClosePanel = () => {
    setSelectedEmployeeId(null);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const handleFitToScreen = () => {
    setZoomLevel(100);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };


  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="text-lg font-medium mb-2">조직도 로딩 중...</h3>
          <p className="text-sm text-muted-foreground">직원 데이터를 불러오고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="max-w-md text-center">
          <h3 className="text-lg font-medium mb-2">조직도 데이터를 불러오지 못했습니다</h3>
          <p className="text-sm text-muted-foreground mb-4">
            직원 API 응답을 확인한 뒤 다시 시도해 주세요.
          </p>
          <Button onClick={() => refetch()} data-testid="button-retry-orgchart">
            다시 불러오기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" data-testid="orgchart-page">
      <div className="flex-1 relative">
        {/* Top Controls Bar */}
        <div className="absolute top-4 left-4 right-4 z-10 bg-card border border-border rounded-lg p-3 shadow-lg">
          <div className="flex items-center justify-between">
            {/* Left: Search and Zoom Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="직원 검색..."
                    className="pl-10 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-employee-search"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearSearch}
                  data-testid="button-clear-search"
                >
                  초기화
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleZoomOut}
                  data-testid="button-zoom-out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center" data-testid="text-zoom-level">
                  {zoomLevel}%
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleZoomIn}
                  data-testid="button-zoom-in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleFitToScreen}
                  data-testid="button-fit-screen"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  화면 맞춤
                </Button>
              </div>
            </div>

          </div>
        </div>


        {/* Org Chart */}
        <D3OrgChart
          employees={chartEmployees}
          searchTerm={searchTerm}
          zoomLevel={zoomLevel}
          onEmployeeSelect={handleEmployeeSelect}
        />
      </div>

      {/* Employee Detail Panel */}
      {selectedEmployeeId && (
        <EmployeePanel
          employeeId={selectedEmployeeId}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
