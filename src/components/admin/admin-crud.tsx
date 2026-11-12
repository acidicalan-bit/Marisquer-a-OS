"use client";

import Image from "next/image";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  minLength?: number;
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

type ServerAction = (
  formData: FormData,
) => void | Promise<void | { ok: true } | { ok: false; error: string }>;
type DeleteAction = (formData: FormData) => void | Promise<void>;

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
  deleteAction?: DeleteAction;
  deleteLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-MX");
    return normalized
      ? records.filter((record) =>
          `${record.title} ${record.subtitle ?? ""}`
            .toLocaleLowerCase("es-MX")
            .includes(normalized),
        )
      : records;
  }, [query, records]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const visibleRecords = filteredRecords.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );
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

      {records.length > 5 && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label
            className="sr-only"
            htmlFor={`search-${title.replace(/ /g, "-")}`}
          >
            Buscar {title}
          </label>
          <input
            id={`search-${title.replace(/ /g, "-")}`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={`Buscar ${title.toLocaleLowerCase("es-MX")}`}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-700 sm:max-w-sm"
          />
          <p aria-live="polite" className="text-xs text-slate-500">
            {filteredRecords.length} resultados · mostrando{" "}
            {Math.min(pageSize, visibleRecords.length)} por página
          </p>
        </div>
      )}
      {records.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 xl:grid-cols-2">
          {visibleRecords.map((record) => (
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`${deleteLabel} ${record.title}`}
                        className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          ¿{deleteLabel} “{record.title}”?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción puede afectar la operación de la sucursal.
                          Confirma solo si elegiste el registro correcto.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={record.id} />
                          <AlertDialogAction asChild variant="destructive">
                            <button type="submit">
                              Sí, {deleteLabel.toLocaleLowerCase("es-MX")}
                            </button>
                          </AlertDialogAction>
                        </form>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {filteredRecords.length > pageSize && (
        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <p className="text-xs text-slate-500">
            Página {visiblePage} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={visiblePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={visiblePage >= pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {records.length > 0 && visibleRecords.length === 0 && (
        <p className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
          No encontramos coincidencias para “{query}”.
        </p>
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const submit = (formData: FormData) => {
    setError("");
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result && !result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo guardar. Revisa la conexión e inténtalo de nuevo.",
        );
      }
    });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError("");
      }}
    >
      <DialogTrigger asChild>
        {compact ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`${label} ${record?.title ?? "registro"}`}
          >
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
        <form action={submit} className="grid gap-4 pt-2 sm:grid-cols-2">
          <input type="hidden" name="id" value={record?.id ?? ""} />
          {fields.map((field) => (
            <AdminInput key={field.name} field={field} record={record} />
          ))}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end pt-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={isPending}
              className="min-w-32 rounded-xl bg-teal-900 hover:bg-teal-800"
            >
              {isPending ? "Guardando…" : "Guardar cambios"}
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
  const [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
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
      ) : field.type === "file" ? (
        <div className="space-y-3">
          {(preview || record?.image_url) && (
            <Image
              src={preview || String(record?.image_url)}
              alt="Vista previa del producto"
              width={360}
              height={180}
              unoptimized
              className="h-36 w-full rounded-xl bg-slate-100 object-cover"
            />
          )}
          <Input
            id={`${record?.id ?? "new"}-${field.name}`}
            name={field.name}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required={field.required && !record}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) setPreview(URL.createObjectURL(file));
            }}
            className="min-h-12 cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-900"
          />
          <p className="text-xs text-slate-500">
            JPEG, PNG, WebP o AVIF · máximo 5 MB. Si no eliges otra, se conserva
            la imagen actual.
          </p>
          {field.currentName && (
            <input
              type="hidden"
              name={field.currentName}
              value={String(record?.[field.currentName] ?? "")}
            />
          )}
        </div>
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
            defaultValue={String(existing)}
            required={field.required && !record}
            minLength={field.minLength}
            step={field.step}
            placeholder={field.placeholder}
          />
        </>
      )}
    </div>
  );
}
