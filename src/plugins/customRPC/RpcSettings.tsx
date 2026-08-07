/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./settings.css";

import { DataStore } from "@api/index";
import { isPluginEnabled } from "@api/PluginManager";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { resolveError } from "@components/settings/tabs/plugins/components/Common";
import { debounce } from "@shared/debounce";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import { useAwaiter } from "@utils/react";
import { ActivityType } from "@vencord/discord-types/enums";
import { Button, Select, showToast, Text, TextInput, Toasts, useState } from "@webpack/common";

import CustomRPCPlugin, { RpcConfig, setRpc, settings, TimestampMode } from ".";

const cl = classNameFactory("vc-customRPC-settings-");
const PRESETS_KEY = "CustomRPC_presets";

type SettingsKey = keyof typeof settings.store;

interface RpcPreset {
    name: string;
    config: RpcConfig;
}

interface TextOption<T> {
    settingsKey: SettingsKey;
    label: string;
    disabled?: boolean;
    transform?: (value: string) => T;
    isValid?: (value: T) => true | string;
    /** Render the value as an image below the field, so a wrong link is obvious here
     *  instead of only after saving and opening your own profile. */
    preview?: boolean;
}

interface SelectOption<T> {
    settingsKey: SettingsKey;
    label: string;
    disabled?: boolean;
    options: { label: string; value: T; default?: boolean; }[];
}

const makeValidator = (maxLength: number, isRequired = false) => (value: string) => {
    if (isRequired && !value) return t("هذا الحقل مطلوب.", "This field is required.");
    if (value.length > maxLength) return t(`يجب ألّا يتجاوز ${maxLength} حرفاً.`, `Must be not longer than ${maxLength} characters.`);
    return true;
};

const maxLength128 = makeValidator(128);

function isAppIdValid(value: string) {
    if (!/^\d{16,21}$/.test(value)) return t("يجب أن يكون مُعرِّف ديسكورد صالحاً.", "Must be a valid Discord ID.");
    return true;
}

const updateRPC = debounce(() => {
    setRpc(true);
    if (isPluginEnabled(CustomRPCPlugin.name)) setRpc();
});

function isStreamLinkDisabled() {
    return settings.store.type !== ActivityType.STREAMING;
}

function isStreamLinkValid(value: string) {
    if (!isStreamLinkDisabled() && !/https?:\/\/(www\.)?(twitch\.tv|youtube\.com)\/\w+/.test(value)) return t("رابط البثّ يجب أن يكون رابطاً صالحاً.", "Streaming link must be a valid URL.");
    if (value && value.length > 512) return t("رابط البثّ يجب ألّا يتجاوز ٥١٢ حرفاً.", "Streaming link must be not longer than 512 characters.");
    return true;
}

function parseNumber(value: string) {
    return value ? parseInt(value, 10) : 0;
}

function isNumberValid(value: number) {
    if (isNaN(value)) return t("يجب أن يكون رقماً.", "Must be a number.");
    if (value < 0) return t("يجب أن يكون رقماً موجباً.", "Must be a positive number.");
    return true;
}

function isUrlValid(value: string) {
    if (value && !/^https?:\/\/.+/.test(value)) return t("يجب أن يكون رابطاً صالحاً.", "Must be a valid URL.");
    return true;
}

function isImageKeyValid(value: string) {
    if (/https?:\/\/(cdn|media)\.discordapp\.(com|net)\//.test(value)) return t("لا تستخدم رابط ديسكورد — روابطه تنتهي صلاحيتها. استخدم رابط صورة من Imgur.", "Don't use a Discord link. Use an Imgur image link instead.");
    if (/https?:\/\/(?!i\.)?imgur\.com\//.test(value)) return t("رابط Imgur يجب أن يكون مباشراً للصورة (مثل https://i.imgur.com/...). انقر الصورة بالزر الأيمن ثم «نسخ عنوان الصورة».", "Imgur link must be a direct link to the image (e.g. https://i.imgur.com/...). Right click the image and click 'Copy image address'");
    if (/https?:\/\/(?!media\.)?tenor\.com\//.test(value)) return t("رابط Tenor يجب أن يكون مباشراً للصورة (مثل https://media.tenor.com/...). انقر الصورة المتحركة بالزر الأيمن ثم «نسخ عنوان الصورة».", "Tenor link must be a direct link to the image (e.g. https://media.tenor.com/...). Right click the GIF and click 'Copy image address'");
    return true;
}

/** Whatever link is entered below is handed to Discord, which re-hosts a copy of the image
 *  on its own CDN so the activity keeps working. Two consequences are easy to miss, so we
 *  spell them out next to the fields instead of burying them in the README. */
function ImagePrivacyNotice() {
    return (
        <div className={cl("notice")}>
            <Text variant="text-sm/normal">
                {t(
                    "تنبيه: الصورة التي تضعها هنا تُرسَل إلى ديسكورد ويحتفظ بنسخة منها على خوادمه، ويراها كلّ من يفتح ملفّك الشخصي. لا تستخدم صوراً خاصّة، ولا روابط تحوي معلومات شخصية — فقد تبقى متاحة حتى بعد حذف الأصل أو إيقاف الإضافة.",
                    "Note: the image you enter here is sent to Discord, which keeps a copy on its own servers, and anyone who opens your profile can see it. Don't use private images or links containing personal information — they may stay reachable even after you delete the original or turn this plugin off."
                )}
            </Text>
        </div>
    );
}

function PairSetting<T>(props: { data: [TextOption<T>, TextOption<T>]; }) {
    const [left, right] = props.data;

    return (
        <div className={cl("pair")}>
            <SingleSetting {...left} />
            <SingleSetting {...right} />
        </div>
    );
}

function SingleSetting<T>({ settingsKey, label, disabled, isValid, transform, preview }: TextOption<T>) {
    const [state, setState] = useState(settings.store[settingsKey] ?? "");
    const [error, setError] = useState<string | null>(null);
    const [previewFailed, setPreviewFailed] = useState(false);

    // Only http(s) values can be shown. An application asset key is resolved by
    // Discord at dispatch time and has nothing to render here.
    const previewUrl = preview && typeof state === "string" && /^https?:\/\//.test(state) ? state : null;

    function handleChange(newValue: any) {
        if (transform) newValue = transform(newValue);

        const valid = isValid?.(newValue) ?? true;

        setState(newValue);
        setError(resolveError(valid));
        setPreviewFailed(false);

        if (valid === true) {
            settings.store[settingsKey] = newValue;
            updateRPC();
        }
    }

    return (
        <div className={cl("single", { disabled })}>
            <Heading tag="h5">{label}</Heading>
            <TextInput
                type="text"
                placeholder={t("أدخل قيمة", "Enter a value")}
                value={state}
                onChange={handleChange}
                disabled={disabled}
            />
            {error && <Text className={cl("error")} variant="text-sm/normal">{error}</Text>}
            {previewUrl && (previewFailed
                ? <Text className={cl("error")} variant="text-sm/normal">{t("تعذّر تحميل الصورة من هذا الرابط.", "This link did not load as an image.")}</Text>
                : <img className={cl("preview")} src={previewUrl} alt="" onError={() => setPreviewFailed(true)} />)}
        </div>
    );
}

function SelectSetting<T>({ settingsKey, label, options, disabled }: SelectOption<T>) {
    return (
        <div className={cl("single", { disabled })}>
            <Heading tag="h5">{label}</Heading>
            <Select
                placeholder={t("اختر خياراً", "Select an option")}
                options={options}
                maxVisibleItems={5}
                closeOnSelect={true}
                select={v => {
                    settings.store[settingsKey] = v;
                    updateRPC();
                }}
                isSelected={v => v === settings.store[settingsKey]}
                serialize={v => String(v)}
                isDisabled={disabled}
            />
        </div>
    );
}

function getCurrentConfig(): RpcConfig {
    const { config, ...rpcConfig } = settings.store;
    return rpcConfig;
}

function PresetSettings({ onLoad }: { onLoad(): void; }) {
    const [storedPresets] = useAwaiter(async () => await DataStore.get<RpcPreset[]>(PRESETS_KEY) ?? [], { fallbackValue: [] });
    const [changedPresets, setChangedPresets] = useState<RpcPreset[] | null>(null);
    const [presetName, setPresetName] = useState("");
    const [selectedPreset, setSelectedPreset] = useState("");
    const presets = changedPresets ?? storedPresets;

    async function savePreset() {
        const name = presetName.trim();
        if (!name) return;

        const nextPresets = [
            ...presets.filter(preset => preset.name !== name),
            { name, config: getCurrentConfig() }
        ].sort((a, b) => a.name.localeCompare(b.name));

        await DataStore.set(PRESETS_KEY, nextPresets);
        setChangedPresets(nextPresets);
        setSelectedPreset(name);
        showToast(`Saved preset ${name}.`, Toasts.Type.SUCCESS);
    }

    function loadPreset() {
        const preset = presets.find(preset => preset.name === selectedPreset);
        if (!preset) return;

        Object.assign(settings.store, preset.config);
        onLoad();
        updateRPC();
        showToast(`Loaded preset ${preset.name}.`, Toasts.Type.SUCCESS);
    }

    async function deletePreset() {
        const nextPresets = presets.filter(preset => preset.name !== selectedPreset);
        if (nextPresets.length === presets.length) return;

        await DataStore.set(PRESETS_KEY, nextPresets);
        setChangedPresets(nextPresets);
        setSelectedPreset("");
        showToast(`Deleted preset ${selectedPreset}.`, Toasts.Type.SUCCESS);
    }

    return (
        <div className={cl("presets")}>
            <Heading tag="h5">Presets</Heading>
            <div className={cl("preset-create")}>
                <TextInput
                    type="text"
                    placeholder="Preset name"
                    value={presetName}
                    onChange={setPresetName}
                />
                <Button disabled={!presetName.trim()} onClick={savePreset}>Save</Button>
            </div>
            {presets.length ? (
                <div className={cl("preset-actions")}>
                    <Select
                        placeholder="Select a preset"
                        options={presets.map(preset => ({ label: preset.name, value: preset.name }))}
                        closeOnSelect={true}
                        select={setSelectedPreset}
                        isSelected={value => value === selectedPreset}
                        serialize={String}
                    />
                    <Button disabled={!selectedPreset} onClick={loadPreset}>Load</Button>
                    <Button color={Button.Colors.RED} disabled={!selectedPreset} onClick={deletePreset}>Delete</Button>
                </div>
            ) : (
                <Text variant="text-sm/normal">No saved presets yet.</Text>
            )}
        </div>
    );
}

function RPCFields() {
    const { type, timestampMode } = settings.use(["type", "timestampMode"]);

    return (
        <>
            <SelectSetting
                settingsKey="type"
                label={t("نوع النشاط", "Activity Type")}
                options={[
                    {
                        label: t("يلعب", "Playing"),
                        value: ActivityType.PLAYING,
                        default: true
                    },
                    {
                        label: t("يبثّ", "Streaming"),
                        value: ActivityType.STREAMING
                    },
                    {
                        label: t("يستمع", "Listening"),
                        value: ActivityType.LISTENING
                    },
                    {
                        label: t("يشاهد", "Watching"),
                        value: ActivityType.WATCHING
                    },
                    {
                        label: t("يتنافس", "Competing"),
                        value: ActivityType.COMPETING
                    }
                ]}
            />

            <PairSetting data={[
                { settingsKey: "appID", label: t("مُعرِّف التطبيق", "Application ID"), isValid: isAppIdValid },
                { settingsKey: "appName", label: t("اسم التطبيق", "Application Name"), isValid: makeValidator(128, true) },
            ]} />

            <PairSetting data={[
                { settingsKey: "details", label: t("التفاصيل (السطر 1)", "Detail (line 1)"), isValid: maxLength128 },
                { settingsKey: "detailsURL", label: t("رابط التفاصيل", "Detail URL"), isValid: isUrlValid },
            ]} />

            <PairSetting data={[
                { settingsKey: "state", label: t("الحالة (السطر 2)", "State (line 2)"), isValid: maxLength128 },
                { settingsKey: "stateURL", label: t("رابط الحالة", "State URL"), isValid: isUrlValid },
            ]} />

            <SingleSetting
                settingsKey="streamLink"
                label={t("رابط البثّ (Twitch أو YouTube، فقط إذا كان نوع النشاط بثّاً)", "Stream Link (Twitch or YouTube, only if activity type is Streaming)")}
                disabled={type !== ActivityType.STREAMING}
                isValid={isStreamLinkValid}
            />

            <PairSetting data={[
                {
                    settingsKey: "partySize",
                    label: t("حجم المجموعة", "Party Size"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: type !== ActivityType.PLAYING,
                },
                {
                    settingsKey: "partyMaxSize",
                    label: t("الحدّ الأقصى لحجم المجموعة", "Maximum Party Size"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: type !== ActivityType.PLAYING,
                },
            ]} />

            <Divider />

            <ImagePrivacyNotice />

            <PairSetting data={[
                { settingsKey: "imageBig", label: t("رابط/مفتاح الصورة الكبيرة", "Large Image URL/Key"), isValid: isImageKeyValid, preview: true },
                { settingsKey: "imageBigTooltip", label: t("نصّ الصورة الكبيرة", "Large Image Text"), isValid: maxLength128 },
            ]} />
            <SingleSetting settingsKey="imageBigURL" label={t("رابط قابل للنقر للصورة الكبيرة", "Large Image clickable URL")} isValid={isUrlValid} />

            <PairSetting data={[
                { settingsKey: "imageSmall", label: t("رابط/مفتاح الصورة الصغيرة", "Small Image URL/Key"), isValid: isImageKeyValid, preview: true },
                { settingsKey: "imageSmallTooltip", label: t("نصّ الصورة الصغيرة", "Small Image Text"), isValid: maxLength128 },
            ]} />
            <SingleSetting settingsKey="imageSmallURL" label={t("رابط قابل للنقر للصورة الصغيرة", "Small Image clickable URL")} isValid={isUrlValid} />

            <Divider />

            <PairSetting data={[
                { settingsKey: "buttonOneText", label: t("نصّ الزرّ الأول", "Button1 Text"), isValid: makeValidator(31) },
                { settingsKey: "buttonOneURL", label: t("رابط الزرّ الأول", "Button1 URL"), isValid: isUrlValid },
            ]} />
            <PairSetting data={[
                { settingsKey: "buttonTwoText", label: t("نصّ الزرّ الثاني", "Button2 Text"), isValid: makeValidator(31) },
                { settingsKey: "buttonTwoURL", label: t("رابط الزرّ الثاني", "Button2 URL"), isValid: isUrlValid },
            ]} />

            <Divider />

            <SelectSetting
                settingsKey="timestampMode"
                label={t("نمط الطابع الزمني", "Timestamp Mode")}
                options={[
                    {
                        label: t("لا شيء", "None"),
                        value: TimestampMode.NONE,
                        default: true
                    },
                    {
                        label: t("منذ فتح ديسكورد", "Since discord open"),
                        value: TimestampMode.NOW
                    },
                    {
                        label: t("مطابق لوقتك الحالي (لا يُعاد ضبطه بعد 24 ساعة)", "Same as your current time (not reset after 24h)"),
                        value: TimestampMode.TIME
                    },
                    {
                        label: t("مخصّص", "Custom"),
                        value: TimestampMode.CUSTOM
                    }
                ]}
            />

            <PairSetting data={[
                {
                    settingsKey: "startTime",
                    label: t("الطابع الزمني للبداية (بالمللي ثانية)", "Start Timestamp (in milliseconds)"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: timestampMode !== TimestampMode.CUSTOM,
                },
                {
                    settingsKey: "endTime",
                    label: t("الطابع الزمني النهائي (بالمللي ثانية)", "End Timestamp (in milliseconds)"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: timestampMode !== TimestampMode.CUSTOM,
                },
            ]} />
        </>
    );
}

export function RPCSettings() {
    const [formVersion, setFormVersion] = useState(0);

    return (
        <div className={cl("root")}>
            <PresetSettings onLoad={() => setFormVersion(version => version + 1)} />
            <Divider />
            <RPCFields key={formVersion} />
        </div>
    );
}
