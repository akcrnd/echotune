import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  Table,
  Trophy,
  User,
  Users,
} from "lucide-react";

const navigation = [
  { name: "대시보드", href: "/dashboard", icon: LayoutDashboard },
  { name: "조직도", href: "/orgchart", icon: Table },
  { name: "직원 관리", href: "/employees", icon: Users },
  { name: "교육 관리", href: "/training", icon: BookOpen },
  { name: "성과관리", href: "/achievements", icon: Trophy },
  { name: "R&D 역량평가", href: "/rd-evaluation", icon: Award },
  { name: "팀 적격성 관리", href: "/team-competency", icon: ClipboardCheck },
  { name: "보고서", href: "/reports", icon: BarChart3 },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">Ashimori</h1>
        <p className="text-sm text-muted-foreground">교육 이력 관리 시스템</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
          const Icon = item.icon;

          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "flex items-center px-4 py-2 text-sm rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="w-4 h-4 mr-3" />
                {item.name}
              </a>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border" data-testid="user-profile">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
            <User className="w-4 h-4" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">관리자</p>
            <p className="text-xs text-muted-foreground">시스템 관리자</p>
          </div>
        </div>
      </div>
    </div>
  );
}
