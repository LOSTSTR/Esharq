/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Button, openModal, React } from "@webpack/common";

import { DiagnosticsModal } from "./DiagnosticsModal";
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

function HeaderBarDiagnosticsButton() {
    useSettings(["plugins.Settings.arabicMode"]);
    return (
        <HeaderBarButton
            icon={DiagnosticsIcon}
            tooltip={t("تشخيص إِشراق", "Esharq Diagnostics")}
            onClick={openDiagnostics}
        />
    );
}

const settings = definePluginSettings({
    liveInterval: {
        type: OptionType.SLIDER,
        description: t("الفاصل الزمني لتحديث المراقبة الحية (بالثواني)", "Live-monitoring refresh interval (seconds)"),
        markers: [3, 5, 10, 15, 30],
        default: 5,
        stickToMarkers: true,
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
    description: "On-demand, one-shot snapshot of each enabled plugin's footprint (patches, listeners, UI injects, load). Zero cost when idle.",
    tags: ["Utility"],
    authors: [EquicordDevs.LOSTSTR],
    dependencies: ["HeaderBarAPI"],
    settings,

    // Easy-access button in the top-right header bar (in addition to the settings button)
    headerBarButton: {
        icon: DiagnosticsIcon,
        render: HeaderBarDiagnosticsButton,
    },
});
