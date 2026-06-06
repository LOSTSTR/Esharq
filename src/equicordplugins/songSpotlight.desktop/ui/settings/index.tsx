/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { apiConstants, deleteData, getData, saveData } from "@equicordplugins/songSpotlight.desktop/lib/api";
import { presentOAuth2Modal } from "@equicordplugins/songSpotlight.desktop/lib/oauth2";
import { useAuthorizationStore } from "@equicordplugins/songSpotlight.desktop/lib/stores/AuthorizationStore";
import { useSongStore } from "@equicordplugins/songSpotlight.desktop/lib/stores/SongStore";
import { cl } from "@equicordplugins/songSpotlight.desktop/lib/utils";
import { Native } from "@equicordplugins/songSpotlight.desktop/service";
import { Spinner } from "@equicordplugins/songSpotlight.desktop/ui/common";
import SongList from "@equicordplugins/songSpotlight.desktop/ui/settings/SongList";
import { UserData, UserDataSchema } from "@song-spotlight/api/structs";
import { sid } from "@song-spotlight/api/util";
import { readClipboard } from "@utils/clipboard";
import { copyWithToast } from "@utils/discord";
import { t } from "@utils/esharqI18n";
import { RenderModalProps } from "@vencord/discord-types";
import { Alerts, Modal,openModal, Parser, showToast, Toasts, useCallback, useEffect, useMemo, useRef, useState } from "@webpack/common";

interface ImportButtonProps {
    overwrite: boolean;
    pending: boolean;
    setPending(pending: boolean): void;
    onImport(data: UserData): void;
}

function ImportButton({ overwrite, pending, setPending, onImport }: ImportButtonProps) {
    const checkClipboard = useCallback(async () => {
        setPending(true);

        let json: unknown;
        try {
            json = JSON.parse(await readClipboard());
        } catch {
            setPending(false);
            return showToast(t("لا يوجد JSON في الحافظة!", "No JSON in clipboard!"), Toasts.Type.FAILURE);
        }

        const { error, data } = UserDataSchema.max(apiConstants.songLimit).safeParse(json);
        if (error) {
            setPending(false);
            return showToast(t("بيانات Song Spotlight في الحافظة غير صالحة!", "Invalid Song Spotlight data in clipboard!"), Toasts.Type.FAILURE);
        }

        const validated = await Promise.allSettled(data.map(song => Native.validateSong(song)));
        if (!validated.every(x => x.status === "fulfilled" && x.value)) {
            setPending(false);
            return showToast(t("أغنية واحدة أو أكثر من المستوردة غير صالحة.", "One or more imported songs were invalid."), Toasts.Type.FAILURE);
        }

        onImport(data);
        setPending(false);
        showToast(t("تم استيراد الأغاني من الحافظة!", "Imported songs from clipboard!"), Toasts.Type.SUCCESS);
    }, [pending]);

    return (
        <Button
            variant="secondary"
            onClick={async () => {
                if (overwrite) {
                    Alerts.show({
                        title: t("هل أنت متأكد؟", "Are you sure?"),
                        body: t("سيستبدل هذا أغانيك الحالية.", "This will overwrite your current songs."),
                        onConfirm: checkClipboard,
                        confirmText: t("متابعة", "Continue"),
                        cancelText: t("لا عليك", "Nevermind"),
                    });
                } else checkClipboard();
            }}
            disabled={pending}
        >
            {t("استيراد من الحافظة", "Import from clipboard")}
        </Button>
    );
}

interface SettingsProps {
    templateData?: UserData;
}

export default function Settings({ templateData }: SettingsProps) {
    const { isAuthorized, deleteTokens } = useAuthorizationStore();
    const { self } = useSongStore();

    const ticked = useRef(false);
    const [localData, setLocalData] = useState(templateData ?? self?.data);
    useEffect(() => {
        // only setLocalData on the second time this effect runs
        if (ticked.current) setLocalData(self?.data);
        else ticked.current = true;
    }, [self?.data]);
    const [pending, setPending] = useState(!localData);

    const isSame = useMemo(() =>
        self?.data && localData
            ? self.data.length === localData.length && self.data.map(sid).join(",") === localData.map(sid).join(",")
            : true, [self?.data, localData]);

    useEffect(() => {
        if (isAuthorized() && !localData) getData().then(() => setPending(false));
    }, [isAuthorized()]);

    if (!isAuthorized()) return <Button onClick={() => presentOAuth2Modal()}>{t("تسجيل الدخول إلى Song Spotlight", "Sign in to Song Spotlight")}</Button>;

    return (
        <Flex flexDirection="column" gap="20px">
            <BaseText size="md" weight="normal">
                {t("يمكنك أيضاً عرض أغانيك عبر الأمر", "You can also view your songs via the")} {Parser.parse("</songspotlight:1468320979938971802>")}{t("!", " command!")}
            </BaseText>
            {localData
                ? (
                    <Flex flexDirection="column" gap="12px">
                        <Flex flexDirection="column" gap={0}>
                            <BaseText size="lg" weight="semibold">{t("الأغاني", "Songs")}</BaseText>
                            {self?.at
                                && (
                                    <BaseText size="xs" weight="normal" className={cl("sub")}>
                                        {t("آخر تحديث", "Last updated")} <b>{Intl.DateTimeFormat().format(new Date(self.at))}</b>
                                    </BaseText>
                                )}
                        </Flex>
                        <Flex flexDirection="column" gap="6px">
                            <SongList
                                localData={localData}
                                setLocalData={setLocalData}
                            />
                        </Flex>
                        <Flex flexDirection="column" gap="8px">
                            <div className={cl("twin-buttons")}>
                                <Button
                                    variant="secondary"
                                    onClick={() => copyWithToast(JSON.stringify(localData))}
                                    disabled={pending}
                                >
                                    {t("نسخ إلى الحافظة", "Copy to clipboard")}
                                </Button>
                                <ImportButton
                                    overwrite={!!localData[0]}
                                    pending={pending}
                                    setPending={setPending}
                                    onImport={setLocalData}
                                />
                            </div>
                            <Button
                                variant="primary"
                                onClick={async () => {
                                    setPending(true);
                                    try {
                                        await saveData(localData);
                                        showToast(t("تم حفظ الأغاني بنجاح!", "Successfully saved songs!"), Toasts.Type.SUCCESS);
                                    } finally {
                                        setPending(false);
                                    }
                                }}
                                disabled={isSame || pending}
                            >
                                {t("حفظ", "Save")}
                            </Button>
                        </Flex>
                    </Flex>
                )
                : <Spinner type={Spinner.Type.WANDERING_CUBES} />}
            <Flex flexDirection="column" gap="12px">
                <BaseText size="lg" weight="semibold">{t("التفويض", "Authorization")}</BaseText>
                <div className={cl("twin-buttons")}>
                    <Button
                        variant="dangerPrimary"
                        onClick={() => {
                            deleteTokens();
                            showToast("Successfully signed out!", Toasts.Type.SUCCESS);
                        }}
                        disabled={pending}
                    >{t("تسجيل الخروج", "Sign out")}</Button>
                    <Button
                        variant="dangerSecondary"
                        onClick={() =>
                            Alerts.show({
                                title: t("هل أنت متأكد؟", "Are you sure?"),
                                body: t("سيحذف هذا جميع أغانيك نهائياً.", "This will permanently delete all of your songs."),
                                onConfirm: async () => {
                                    setPending(true);
                                    try {
                                        await deleteData();
                                        deleteTokens();

                                        showToast(t("تم حذف الأغاني بنجاح!", "Successfully deleted songs!"), Toasts.Type.SUCCESS);
                                    } finally {
                                        setPending(false);
                                    }
                                },
                                confirmColor: "danger",
                                confirmText: t("حذف", "Delete"),
                                cancelText: t("لا عليك", "Nevermind"),
                            })}
                        disabled={!self?.data[0] || pending}
                    >{t("حذف الأغاني", "Delete songs")}</Button>
                </div>
            </Flex>
        </Flex>
    );
}

export function SettingsModal({ modalProps, ...props }: SettingsProps & { modalProps: RenderModalProps; }) {
    return (
        <ErrorBoundary>
            <Modal {...modalProps} size="lg" title="Song Spotlight">
                <div style={{ marginBottom: "20px" }}>
                    <Settings {...props} />
                </div>
            </Modal>
        </ErrorBoundary>
    );
}

export function openSettingsModal(templateData?: UserData) {
    openModal(modalProps => <SettingsModal modalProps={modalProps} templateData={templateData} />);
}
