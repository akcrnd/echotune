import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import OrgChart from "@/pages/orgchart";
import Employees from "@/pages/employees";
import EmployeeDetail from "@/pages/employee-detail";
import DepartmentTeamManagement from "@/pages/department-team-management";
import Training from "@/pages/training";
import TrainingAnalysis from "@/pages/training-analysis";
import Achievements from "@/pages/achievements";
import RdEvaluation from "@/pages/rd-evaluation";
import TeamCompetency from "@/pages/team-competency";
import Reports from "@/pages/reports";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";

function Router() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/orgchart" component={OrgChart} />
            <Route path="/employees" component={Employees} />
            <Route path="/employees/:id" component={EmployeeDetail} />
            <Route path="/departments" component={DepartmentTeamManagement} />
            <Route path="/teams" component={DepartmentTeamManagement} />
            <Route path="/training" component={Training} />
            <Route path="/training-analysis" component={TrainingAnalysis} />
            <Route path="/achievements" component={Achievements} />
            <Route path="/rd-evaluation" component={RdEvaluation} />
            <Route path="/team-competency" component={TeamCompetency} />
            <Route path="/reports" component={Reports} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
