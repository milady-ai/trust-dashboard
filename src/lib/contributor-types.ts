export interface ContributorEvent {
  type: string;
  timestamp: number;
  linesChanged: number;
  labels: string[];
  prNumber: number;
  prTitle?: string;
}

export interface ContributorProfile {
  username: string;
  avatarUrl: string;
  totalApprovals: number;
  totalRejections: number;
  totalCloses: number;
  totalSelfCloses: number;
  lastEventAt: string | null;
  firstSeenAt: string;
  events: ContributorEvent[];
}
