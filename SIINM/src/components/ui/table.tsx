import * as React from "react";
import {
  useTable,
  tableFeatures,
  rowPaginationFeature,
  createPaginatedRowModel,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-gray-400", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-slate-100/50 font-medium [&>tr]:last:border-b-0 dark:bg-slate-800/50",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors  data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-slate-500 has-[[role=checkbox]]:pr-0 dark:text-slate-400",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle has-[[role=checkbox]]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-slate-500 dark:text-slate-400", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

// Características de paginación para @tanstack/react-table v9 (useTable)
export const paginationFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

/**
 * Hook reutilizable basado en `useTable` de @tanstack/react-table v9
 * para paginar cualquier arreglo de datos en las tablas del sistema.
 */
export function usePaginatedTable<TData extends RowData>(
  data: ReadonlyArray<TData>,
  initialPageSize = 5,
  customColumns?: ColumnDef<typeof paginationFeatures, TData, unknown>[],
) {
  const columns = React.useMemo<
    ColumnDef<typeof paginationFeatures, TData, unknown>[]
  >(
    () =>
      customColumns ?? [
        {
          id: "item",
          accessorFn: (row: TData) => row,
        },
      ],
    [customColumns],
  );

  const table = useTable(
    {
      features: paginationFeatures,
      data,
      columns,
      initialState: {
        pagination: {
          pageIndex: 0,
          pageSize: initialPageSize,
        },
      },
      autoResetPageIndex: true,
    },
    (state) => ({
      pagination: state.pagination,
    }),
  );

  const pageCount = table.getPageCount();
  const pageIndex = table.state.pagination.pageIndex;

  // Asegurar que el índice de página sea válido cuando se filtra la lista
  React.useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      table.setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [pageCount, pageIndex, table]);

  const paginatedRows = table.getRowModel().rows;
  const paginatedData: TData[] = paginatedRows.map((row) => row.original);

  return {
    table,
    paginatedRows,
    paginatedData,
  };
}

export interface TablePaginationProps<TData extends RowData = RowData> {
  table: ReturnType<typeof usePaginatedTable<TData>>["table"];
  pageSizeOptions?: number[];
  className?: string;
}

/**
 * Barra de controles de paginación conectada a la instancia de `useTable` (@tanstack/react-table)
 */
function TablePagination<TData extends RowData>({
  table,
  pageSizeOptions = [5, 10, 20, 50],
  className,
}: TablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.state.pagination;
  const totalRows = table.getRowCount();
  const pageCount = Math.max(1, table.getPageCount());

  const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  // Generar números de página visibles alrededor de la página actual
  const visiblePages = React.useMemo(() => {
    const maxButtons = 5;
    if (pageCount <= maxButtons) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(0, pageIndex - half);
    const end = Math.min(pageCount - 1, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(0, end - maxButtons + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pageCount, pageIndex]);

  if (totalRows === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 bg-slate-50/60 text-xs text-slate-600",
        className,
      )}
    >
      {/* Indicador de registros mostrados */}
      <div className="flex items-center gap-4 flex-wrap">
        <span>
          Mostrando{" "}
          <strong className="font-bold text-slate-800">{startRow}</strong> -{" "}
          <strong className="font-bold text-slate-800">{endRow}</strong> de{" "}
          <strong className="font-bold text-slate-800">{totalRows}</strong>{" "}
          registros
        </span>

        {/* Selector de filas por página */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Filas por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Controles de navegación de páginas */}
      <div className="flex items-center justify-end gap-1">
        <span className="mr-2 text-slate-500 hidden md:inline">
          Página{" "}
          <strong className="font-bold text-slate-700">{pageIndex + 1}</strong>{" "}
          de <strong className="font-bold text-slate-700">{pageCount}</strong>
        </span>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 border-slate-200"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          title="Primera página"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 border-slate-200"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          title="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        {visiblePages.map((idx) => (
          <Button
            key={idx}
            type="button"
            variant={idx === pageIndex ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 min-w-7 px-2 text-xs font-bold",
              idx !== pageIndex && "border-slate-200 text-slate-700",
            )}
            onClick={() => table.setPageIndex(idx)}
          >
            {idx + 1}
          </Button>
        ))}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 border-slate-200"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          title="Página siguiente"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 border-slate-200"
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          title="Última página"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TablePagination,
};
