import { Table } from "lx_client/js/components/Table";
import type { TableColumnDef } from "lx_client/js/components/Table";
import type { FieldModel } from "../../types/semanticLayer";

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function declared(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "not declared";
}

function typeLabel(field: FieldModel): string {
  const reference = field.reference ? `Reference → ${field.reference}` : null;
  if (field.types.length === 0) return reference ?? "not declared";
  const base = field.types.join(" | ");
  const withItem = field.itemType ? `${base} of ${field.itemType}` : base;
  const withFormat = field.format ? `${withItem} (${field.format})` : withItem;
  return reference ? `${withFormat} · ${reference}` : withFormat;
}

function constraints(field: FieldModel): string[] {
  const values: string[] = [];
  if (field.pattern) values.push(`pattern ${field.pattern}`);
  if (field.minLength !== null) values.push(`min length ${field.minLength}`);
  if (field.maxLength !== null) values.push(`max length ${field.maxLength}`);
  if (field.minimum !== null) values.push(`minimum ${field.minimum}`);
  if (field.maximum !== null) values.push(`maximum ${field.maximum}`);
  if (field.declaredMinimum) values.push(`minimum ${field.declaredMinimum}`);
  if (field.declaredMaximum) values.push(`maximum ${field.declaredMaximum}`);
  return values;
}

function vocabulary(field: FieldModel): string {
  if (field.enumValues.length > 0) {
    return `Closed: ${field.enumValues.join(", ")}`;
  }
  if (field.knownValues.length > 0) {
    return `Open (known values): ${field.knownValues.join(", ")}`;
  }
  return "not declared";
}

function unitAndPrecision(field: FieldModel): string {
  const values: string[] = [];
  if (field.unit) values.push(field.unit);
  if (field.precision !== null) values.push(`precision ${field.precision}`);
  if (field.scale !== null) values.push(`scale ${field.scale}`);
  return values.length > 0 ? values.join(" · ") : "not declared";
}

interface FieldRow {
  name: string;
  description: string | null;
  type: string;
  required: string;
  nullable: string;
  writable: string;
  aggregates: string;
  constraints: string[];
  vocabulary: string;
  unitAndPrecision: string;
}

function toRow(field: FieldModel): FieldRow {
  return {
    name: field.name,
    description: field.description,
    type: typeLabel(field),
    required: yesNo(field.required),
    nullable: yesNo(field.nullable),
    writable: field.writable === null ? "not declared" : yesNo(field.writable),
    aggregates:
      field.aggregates.length > 0
        ? field.aggregates.join(", ")
        : "not declared",
    constraints: constraints(field),
    vocabulary: vocabulary(field),
    unitAndPrecision: unitAndPrecision(field),
  };
}

function tableKeyFor(caption: string): string {
  return `semantic-layer-fields-${caption
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

/** Props for the field table. */
export interface FieldTableProps {
  fields: FieldModel[];
  caption: string;
}

/**
 * Renders every declared field and its semantics with the shared lx_client
 * data-grid component so the application does not define a competing table
 * primitive.
 */
export function FieldTable({ fields, caption }: FieldTableProps) {
  if (fields.length === 0) {
    return <p className="obolargus_semantic_muted">No fields declared.</p>;
  }

  const rows = fields.map(toRow);
  const columns: TableColumnDef<FieldRow>[] = [
    {
      id: "field",
      accessorKey: "name",
      header: "Field",
      cell: ({ row }) => (
        <div>
          <span className="obolargus_semantic_field_name">
            {row.original.name}
          </span>
          <span className="obolargus_semantic_field_description">
            {declared(row.original.description)}
          </span>
        </div>
      ),
    },
    { id: "type", accessorKey: "type", header: "Type" },
    { id: "required", accessorKey: "required", header: "Required" },
    { id: "nullable", accessorKey: "nullable", header: "Nullable" },
    { id: "writable", accessorKey: "writable", header: "Writable" },
    { id: "aggregates", accessorKey: "aggregates", header: "Aggregates" },
    {
      id: "constraints",
      accessorFn: (row) => row.constraints.join(" "),
      header: "Constraints",
      cell: ({ row }) =>
        row.original.constraints.length > 0 ? (
          <ul className="obolargus_semantic_inline_list">
            {row.original.constraints.map((constraint) => (
              <li key={constraint}>
                <code>{constraint}</code>
              </li>
            ))}
          </ul>
        ) : (
          "not declared"
        ),
    },
    { id: "vocabulary", accessorKey: "vocabulary", header: "Vocabulary" },
    {
      id: "unitAndPrecision",
      accessorKey: "unitAndPrecision",
      header: "Unit and precision",
    },
  ];

  return (
    <section className="obolargus_semantic_field_table" aria-label={caption}>
      <Table
        tableKey={tableKeyFor(caption)}
        aria-label={caption}
        columns={columns}
        data={rows}
        enableSorting
        enableFiltering
        enablePagination={false}
        enableRowSelection={false}
        enableColumnCustomization={false}
        enableGrouping={false}
        pageSize={Math.max(fields.length, 1)}
      />
    </section>
  );
}

export default FieldTable;
