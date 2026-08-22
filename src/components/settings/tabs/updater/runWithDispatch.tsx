/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorCard } from "@components/ErrorCard";
import { t } from "@utils/esharqI18n";
import { UpdateLogger } from "@utils/updater";
import { ConfirmModal,openModal, Parser } from "@webpack/common";

/**
 * 🔴 هذه الدالّة كانت تعرف **مُحدِّث git وحده**.
 *
 * أخطاؤه تحمل `code` و`cmd` (لأنّها من تشغيل عملية)، فكل ما عداها كان يسقط
 * في «حدث خطأ غير معروف» — ومنه **كل أخطاء مُحدِّث HTTP**. وهي أخطاء مفيدة:
 * `checkedFetch` يرمي `Error` نصّه «GET …: 403 rate limit exceeded» أو 404،
 * فكان النصّ يُبنى ثمّ يُرمى، ويرى المستخدم رسالةً لا تدلّه على شيء ولا يصل
 * صاحبَ المشروع سببٌ يُحقّق فيه.
 */
function getErrorMessage(e: any) {
    // مسار مُحدِّث git — عمليات فاشلة
    if (e?.code && e.cmd) {
        const { code, path, cmd, stderr } = e;

        if (code === "ENOENT")
            return t(`الأمر \`${path}\` غير موجود.\nثبّته ثمّ حاول من جديد.`,
                `Command \`${path}\` not found.\nPlease install it and try again.`);

        const extra = stderr || t(`الرمز \`${code}\`. انظر المِعراض لمزيد.`,
            `Code \`${code}\`. See the console for more info.`);

        return t(`حدث خطأ أثناء تشغيل \`${cmd}\`:\n${extra}`,
            `An error occurred while running \`${cmd}\`:\n${extra}`);
    }

    // مسار مُحدِّث HTTP — الرسالة موجودة، وتُترجَم للحالات المعروفة
    const message: string = typeof e?.message === "string" ? e.message : "";

    if (message.includes("403") && /rate limit/i.test(message)) {
        return t(
            "تجاوزتَ حدّ طلبات GitHub (60 طلباً في الساعة لكلّ عنوان شبكة).\nحاول بعد ساعة — لا عطل في إشراق.",
            "You hit GitHub's request limit (60 per hour per IP address).\nTry again in an hour — nothing is broken in Esharq."
        );
    }

    if (message.includes("404")) {
        return t(
            "لم يتعرّف GitHub على نسخة بنائك.\nيحدث هذا مع بناءٍ محليّ لم يُدفَع. أعِد التثبيت من الموقع لتعود التحديثات.",
            "GitHub does not recognise your build.\nThis happens with a local build that was never pushed. Reinstall from the site to restore updates."
        );
    }

    if (/failed:|fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(message)) {
        return t(
            "تعذّر الوصول إلى GitHub.\nتحقّق من اتّصالك أو من حاجب الشبكة، ثمّ حاول من جديد.",
            "Could not reach GitHub.\nCheck your connection or network filter, then try again."
        );
    }

    if (message) return message;

    return t("حدث خطأ غير معروف.\nحاول من جديد أو انظر المِعراض لمزيد.",
        "An unknown error occurred.\nPlease try again or see the console for more info.");
}

export function runWithDispatch(dispatch: React.Dispatch<React.SetStateAction<boolean>>, action: () => any) {
    return async () => {
        dispatch(true);

        try {
            await action();
        } catch (e: any) {
            UpdateLogger.error(e);

            const err = getErrorMessage(e);

            openModal(props => (
                <ConfirmModal
                    {...props}
                    title="Oops!"
                    confirmText="OK"
                    variant="primary"
                >
                    <ErrorCard>
                        {err.split("\n").map((line, idx) =>
                            <div key={idx}>{Parser.parse(line)}</div>
                        )}
                    </ErrorCard>
                </ConfirmModal>
            ));
        } finally {
            dispatch(false);
        }
    };
}
