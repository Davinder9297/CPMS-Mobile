import { apiRequest } from '@/services/api/client';

// One rating level within a category (e.g. "4 - Exceeds"); count is null when no
// votes landed at that level (the screen renders null as "-").
export interface ThreeSixtyLevel {
  label: string;
  count: number | null;
}

export interface ThreeSixtyFlightCategory {
  id: string;
  title: string;
  avg: number;
  levels: ThreeSixtyLevel[];
}

// One flight the crew member was rated on (Flight Level view).
export interface ThreeSixtyFlight {
  id: string;
  date: string | null;
  flightCode: string;
  avgRating: number;
  totalVotes: number;
  categories: ThreeSixtyFlightCategory[];
}

// One category in the Trend view — the crew member's YTD numbers alongside the
// org-wide (OV) numbers.
export interface ThreeSixtyTrendCategory {
  id: string;
  title: string;
  yourAvg: number;
  yourVotes: number;
  totalFlights: number;
  ovAvg: number;
  totalCrew: number;
  totalVotes: number;
}

export interface ThreeSixtyChartSeries {
  id: string;
  label: string;
  data: (number | null)[];
}

// Full "View My 360 Rating" payload for the mobile screen.
export interface MyThreeSixty {
  year: number;
  categories: { id: string; title: string }[];
  flights: ThreeSixtyFlight[];
  trend: {
    overall: Omit<ThreeSixtyTrendCategory, 'id' | 'title'>;
    categories: ThreeSixtyTrendCategory[];
    chart: { months: string[]; series: ThreeSixtyChartSeries[] };
  };
}

// The logged-in crew member's 360 view for the given year (defaults server-side
// to the current year). staffId is resolved from the JWT.
export function getMyThreeSixty(year?: number): Promise<MyThreeSixty> {
  const qs = year ? `?year=${year}` : '';
  return apiRequest<MyThreeSixty>(`/crew/my-360-feedback${qs}`);
}

// --- Give 360 Feedback -------------------------------------------------------

export interface Give360Task {
  taskId: string;
  code: string;
  route: string;
  title: string;
  dated: string | null;
  dueDate: string | null;
  submittedOn: string | null;
  status: 'pending' | 'submitted';
}

export interface Give360Kpi {
  id: string;
  name: string;
  rating: number | null;
}

export interface Give360Crew {
  staffId: string;
  name: string;
  grade: string;
  comments: string;
  kpis: Give360Kpi[];
}

export interface Give360Detail {
  taskId: string;
  code: string;
  route: string;
  dated: string | null;
  dueDate: string | null;
  status: 'pending' | 'submitted';
  scale: { rating: number; label: string }[];
  crew: Give360Crew[];
}

export interface Give360Rating {
  staffId: string;
  kpiId: string;
  rating: number;
}

// 360_FEEDBACK tasks owned by the logged-in crew member (one per flight).
export function getGive360Tasks(): Promise<Give360Task[]> {
  return apiRequest<Give360Task[]>('/crew/my-360-feedback/tasks');
}

// The crew to rate on a flight and the KPIs each must be rated on.
export function getGive360Task(taskId: string): Promise<Give360Detail> {
  return apiRequest<Give360Detail>(`/crew/my-360-feedback/tasks/${encodeURIComponent(taskId)}`);
}

// Saves all ratings and closes the task. The server rejects (400
// FEEDBACK_INCOMPLETE) unless every KPI of every crew member is rated.
export function submitGive360(
  taskId: string,
  ratings: Give360Rating[],
  comments: { staffId: string; comments: string }[]
): Promise<{ taskId: string; ratingsSaved: number; status: string }> {
  return apiRequest(`/crew/my-360-feedback/tasks/${encodeURIComponent(taskId)}/submit`, {
    method: 'POST',
    body: { ratings, comments },
  });
}
