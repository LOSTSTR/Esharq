/*
 * MicPro — Esharq Voice Lab
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * **ترقيع الستيريو من داخل العميل** — بلا بايثون وبلا أداة خارجية.
 *
 * المشكلة الهندسية: ديسكورد يُبقي `discord_voice.node` مفتوحاً ما دام يعمل،
 * فلا يُستبدل من داخله. والحلّ الذي تستعمله الأدوات الأخرى — ونستعمله هنا —
 * أن يُكتب **عاملٌ خارج العملية** يُجدوَل في ويندوز، فينتظر خروج ديسكورد ثم
 * يُبدّل الملفّات ويُعيد تشغيله ثم يمحو مهمّته بنفسه.
 *
 * ## ما نفعله ولا تفعله الأدوات الأصلية
 *
 * 1. **التثبيت على التزام بعينه** لا على فرع متحرّك.
 * 2. **SHA-256 لكل ملفّ من التسعة** قبل أن يُنسخ شيء — وهي أدوات تفحص
 *    «ليس صفحة HTML وأكبر من كيلوبايت» ولا شيء غير ذلك.
 * 3. **استبدال شبه ذرّي**: يُكتب كل ملفّ باسم مؤقّت ثم يُنقل فوق هدفه.
 *    الأدوات الأصلية تمحو المجلد ثم تنسخ، فانقطاعٌ بين الخطوتين يترك
 *    وحدة الصوت **فارغة**.
 * 4. **نسخة أصلية دائمة** خارج `%TEMP%` — لا تُمحى بتنظيف القرص.
 * 5. **لا رفع صلاحيات ولا قتل عمليات**: كل المسارات تحت `%LOCALAPPDATA%`،
 *    والعامل ينتظر خروج ديسكورد ولا يُنهيه قسراً.
 */

import { DATA_DIR } from "@main/utils/constants";
import { downloadToFile } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { spawn } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "fs";
import { basename, join } from "path";

/**
 * الحمولة مثبَّتة على التزام `5e96ff0` (2026-07-01) من
 * `ProdHallow/Discord-Stereo-Windows-MacOS-Linux`، وكل ملفّ ببصمته.
 *
 * 🔴 لا تُبدّل الالتزام دون إعادة حساب البصمات التسع من الملفّات نفسها.
 * والوحدة المُرقَّعة هنا مبنية على بناء ديسكورد **1.0.9243**؛ من كان على بناء
 * أحدث فهذا **رجوعٌ بوحدة الصوت إلى الوراء** — تُقال له صراحةً في الواجهة.
 */
const COMMIT = "5e96ff026df45151d90b309cdece9dc82ec2267b";
const PAYLOAD_BASE = `https://raw.githubusercontent.com/ProdHallow/Discord-Stereo-Windows-MacOS-Linux/${COMMIT}/Updates/Nodes/Patched%20Nodes%20(for%20Installer)/Windows/`;

const PAYLOAD: Record<string, { sha256: string; size: number; }> = {
    "audio_effects_helper.exe": { sha256: "0e10d1ef86d6a3782a625e61e454e5bc20cf1a9f56b85eef5e254ad55832f35c", size: 289208 },
    "discord_voice.node": { sha256: "dccda1f5770572523429abca88dcb3a5bbbca7b7703e119391ad3751fafb7a42", size: 14817208 },
    "gpu_encoder_helper.exe": { sha256: "74677216d2c1e525cd7334e053a6e51c1748461d87430660099b6c204761db96", size: 910264 },
    "index.js": { sha256: "f423f18bbce8ed32b9626bf70d839e83eb8a0f97ea01d08a8a8ec00cb7f0a1f6", size: 21874 },
    "manifest.json": { sha256: "339f1dbbb76936f060cc858f596ceff9c6b3b0cdd98df5b172a895e3c29c17d0", size: 263 },
    "mediapipe.dll": { sha256: "4d6e5b6c1f35c6dd46e8d8cfa88d21f4a88945795f29a24d6c7d4040312a018a", size: 8675256 },
    "package.json": { sha256: "4e7956363d9c3a1459953eb904448cc8ca31ff7af729ceda904120d8787bebc6", size: 23 },
    "selfie_segmentation.tflite": { sha256: "9ee168ec7c8f2a16c56fe8e1cfbc514974cbbb7e434051b455635f1bd1462f5c", size: 249505 },
    "selfie_segmentation_landscape.tflite": { sha256: "a77d03f4659b9f6b6c1f5106947bf40e99d7655094b6527f214ea7d451106edd", size: 250145 }
};

/** بصمة الوحدة المُرقَّعة — بها نعرف أن ديسكورد مُرقَّع أياً كان من رقّعه. */
export const PATCHED_NODE_SHA256 = PAYLOAD["discord_voice.node"].sha256;

const STEREO_DIR = join(DATA_DIR, "tools", "stereo");
const PAYLOAD_DIR = join(STEREO_DIR, "payload");
const BACKUP_DIR = join(STEREO_DIR, "backup");
const WORKER_DIR = join(STEREO_DIR, "worker");

function sha256File(path: string) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verified(path: string, expect: { sha256: string; size: number; }) {
    if (!existsSync(path)) return false;
    try {
        return statSync(path).size === expect.size && sha256File(path) === expect.sha256;
    } catch {
        return false;
    }
}

// ── اكتشاف عملاء ديسكورد ─────────────────────────────────────────────────────

export interface StereoTarget {
    /** مفتاح ثابت للعميل — يدخل في مسار النسخة الاحتياطية. */
    key: string;
    label: string;
    /** جذر التثبيت، مثل `%LOCALAPPDATA%\\Discord`. */
    root: string;
    /** `app-1.0.9253` — بناء ديسكورد الذي سيُرقَّع. */
    build: string;
    /** مجلد `discord_voice` الذي تُستبدل ملفّاته. */
    voiceDir: string;
    exe: string;
    patched: boolean;
    hasBackup: boolean;
}

const CLIENTS: readonly { key: string; label: string; dir: string; exe: string; }[] = [
    { key: "stable", label: "Discord", dir: "Discord", exe: "Discord.exe" },
    { key: "canary", label: "Discord Canary", dir: "DiscordCanary", exe: "DiscordCanary.exe" },
    { key: "ptb", label: "Discord PTB", dir: "DiscordPTB", exe: "DiscordPTB.exe" },
    { key: "development", label: "Discord Development", dir: "DiscordDevelopment", exe: "DiscordDevelopment.exe" }
];

/** رقم البناء عدداً — لاختيار الأحدث حين توجد عدّة مجلدات `app-*`. */
function buildOrder(name: string): number {
    const parts = name.replace(/^app-/, "").split(".").map(Number);
    return parts.reduce((acc, part) => acc * 10000 + (Number.isFinite(part) ? part : 0), 0);
}

export function stereoTargets(): StereoTarget[] {
    if (process.platform !== "win32") return [];
    const local = process.env.LOCALAPPDATA;
    if (local == null) return [];

    const out: StereoTarget[] = [];
    for (const client of CLIENTS) {
        const root = join(local, client.dir);
        if (!existsSync(root)) continue;

        // الأحدث وحده: ديسكورد يُشغّل آخر `app-*` ويترك السابق على القرص.
        const builds = readdirSync(root).filter(name => name.startsWith("app-")).sort((a, b) => buildOrder(b) - buildOrder(a));
        for (const build of builds) {
            const modules = join(root, build, "modules");
            if (!existsSync(modules)) continue;
            const mod = readdirSync(modules).find(name => name.startsWith("discord_voice"));
            if (mod === undefined) continue;
            const voiceDir = join(modules, mod, "discord_voice");
            const node = join(voiceDir, "discord_voice.node");
            if (!existsSync(node)) continue;

            let patched = false;
            try { patched = sha256File(node) === PATCHED_NODE_SHA256; } catch { /* ملفّ مقفل ⇒ يُعدّ غير مُرقَّع */ }

            out.push({
                key: client.key,
                label: client.label,
                root,
                build,
                voiceDir,
                exe: join(root, build, client.exe),
                patched,
                hasBackup: existsSync(join(BACKUP_DIR, client.key, "discord_voice.node"))
            });
            break;
        }
    }
    return out;
}

function targetFor(key: string): StereoTarget {
    const target = stereoTargets().find(t => t.key === key);
    if (target === undefined) throw new Error(`No Discord install found for "${key}"`);
    return target;
}

// ── الحمولة: تنزيل مثبَّت ومُتحقَّق ─────────────────────────────────────────────

export async function ensurePayload(): Promise<{ downloaded: string[]; verified: string[]; }> {
    mkdirSync(PAYLOAD_DIR, { recursive: true });
    const downloaded: string[] = [];
    const ok: string[] = [];

    for (const [name, expect] of Object.entries(PAYLOAD)) {
        const dest = join(PAYLOAD_DIR, name);
        if (verified(dest, expect)) { ok.push(name); continue; }
        if (existsSync(dest)) unlinkSync(dest);

        const tmp = `${dest}.download`;
        try {
            await downloadToFile(PAYLOAD_BASE + encodeURIComponent(name), tmp, {
                headers: { "User-Agent": VENCORD_USER_AGENT }
            });
            const size = statSync(tmp).size;
            const digest = sha256File(tmp);
            if (size !== expect.size || digest !== expect.sha256) {
                throw new Error(`${name} failed integrity check: expected ${expect.sha256} (${expect.size} bytes), got ${digest} (${size} bytes)`);
            }
            renameSync(tmp, dest);
            downloaded.push(name);
            ok.push(name);
        } finally {
            if (existsSync(tmp)) unlinkSync(tmp);
        }
    }
    return { downloaded, verified: ok };
}

// ── النسخة الأصلية ───────────────────────────────────────────────────────────

/**
 * تُؤخذ **مرّة واحدة** وقبل أول ترقيع. ولا تُؤخذ من مجلد مُرقَّع أبداً — وإلّا
 * صار «الأصل» نسخةً مُرقَّعة ولم يبقَ طريق رجوع.
 */
function ensureBackup(target: StereoTarget): { created: boolean; dir: string; } {
    const dir = join(BACKUP_DIR, target.key);
    if (existsSync(join(dir, "discord_voice.node"))) return { created: false, dir };
    if (target.patched) throw new Error("Discord's voice module is already patched and no original backup exists — reinstall Discord to restore it first");

    mkdirSync(dir, { recursive: true });
    for (const name of readdirSync(target.voiceDir)) {
        const src = join(target.voiceDir, name);
        if (statSync(src).isFile()) copyFileSync(src, join(dir, name));
    }
    return { created: true, dir };
}

// ── العامل خارج العملية ──────────────────────────────────────────────────────

/**
 * 🔴 **النسخ شبه ذرّي**: كل ملفّ يُكتب باسم `.esharq-new` ثم يُنقل فوق هدفه.
 * الأدوات الأصلية تُفرّغ المجلد ثم تنسخ، فانقطاعٌ بينهما يترك وحدة الصوت
 * فارغة ولا يعمل الصوت. وهنا أسوأ ما يقع أن يبقى ملفّ مؤقّت بجانب الأصل.
 */
const WORKER_SOURCE = String.raw`
param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$cfg = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json

function Write-Line([string]$text) {
    "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')) $text" | Out-File -FilePath $cfg.logPath -Append -Encoding utf8
}

try {
    Write-Line "start $($cfg.action) -> $($cfg.targetDir)"

    # ننتظر خروج ديسكورد ولا نقتله: القتل القسري يفقد ما لم يُحفظ.
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Process -Name $cfg.processName -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }
    if (Get-Process -Name $cfg.processName -ErrorAction SilentlyContinue) {
        Write-Line "abort: $($cfg.processName) is still running after 90s; nothing was changed"
        exit 2
    }

    foreach ($name in $cfg.files) {
        $src = Join-Path $cfg.sourceDir $name
        $dst = Join-Path $cfg.targetDir $name
        if (-not (Test-Path -LiteralPath $src)) { Write-Line "skip missing $name"; continue }
        $tmp = "$dst.esharq-new"
        Copy-Item -LiteralPath $src -Destination $tmp -Force
        Move-Item -LiteralPath $tmp -Destination $dst -Force
        Write-Line "wrote $name"
    }

    Write-Line "done"
    if ($cfg.relaunch -and (Test-Path -LiteralPath $cfg.exePath)) {
        Start-Process -FilePath $cfg.exePath | Out-Null
        Write-Line "relaunched $($cfg.exePath)"
    }
} catch {
    Write-Line "ERROR $($_.Exception.Message)"
} finally {
    if ($cfg.taskName) { schtasks.exe /Delete /TN $cfg.taskName /F | Out-Null }
    Remove-Item -LiteralPath $ConfigPath -Force -ErrorAction SilentlyContinue
}
`;

export interface WorkerPlan {
    action: "patch" | "revert";
    client: string;
    sourceDir: string;
    targetDir: string;
    files: string[];
    workerScript: string;
    taskName: string;
    logPath: string;
    /** في التجربة الجافّة: نصّ العامل كما سيُكتب، ليُقرأ قبل تشغيل أي شيء. */
    workerSource?: string;
}

function runSchtasks(args: string[]): Promise<number> {
    return new Promise(resolve => {
        const child = spawn(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "schtasks.exe"), args, { windowsHide: true });
        child.once("error", () => resolve(-1));
        child.once("close", code => resolve(code ?? -1));
    });
}

/**
 * يُجهّز العامل ويُجدوله. `dryRun` يُنتج الخطة كاملةً **بلا كتابة ولا جدولة**،
 * فيُقرأ ما سيجري قبل أن يجري.
 */
async function schedule(action: "patch" | "revert", target: StereoTarget, sourceDir: string, dryRun: boolean): Promise<WorkerPlan> {
    const taskName = `Esharq-Stereo-${target.key}-${Date.now()}`;
    const workerScript = join(WORKER_DIR, "stereo-worker.ps1");
    const configPath = join(WORKER_DIR, `stereo-${Date.now()}.json`);
    const logPath = join(STEREO_DIR, "stereo.log");
    const files = existsSync(sourceDir)
        ? readdirSync(sourceDir).filter(name => statSync(join(sourceDir, name)).isFile() && !name.endsWith(".download"))
        : [];

    const plan: WorkerPlan = {
        action,
        client: target.label,
        sourceDir,
        targetDir: target.voiceDir,
        files,
        workerScript,
        taskName,
        logPath
    };
    if (dryRun) return { ...plan, workerSource: WORKER_SOURCE };

    mkdirSync(WORKER_DIR, { recursive: true });
    writeFileSync(workerScript, WORKER_SOURCE, "utf8");
    writeFileSync(configPath, JSON.stringify({
        action,
        sourceDir,
        targetDir: target.voiceDir,
        files,
        processName: basename(target.exe, ".exe"),
        exePath: target.exe,
        relaunch: true,
        taskName,
        logPath
    }), "utf8");

    const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "${workerScript}" "${configPath}"`;
    const time = new Date(Date.now() + 60_000);
    const at = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;

    // `/RL LIMITED` — بلا رفع صلاحيات: كل المسارات تحت %LOCALAPPDATA%.
    const created = await runSchtasks(["/Create", "/TN", taskName, "/SC", "ONCE", "/ST", at, "/TR", command, "/F", "/RL", "LIMITED"]);
    if (created !== 0) throw new Error(`Could not schedule the stereo worker (schtasks exit ${created})`);
    const started = await runSchtasks(["/Run", "/TN", taskName]);
    if (started !== 0) {
        await runSchtasks(["/Delete", "/TN", taskName, "/F"]);
        throw new Error(`Could not start the stereo worker (schtasks exit ${started})`);
    }
    return plan;
}

/** ما الذي سيُنزَّل فعلاً؟ يُقرأ قبل أن يُنزَّل شيء. */
export function payloadStatus() {
    return Object.entries(PAYLOAD).map(([name, expect]) => ({
        name,
        size: expect.size,
        present: verified(join(PAYLOAD_DIR, name), expect)
    }));
}

/**
 * 🔴 `dryRun` **لا يُنزّل ولا يكتب ولا يُجدول**: يُظهر الخطة كاملةً — أي ملفّ
 * سيُجلَب وأين سيُوضع وما نصّ العامل — كي تُقرأ قبل أن يُلمَس شيء.
 */
export async function applyStereoPatch(key: string, dryRun: boolean): Promise<WorkerPlan & { backupCreated: boolean; payload: ReturnType<typeof payloadStatus>; }> {
    const target = targetFor(key);
    const payload = payloadStatus();
    if (dryRun) {
        const plan = await schedule("patch", target, PAYLOAD_DIR, true);
        return { ...plan, files: payload.map(f => f.name), backupCreated: false, payload };
    }
    await ensurePayload();
    const backup = ensureBackup(target);
    const plan = await schedule("patch", target, PAYLOAD_DIR, false);
    return { ...plan, backupCreated: backup.created, payload: payloadStatus() };
}

export async function revertStereoPatch(key: string, dryRun: boolean): Promise<WorkerPlan> {
    const target = targetFor(key);
    const dir = join(BACKUP_DIR, target.key);
    if (!existsSync(join(dir, "discord_voice.node"))) throw new Error("No original backup was found for this client");
    return schedule("revert", target, dir, dryRun);
}

export function forgetStereoPayload(): { ok: true; } {
    rmSync(PAYLOAD_DIR, { recursive: true, force: true });
    rmSync(WORKER_DIR, { recursive: true, force: true });
    return { ok: true };
}
