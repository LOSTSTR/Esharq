/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Settings } from "@api/Settings";
import { IpcEvents } from "@shared/IpcEvents";
import { SettingsStore } from "@shared/SettingsStore";
import { mergeDefaults } from "@utils/mergeDefaults";
import { ipcMain } from "electron";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";

import { NATIVE_SETTINGS_FILE, SETTINGS_DIR, SETTINGS_FILE } from "./utils/constants";

mkdirSync(SETTINGS_DIR, { recursive: true });

function readSettings<T = object>(name: string, file: string): Partial<T> {
    try {
        return JSON.parse(readFileSync(file, "utf-8"));
    } catch (err: any) {
        if (err?.code !== "ENOENT")
            console.error(`Failed to read ${name} settings`, err);

        return {};
    }
}

export const RendererSettings = new SettingsStore(readSettings<Settings>("renderer", SETTINGS_FILE));

/**
 * آخر فشلٍ في حفظ الإعدادات — يُقرأ من الواجهة.
 *
 * 🔴 لماذا يُرصد: كان الفشل يُطبَع في مِعراض **العملية الرئيسية** وحده — وهو
 * ما لا يراه مستخدم. فمن يُفعّل إضافاته ثمّ يجدها مُطفأة بعد إعادة التشغيل لا
 * يرى سبباً واحداً في أي مكان، ولا يحمله تقرير الدعم. حالةٌ حقيقية: عضوٌ
 * أرسل تقريراً فيه 21 إضافة، **كلّها تلقائية** (`required` أو
 * `enabledByDefault` أو تابعة) — أي أن ملفّه لم يُطبَّق قطّ، والتقرير لا يقول
 * لماذا. فالسبب يجب أن يصل الواجهة لا المِعراض.
 */
let lastWriteError: string | null = null;

RendererSettings.addGlobalChangeListener(() => {
    try {
        const json = JSON.stringify(RendererSettings.plain, null, 4);
        writeFileSync(SETTINGS_FILE, json);

        // 🔴 الكتابة قد «تنجح» ولا تصل القرص: مضادّ فيروسات يعترضها، أو مجلد
        // مُزامَن يُعيد الملفّ القديم. نتحقّق من الحجم — رخيصٌ، والتبديل نادر.
        const written = statSync(SETTINGS_FILE).size;
        const expected = Buffer.byteLength(json);
        lastWriteError = written === expected
            ? null
            : `الملفّ كُتب بحجم ${written} بايت والمتوقّع ${expected} — يعترضه شيءٌ خارج إشراق.`;
    } catch (e: any) {
        lastWriteError = `${e?.code ?? "خطأ"}: ${e?.message ?? e}`;
        console.error("Failed to write renderer settings", e);
    }
});

ipcMain.handle(IpcEvents.GET_SETTINGS_HEALTH, () => {
    let exists = false, size = 0, mtime: string | null = null, readable: string | null = null;
    try {
        const st = statSync(SETTINGS_FILE);
        exists = true;
        size = st.size;
        mtime = st.mtime.toISOString();
        // يُقرأ فعلاً: ملفٌّ موجودٌ لكنّه تالف يُعيد المستخدمَ إلى الافتراضات
        // في كل إقلاع، وهو أشيع من غيابه.
        JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    } catch (e: any) {
        if (e?.code !== "ENOENT") readable = `${e?.code ?? "خطأ"}: ${e?.message ?? e}`;
    }
    return { path: SETTINGS_FILE, exists, size, mtime, readable, lastWriteError };
});

ipcMain.handle(IpcEvents.GET_SETTINGS_DIR, () => SETTINGS_DIR);
ipcMain.on(IpcEvents.GET_SETTINGS, e => e.returnValue = RendererSettings.plain);

ipcMain.handle(IpcEvents.SET_SETTINGS, (_, data: Settings, pathToNotify?: string) => {
    RendererSettings.setData(data, pathToNotify);
});

export interface NativeSettings {
    plugins: {
        [plugin: string]: {
            [setting: string]: any;
        };
    };
    customCspRules: Record<string, string[]>;
}

const DefaultNativeSettings: NativeSettings = {
    plugins: {},
    customCspRules: {}
};

const nativeSettings = readSettings<NativeSettings>("native", NATIVE_SETTINGS_FILE);
mergeDefaults(nativeSettings, DefaultNativeSettings);

export const NativeSettings = new SettingsStore(nativeSettings as NativeSettings);

NativeSettings.addGlobalChangeListener(() => {
    try {
        writeFileSync(NATIVE_SETTINGS_FILE, JSON.stringify(NativeSettings.plain, null, 4));
    } catch (e) {
        console.error("Failed to write native settings", e);
    }
});
