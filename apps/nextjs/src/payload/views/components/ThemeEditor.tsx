"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { ColorSet, ResolvedShadow } from "~/lib/theme/defaults";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  COLOR_TOKENS,
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_FONT_SERIF,
  DEFAULT_RADIUS,
  DEFAULT_SHADOW,
  DEFAULT_SPACING,
  FONT_MONO_OPTIONS,
  FONT_SANS_OPTIONS,
  FONT_SERIF_OPTIONS,
} from "~/lib/theme/defaults";
import { deriveBoth, deriveSidebarFromBase } from "~/lib/theme/derive";
import { themeToCss } from "~/lib/theme/serialize";
import { ColorField } from "./ColorField";
import { UploadTile } from "./UploadTile";

type Mode = "light" | "dark";
type EditorMode = "simple" | "advanced";
interface MediaRef {
  id: number;
  url: string | null;
}

export interface ThemeEditorInitial {
  editorMode: EditorMode;
  appName: string;
  appIcon: MediaRef | null;
  logoLight: MediaRef | null;
  logoDark: MediaRef | null;
  colorsLight: ColorSet;
  colorsDark: ColorSet;
  fontSans: string;
  fontSerif: string;
  fontMono: string;
  letterSpacing: string;
  radius: string;
  spacing: string;
  shadow: ResolvedShadow;
}

const LABELS: Record<string, string> = Object.fromEntries(
  COLOR_TOKENS.map((t) => [t.field, t.label]),
);
const COLOR_GROUPS: { title: string; fields: string[]; sync?: boolean }[] = [
  {
    title: "Brand",
    fields: [
      "primary",
      "primaryForeground",
      "secondary",
      "secondaryForeground",
      "destructive",
      "destructiveForeground",
    ],
  },
  {
    title: "Base",
    fields: [
      "background",
      "foreground",
      "card",
      "cardForeground",
      "popover",
      "popoverForeground",
    ],
  },
  {
    title: "UI",
    fields: [
      "muted",
      "mutedForeground",
      "accent",
      "accentForeground",
      "border",
      "input",
      "ring",
    ],
  },
  {
    title: "Sidebar",
    sync: true,
    fields: [
      "sidebar",
      "sidebarForeground",
      "sidebarPrimary",
      "sidebarPrimaryForeground",
      "sidebarAccent",
      "sidebarAccentForeground",
      "sidebarBorder",
      "sidebarRing",
    ],
  },
  {
    title: "Charts",
    fields: ["chart1", "chart2", "chart3", "chart4", "chart5"],
  },
];

const numOf = (s: string, fallback: number) => {
  const m = /-?[\d.]+/.exec(s);
  return m ? parseFloat(m[0]) : fallback;
};

export function ThemeEditor(props: { initial: ThemeEditorInitial }) {
  const { initial } = props;
  const router = useRouter();

  const [editorMode, setEditorMode] = React.useState<EditorMode>(
    initial.editorMode,
  );
  const [mode, setMode] = React.useState<Mode>("light");
  const [appName, setAppName] = React.useState(initial.appName);
  const [appIcon, setAppIcon] = React.useState<MediaRef | null>(
    initial.appIcon,
  );
  const [logoLight, setLogoLight] = React.useState<MediaRef | null>(
    initial.logoLight,
  );
  const [logoDark, setLogoDark] = React.useState<MediaRef | null>(
    initial.logoDark,
  );
  const [light, setLight] = React.useState<ColorSet>(initial.colorsLight);
  const [dark, setDark] = React.useState<ColorSet>(initial.colorsDark);
  const [fontSans, setFontSans] = React.useState(initial.fontSans);
  const [fontSerif, setFontSerif] = React.useState(initial.fontSerif);
  const [fontMono, setFontMono] = React.useState(initial.fontMono);
  const [letterSpacing, setLetterSpacing] = React.useState(
    numOf(initial.letterSpacing, 0),
  );
  const [radius, setRadius] = React.useState(numOf(initial.radius, 0.75));
  const [spacing, setSpacing] = React.useState(numOf(initial.spacing, 0.25));
  const [shadow, setShadow] = React.useState<ResolvedShadow>(initial.shadow);
  const [sidebarSync, setSidebarSync] = React.useState({
    light: false,
    dark: false,
  });
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const active = mode === "light" ? light : dark;
  const setActive = mode === "light" ? setLight : setDark;

  const setColor = (field: string, value: string) => {
    setActive((prev) => {
      const next = { ...prev, [field]: value };
      return sidebarSync[mode]
        ? { ...next, ...deriveSidebarFromBase(next) }
        : next;
    });
  };

  // Simple mode: editing one of the 3 anchors re-derives the whole palette
  // (light) and an auto-generated dark palette.
  const setAnchor = (
    field: "background" | "foreground" | "primary",
    value: string,
  ) => {
    const anchors = { ...light, [field]: value };
    const { light: l, dark: d } = deriveBoth(
      anchors.background ?? "",
      anchors.foreground ?? "",
      anchors.primary ?? "",
    );
    setLight(l);
    setDark(d);
  };

  const toggleSync = (on: boolean) => {
    setSidebarSync((s) => ({ ...s, [mode]: on }));
    if (on) setActive((prev) => ({ ...prev, ...deriveSidebarFromBase(prev) }));
  };

  // Live-preview CSS variables for the active palette.
  const previewVars = React.useMemo(() => {
    const vars: Record<string, string> = { "--radius": `${radius}rem` };
    for (const t of COLOR_TOKENS) {
      const v = active[t.field];
      if (v) vars[`--${t.cssVar}`] = v;
    }
    return vars as React.CSSProperties;
  }, [active, radius]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const body = {
        editorMode,
        appName,
        appIcon: appIcon?.id ?? null,
        logoLight: logoLight?.id ?? null,
        logoDark: logoDark?.id ?? null,
        colorsLight: light,
        colorsDark: dark,
        fontSans,
        fontSerif,
        fontMono,
        letterSpacing: `${letterSpacing}em`,
        radius: `${radius}rem`,
        spacing: `${spacing}rem`,
        shadow,
      };
      const res = await fetch("/cms-api/globals/theme-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setStatus("Saved — theme applied across the app.");
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // The exact CSS the runtime injects for the current (unsaved) state — handy as
  // a copy-paste export and as a "what will ship" preview.
  const currentCss = React.useMemo(
    () =>
      themeToCss({
        colorsLight: light,
        colorsDark: dark,
        radius: `${radius}rem`,
        spacing: `${spacing}rem`,
        letterSpacing: `${letterSpacing}em`,
        fontSans,
        fontSerif,
        fontMono,
        shadow,
      }),
    [
      light,
      dark,
      radius,
      spacing,
      letterSpacing,
      fontSans,
      fontSerif,
      fontMono,
      shadow,
    ],
  );

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  function resetDefaults() {
    setLight(Object.fromEntries(COLOR_TOKENS.map((t) => [t.field, t.light])));
    setDark(Object.fromEntries(COLOR_TOKENS.map((t) => [t.field, t.dark])));
    setFontSans(DEFAULT_FONT_SANS);
    setFontSerif(DEFAULT_FONT_SERIF);
    setFontMono(DEFAULT_FONT_MONO);
    setLetterSpacing(0);
    setRadius(numOf(DEFAULT_RADIUS, 0.75));
    setSpacing(numOf(DEFAULT_SPACING, 0.25));
    setShadow(DEFAULT_SHADOW);
    setSidebarSync({ light: false, dark: false });
    setStatus("Reset to defaults — Save to apply.");
  }

  return (
    <div className="bg-background text-foreground min-h-screen p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Theme</h1>
              <p className="text-muted-foreground text-sm">
                Branding, colors, typography and styles for the whole app +
                admin.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {status && (
                <span className="text-muted-foreground mr-1 text-sm">
                  {status}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={resetDefaults}>
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(currentCss, "css")}
              >
                {copied === "css" ? "Copied!" : "Copy CSS"}
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                App identity shown across the product.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="appName">App name</Label>
                <Input
                  id="appName"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="My App"
                  className="max-w-sm"
                />
              </div>
              <Separator />
              <div className="grid gap-5 sm:grid-cols-3">
                <UploadTile
                  label="App icon"
                  description="Favicon · square"
                  url={appIcon?.url ?? null}
                  onChange={setAppIcon}
                />
                <UploadTile
                  label="Logo (light)"
                  url={logoLight?.url ?? null}
                  onChange={setLogoLight}
                />
                <UploadTile
                  label="Logo (dark)"
                  dark
                  url={logoDark?.url ?? null}
                  onChange={setLogoDark}
                />
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Colors</CardTitle>
                <CardDescription>
                  {editorMode === "simple"
                    ? "Pick three colors — the full palette (light + dark) is derived."
                    : "Fine-tune every token for light and dark."}
                </CardDescription>
              </div>
              <ToggleGroup
                type="single"
                value={editorMode}
                onValueChange={(v) => v && setEditorMode(v as EditorMode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="simple">Simple</ToggleGroupItem>
                <ToggleGroupItem value="advanced">Advanced</ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent className="space-y-5">
              {editorMode === "simple" ? (
                <div className="grid max-w-md gap-4">
                  <ColorField
                    label="Background"
                    value={light.background ?? ""}
                    onChange={(v) => setAnchor("background", v)}
                  />
                  <ColorField
                    label="Foreground"
                    value={light.foreground ?? ""}
                    onChange={(v) => setAnchor("foreground", v)}
                  />
                  <ColorField
                    label="Primary"
                    value={light.primary ?? ""}
                    onChange={(v) => setAnchor("primary", v)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Switch to Advanced to tweak any derived token.
                  </p>
                </div>
              ) : (
                <>
                  <ToggleGroup
                    type="single"
                    value={mode}
                    onValueChange={(v) => v && setMode(v as Mode)}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="light">Light</ToggleGroupItem>
                    <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
                  </ToggleGroup>
                  {COLOR_GROUPS.map((group) => {
                    const synced = group.sync && sidebarSync[mode];
                    return (
                      <Collapsible
                        key={group.title}
                        defaultOpen
                        className="border-border rounded-lg border"
                      >
                        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
                          {group.title}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 px-4 pb-4">
                          {group.sync && (
                            <div className="flex items-center justify-between">
                              <Label className="text-muted-foreground text-xs font-normal">
                                Sync to base colors
                              </Label>
                              <Switch
                                checked={sidebarSync[mode]}
                                onCheckedChange={toggleSync}
                              />
                            </div>
                          )}
                          {group.fields.map((field) => (
                            <ColorField
                              key={field}
                              label={LABELS[field] ?? field}
                              value={active[field] ?? ""}
                              disabled={synced}
                              onChange={(v) => setColor(field, v)}
                            />
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FontSelect
                label="Sans-serif"
                value={fontSans}
                onChange={setFontSans}
                options={FONT_SANS_OPTIONS}
              />
              <FontSelect
                label="Serif"
                value={fontSerif}
                onChange={setFontSerif}
                options={FONT_SERIF_OPTIONS}
              />
              <FontSelect
                label="Monospace"
                value={fontMono}
                onChange={setFontMono}
                options={FONT_MONO_OPTIONS}
              />
              <SliderRow
                label="Letter spacing"
                value={letterSpacing}
                min={-0.05}
                max={0.25}
                step={0.005}
                unit="em"
                onChange={setLetterSpacing}
              />
            </CardContent>
          </Card>

          {/* Other */}
          <Card>
            <CardHeader>
              <CardTitle>Other styles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SliderRow
                label="Radius"
                value={radius}
                min={0}
                max={1.5}
                step={0.025}
                unit="rem"
                onChange={setRadius}
              />
              <SliderRow
                label="Spacing"
                value={spacing}
                min={0.1}
                max={0.5}
                step={0.01}
                unit="rem"
                onChange={setSpacing}
              />
              <Separator />
              <ColorField
                label="Shadow color"
                value={shadow.color}
                onChange={(v) => setShadow((s) => ({ ...s, color: v }))}
              />
              <SliderRow
                label="Shadow opacity"
                value={shadow.opacity}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setShadow((s) => ({ ...s, opacity: v }))}
              />
              <SliderRow
                label="Shadow blur"
                value={shadow.blurRadius}
                min={0}
                max={50}
                step={1}
                unit="px"
                onChange={(v) => setShadow((s) => ({ ...s, blurRadius: v }))}
              />
              <SliderRow
                label="Shadow spread"
                value={shadow.spread}
                min={-20}
                max={20}
                step={1}
                unit="px"
                onChange={(v) => setShadow((s) => ({ ...s, spread: v }))}
              />
              <SliderRow
                label="Shadow offset X"
                value={shadow.offsetX}
                min={-20}
                max={20}
                step={1}
                unit="px"
                onChange={(v) => setShadow((s) => ({ ...s, offsetX: v }))}
              />
              <SliderRow
                label="Shadow offset Y"
                value={shadow.offsetY}
                min={-20}
                max={20}
                step={1}
                unit="px"
                onChange={(v) => setShadow((s) => ({ ...s, offsetY: v }))}
              />
            </CardContent>
          </Card>

          {/* API & export */}
          <Card>
            <CardHeader>
              <CardTitle>API &amp; export</CardTitle>
              <CardDescription>
                This theme is the <code>theme-settings</code> CMS global. The
                web app reads it server-side; mobile / other clients can fetch
                it over REST. Same data, one source of truth.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <EndpointRow
                method="GET"
                path="/cms-api/globals/theme-settings"
                hint="Read the current theme (public)."
                onCopy={(p) => copy(p, "get")}
                copied={copied === "get"}
                openable
              />
              <EndpointRow
                method="POST"
                path="/cms-api/globals/theme-settings"
                hint="Update the theme (staff only). What Save calls."
                onCopy={(p) => copy(p, "post")}
                copied={copied === "post"}
              />
              <EndpointRow
                method="POST"
                path="/cms-api/media"
                hint="Upload branding images (multipart) → returns media id."
                onCopy={(p) => copy(p, "media")}
                copied={copied === "media"}
              />
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">CSS variables</p>
                  <p className="text-muted-foreground text-xs">
                    The exact <code>:root</code> / dark overrides injected at
                    runtime.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(currentCss, "css")}
                >
                  {copied === "css" ? "Copied!" : "Copy CSS"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          <Card
            style={previewVars}
            className="bg-background text-foreground overflow-hidden"
          >
            <CardHeader>
              <CardTitle className="text-base">Preview ({mode})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="secondary">
                  Secondary
                </Button>
                <Button size="sm" variant="outline">
                  Outline
                </Button>
                <Button size="sm" variant="destructive">
                  Destructive
                </Button>
              </div>
              <Input placeholder="Input field" />
              <div className="bg-card text-card-foreground rounded-(--radius) border p-3">
                <p className="text-sm font-medium">Card surface</p>
                <p className="text-muted-foreground text-xs">
                  Muted foreground text
                </p>
              </div>
              <div className="bg-sidebar text-sidebar-foreground rounded-(--radius) p-3 text-sm">
                Sidebar surface
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EndpointRow({
  method,
  path,
  hint,
  onCopy,
  copied,
  openable,
}: {
  method: string;
  path: string;
  hint: string;
  onCopy: (path: string) => void;
  copied: boolean;
  openable?: boolean;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-3 rounded-md border p-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold">
            {method}
          </span>
          <code className="truncate text-xs">{path}</code>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {openable && (
          <Button asChild variant="ghost" size="sm">
            <a href={path} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onCopy(path)}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-normal">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-normal">{label}</Label>
        <span className="text-muted-foreground font-mono text-xs">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
      />
    </div>
  );
}
