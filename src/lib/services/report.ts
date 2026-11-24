import { apiFetch } from './api';
import type { GeneralReport, OccupancyReport, ReportPeriod } from '$lib/types/report';

export type OccupancyQuery = { period: ReportPeriod } | { from: string; to: string };

export const reportService = {
  occupancy(query: OccupancyQuery): Promise<OccupancyReport> {
    const params =
      'period' in query
        ? new URLSearchParams({ periodo: query.period })
        : new URLSearchParams({ desde: query.from, hasta: query.to });
    return apiFetch<OccupancyReport>(`/reportes/ocupacion?${params.toString()}`);
  },

  general(period: ReportPeriod): Promise<GeneralReport> {
    return apiFetch<GeneralReport>(`/reportes/general?periodo=${period}`);
  }
};
