/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { SettingsSection } from "@components/settings/tabs/plugins/components/Common";
import { Switch } from "@components/Switch";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import { useForceUpdater } from "@utils/react";
import { OptionType } from "@utils/types";
import { React, Select, showToast, TextArea, TextInput, Toasts } from "@webpack/common";

import { CORS_PROXY } from "./constants";
import { fallbackServiceOrder, serviceLabels, ServiceType } from "./types";
import { parseShareXConfig } from "./utils/sharex";

const defaultFallbackOrder = fallbackServiceOrder.join(",");
const cl = classNameFactory("vc-file-upload-settings-");

const serviceOptions = [
    { label: "Zipline", value: ServiceType.ZIPLINE, default: true },
    { label: "E-Z Host", value: ServiceType.EZHOST },
    { label: "Nest", value: ServiceType.NEST },
    { label: "Encrypting.host", value: ServiceType.ENCRYPTINGHOST },
    { label: "S3-Compatible", value: ServiceType.S3 },
    { label: "Catbox.moe", value: ServiceType.CATBOX },
    ...(IS_DISCORD_DESKTOP ? [{ label: "0x0.st", value: ServiceType.ZEROX0 }] : []),
    { label: "Litterbox", value: ServiceType.LITTERBOX },
    { label: "GoFile", value: ServiceType.GOFILE },
    { label: "tmpfiles.org", value: ServiceType.TMPFILES },
    { label: "buzzheavier.com", value: ServiceType.BUZZHEAVIER },
    { label: "temp.sh", value: ServiceType.TEMPSH },
    { label: "filebin.net", value: ServiceType.FILEBIN },
    { label: "PixelVault", value: ServiceType.PIXELVAULT },
    { label: "PixelDrain", value: ServiceType.PIXELDRAIN },
    { label: "ShareX Custom Uploader", value: ServiceType.SHAREX }
];

const litterboxOptions = [
    { label: "1 hour", value: "1h" },
    { label: "12 hours", value: "12h" },
    { label: "24 hours", value: "24h", default: true },
    { label: "72 hours", value: "72h" }
];

const embedProxyOptions = [
    { label: "CORS Proxy", value: "cors", default: true },
    { label: "discord.nfp.is", value: "nfp" }
];

const encryptingHostUrlStyleOptions = [
    { label: "Query", value: "query", default: true },
    { label: "Param", value: "param" },
    { label: "Fake Link", value: "fakelink" },
    { label: "Embed", value: "embed" }
];

export const settings = definePluginSettings({
    serviceType: {
        type: OptionType.SELECT,
        get description() { return t("خدمة الرفع المحددة", "Selected upload service"); },
        options: serviceOptions,
        hidden: true
    },
    serviceUrl: {
        type: OptionType.STRING,
        get description() { return t("رابط خدمة Zipline", "Zipline service URL"); },
        default: "",
        hidden: true
    },
    ziplineToken: {
        type: OptionType.STRING,
        get description() { return t("رمز مصادقة Zipline", "Zipline authentication token"); },
        default: "",
        hidden: true
    },
    folderId: {
        type: OptionType.STRING,
        get description() { return t("معرّف مجلد Zipline الاختياري", "Optional Zipline folder ID"); },
        default: "",
        hidden: true
    },
    ezHostKey: {
        type: OptionType.STRING,
        get description() { return t("مفتاح API لـ E-Z Host", "E-Z Host API key"); },
        default: "",
        hidden: true
    },
    nestToken: {
        type: OptionType.STRING,
        get description() { return t("رمز API لـ Nest", "Nest API token"); },
        default: "",
        hidden: true
    },
    encryptingHostKey: {
        type: OptionType.STRING,
        description: "Encrypting.host API key",
        default: "",
        hidden: true
    },
    encryptingHostUrlStyle: {
        type: OptionType.SELECT,
        description: "Encrypting.host URL style",
        options: encryptingHostUrlStyleOptions,
        default: "query",
        hidden: true
    },
    encryptingHostDomains: {
        type: OptionType.STRING,
        description: "Encrypting.host domains JSON list",
        default: "[\"offensive\"]",
        hidden: true
    },
    encryptingHostTitle: {
        type: OptionType.STRING,
        description: "Optional Encrypting.host embed title",
        default: "",
        hidden: true
    },
    encryptingHostColor: {
        type: OptionType.STRING,
        description: "Optional Encrypting.host embed color",
        default: "",
        hidden: true
    },
    encryptingHostFakelink: {
        type: OptionType.STRING,
        description: "Optional Encrypting.host fake link",
        default: "",
        hidden: true
    },
    s3Endpoint: {
        type: OptionType.STRING,
        get description() { return t("رابط نقطة النهاية المتوافقة مع S3", "S3-compatible endpoint URL"); },
        default: "",
        hidden: true
    },
    s3Bucket: {
        type: OptionType.STRING,
        get description() { return t("اسم حاوية S3", "S3 bucket name"); },
        default: "",
        hidden: true
    },
    s3Region: {
        type: OptionType.STRING,
        get description() { return t("منطقة S3 (استخدم auto لـ R2)", "S3 region (use auto for R2)"); },
        default: "auto",
        hidden: true
    },
    s3AccessKeyId: {
        type: OptionType.STRING,
        get description() { return t("معرّف مفتاح الوصول لـ S3", "S3 access key ID"); },
        default: "",
        hidden: true
    },
    s3SecretAccessKey: {
        type: OptionType.STRING,
        get description() { return t("مفتاح الوصول السري لـ S3", "S3 secret access key"); },
        default: "",
        hidden: true
    },
    s3SessionToken: {
        type: OptionType.STRING,
        get description() { return t("رمز جلسة S3 الاختياري", "Optional S3 session token"); },
        default: "",
        hidden: true
    },
    s3PublicUrl: {
        type: OptionType.STRING,
        get description() { return t("رابط القاعدة العامة الاختياري", "Optional public base URL"); },
        default: "",
        hidden: true
    },
    s3Prefix: {
        type: OptionType.STRING,
        get description() { return t("بادئة مفتاح كائن S3 الاختيارية", "Optional S3 object key prefix"); },
        default: "",
        hidden: true
    },
    s3ForcePathStyle: {
        type: OptionType.BOOLEAN,
        get description() { return t("استخدام روابط S3 بأسلوب المسار", "Use S3 path-style URLs"); },
        default: true,
        hidden: true
    },
    litterboxExpiry: {
        type: OptionType.SELECT,
        get description() { return t("مدة الاحتفاظ في Litterbox", "Litterbox retention duration"); },
        options: litterboxOptions,
        default: "24h",
        hidden: true
    },
    catboxUserhash: {
        type: OptionType.STRING,
        get description() { return t("رمز مستخدم Catbox لربط الحساب", "Catbox userhash for account binding"); },
        default: "",
        hidden: true
    },
    sharexConfig: {
        type: OptionType.STRING,
        get description() { return t("ملف JSON لرافع ShareX المخصص", "JSON config for ShareX custom uploader"); },
        default: "",
        hidden: true
    },
    disableFallbacks: {
        type: OptionType.BOOLEAN,
        get description() { return t("تعطيل خدمات الرفع الاحتياطية", "Disable fallback upload services"); },
        default: false,
        hidden: true
    },
    autoSend: {
        type: OptionType.BOOLEAN,
        get description() { return t("إدراج رابط الملف المرفوع في مربع الدردشة", "Insert uploaded file link into the chat input"); },
        default: false,
        hidden: true
    },
    autoFormat: {
        type: OptionType.BOOLEAN,
        get description() { return t("تغليف الرابط المدرج بأقواس زاوية", "Wrap inserted link in angle brackets"); },
        default: false,
        hidden: true
    },
    bypassDiscordUpload: {
        type: OptionType.BOOLEAN,
        get description() { return t("تجاوز رفع Discord واستخدام FileUpload عوضاً عنه.", "Bypass Discord upload and use FileUpload instead."); },
        default: true,
        hidden: true
    },
    bypassDiscordUploadOnlyOverLimit: {
        type: OptionType.BOOLEAN,
        get description() { return t("استخدام FileUpload فقط إذا تجاوزت الملفات حد الحجم المسموح.", "Use FileUpload only if files exceed the allowed size limit."); },
        default: true,
        hidden: true
    },
    gofileToken: {
        type: OptionType.STRING,
        get description() { return t("رمز API لـ GoFile الاختياري", "Optional GoFile API token"); },
        default: "",
        hidden: true
    },
    fallbackOrder: {
        type: OptionType.STRING,
        get description() { return t("ترتيب الرافعين الاحتياطيين", "Order of fallback uploaders"); },
        default: defaultFallbackOrder,
        hidden: true
    },
    pixelVaultKey: {
        type: OptionType.STRING,
        get description() { return t("مفتاح رفع PixelVault", "PixelVault upload key"); },
        default: "",
        hidden: true
    },
    pixelDrainKey: {
        type: OptionType.STRING,
        get description() { return t("مفتاح API لـ PixelDrain الاختياري", "Optional PixelDrain API key"); },
        default: "",
        hidden: true
    },
    uploadTimeoutMs: {
        type: OptionType.NUMBER,
        get description() { return t("مهلة الرفع بالمللي ثانية", "Upload timeout in milliseconds"); },
        default: 300000,
        hidden: true
    },
    stripQueryParams: {
        type: OptionType.BOOLEAN,
        get description() { return t("إزالة معاملات الاستعلام من روابط الملفات المرفوعة", "Strip query parameters from uploaded file links"); },
        default: false,
        hidden: true
    },
    embedProxyEnabled: {
        type: OptionType.BOOLEAN,
        get description() { return t("توجيه روابط الفيديو المرفوعة عبر خدمة مساعدة للتضمين.", "Route uploaded video links through an embed helper service."); },
        default: false,
        hidden: true
    },
    embedProxyService: {
        type: OptionType.SELECT,
        get description() { return t("خدمة مساعدة التضمين لتغليف روابط الفيديو المرفوعة.", "Embed helper service for wrapping uploaded video links."); },
        options: embedProxyOptions,
        default: "cors",
        hidden: true
    },
    corsProxyUrl: {
        type: OptionType.STRING,
        get description() { return t("رابط وكيل CORS المستخدم لرفع المتصفح", "CORS proxy URL used for browser uploads"); },
        default: CORS_PROXY,
        hidden: true
    },
    apngToGif: {
        type: OptionType.BOOLEAN,
        get description() { return t("تحويل ملفات APNG المرفوعة إلى GIF", "Convert uploaded APNG files to GIF"); },
        default: false,
        hidden: true
    },
    preserveOriginalFilename: {
        type: OptionType.BOOLEAN,
        get description() { return t("الحفاظ على اسم الملف الأصلي عند الرفع.", "Preserve the original filename when uploading."); },
        default: true,
        hidden: true
    },
    autoCopy: {
        type: OptionType.BOOLEAN,
        get description() { return t("نسخ رابط الرفع تلقائياً", "Automatically copy the upload link"); },
        default: true,
        hidden: true
    },
    autoUploadPastedFiles: {
        type: OptionType.BOOLEAN,
        get description() { return t("رفع الملفات تلقائياً من الحافظة إلى خدمة الصور عند اللصق في مربع الدردشة.", "Automatically upload files from clipboard to the image service when pasting in the chat input."); },
        default: false
    },
    settingsComponent: {
        type: OptionType.COMPONENT,
        get description() { return t("الإعدادات", "Settings"); },
        component: SettingsComponent
    }
});

function SettingTextInput(props: {
    description: string;
    name: string;
    onChange: (value: string) => void;
    placeholder: string;
    value: string;
}) {
    const { description, name, onChange, placeholder, value } = props;

    return (
        <SettingsSection name={name} description={description ?? ""}>
            <TextInput
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
        </SettingsSection>
    );
}

function SettingGroup(props: {
    children: React.ReactNode;
    description?: string;
    name: string;
}) {
    const { children, description, name } = props;

    return (
        <SettingsSection name={name} description={description ?? ""}>
            <div className={cl("group")}>
                {children}
            </div>
        </SettingsSection>
    );
}

function SettingSwitch(props: {
    checked: boolean;
    description: string;
    name: string;
    onChange: (value: boolean) => void;
}) {
    const { checked, description, name, onChange } = props;

    return (
        <SettingsSection tag="label" name={name} description={description} inlineSetting>
            <Switch checked={checked} onChange={onChange} />
        </SettingsSection>
    );
}

function ServicePicker(props: {
    onChange: (service: ServiceType) => void;
    value: ServiceType;
}) {
    const { onChange, value } = props;

    return (
        <div className={cl("service-grid")}>
            {serviceOptions.map(option => (
                <button
                    key={option.value}
                    type="button"
                    className={cl("service-option")}
                    data-selected={option.value === value}
                    onClick={() => onChange(option.value)}
                >
                    <span className={cl("service-option-label")}>{option.label}</span>
                </button>
            ))}
        </div>
    );
}

function FallbackOrderSettings() {
    const update = useForceUpdater();
    const { store } = settings;
    const [dragIndex, setDragIndex] = React.useState<number | null>(null);
    const [order, setOrder] = React.useState<ServiceType[]>(() => {
        const configured = (store.fallbackOrder || defaultFallbackOrder)
            .split(/[\n,]/)
            .map(entry => entry.trim())
            .filter((entry): entry is ServiceType => Object.values(ServiceType).includes(entry as ServiceType));

        return configured.length === fallbackServiceOrder.length && new Set(configured).size === fallbackServiceOrder.length
            ? configured
            : fallbackServiceOrder;
    });

    const commitOrder = (nextOrder: ServiceType[]) => {
        setOrder(nextOrder);
        store.fallbackOrder = nextOrder.join(",");
        update();
    };

    return (
        <SettingsSection name="Fallback Order" description="Drag hosts to reorder fallback attempts. The selected host is tried first, then this order is used.">
            <div className={cl("fallback-order-list")}>
                {order.map((service, index) => (
                    <div
                        key={service}
                        className={cl("fallback-order-item")}
                        draggable
                        onDragStart={event => {
                            setDragIndex(index);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", String(index));
                        }}
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => {
                            event.preventDefault();
                            const sourceIndex = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
                            if (!Number.isInteger(sourceIndex) || sourceIndex === index || sourceIndex < 0 || sourceIndex >= order.length) {
                                setDragIndex(null);
                                return;
                            }

                            const nextOrder = [...order];
                            const [moved] = nextOrder.splice(sourceIndex, 1);
                            nextOrder.splice(index, 0, moved);
                            setDragIndex(null);
                            commitOrder(nextOrder);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        data-dragging={dragIndex === index}
                    >
                        <span className={cl("fallback-order-label")}>{serviceLabels[service]}</span>
                        <span className={cl("fallback-order-handle")}>Drag</span>
                    </div>
                ))}
            </div>
            <div className={cl("fallback-order-actions")}>
                <Button size="small" onClick={() => commitOrder(fallbackServiceOrder)}>{t("إعادة للافتراضي", "Reset to default")}</Button>
            </div>
        </SettingsSection>
    );
}

export function SettingsComponent() {
    const update = useForceUpdater();
    const { store } = settings;
    const sharexFileInputRef = React.useRef<HTMLInputElement>(null);
    const isNest = store.serviceType === ServiceType.NEST;
    const isEzHost = store.serviceType === ServiceType.EZHOST;
    const isEncryptingHost = store.serviceType === ServiceType.ENCRYPTINGHOST;
    const isS3 = store.serviceType === ServiceType.S3;
    const isZipline = store.serviceType === ServiceType.ZIPLINE;
    const isCatbox = store.serviceType === ServiceType.CATBOX;
    const isLitterbox = store.serviceType === ServiceType.LITTERBOX;
    const isGofile = store.serviceType === ServiceType.GOFILE;
    const isPixelVault = store.serviceType === ServiceType.PIXELVAULT;
    const isPixelDrain = store.serviceType === ServiceType.PIXELDRAIN;
    const isShareX = store.serviceType === ServiceType.SHAREX;

    const validateShareXConfig = () => {
        try {
            parseShareXConfig(store.sharexConfig || "");
            showToast("ShareX config is valid", Toasts.Type.SUCCESS);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid ShareX config";
            showToast(message, Toasts.Type.FAILURE);
        }
    };

    const triggerShareXFileUpload = () => {
        sharexFileInputRef.current?.click();
    };

    const handleShareXFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            try {
                const content = String(e.target?.result || "");
                const parsed = parseShareXConfig(content);
                store.sharexConfig = JSON.stringify(parsed, null, 2);
                update();
                showToast("Imported ShareX config", Toasts.Type.SUCCESS);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to import ShareX config";
                showToast(message, Toasts.Type.FAILURE);
            }
        };
        reader.readAsText(file);
        event.target.value = "";
    };

    return (
        <>
            <SettingsSection name="Upload Service" description="Choose where FileUpload sends new files.">
                <ServicePicker
                    value={store.serviceType as ServiceType}
                    onChange={service => {
                        store.serviceType = service;
                        update();
                    }}
                />
            </SettingsSection>

            {isZipline && (
                <SettingGroup name="Zipline" description="Connection details for your Zipline instance.">
                    <SettingTextInput
                        name="Service URL"
                        description="The URL of your Zipline instance"
                        value={store.serviceUrl}
                        onChange={v => store.serviceUrl = v}
                        placeholder="https://your-zipline-instance.com"
                    />
                    <SettingTextInput
                        name="Zipline Token"
                        description="Your Zipline API authorization token"
                        value={store.ziplineToken}
                        onChange={v => store.ziplineToken = v}
                        placeholder={t("رمز API الخاص بـ Zipline", "Your Zipline API token")}
                    />
                    <SettingTextInput
                        name="Folder ID"
                        description="Folder ID for uploads (leave empty for no folder)"
                        value={store.folderId}
                        onChange={v => store.folderId = v}
                        placeholder={t("اتركه فارغاً لعدم استخدام مجلد", "Leave empty for no folder")}
                    />
                </SettingGroup>
            )}

            {isEzHost && (
                <SettingGroup name="E-Z Host" description="Connection details for E-Z Host uploads.">
                    <SettingTextInput
                        name="E-Z Host API Key"
                        description="Your E-Z Host API key"
                        value={store.ezHostKey}
                        onChange={v => store.ezHostKey = v}
                        placeholder={t("مفتاح API الخاص بـ E-Z Host", "Your E-Z Host API key")}
                    />
                </SettingGroup>
            )}

            {isNest && (
                <SettingGroup name="Nest" description="Connection details for Nest uploads.">
                    <SettingTextInput
                        name="Nest Token"
                        description="Your Nest API authorization token"
                        value={store.nestToken}
                        onChange={v => store.nestToken = v}
                        placeholder={t("رمز API الخاص بـ Nest", "Your Nest API token")}
                    />
                </SettingGroup>
            )}

            {isEncryptingHost && (
                <SettingGroup name="Encrypting.host" description="Connection details for Encrypting.host uploads.">
                    <SettingTextInput
                        name="Encrypting.host API Key"
                        description="Your Encrypting.host API key"
                        value={(store as { encryptingHostKey?: string; }).encryptingHostKey || ""}
                        onChange={v => (store as { encryptingHostKey?: string; }).encryptingHostKey = v}
                        placeholder={t("مفتاح API الخاص بـ Encrypting.host", "Your Encrypting.host API key")}
                    />
                    <SettingsSection name="URL Style" description="How Encrypting.host should format returned links.">
                        <Select
                            options={encryptingHostUrlStyleOptions}
                            isSelected={v => v === (store as { encryptingHostUrlStyle?: string; }).encryptingHostUrlStyle}
                            select={v => {
                                (store as { encryptingHostUrlStyle?: string; }).encryptingHostUrlStyle = v;
                                update();
                            }}
                            serialize={v => v}
                            placeholder={t("اختر نمط الرابط", "Select URL style")}
                        />
                    </SettingsSection>
                    <SettingsSection name="Domains JSON" description={"JSON array of domains to use, for example [\"offensive\"]."}>
                        <TextArea
                            value={(store as { encryptingHostDomains?: string; }).encryptingHostDomains || ""}
                            rows={3}
                            placeholder='["offensive"]'
                            onChange={v => (store as { encryptingHostDomains?: string; }).encryptingHostDomains = v}
                        />
                    </SettingsSection>
                    <SettingTextInput
                        name="Embed Title"
                        description="Optional title for embed style responses."
                        value={(store as { encryptingHostTitle?: string; }).encryptingHostTitle || ""}
                        onChange={v => (store as { encryptingHostTitle?: string; }).encryptingHostTitle = v}
                        placeholder={t("عنوان (اختياري)", "Optional title")}
                    />
                    <SettingTextInput
                        name="Embed Color"
                        description="Optional color for embed style responses."
                        value={(store as { encryptingHostColor?: string; }).encryptingHostColor || ""}
                        onChange={v => (store as { encryptingHostColor?: string; }).encryptingHostColor = v}
                        placeholder={t("لون (اختياري)", "Optional color")}
                    />
                    <SettingTextInput
                        name="Fake Link"
                        description="Optional fake link value for fakelink style responses."
                        value={(store as { encryptingHostFakelink?: string; }).encryptingHostFakelink || ""}
                        onChange={v => (store as { encryptingHostFakelink?: string; }).encryptingHostFakelink = v}
                        placeholder={t("رابط وهمي (اختياري)", "Optional fake link")}
                    />
                </SettingGroup>
            )}

            {isS3 && (
                <SettingGroup name="S3-Compatible Storage" description="Connection details and object naming for your bucket.">
                    <SettingTextInput
                        name="S3 Endpoint URL"
                        description="S3-compatible endpoint (e.g. https://<accountid>.r2.cloudflarestorage.com)"
                        value={store.s3Endpoint}
                        onChange={v => store.s3Endpoint = v}
                        placeholder="https://your-endpoint.example.com"
                    />
                    <SettingTextInput
                        name="Bucket Name"
                        description="Bucket to upload into"
                        value={store.s3Bucket}
                        onChange={v => store.s3Bucket = v}
                        placeholder="my-bucket"
                    />
                    <SettingTextInput
                        name="Region"
                        description="AWS region or auto for Cloudflare R2"
                        value={store.s3Region}
                        onChange={v => store.s3Region = v}
                        placeholder="auto"
                    />
                    <SettingTextInput
                        name="Access Key ID"
                        description="S3-compatible access key"
                        value={store.s3AccessKeyId}
                        onChange={v => store.s3AccessKeyId = v}
                        placeholder={t("معرّف مفتاح الوصول الخاص بك", "Your access key ID")}
                    />
                    <SettingTextInput
                        name="Secret Access Key"
                        description="S3-compatible secret key"
                        value={store.s3SecretAccessKey}
                        onChange={v => store.s3SecretAccessKey = v}
                        placeholder={t("مفتاح الوصول السرّي الخاص بك", "Your secret access key")}
                    />
                    <SettingTextInput
                        name="Session Token"
                        description="Optional temporary credential token"
                        value={store.s3SessionToken}
                        onChange={v => store.s3SessionToken = v}
                        placeholder={t("رمز جلسة (اختياري)", "Optional session token")}
                    />
                    <SettingTextInput
                        name="Public Base URL"
                        description="Optional public URL base to use for returned links"
                        value={store.s3PublicUrl}
                        onChange={v => store.s3PublicUrl = v}
                        placeholder="https://cdn.example.com"
                    />
                    <SettingTextInput
                        name="Object Key Prefix"
                        description="Optional folder/prefix inside the bucket"
                        value={store.s3Prefix}
                        onChange={v => store.s3Prefix = v}
                        placeholder="uploads/discord"
                    />
                    <SettingSwitch
                        name="Use Path-Style Endpoint"
                        description="Use endpoint/bucket/key format, recommended for R2."
                        checked={store.s3ForcePathStyle}
                        onChange={v => store.s3ForcePathStyle = v}
                    />
                </SettingGroup>
            )}

            {isCatbox && (
                <SettingGroup name="Catbox" description="Optional account binding for Catbox uploads.">
                    <SettingTextInput
                        name="Catbox Userhash"
                        description="Your Catbox userhash for account binding, leave empty for anonymous uploads."
                        value={store.catboxUserhash}
                        onChange={v => store.catboxUserhash = v}
                        placeholder={t("رمز userhash الخاص بـ Catbox", "Your Catbox userhash")}
                    />
                </SettingGroup>
            )}

            {isLitterbox && (
                <SettingsSection name="Litterbox Expiry" description="How long uploads are retained">
                    <Select
                        options={litterboxOptions}
                        isSelected={v => v === store.litterboxExpiry}
                        select={v => {
                            store.litterboxExpiry = v;
                            update();
                        }}
                        serialize={v => v}
                        placeholder={t("اختر مدّة الانتهاء", "Select expiry")}
                    />
                </SettingsSection>
            )}

            {isGofile && (
                <SettingGroup name="GoFile" description="Optional account binding for GoFile uploads.">
                    <SettingTextInput
                        name="GoFile Token"
                        description="Optional GoFile token to upload into your account."
                        value={store.gofileToken}
                        onChange={v => store.gofileToken = v}
                        placeholder={t("رمز GoFile (اختياري)", "Optional GoFile token")}
                    />
                </SettingGroup>
            )}

            {isPixelVault && (
                <SettingGroup name="PixelVault" description="Connection details for PixelVault uploads.">
                    <SettingTextInput
                        name="PixelVault Upload Key"
                        description="Your PixelVault authorization key."
                        value={store.pixelVaultKey}
                        onChange={v => store.pixelVaultKey = v}
                        placeholder={t("مفتاح الرفع الخاص بـ PixelVault", "Your PixelVault upload key")}
                    />
                </SettingGroup>
            )}

            {isPixelDrain && (
                <SettingGroup name="PixelDrain" description="Optional account binding for PixelDrain uploads.">
                    <SettingTextInput
                        name="PixelDrain API Key"
                        description="Optional PixelDrain API key for authenticated uploads. Leave empty for anonymous uploads."
                        value={store.pixelDrainKey}
                        onChange={v => store.pixelDrainKey = v}
                        placeholder={t("مفتاح API الخاص بـ PixelDrain", "Your PixelDrain API key")}
                    />
                </SettingGroup>
            )}

            {isShareX && (
                <SettingGroup name="ShareX Custom Uploader" description="Paste, import, or validate a ShareX custom uploader config.">
                    <SettingsSection
                        name="ShareX Custom Uploader Config"
                        description="Paste your ShareX custom uploader JSON (.sxcu/.json). DestinationType must include FileUploader or ImageUploader."
                    >
                        <TextArea
                            value={store.sharexConfig}
                            rows={10}
                            placeholder='{"RequestMethod":"POST","RequestURL":"https://example.com/api/upload","Body":"MultipartFormData"}'
                            onChange={v => store.sharexConfig = v}
                        />
                    </SettingsSection>
                    <SettingsSection name="ShareX Config Actions" description="Import from file or validate pasted config">
                        <div className={cl("actions")}>
                            <Button size="small" onClick={triggerShareXFileUpload}>{t("استيراد .sxcu/.json", "Import .sxcu/.json")}</Button>
                            <Button size="small" onClick={validateShareXConfig}>{t("تحقّق", "Validate")}</Button>
                        </div>
                        <input
                            ref={sharexFileInputRef}
                            type="file"
                            accept=".sxcu,.json,application/json,text/plain"
                            style={{ display: "none" }}
                            onChange={handleShareXFileUpload}
                        />
                    </SettingsSection>
                </SettingGroup>
            )}

            <SettingGroup name="Upload Behavior" description="Control what FileUpload does after a host returns a URL.">
                <SettingSwitch
                    name="Strip Query Parameters"
                    description="Strip query parameters from the uploaded file URL."
                    checked={store.stripQueryParams}
                    onChange={v => store.stripQueryParams = v}
                />

                <SettingSwitch
                    name="Use Embed Proxy"
                    description="Wrap uploaded video links with an embed proxy service for better Discord previews."
                    checked={store.embedProxyEnabled}
                    onChange={v => {
                        store.embedProxyEnabled = v;
                        update();
                    }}
                />

                {store.embedProxyEnabled && (
                    <SettingsSection name="Embed Proxy Service" description="Choose which embed proxy service to use for uploaded video links">
                        <Select
                            options={embedProxyOptions}
                            isSelected={v => v === store.embedProxyService}
                            select={v => {
                                store.embedProxyService = v;
                                update();
                            }}
                            serialize={v => v}
                            placeholder={t("اختر خدمة وكيل التضمين", "Select an embed proxy service")}
                        />
                    </SettingsSection>
                )}

                <SettingSwitch
                    name="Convert APNG to GIF"
                    description="Convert APNG files to GIF format."
                    checked={store.apngToGif}
                    onChange={v => store.apngToGif = v}
                />

                <SettingSwitch
                    name="Preserve Original Filename"
                    description="Use the original filename instead of naming uploads as upload.ext."
                    checked={Boolean((store as { preserveOriginalFilename?: boolean; }).preserveOriginalFilename)}
                    onChange={v => (store as { preserveOriginalFilename?: boolean; }).preserveOriginalFilename = v}
                />

                <SettingSwitch
                    name="Auto Copy URL"
                    description="Automatically copy the uploaded file URL to clipboard."
                    checked={store.autoCopy}
                    onChange={v => store.autoCopy = v}
                />

                <SettingSwitch
                    name="Disable Fallback Uploaders"
                    description="Only use the selected uploader without trying fallback hosts."
                    checked={store.disableFallbacks}
                    onChange={v => store.disableFallbacks = v}
                />

                <SettingSwitch
                    name="Insert URL into Chat Input"
                    description="After upload, insert the resulting URL into the current chat input."
                    checked={store.autoSend}
                    onChange={v => store.autoSend = v}
                />

                <SettingSwitch
                    name="Format Inserted URL"
                    description="Wrap inserted URLs in angle brackets to avoid Discord preview embedding."
                    checked={store.autoFormat}
                    onChange={v => store.autoFormat = v}
                />
            </SettingGroup>

            <SettingGroup name="Discord Integration" description="Choose when FileUpload takes over Discord file handling.">
                <SettingSwitch
                    name="Bypass Discord Upload Button"
                    description="Use FileUpload when uploading through Discord's file picker."
                    checked={Boolean((store as { bypassDiscordUpload?: boolean; }).bypassDiscordUpload)}
                    onChange={v => (store as { bypassDiscordUpload?: boolean; }).bypassDiscordUpload = v}
                />

                <SettingSwitch
                    name="Auto Upload Pasted Files"
                    description="Automatically upload files from clipboard to image host when pasting in chat input."
                    checked={store.autoUploadPastedFiles}
                    onChange={v => store.autoUploadPastedFiles = v}
                />

                <SettingSwitch
                    name="Respect Discord File Size Limit"
                    description="Use FileUpload only for files larger than your current Discord upload limit."
                    checked={store.bypassDiscordUploadOnlyOverLimit}
                    onChange={v => store.bypassDiscordUploadOnlyOverLimit = v}
                />
            </SettingGroup>

            <SettingGroup name="Network" description="Configure browser upload proxying and timeouts.">
                <SettingTextInput
                    name="CORS Proxy URL"
                    description="CORS proxy used for web uploads. Leave empty to use the default proxy."
                    value={store.corsProxyUrl || ""}
                    onChange={v => store.corsProxyUrl = v}
                    placeholder="https://your-cors-proxy.example.com"
                />

                <SettingsSection name="Default CORS Proxy Source" description="Source code for the default CORS proxy">
                    <a href="https://codeberg.org/key/corsproxy" target="_blank" rel="noreferrer">codeberg.org/key/corsproxy</a>
                </SettingsSection>

                <SettingsSection name="Upload Timeout" description="Maximum time to wait per upload attempt before switching to fallback">
                    <Select
                        options={[
                            { label: "30 seconds", value: 30000 },
                            { label: "1 minute", value: 60000 },
                            { label: "2 minutes", value: 120000 },
                            { label: "5 minutes", value: 300000, default: true },
                            { label: "10 minutes", value: 600000 }
                        ]}
                        isSelected={v => v === (store.uploadTimeoutMs || 300000)}
                        select={v => {
                            store.uploadTimeoutMs = v;
                            update();
                        }}
                        serialize={v => v}
                        placeholder={t("اختر المهلة", "Select timeout")}
                    />
                </SettingsSection>
            </SettingGroup>

            <FallbackOrderSettings />
        </>
    );
}
