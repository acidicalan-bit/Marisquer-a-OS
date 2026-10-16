import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { OfflineSyncBridge } from "@/components/offline/offline-sync-bridge";
import { Providers } from "@/components/providers";

import "./globals.css";

// Tailwind v4 emits color functions and feature queries that the embedded
// WebView 75 on the restaurant tablets cannot parse. Keep a small, plain-CSS
// safety net for narrow screens so the POS remains legible while the modern
// desktop stylesheet is loaded normally on current browsers.
const legacyMobileCss = `
@media (max-width:700px){
  html,body{margin:0;min-width:0;background:#f5f2eb;color:#082f36;font-family:Arial,Helvetica,sans-serif}
  *,*:before,*:after{box-sizing:border-box}
  button,input,select,textarea{font:inherit;line-height:1.25}
  button{min-height:44px;cursor:pointer}
  main.grid{display:block;min-height:100vh}
  main.grid>section:first-child{display:none}
  main.grid>section:last-child{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px 16px;background:#f5f2eb}
  main.grid .w-full{width:100%}
  main.grid .max-w-md{max-width:430px}
  main.grid .rounded-xl,.rounded-2xl,.rounded-3xl{border-radius:16px}
  main.grid .border{border:1px solid #d8e1df}
  main.grid .bg-card,main.grid .bg-white{background:#fff}
  main.grid .p-5{padding:20px}.p-4{padding:16px}.px-4{padding-left:16px;padding-right:16px}.py-4{padding-top:16px;padding-bottom:16px}
  main.grid h2{font-size:30px;line-height:1.1;margin:0 0 12px}main.grid label{display:block;margin-bottom:6px;font-weight:700}
  main.grid input,main.grid select,main.grid textarea{width:100%;min-height:48px;border:1px solid #b9cecb;border-radius:12px;background:#fff;color:#082f36;padding:10px 12px}
  main.grid form{display:block}.space-y-5>*+*{margin-top:20px}.mt-6{margin-top:24px}.text-center{text-align:center}
  header{display:block;background:#fff;border-bottom:1px solid #d8e1df;position:relative!important}
  header>div{display:flex;min-height:64px;align-items:center;justify-content:space-between;padding:10px 14px}
  header .flex{display:flex;align-items:center}.gap-2{gap:8px}.gap-3{gap:12px}.gap-4{gap:16px}
  .mx-auto{margin-left:auto;margin-right:auto}.max-w-7xl{max-width:1200px}.px-4{padding-left:16px;padding-right:16px}.sm\\:px-6{padding-left:16px;padding-right:16px}
  .flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.items-end{align-items:flex-end}.justify-between{justify-content:space-between}.min-w-0{min-width:0}.w-full{width:100%}.overflow-hidden{overflow:hidden}.overflow-x-auto{overflow-x:auto}
  .grid{display:grid}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-4{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(2,minmax(0,1fr))}.gap-3{gap:12px}.gap-4{gap:16px}.gap-6{gap:24px}
  .p-3{padding:12px}.p-4{padding:16px}.p-5{padding:20px}.p-6{padding:24px}.py-7{padding-top:28px;padding-bottom:28px}.py-10{padding-top:32px;padding-bottom:32px}
  .mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.mt-4{margin-top:16px}.mt-5{margin-top:20px}.mt-6{margin-top:24px}.mt-7{margin-top:28px}.mb-4{margin-bottom:16px}.mb-7{margin-bottom:28px}
  .space-y-4>*+*{margin-top:16px}.space-y-5>*+*{margin-top:20px}.space-y-6>*+*{margin-top:24px}
  .border{border:1px solid #d8e1df}.border-b{border-bottom:1px solid #d8e1df}.rounded-xl{border-radius:12px}.rounded-2xl{border-radius:16px}.rounded-3xl{border-radius:20px}.shadow-sm{box-shadow:0 2px 8px #082f3614}.shadow-xl{box-shadow:0 12px 30px #082f3620}
  .bg-white{background:#fff}.bg-slate-50{background:#f8fafb}.bg-teal-50{background:#e5f7f4}.bg-slate-950,.bg-teal-950{background:#073b44}.text-white{color:#fff}.text-slate-500,.text-muted-foreground{color:#5d7070}.text-teal-700,.text-teal-800,.text-teal-900{color:#075b62}.font-semibold{font-weight:700}.font-bold{font-weight:800}.text-xs{font-size:12px}.text-sm{font-size:14px}.text-lg{font-size:18px}.text-xl{font-size:21px}.text-2xl{font-size:25px}.text-3xl{font-size:30px}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  /* Chrome 75 no interpreta de forma consistente las utilidades de gradiente
     y opacidad de Tailwind. Declaramos una versión plana y contrastada para
     el panel del mesero, evitando texto blanco sobre fondo blanco. */
  .dashboard-page{background:#f5f2eb;color:#082f36}
  .dashboard-page section[class*="bg-gradient-to-r"]{background:linear-gradient(105deg,#073b44 0%,#092b35 55%,#102f36 100%);color:#fff}
  .dashboard-page section[class*="bg-gradient-to-r"] p{color:#fff}
  .dashboard-page section[class*="bg-gradient-to-r"] .text-teal-300{color:#7ce9d9}
  .dashboard-page section[class*="bg-gradient-to-r"] .text-white\\/80{color:rgba(255,255,255,.86)}
  .dashboard-page section[class*="bg-gradient-to-r"] .bg-white\\/10{background:rgba(255,255,255,.16)}
  .dashboard-page .text-slate-700{color:#36545b}.dashboard-page .text-slate-800{color:#173d46}
  .dashboard-page [role=tablist]{background:#fff;border-color:#cbd9d7;box-shadow:0 4px 12px rgba(8,47,54,.12)}
  .dashboard-page [role=tab]{color:#31545b;background:#f8fbfa;border:1px solid #d7e2df;font-weight:700}
  .dashboard-page [role=tab][data-state="active"]{color:#fff;background:#0f766e;border-color:#0f766e}
  /* Selector by position is intentional: it also catches the suggestion card
     when a legacy browser drops Tailwind's gradient utility class. */
  .dashboard-page>div>section:nth-of-type(2){background:#073b44!important;background-image:linear-gradient(105deg,#073b44 0%,#092b35 55%,#102f36 100%)!important;color:#fff!important}
  .dashboard-page>div>section:nth-of-type(2) p{color:#fff!important}
  .dashboard-page>div>section:nth-of-type(2) .text-teal-300{color:#7ce9d9!important}
  .dashboard-page>div>section:nth-of-type(2) .bg-white\\/10{background:rgba(255,255,255,.16)!important}
  [role=tablist]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px!important;padding:8px!important;background:#fff;border:1px solid #cbd9d7;border-radius:14px}
  [role=tab]{min-height:46px!important;padding:8px!important;white-space:normal!important;line-height:1.15!important;border-radius:10px}
  form button[type=submit],form button.w-full{width:100%;min-height:48px}
}
`;

// El WebView de algunas tabletas reporta un viewport CSS amplio aunque la
// pantalla física sea angosta. Estas reglas no dependen de un breakpoint y
// sólo afectan al panel operativo, garantizando contraste en ambos casos.
const dashboardFallbackCss = `
.dashboard-page>div>section:nth-of-type(2){background:#073b44!important;background-image:linear-gradient(105deg,#073b44 0%,#092b35 55%,#102f36 100%)!important;color:#fff!important}
.dashboard-page>div>section:nth-of-type(2) p{color:#fff!important}
.dashboard-page>div>section:nth-of-type(2) .text-teal-300{color:#7ce9d9!important}
.dashboard-page>div>section:nth-of-type(2) [class*="bg-white/10"]{background:rgba(255,255,255,.16)!important}
.dashboard-page [role="tablist"]{background:#fff;border:1px solid #cbd9d7;box-shadow:0 4px 12px rgba(8,47,54,.12);gap:10px!important;padding:8px!important}
.dashboard-page [role="tab"]{min-width:0;min-height:46px;padding:8px;white-space:normal;overflow-wrap:anywhere;line-height:1.15;text-align:center;color:#31545b;background:#f8fbfa;border:1px solid #d7e2df;font-weight:700}
.dashboard-page [role="tab"][data-state="active"]{color:#fff;background:#0f766e;border-color:#0f766e}
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Marisquería OS",
    template: "%s · Marisquería OS",
  },
  description: "Operación sincronizada para Marisquería Barlovento.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <style dangerouslySetInnerHTML={{ __html: legacyMobileCss }} />
        <style dangerouslySetInnerHTML={{ __html: dashboardFallbackCss }} />
        <Providers>
          <OfflineSyncBridge />
          {children}
        </Providers>
      </body>
    </html>
  );
}
