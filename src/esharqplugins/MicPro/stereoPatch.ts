/*
 * MicPro — Esharq Voice Lab
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * **ستيريو دائم** — يُرقَّع ملفّ صوت ديسكورد الموجود على جهاز المستخدم نفسه،
 * بلا بايثون وبلا أداة خارجية وبلا تنزيل وحدة صوتٍ من أحد.
 *
 * ## الطريقة
 *
 * 1. تُقرأ `discord_voice.node` من بناء المستخدم، وتُطبَّق عليها أنماط المُرقِّع
 *    المثبَّتة نفسها التي يستعملها «ستيريو الجلسة» في الذاكرة (`diskPatcher.ts`).
 *    لا يُقبل الناتج إلّا إن وجدت كلّ رقعة صوتٍ بايتاتها الأصليّة في مكانها.
 * 2. تُحفظ نسخة الأصل (ويُتحقَّق من بصمتها بعد النسخ)، ويُكتب الملفّ المُرقَّع في
 *    مجلد إشراق، ويُسجَّل الاثنان ببصمتيهما في `state.json`.
 * 3. ديسكورد يُبقي الوحدة مفتوحة ما دام يعمل، فالتبديل لـ**عاملٍ خارج العملية**
 *    (PowerShell، بإذن المالك لهذه الميزة وحدها) يُجدوَل في ويندوز: ينتظر خروج
 *    ديسكورد ولا يقتله، يُبدّل الملفّ الواحد تبديلاً شبه ذرّي، يتحقّق من بصمته
 *    ويُرجع الأصل إن لم تطابق، يُعيد فتح ديسكورد، ثمّ يمحو مهمّته وإعداده.
 * 4. **الإزالة**: يُعاد الأصل المحفوظ بالعامل نفسه، ثمّ `sweepStereo()` تتحقّق أنّ
 *    الملفّ عاد ببصمة الأصل فتمحو كلّ ما أنشأه الستيريو الدائم على الجهاز —
 *    النسخ والملفّ المُرقَّع والعامل ومهامّه المجدولة والسجلّ.
 *
 * ## 🔴 لماذا لم تعد الحمولة الجاهزة
 *
 * كانت الطريقة تنسخ تسعة ملفّات من بناء ديسكورد 1.0.9243 (ProdHallow، التزام
 * `5e96ff0`) فوق مجلد الصوت. وحدات اليوم فيها ملفّات ليست في تلك الحمولة
 * (`MediaHost.js` في المستقرّ 9258، `vfx_helper.exe` في كناري 1185)، فالنسخ يخلط
 * جيلين في مجلدٍ واحد — وأعلن صاحب المشروع توقّفه في أغسطس ٢٠٢٦، فلن تأتي حمولة
 * أحدث. ترقيع ملفّ المستخدم نفسه يبقى صالحاً ما دامت الأنماط تطابق بناءه.
 * ومن فعّلها بالطريقة القديمة يبقى إرجاعه يعمل (`patchedBy: "legacy"`).
 */

import { DATA_DIR } from "@main/utils/constants";
import { spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";

import { type FilePatchResult, patchVoiceModuleFile } from "./diskPatcher";

/**
 * بصمة وحدة الصوت المُرقَّعة في الحمولة القديمة (بناء 9243) — وهي نفسها ما تزرعه
 * أداة Stereo Hub. بها نعرف أنّ ديسكورد مُرقَّعٌ بالطريقة القديمة أيّاً كان من رقّعه.
 */
export const LEGACY_PATCHED_NODE_SHA256 = "dccda1f5770572523429abca88dcb3a5bbbca7b7703e119391ad3751fafb7a42";

const STEREO_DIR = join(DATA_DIR, "tools", "stereo");
/** بقايا الطريقة القديمة (٢٥ م.ب) — لا تُستعمل، وتُمحى في الكنس. */
const LEGACY_PAYLOAD_DIR = join(STEREO_DIR, "payload");
const BACKUP_DIR = join(STEREO_DIR, "backup");
const BUILD_DIR = join(STEREO_DIR, "build");
const WORKER_DIR = join(STEREO_DIR, "worker");
const WORKER_SCRIPT = join(WORKER_DIR, "stereo-worker.ps1");
const STATE_FILE = join(STEREO_DIR, "state.json");
const LOG_PATH = join(STEREO_DIR, "stereo.log");
const TASK_PREFIX = "Esharq-Stereo-";
const NODE_NAME = "discord_voice.node";

function sha256(data: Buffer) {
    return createHash("sha256").update(data).digest("hex");
}
function sha256File(path: string) {
    return sha256(readFileSync(path));
}

// ── السجلّ: ما رقّعناه، ببصمتَي الأصل والمُرقَّع ───────────────────────────────

interface PatchRecord {
    key: string;
    build: string;
    module: string;
    /** مسار الوحدة التي رُقِّعت — به يُعرف لاحقاً إن بقيت مُرقَّعة. */
    node: string;
    originalSha256: string;
    patchedSha256: string;
    /** إصدار الأنماط التي بُني بها، مثل `62de190`. */
    patterns: string;
    audio: string;
    created: string;
}

interface StereoState {
    records: Record<string, PatchRecord>;
    /**
     * ما طلب المستخدم إزالته صراحةً (`id` للطريقة الجديدة، `legacy:<key>` للقديمة). به
     * يُميّز الكنسُ الإزالةَ المطلوبة من تفعيلٍ لم يكتمل، فلا يقول «أُزيل» لما لم يُزَل.
     */
    pendingRemovals?: string[];
}

function readState(): StereoState {
    try {
        const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"));
        if (parsed && typeof parsed.records === "object" && parsed.records !== null) return parsed as StereoState;
    } catch { /* لا سجلّ ⇒ فارغ */ }
    return { records: {} };
}

function writeState(state: StereoState) {
    mkdirSync(STEREO_DIR, { recursive: true });
    const tmp = `${STATE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, STATE_FILE);
}

const recordId = (key: string, build: string, module: string) => `${key}/${build}/${module}`;

/** هل هذه البصمة لوحدة صوتٍ مُرقَّعة على القرص — بطريقتنا أو بالقديمة؟ */
function knownPatchedHash(hash: string): "esharq" | "legacy" | null {
    if (hash === LEGACY_PATCHED_NODE_SHA256) return "legacy";
    return Object.values(readState().records).some(r => r.patchedSha256 === hash) ? "esharq" : null;
}

/**
 * يُسأل عنه «ستيريو الجلسة»: ترقيع الذاكرة فوق ملفٍّ مُرقَّع يحلّ ٧ من ١٧ نمطاً،
 * ثلاثٌ منها على مواضع **أخرى** — فلا يُشغَّل المُرقِّع أبداً فوق وحدةٍ نعرفها مُرقَّعة.
 */
export function isDiskPatchedVoiceNode(nodePath: string): boolean {
    try {
        return knownPatchedHash(sha256File(nodePath)) != null;
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
    /** `app-1.0.9258` — بناء ديسكورد الذي يعمل الآن. */
    build: string;
    /** `discord_voice-1` — مجلد الوحدة داخل `modules`. */
    module: string;
    voiceDir: string;
    node: string;
    exe: string;
    patched: boolean;
    /** من رقّعه: إشراق بهذه الطريقة، أم الحمولة القديمة / Stereo Hub. */
    patchedBy: "esharq" | "legacy" | null;
    hasBackup: boolean;
    /**
     * هل تُرقّع الأنماط المثبَّتة هذه الوحدة كاملةً؟ `null` = لم يُعرف بعد (الأنماط لم
     * تُنزَّل، أو الوحدة مُرقَّعة سلفاً فلا معنى للسؤال).
     */
    patchable: { audioOk: number; audioTotal: number; refusal: string | null; } | null;
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

/** أنماط المُرقِّع كما تمرّرها native.ts بعد التحقّق من بصمتها. */
export interface StereoPatterns { text: string; release: string; }

/** المسح نصف ثانية على ٢٢ م.ب — يُحفظ ناتجه لكلّ (ملفّ، حجم، وقت تعديل، أنماط). */
const scanCache = new Map<string, StereoTarget["patchable"]>();

function patchableFor(node: string, patterns: StereoPatterns): StereoTarget["patchable"] {
    try {
        const { size, mtimeMs } = statSync(node);
        const cacheKey = `${node}|${size}|${mtimeMs}|${patterns.release}`;
        if (!scanCache.has(cacheKey)) {
            const outcome = patchVoiceModuleFile(readFileSync(node), patterns.text);
            scanCache.set(cacheKey, { audioOk: outcome.audio.ok, audioTotal: outcome.audio.total, refusal: outcome.refusal });
        }
        return scanCache.get(cacheKey) ?? null;
    } catch (e) {
        return { audioOk: 0, audioTotal: 0, refusal: e instanceof Error ? e.message : String(e) };
    }
}

export function stereoTargets(patterns: StereoPatterns | null = null): StereoTarget[] {
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
            const module = readdirSync(modules).find(name => name.startsWith("discord_voice"));
            if (module === undefined) continue;
            const voiceDir = join(modules, module, "discord_voice");
            const node = join(voiceDir, NODE_NAME);
            if (!existsSync(node)) continue;

            let patchedBy: StereoTarget["patchedBy"] = null;
            try { patchedBy = knownPatchedHash(sha256File(node)); } catch { /* ملفّ مقفل ⇒ يُعدّ غير مُرقَّع */ }

            out.push({
                key: client.key,
                label: client.label,
                root,
                build,
                module,
                voiceDir,
                node,
                exe: join(root, build, client.exe),
                patched: patchedBy != null,
                patchedBy,
                hasBackup: patchedBy === "legacy"
                    ? legacyBackupDir(client.key) != null
                    : existsSync(join(BACKUP_DIR, recordId(client.key, build, module), NODE_NAME)),
                patchable: patchedBy == null && patterns != null ? patchableFor(node, patterns) : null
            });
            break;
        }
    }
    return out;
}

function targetFor(key: string, patterns: StereoPatterns | null = null): StereoTarget {
    const target = stereoTargets(patterns).find(t => t.key === key);
    if (target === undefined) throw new Error(`No Discord install found for "${key}"`);
    return target;
}

/** نسخة الأصل التي أخذتها الطريقة القديمة: ملفّات المجلد كلّها مباشرةً تحت `backup/<key>`. */
function legacyBackupDir(key: string): string | null {
    const dir = join(BACKUP_DIR, key);
    return existsSync(join(dir, NODE_NAME)) && statSync(join(dir, NODE_NAME)).isFile() ? dir : null;
}

// ── العامل خارج العملية ──────────────────────────────────────────────────────

/**
 * 🔴 **النسخ شبه ذرّي**: كل ملفّ يُكتب باسم `.esharq-new` ثم يُنقل فوق هدفه، ثمّ
 * تُقارَن بصمته بما يجب أن تكون. فإن لم تطابق في ترقيعٍ أُعيد الأصل فوراً — فلا
 * تُترك وحدة صوتٍ تالفة. والمؤقّت يُمحى في كلّ حال.
 *
 * يأخذ اسم المهمّة وحده ويقرأ إعداده بجانبه: `/TR` في schtasks لا يقبل أكثر من ٢٦١
 * حرفاً، والمساران الكاملان معاً يتجاوزانها في حسابٍ باسمٍ طويل.
 */
const WORKER_SOURCE = String.raw`
param([Parameter(Mandatory=$true)][string]$TaskName)
$ErrorActionPreference = 'Stop'
$ConfigPath = Join-Path $PSScriptRoot "$TaskName.json"
# 🔴 -Encoding UTF8: بلا هذا يقرأ PowerShell 5.1 الملفَّ بترميز ANSI (cp1256 على
# نظامٍ عربيّ)، فمسارٌ فيه حروف عربية (اسم مستخدم عربيّ) يُقرأ خطأً فيفشل كلُّ شيء.
$cfg = Get-Content -Raw -Encoding UTF8 -LiteralPath $ConfigPath | ConvertFrom-Json

function Write-Line([string]$text) {
    "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')) $text" | Out-File -FilePath $cfg.logPath -Append -Encoding utf8
}

function Copy-Verified([string]$from, [string]$to, [string]$hash) {
    $tmp = "$to.esharq-new"
    try {
        Copy-Item -LiteralPath $from -Destination $tmp -Force
        Move-Item -LiteralPath $tmp -Destination $to -Force
    } finally {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    }
    $actual = (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash.ToLowerInvariant()
    return ($actual -eq $hash)
}

try {
    Write-Line "start $($cfg.action) -> $($cfg.targetDir)"

    # ننتظر خروج ديسكورد ولا نقتله: القتل القسري يفقد ما لم يُحفظ.
    $deadline = (Get-Date).AddSeconds($cfg.waitSeconds)
    while ((Get-Process -Name $cfg.processName -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }
    if (Get-Process -Name $cfg.processName -ErrorAction SilentlyContinue) {
        Write-Line "abort: $($cfg.processName) is still running after $($cfg.waitSeconds)s; nothing was changed"
        exit 2
    }

    $failed = $false
    foreach ($name in $cfg.files) {
        $src = Join-Path $cfg.sourceDir $name
        $dst = Join-Path $cfg.targetDir $name
        if (-not (Test-Path -LiteralPath $src)) { Write-Line "ERROR missing source $name"; $failed = $true; break }
        if (Copy-Verified $src $dst $cfg.hashes.$name) { Write-Line "wrote $name (verified)" }
        else { Write-Line "ERROR $name does not match its expected hash after copying"; $failed = $true; break }
    }

    if ($failed -and $cfg.rollbackDir) {
        foreach ($name in $cfg.files) {
            $orig = Join-Path $cfg.rollbackDir $name
            if (Test-Path -LiteralPath $orig) {
                if (Copy-Verified $orig (Join-Path $cfg.targetDir $name) $cfg.rollbackHashes.$name) { Write-Line "rolled back $name to the original" }
                else { Write-Line "ERROR rollback of $name did not verify" }
            }
        }
    }
    Write-Line ($(if ($failed) { "failed" } else { "done" }))

    if ($cfg.relaunch -and (Test-Path -LiteralPath $cfg.exePath)) {
        # ديسكورد يُعاد فتحه بمجلد البيانات نفسه الذي كان يعمل به.
        if ($cfg.env) { foreach ($p in $cfg.env.PSObject.Properties) { [Environment]::SetEnvironmentVariable($p.Name, [string]$p.Value, 'Process') } }
        Start-Process -FilePath $cfg.exePath | Out-Null
        Write-Line "relaunched $($cfg.exePath)"
    }
} catch {
    Write-Line "ERROR $($_.Exception.Message)"
} finally {
    schtasks.exe /Delete /TN $TaskName /F | Out-Null
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

interface WorkerJob extends WorkerPlan {
    target: StereoTarget;
    hashes: Record<string, string>;
    rollbackDir: string | null;
    rollbackHashes: Record<string, string>;
}

/** عشر دقائق ينتظر فيها العامل خروج ديسكورد — تسعون ثانية كانت تفوت من لم يُغلقه فوراً. */
const WAIT_SECONDS = 600;

function schtasksPath() {
    return join(process.env.SystemRoot ?? "C:\\Windows", "System32", "schtasks.exe");
}

function runSchtasks(args: string[]): Promise<{ code: number; stdout: string; }> {
    return new Promise(resolve => {
        let stdout = "";
        const child = spawn(schtasksPath(), args, { windowsHide: true });
        child.stdout?.on("data", chunk => { stdout += String(chunk); });
        child.once("error", () => resolve({ code: -1, stdout }));
        child.once("close", code => resolve({ code: code ?? -1, stdout }));
    });
}

function hashesOf(dir: string, files: string[]) {
    return Object.fromEntries(files.map(name => [name, sha256File(join(dir, name))]));
}

function planJob(action: "patch" | "revert", target: StereoTarget, sourceDir: string, files: string[], rollbackDir: string | null): WorkerJob {
    const taskName = `${TASK_PREFIX}${target.key}-${Date.now()}`;
    return {
        action,
        client: target.label,
        sourceDir,
        targetDir: target.voiceDir,
        files,
        workerScript: WORKER_SCRIPT,
        taskName,
        logPath: LOG_PATH,
        target,
        hashes: existsSync(sourceDir) ? hashesOf(sourceDir, files.filter(f => existsSync(join(sourceDir, f)))) : {},
        rollbackDir,
        rollbackHashes: rollbackDir != null ? hashesOf(rollbackDir, files.filter(f => existsSync(join(rollbackDir, f)))) : {}
    };
}

const publicPlan = ({ target, hashes, rollbackDir, rollbackHashes, ...plan }: WorkerJob): WorkerPlan => plan;

/**
 * 🔴 يُكتب النصّ بترميز UTF-8 **مع BOM**: بلا BOM يقرأ PowerShell 5.1 السكربت
 * بترميز ANSI، فتعليقاته العربية تتلف — والأهمّ أنّ نفس المشكلة على ملفّ الإعداد
 * تُفسد المسارات العربية (اسم مستخدم عربيّ)، فنُثبّت الترميز على الطرفين.
 */
function writeUtf8Bom(path: string, text: string) {
    writeFileSync(path, "﻿" + text, "utf8");
}

async function schedule(job: WorkerJob): Promise<WorkerPlan> {
    mkdirSync(WORKER_DIR, { recursive: true });
    writeUtf8Bom(WORKER_SCRIPT, WORKER_SOURCE);

    // يُعاد فتح ديسكورد بمجلد البيانات الذي يعمل به الآن (نسخةٌ محمولة أو معزولة).
    const env: Record<string, string> = {};
    for (const name of ["ESHARQ_USER_DATA_DIR", "EQUICORD_USER_DATA_DIR", "DISCORD_USER_DATA_DIR"]) {
        const value = process.env[name];
        if (value) env[name] = value;
    }

    // 🔴 يُكتب الإعداد باسم `.arming` ولا يُسمّى `.json` إلّا بعد نجاح الجدولة: كنسُ
    // عميلٍ آخر (يتشارك المجلد) كان قد يمحو إعداداً كُتب لتوّه ولمّا تُنشأ مهمّته بعد،
    // فيُعلَن «مُجدوَل» ولا يجري شيء. الكنس يتجاهل `.arming`.
    const configPath = join(WORKER_DIR, `${job.taskName}.json`);
    const armingPath = `${configPath}.arming`;
    writeUtf8Bom(armingPath, JSON.stringify({
        action: job.action,
        sourceDir: job.sourceDir,
        targetDir: job.targetDir,
        files: job.files,
        hashes: job.hashes,
        rollbackDir: job.rollbackDir,
        rollbackHashes: job.rollbackHashes,
        processName: basename(job.target.exe, ".exe"),
        exePath: job.target.exe,
        relaunch: true,
        waitSeconds: WAIT_SECONDS,
        env,
        logPath: job.logPath
    }));

    const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "${WORKER_SCRIPT}" ${job.taskName}`;
    if (command.length > 261) {
        rmSync(armingPath, { force: true });
        throw new Error(`Could not schedule the stereo worker: its command line is ${command.length} characters (schtasks allows 261)`);
    }
    const time = new Date(Date.now() + 60_000);
    const at = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;

    // `/RL LIMITED` — بلا رفع صلاحيات: كل المسارات تحت %LOCALAPPDATA% و%APPDATA%.
    const created = await runSchtasks(["/Create", "/TN", job.taskName, "/SC", "ONCE", "/ST", at, "/TR", command, "/F", "/RL", "LIMITED"]);
    if (created.code !== 0) {
        rmSync(armingPath, { force: true });
        throw new Error(`Could not schedule the stereo worker (schtasks exit ${created.code})`);
    }
    // المهمّة موجودة الآن: يُثبَّت الإعداد باسمه النهائيّ قبل التشغيل مباشرةً.
    renameSync(armingPath, configPath);
    const started = await runSchtasks(["/Run", "/TN", job.taskName]);
    if (started.code !== 0) {
        await runSchtasks(["/Delete", "/TN", job.taskName, "/F"]);
        rmSync(configPath, { force: true });
        throw new Error(`Could not start the stereo worker (schtasks exit ${started.code})`);
    }
    return publicPlan(job);
}

/** كتابة ملفٍّ كبير عبر اسمٍ مؤقّت ثمّ التحقّق من بصمته — فلا يُترك نصف ملفّ. */
function writeVerified(path: string, data: Buffer) {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, data);
    renameSync(tmp, path);
    if (sha256File(path) !== sha256(data)) {
        rmSync(path, { force: true });
        throw new Error(`Writing ${path} did not verify`);
    }
}

// ── التفعيل ─────────────────────────────────────────────────────────────────

export interface ApplyResult extends WorkerPlan {
    audio: { ok: number; total: number; };
    bytesChanged: number;
    patches: Pick<FilePatchResult, "name" | "status" | "rva" | "section">[];
}

/**
 * 🔴 `dryRun` **لا يكتب ولا يُجدول**: يُرقّع في الذاكرة ويُعيد الخطة كاملةً — كم رقعة
 * وأين، وما نصّ العامل — كي تُقرأ قبل أن يُلمَس شيء.
 */
export async function applyStereoPatch(key: string, dryRun: boolean, patterns: StereoPatterns): Promise<ApplyResult> {
    const target = targetFor(key);
    if (target.patched) throw new Error(`${target.label} ${target.build} already has Permanent stereo`);

    const original = readFileSync(target.node);
    const outcome = patchVoiceModuleFile(original, patterns.text);
    if (outcome.refusal != null || outcome.patched == null) throw new Error(outcome.refusal ?? "Patching produced no output");

    const id = recordId(target.key, target.build, target.module);
    const buildDir = join(BUILD_DIR, id);
    const backupDir = join(BACKUP_DIR, id);
    const summary = {
        audio: { ok: outcome.audio.ok, total: outcome.audio.total },
        bytesChanged: outcome.bytesChanged,
        patches: outcome.patches.map(({ name, status, rva, section }) => ({ name, status, rva, section }))
    };

    if (dryRun) {
        const job = planJob("patch", target, buildDir, [NODE_NAME], backupDir);
        return { ...publicPlan(job), workerSource: WORKER_SOURCE, ...summary };
    }

    // النسخة الأصليّة أوّلاً — ولا تُؤخذ من ملفٍّ مُرقَّع: الأنماط أثبتت أعلاه أنّه أصل.
    mkdirSync(backupDir, { recursive: true });
    mkdirSync(buildDir, { recursive: true });
    writeVerified(join(backupDir, NODE_NAME), original);
    writeVerified(join(buildDir, NODE_NAME), outcome.patched);

    const state = readState();
    state.records[id] = {
        key: target.key,
        build: target.build,
        module: target.module,
        node: target.node,
        originalSha256: sha256(original),
        patchedSha256: sha256(outcome.patched),
        patterns: patterns.release,
        audio: `${outcome.audio.ok}/${outcome.audio.total}`,
        created: new Date().toISOString()
    };
    // تفعيلٌ جديد يُلغي أيّ طلب إزالةٍ سابقٍ عالقٍ لهذا العميل.
    if (state.pendingRemovals?.length) state.pendingRemovals = state.pendingRemovals.filter(r => r !== id);
    writeState(state);

    const plan = await schedule(planJob("patch", target, buildDir, [NODE_NAME], backupDir));
    return { ...plan, ...summary };
}

// ── الإزالة ─────────────────────────────────────────────────────────────────

export async function revertStereoPatch(key: string, dryRun: boolean): Promise<WorkerPlan> {
    const target = targetFor(key);
    // 🔴 بعد تحديث ديسكورد يصير المجلد أصليّاً من جيلٍ أحدث، ونسخُ احتياطيٍّ أقدم فوقه
    // يخلط بناءين. لا إرجاع إلّا لمُرقَّع.
    if (!target.patched) throw new Error(`${target.label} ${target.build} is not patched — there is nothing to restore, and copying an older backup over it would mix two builds`);

    let job: WorkerJob;
    let removalTag: string;
    if (target.patchedBy === "esharq") {
        const id = recordId(target.key, target.build, target.module);
        const record = readState().records[id];
        const backupDir = join(BACKUP_DIR, id);
        const backupNode = join(backupDir, NODE_NAME);
        // الأصل المحفوظ يُقبل ببصمته المسجّلة وحدها — نسخةٌ تالفة لا تُكتب فوق ديسكورد.
        if (record == null || !existsSync(backupNode) || sha256File(backupNode) !== record.originalSha256) {
            throw new Error("No original backup was found for this client (the saved copy is missing or does not match its recorded fingerprint)");
        }
        job = planJob("revert", target, backupDir, [NODE_NAME], null);
        removalTag = id;
    } else {
        // الطريقة القديمة بدّلت تسعة ملفّات، فتُعاد كلّها من نسختها.
        const dir = legacyBackupDir(target.key);
        if (dir == null) throw new Error("No original backup was found for this client");
        const files = readdirSync(dir).filter(name => statSync(join(dir, name)).isFile());
        job = planJob("revert", target, dir, files, null);
        removalTag = `legacy:${target.key}`;
    }

    if (dryRun) return { ...publicPlan(job), workerSource: WORKER_SOURCE };
    // يُعلَّم أنّ هذه إزالةٌ طلبها المستخدم، فيقول الكنسُ «أُزيل» لا «لم يكتمل التفعيل».
    const state = readState();
    state.pendingRemovals = [...new Set([...(state.pendingRemovals ?? []), removalTag])];
    writeState(state);
    return schedule(job);
}

// ── الكنس: لا يبقى من الستيريو الدائم شيءٌ لم يعد يلزم ─────────────────────────

/** `null` = تعذّر السؤال — فلا يُعرف أيّ عاملٍ حيّ، ولا يُمحى شيء في هذا الكنس. */
async function scheduledStereoTasks(): Promise<string[] | null> {
    const { code, stdout } = await runSchtasks(["/Query", "/FO", "CSV", "/NH"]);
    if (code !== 0) return null;
    const names = new Set<string>();
    for (const line of stdout.split(/\r?\n/)) {
        const first = /^"([^"]*)"/.exec(line)?.[1] ?? "";
        const name = first.replace(/^\\/, "");
        if (name.startsWith(TASK_PREFIX)) names.add(name);
    }
    return [...names];
}

export interface SweepResult {
    /** ما مُحي في هذا الكنس، بكلماتٍ يفهمها سجلّ المطوّر. */
    removed: string[];
    /** لم يبقَ من الستيريو الدائم على الجهاز شيء — المجلد نفسه مُحي. */
    clean: boolean;
    /** عاملٌ مجدول ينتظر خروج ديسكورد. */
    pending: boolean;
    /** أسماء عمليّات ديسكورد التي ينتظر العمّال خروجها — لا يُغلَق عميلٌ لا ينتظره أحد. */
    pendingProcesses: string[];
    /** مُحي ما بقي بعد «إزالة» طلبها المستخدم — لا بعد تفعيلٍ لم يكتمل. */
    removedByUser: boolean;
}

/** مهلة التسليح: إعدادٌ أحدث من هذا قد تكون مهمّته قيد الإنشاء في عميلٍ آخر يشاركنا المجلد. */
const ARMING_MS = 60_000;
/** عاملٌ أقدم من هذا مات حتماً: العامل نفسه يستسلم بعد WAIT_SECONDS. */
const WORKER_LIFETIME_MS = (WAIT_SECONDS + 120) * 1000;
const taskAge = (name: string) => Date.now() - Number(/-(\d+)$/.exec(name)?.[1] ?? 0);

/**
 * يُستدعى عند بدء MicPro وعند عرض بطاقة الستيريو الدائم. يمحو كلّ ما لم يعد يلزم،
 * ولا يمسّ شيئاً ما دام عاملٌ ينتظر أو وحدةٌ ما زالت مُرقَّعة بفعلنا:
 *   - سجلٌّ عادت وحدته إلى بصمة غير المُرقَّعة (أُزيل، أو حدّث ديسكورد الوحدة، أو
 *     حُذف مجلد البناء): تُمحى نسخته الأصليّة وملفّه المُرقَّع.
 *   - بقايا الطريقة القديمة: الحمولة دائماً (لا تُستعمل)، ونسخها حين لا يكون
 *     عميلها مُرقَّعاً بها.
 *   - العامل ومهامّه وإعداداته حين لا ينتظر شيء، ثمّ المجلد كلّه مع سجلّه.
 */
/** اسم عمليّة ديسكورد التي ينتظرها عاملٌ حيّ — من إعداده. */
function workerProcess(name: string): string | null {
    try {
        const cfg = JSON.parse(readFileSync(join(WORKER_DIR, `${name}.json`), "utf8").replace(/^﻿/, ""));
        return typeof cfg.processName === "string" ? cfg.processName : null;
    } catch {
        return null;
    }
}

export async function sweepStereo(): Promise<SweepResult> {
    const removed: string[] = [];
    const idle = (over: Partial<SweepResult> = {}): SweepResult =>
        ({ removed, clean: !existsSync(STEREO_DIR), pending: false, pendingProcesses: [], removedByUser: false, ...over });
    if (process.platform !== "win32" || !existsSync(STEREO_DIR)) return idle({ clean: true });

    // 🔴 تعذّر سؤال المُجدوِل ⇒ لا يُعرف أيّ عاملٍ حيّ، فلا يُمحى شيء في هذا الكنس
    // (وإلّا حُذف مصدرُ تفعيلٍ قيد الانتظار). يُعامَل كأنّ عملاً معلّقاً.
    const tasks = existsSync(WORKER_DIR) ? await scheduledStereoTasks() : [];
    if (tasks === null) return idle({ pending: true, clean: false });

    const configs = existsSync(WORKER_DIR)
        ? readdirSync(WORKER_DIR).filter(n => n.startsWith(TASK_PREFIX) && n.endsWith(".json")).map(n => n.slice(0, -5))
        : [];
    // عاملٌ حيّ: مهمّةٌ لم يتجاوز عمرُها حياةَ العامل، أو إعدادٌ يُسلَّح الآن في عميلٍ آخر
    // (أحدث من مهلة التسليح ولمّا تُنشأ مهمّته). ما عدا ذلك بقيّةُ عاملٍ مات ⇒ يُنظَّف.
    const live: string[] = [];
    for (const name of new Set([...tasks, ...configs])) {
        const hasTask = tasks.includes(name);
        const hasConfig = configs.includes(name);
        const age = taskAge(name);
        const running = hasTask && age >= 0 && age < WORKER_LIFETIME_MS;
        const arming = hasConfig && !hasTask && age >= 0 && age < ARMING_MS;
        if (running || arming) { live.push(name); continue; }
        if (hasConfig) { rmSync(join(WORKER_DIR, `${name}.json`), { force: true }); removed.push(`stale worker config ${name}`); }
        if (hasTask && (await runSchtasks(["/Delete", "/TN", name, "/F"])).code === 0) removed.push(`stale scheduled task ${name}`);
    }
    if (live.length) {
        const pendingProcesses = [...new Set(live.map(workerProcess).filter((p): p is string => p != null))];
        return { removed, clean: false, pending: true, pendingProcesses, removedByUser: false };
    }

    // سجلّاتٌ لم تعد وحداتها مُرقَّعة بفعلنا. 🔴 ملفٌّ **مفقود** (حجْرٌ من مضادّ فيروسات
    // مثلاً) أو **مقفل** يُبقى سجلُّه ونسختُه: قد يعود، وحذفُ النسخة يقطع طريق الرجوع.
    const state = readState();
    const pendingRemovals = new Set(state.pendingRemovals ?? []);
    let removedByUser = false;
    for (const [id, record] of Object.entries(state.records)) {
        let status: "patched" | "changed" | "unknown";
        try {
            if (!existsSync(record.node)) status = "unknown";
            else status = sha256File(record.node) === record.patchedSha256 ? "patched" : "changed";
        } catch { status = "unknown"; }
        if (status !== "changed") continue; // مُرقَّع ⇒ يبقى، مفقود/مقفل ⇒ يبقى
        rmSync(join(BUILD_DIR, id), { recursive: true, force: true });
        rmSync(join(BACKUP_DIR, id), { recursive: true, force: true });
        delete state.records[id];
        if (pendingRemovals.delete(id)) { removedByUser = true; removed.push(`removed by user ${id}`); }
        else removed.push(`backup and patched copy of ${id}`); // تحديثُ ديسكورد للوحدة، أو تفعيلٌ لم يكتمل
    }

    // بقايا الطريقة القديمة: الحمولة دائماً، ونسخُ عميلٍ لم يعد مُرقَّعاً بها
    if (existsSync(LEGACY_PAYLOAD_DIR)) {
        rmSync(LEGACY_PAYLOAD_DIR, { recursive: true, force: true });
        removed.push("legacy 9243 payload");
    }
    if (existsSync(BACKUP_DIR)) {
        const legacyInUse = new Set(stereoTargets().filter(t => t.patchedBy === "legacy").map(t => t.key));
        for (const key of readdirSync(BACKUP_DIR)) {
            const dir = join(BACKUP_DIR, key);
            if (legacyInUse.has(key) || !statSync(dir).isDirectory()) continue;
            // النسخ القديمة ملفّاتٌ مباشرةً تحت backup/<key>؛ نسخ الطريقة الجديدة مجلّداتٌ مُتداخلة تُركت أعلاه.
            const flat = readdirSync(dir).filter(n => statSync(join(dir, n)).isFile());
            if (!flat.length) continue;
            for (const name of flat) { unlinkSync(join(dir, name)); removed.push(`legacy backup ${key}/${name}`); }
            if (pendingRemovals.delete(`legacy:${key}`)) removedByUser = true;
        }
    }

    state.pendingRemovals = [...pendingRemovals];
    if (Object.keys(state.records).length || state.pendingRemovals.length) writeState(state);
    else if (existsSync(STATE_FILE)) rmSync(STATE_FILE, { force: true });

    // مجلداتٌ فرغت، ثمّ المجلد كلّه إن لم يبقَ فيه ما يلزم
    const pruneEmpty = (dir: string): boolean => {
        if (!existsSync(dir)) return true;
        let empty = true;
        for (const name of readdirSync(dir)) {
            if (statSync(join(dir, name)).isDirectory() && pruneEmpty(join(dir, name))) continue;
            empty = false;
        }
        if (empty) rmSync(dir, { recursive: true, force: true });
        return empty;
    };
    const backupsGone = pruneEmpty(BACKUP_DIR);
    const buildsGone = pruneEmpty(BUILD_DIR);
    if (backupsGone && buildsGone && Object.keys(state.records).length === 0 && !existsSync(STATE_FILE)) {
        rmSync(STEREO_DIR, { recursive: true, force: true });
        removed.push("the whole Permanent stereo folder (worker, log)");
        // ومجلد الأدوات إن لم يبقَ فيه غيرنا (Stereo Hub وحالة الأدوات تعيش فيه أيضاً).
        try { rmdirSync(dirname(STEREO_DIR)); } catch { /* فيه غيرنا ⇒ يبقى */ }
    }

    if (removed.length) console.log("[MicPro] permanent stereo sweep:", removed.join("; "));
    return idle({ removedByUser });
}
