import Image from "next/image";
import { Download, Palette, Sparkles, Upload } from "lucide-react";

import { generateBrandLogo, saveBrand } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandStudio({
  branch,
}: {
  branch: {
    id: string;
    name: string;
    logo_url: string | null;
    logo_scale: number;
    logo_position: string;
    accent: string;
  };
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_30px_90px_-30px_rgba(7,45,59,.7)]">
      <div className="grid lg:grid-cols-[.9fr_1.1fr]">
        <div className="relative min-h-72 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,.3),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(245,158,11,.24),transparent_38%)] p-8 sm:p-10">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[.24em] text-teal-300 uppercase">
                Estudio de marca
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Una identidad que se reconoce al instante.
              </h2>
            </div>
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur">
              {branch.logo_url ? (
                <Image
                  src={branch.logo_url}
                  alt={`Logo de ${branch.name}`}
                  width={600}
                  height={210}
                  unoptimized
                  className="h-28 w-full object-contain"
                  style={{ objectPosition: branch.logo_position }}
                />
              ) : (
                <div className="grid h-28 place-items-center text-2xl font-semibold text-white/80">
                  {branch.name}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between text-xs text-white/50">
                <span>Vista previa</span>
                {branch.logo_url && (
                  <a
                    href={branch.logo_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-teal-200 hover:text-white"
                  >
                    <Download className="size-3.5" /> Exportar logo
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white p-7 text-slate-900 sm:p-10">
          <form action={saveBrand} className="grid gap-5 sm:grid-cols-2">
            <input type="hidden" name="branch_id" value={branch.id} />
            <input
              type="hidden"
              name="current_logo_url"
              value={branch.logo_url ?? ""}
            />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="brand-name">Nombre comercial</Label>
              <Input
                id="brand-name"
                name="name"
                defaultValue={branch.name}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="brand-logo">Cargar logo</Label>
              <Input
                id="brand-logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
              />
              <p className="text-xs text-slate-400">
                PNG, WebP, AVIF, JPG o SVG · máximo 5 MB
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-scale">Escala (%)</Label>
              <Input
                id="logo-scale"
                name="logo_scale"
                type="number"
                min="50"
                max="180"
                defaultValue={branch.logo_scale}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-position">Acomodo</Label>
              <select
                id="logo-position"
                name="logo_position"
                defaultValue={branch.logo_position}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-accent">Color distintivo</Label>
              <Input
                id="brand-accent"
                name="accent"
                type="color"
                defaultValue={branch.accent}
                className="p-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full bg-teal-900 hover:bg-teal-800"
              >
                <Upload className="size-4" /> Guardar identidad
              </Button>
            </div>
          </form>
          <div className="my-7 h-px bg-slate-100" />
          <form
            action={generateBrandLogo}
            className="rounded-2xl bg-gradient-to-br from-amber-50 to-teal-50 p-5"
          >
            <input type="hidden" name="branch_id" value={branch.id} />
            <input type="hidden" name="name" value={branch.name} />
            <div className="flex gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-amber-600 shadow-sm">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">Generador de logo premium</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Crea una versión de alta resolución lista para exportar.
                </p>
              </div>
            </div>
            <textarea
              name="direction"
              maxLength={500}
              placeholder="Opcional: describe colores, símbolo o sensación que buscas…"
              className="mt-4 min-h-20 w-full resize-none rounded-xl border border-white bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-700/20"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <select
                name="style"
                className="h-10 flex-1 rounded-xl border border-white bg-white px-3 text-sm"
              >
                <option value="ocean">Océano clásico</option>
                <option value="pearl">Perla minimalista</option>
                <option value="coral">Coral nocturno</option>
              </select>
              <Button
                type="submit"
                variant="outline"
                className="rounded-xl border-white bg-white"
              >
                <Palette className="size-4" /> Generar con IA
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
