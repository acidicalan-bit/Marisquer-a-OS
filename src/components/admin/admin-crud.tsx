"use client";

import Image from "next/image";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { label: string; value: string };
export type AdminField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "file"
    | "email"
    | "password";
  options?: Option[];
  required?: boolean;
  step?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  currentName?: string;
};

export type AdminRecord = Record<string, string | number | boolean | null> & {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string | null;
};

type ServerAction = (formData: FormData) => void | Promise<void>;

export function AdminCrud({
  title,
  description,
  createLabel,
  emptyLabel,
  fields,
  records,
  saveAction,
  deleteAction,
  deleteLabel = "Archivar",
}: {
  title: string;
  description: string;
  createLabel: string;
  emptyLabel: string;
  fields: AdminField[];
  records: AdminRecord[];
  saveAction: ServerAction;
  deleteAction?: ServerAction;
  deleteLabel?: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_-35px_rgba(7,45,59,.35)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
        <EntityDialog label={createLabel} fields={fields} action={saveAction} />
      </div>

      {records.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 xl:grid-cols-2">
          {records.map((record) => (
            <article
              key={record.id}
              className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-teal-100 hover:shadow-lg hover:shadow-teal-950/5"
            >
              {record.image_url ? (
                <Image
                  src={record.image_url}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 rounded-xl object-cover ring-1 ring-slate-100"
                />
              ) : (
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-50 to-amber-50 text-lg font-semibold text-teal-800">
                  {record.title.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {record.title}
                </p>
                {record.subtitle && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {record.subtitle}
                  </p>
                )}
              </div>
              <div className="flex gap-1 opacity-70 transition group-hover:opacity-100">
                <EntityDialog
                  label="Editar"
                  fields={fields}
                  action={saveAction}
                  record={record}
                  compact
                />
                {deleteAction && (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={record.id} />
                    <Button
                      type="submit"
                      size="icon"
                      variant="ghost"
                      title={deleteLabel}
                      className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EntityDialog({
  label,
  fields,
  action,
  record,
  compact,
}: {
  label: string;
  fields: AdminField[];
  action: ServerAction;
  record?: AdminRecord;
  compact?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button size="icon" variant="ghost" title={label}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button className="rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-teal-950">
            <Plus className="size-4" /> {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl border-white/70 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{record ? `Editar ${record.title}` : label}</DialogTitle>
          <DialogDescription>
            Los cambios se guardan en la sucursal activa y quedan registrados.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4 pt-2 sm:grid-cols-2">
          <input type="hidden" name="id" value={record?.id ?? ""} />
          {fields.map((field) => (
            <AdminInput key={field.name} field={field} record={record} />
          ))}
          <div className="flex justify-end pt-2 sm:col-span-2">
            <Button
              type="submit"
              className="min-w-32 rounded-xl bg-teal-900 hover:bg-teal-800"
            >
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminInput({
  field,
  record,
}: {
  field: AdminField;
  record?: AdminRecord;
}) {
  const existing = record?.[field.name] ?? field.defaultValue ?? "";
  const wide = field.type === "textarea" || field.type === "file";
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-3 py-3 text-sm sm:self-end">
        <input
          type="checkbox"
          name={field.name}
          defaultChecked={Boolean(existing)}
          className="size-4 accent-teal-800"
        />
        {field.label}
      </label>
    );
  }
  return (
    <div className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <Label htmlFor={`${record?.id ?? "new"}-${field.name}`}>
        {field.label}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={`${record?.id ?? "new"}-${field.name}`}
          name={field.name}
          defaultValue={String(existing)}
          placeholder={field.placeholder}
          required={field.required}
        />
      ) : field.type === "select" ? (
        <Select
          name={field.name}
          defaultValue={String(existing)}
          required={field.required}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? "Selecciona"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <>
          {field.currentName && (
            <input
              type="hidden"
              name={field.currentName}
              value={String(record?.[field.currentName] ?? "")}
            />
          )}
          <Input
            id={`${record?.id ?? "new"}-${field.name}`}
            name={field.name}
            type={field.type ?? "text"}
            defaultValue={field.type === "file" ? undefined : String(existing)}
            accept={
              field.type === "file"
                ? "image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                : undefined
            }
            required={field.required && !record}
            step={field.step}
            placeholder={field.placeholder}
          />
        </>
      )}
    </div>
  );
}
