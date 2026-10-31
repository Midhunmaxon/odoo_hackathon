import { Knex } from 'knex';
import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Extracts and normalizes pagination & sorting parameters from an Express Request query.
 * Standard query parameters: ?page=&limit=&sort= (e.g. ?sort=created_at:desc or ?sort=name:asc)
 */
export function extractPaginationParams(
  req: Request,
  defaultLimit: number = 10,
  defaultSort: string = 'id:desc'
): PaginationParams {
  const pageRaw = parseInt(req.query.page as string, 10);
  const limitRaw = parseInt(req.query.limit as string, 10);

  const page = !isNaN(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = !isNaN(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : defaultLimit;

  const sortParam = (req.query.sort as string) || defaultSort;
  const [sortField, rawDir] = sortParam.split(':');
  const sortDirection: 'asc' | 'desc' = rawDir?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    sortField: sortField || 'id',
    sortDirection,
  };
}

/**
 * Executes a paginated Knex query builder and returns the standard { data, page, limit, total } format.
 */
export async function paginateKnexQuery<T>(
  query: Knex.QueryBuilder,
  params: PaginationParams
): Promise<PaginatedResponse<T>> {
  const { page, limit, sortField, sortDirection } = params;
  const offset = (page - 1) * limit;

  // Clone query to count total records
  const countResult = await query
    .clone()
    .clearSelect()
    .clearOrder()
    .count<{ count: string | number }[]>('* as count')
    .first();

  const total = countResult ? Number(countResult.count) : 0;

  // Apply sorting and pagination
  let dataQuery = query.clone();
  if (sortField) {
    dataQuery = dataQuery.orderBy(sortField, sortDirection);
  }

  const data = await dataQuery.offset(offset).limit(limit);

  return {
    data: data as T[],
    page,
    limit,
    total,
  };
}

/**
 * In-memory array pagination helper, useful for mock data or unit test responses.
 */
export function paginateArray<T>(
  items: T[],
  params: PaginationParams
): PaginatedResponse<T> {
  const { page, limit, sortField, sortDirection } = params;

  let sorted = [...items];
  if (sortField) {
    sorted.sort((a: any, b: any) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const total = sorted.length;
  const offset = (page - 1) * limit;
  const data = sorted.slice(offset, offset + limit);

  return {
    data,
    page,
    limit,
    total,
  };
}
