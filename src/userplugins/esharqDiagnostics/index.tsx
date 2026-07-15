/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { showNotification } from "@api/Notifications";
import { definePluginSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Button, openModal, React } from "@webpack/common";

import { DiagnosticsModal } from "./DiagnosticsModal";
import { startMemoryGuard, stopMemoryGuard } from "./memoryGuard";
import { runtimeProfiler } from "./runtimeProfiler";
import { sampleHeapMB, scanPlugins } from "./scanner";
import { processSnapshot } from "./scoring";

// Scanner (layer 1) → Processing (layer 2). One synchronous pass, on demand.
function runScan() {
    return processSnapshot(scanPlugins());
}

function openDiagnostics() {
    const initial = runScan();          // single pass at click time
    const heapMB = sampleHeapMB();
    const interval = settings.store.liveInterval ?? 5;   // live-monitoring refresh seconds
    openModal(props => (
        <ErrorBoundary>
            <DiagnosticsModal modalProps={props} initial={initial} heapMB={heapMB} rescan={runScan} interval={interval} />
        </ErrorBoundary>
    ));
    // `initial` is referenced only by the modal closure; released for GC when the modal unmounts.
}

// activity / heartbeat icon
function DiagnosticsIcon({ width = 20, height = 20, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
    );
}

// A recording keeps running after the modal closes, so the icon is the only thing
// that can tell you it is still going — without it you would leave it recording forever.
function useIsRecording() {
    const [rec, setRec] = React.useState(runtimeProfiler.recording);
    React.useEffect(() => runtimeProfiler.subscribeState(() => setRec(runtimeProfiler.recording)), []);
    return rec;
}

function HeaderBarDiagnosticsButton() {
    useSettings(["plugins.Settings.arabicMode"]);
    const recording = useIsRecording();
    return (
        <HeaderBarButton
            icon={() => <DiagnosticsIcon className={recording ? "esharq-diag-recording" : undefined} />}
            tooltip={recording
                ? t("⏺ جارٍ تسجيل الأداء — انقر للعرض أو الإيقاف", "⏺ Recording profile — click to view or stop")
                : t("تشخيص إِشراق", "Esharq Diagnostics")}
            onClick={openDiagnostics}
        />
    );
}

// يبدأ حارس الذاكرة (بإشعار يفتح نافذة التشخيص عند الرصد) — idempotent.
function armMemoryGuard() {
    startMemoryGuard(growthMB => {
        showNotification({
            title: "EsharqDiagnostics",
            body: t(
                `يبدو أن هناك تسريب ذاكرة: خطّ أساس الذاكرة ارتفع ~${growthMB}MB خلال آخر 15 دقيقة رغم عمل جامع المهملات. افتح التشخيص لعزل المسبّب.`,
                `Possible memory leak: the heap baseline grew ~${growthMB}MB over the last 15 minutes despite garbage collection. Open Diagnostics to isolate the cause.`
            ),
            color: "#faa81a",
            onClick: openDiagnostics
        });
    });
}

const settings = definePluginSettings({
    liveInterval: {
        type: OptionType.SLIDER,
        description: t("الفاصل الزمني لتحديث المراقبة الحية (بالثواني)", "Live-monitoring refresh interval (seconds)"),
        markers: [3, 5, 10, 15, 30],
        default: 5,
        stickToMarkers: true,
    },
    // مُطفأ افتراضياً — المستخدم وحده يقرّر تشغيله. عند تفعيله: عيّنة heap كل دقيقة فقط
    // (قراءة خاصية واحدة)، وإشعار واحد في الجلسة إذا نما خطّ الأساس بعد GC نموّاً مطّرداً.
    memoryGuard: {
        type: OptionType.BOOLEAN,
        description: t(
            "🛡️ حارس الذاكرة (اختياري): مراقبة خلفية خفيفة جداً (عيّنة/دقيقة) تُنبّهك مرة واحدة إذا رُصد نموّ ذاكرة مطّرد يشبه التسريب — مُطفأ افتراضياً.",
            "🛡️ Memory guard (optional): ultra-light background watch (one sample/minute) that notifies you once if sustained leak-like memory growth is detected — off by default."
        ),
        default: false,
        onChange(value: boolean) {
            if (value) armMemoryGuard();
            else stopMemoryGuard();
        }
    },
    open: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button onClick={openDiagnostics}>{t("فحص التشخيص", "Scan Diagnostics")}</Button>
        ),
    },
});

export default definePlugin({
    name: "EsharqDiagnostics",
    description: "On-demand diagnostics suite: plugin footprint snapshots, live profiling (CPU/RAM/FPS/event-loop/Flux dispatch), unapplied-patch audit, a real causal impact test that measures a plugin ON vs OFF, baseline comparison and measurement-backed recommendations. Zero cost when idle.",
    tags: ["Utility"],
    authors: [EquicordDevs.LOSTSTR],
    dependencies: ["HeaderBarAPI"],
    settings,

    // Easy-access button in the top-right header bar (in addition to the settings button)
    headerBarButton: {
        icon: DiagnosticsIcon,
        render: HeaderBarDiagnosticsButton,
    },

    start() {
        // الحارس اختياري ومُطفأ افتراضياً — لا يعمل شيء في الخلفية إلا إذا فعّله المستخدم.
        if (settings.store.memoryGuard) armMemoryGuard();
    },

    stop() {
        stopMemoryGuard();
        // A recording no longer dies with the modal, so disabling the plugin is the
        // only remaining backstop — otherwise its timers and the __esharqProf global
        // would outlive the plugin itself.
        runtimeProfiler.stop();
    },
});
