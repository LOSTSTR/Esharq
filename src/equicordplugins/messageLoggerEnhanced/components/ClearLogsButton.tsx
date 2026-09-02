/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { t } from "@utils/esharqI18n";
import { Alerts, Toasts, useState } from "@webpack/common";

import { clearMessagesIDB } from "../db";
import { Flogger } from "../index";

interface ClearLogsButtonProps {
    label?: string;
    onCleared?: () => void;
}

export function ClearLogsButton({ label = t("مسح السجلات", "Clear Logs"), onCleared }: ClearLogsButtonProps) {
    const [loading, setLoading] = useState(false);
    return (
        <Button
            disabled={loading}
            variant="dangerPrimary"
            onClick={() => Alerts.show({
                title: t("مسح السجلات", "Clear Logs"),
                body: t("هل أنت متأكد أنك تريد مسح جميع السجلات؟", "Are you sure you want to clear all logs?"),
                // @ts-ignore
                confirmVariant: "critical-primary",
                confirmText: t("مسح", "Clear"),
                cancelText: t("إلغاء", "Cancel"),
                onConfirm: async () => {
                    setLoading(true);
                    try {
                        await clearMessagesIDB();
                        onCleared?.();
                        Toasts.show({
                            id: Toasts.genId(),
                            message: t("مُسحت السجلات", "Cleared Logs"),
                            type: Toasts.Type.SUCCESS
                        });
                    } catch (err) {
                        Flogger.error("Failed to clear logs", err);
                        Toasts.show({
                            id: Toasts.genId(),
                            message: t("فشل مسح السجلات", "Failed to clear logs"),
                            type: Toasts.Type.FAILURE
                        });
                    } finally {
                        setLoading(false);
                    }
                },
            })}
        >
            {loading ? t("جارٍ مسح السجلات...", "Clearing Logs...") : label}
        </Button>
    );
}
