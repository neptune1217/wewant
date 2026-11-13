/**
 * 목록 표가 쓰는 TanStack Table v9 기능 묶음 (정렬, 전체 검색, 항목별 필터)
 * v9는 쓸 기능을 미리 등록해야 한다. 모든 목록 표가 이 묶음을 함께 쓴다.
 */
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";

export const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
});

export type DataTableFeatures = typeof features;

/** 목록 표의 열 정의 타입 */
export type DataColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;
