export interface AdminStatsResponse {
  totalUsers: number;
  totalProfiles: number;
  newUsersToday: number;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
    createdAt: string;
  }>;
}
