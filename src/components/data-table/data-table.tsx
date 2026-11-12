"use client";

/**
 * 공통 목록 표 — 검색창, 선택 필터, 열 머리글 클릭 정렬, 건수 표시.
 * 데이터는 서버 화면(page)이 권한 확인 후 읽어서 넘긴다. 이 부품은 화면 안에서만 거른다.
 */
import { useState, type ReactNode } from "react";
import {
  useTable,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { features, type DataColumn } from "./data-table-features";

/** 선택 필터 정의. value가 ALL이면 거르지 않는다. 열에는 filterFn: "equalsString"을 준다 */
export type SelectFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
  /** 처음 선택값 (예: 활성만 보기) */
  defaultValue?: string;
};

export const ALL = "__all__";

export function DataTable<TData extends RowData>({
  columns,
  data,
  searchPlaceholder = "검색",
  filters = [],
  toolbar,
  emptyMessage = "표시할 항목이 없습니다.",
}: {
  columns: DataColumn<TData>[];
  data: TData[];
  searchPlaceholder?: string;
  filters?: SelectFilter[];
  /** 오른쪽 위 버튼 자리 (예: 등록) */
  toolbar?: ReactNode;
  emptyMessage?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() =>
    filters
      .filter((f) => f.defaultValue && f.defaultValue !== ALL)
      .map((f) => ({ id: f.columnId, value: f.defaultValue })),
  );

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;

  const filterValue = (columnId: string) =>
    (columnFilters.find((f) => f.id === columnId)?.value as string | undefined) ?? ALL;
  const setFilter = (columnId: string, value: string) =>
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== columnId),
      ...(value === ALL ? [] : [{ id: columnId, value }]),
    ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="검색"
          className="w-full sm:w-64"
        />
        {filters.map((f) => (
          <Select
            key={f.columnId}
            value={filterValue(f.columnId)}
            onValueChange={(v) => setFilter(f.columnId, v)}
          >
            <SelectTrigger aria-label={f.label} className="w-full sm:w-40">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{f.label}: 전체</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {f.label}: {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <span className="text-sm text-muted-foreground">{rows.length}건</span>
        {toolbar && <div className="ml-auto flex gap-2">{toolbar}</div>}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-20 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
