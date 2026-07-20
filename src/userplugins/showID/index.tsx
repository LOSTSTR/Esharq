/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { React, useState } from "@webpack/common";

const Section = findComponentByCodeLazy("headingVariant:", '"section"', "headingIcon:");

const CopyIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CheckIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

function CopyButton({ text }: { text: string; }) {
    const [copied, setCopied] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            navigator.clipboard.writeText(text);
        } catch {
            const el = document.createElement("textarea");
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <button
            onClick={handleClick}
            title={copied ? t("تمّ النسخ!", "Copied!") : t("نسخ المعرّف", "Copy ID")}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                marginInlineStart: "6px",
                background: copied ? "rgb(35 165 90 / 15%)" : "transparent",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                color: copied ? "#23a55a" : "var(--text-muted)",
                transition: "all 0.15s ease",
                flexShrink: 0,
                lineHeight: 0,
                verticalAlign: "middle",
            }}
            onMouseEnter={e => !copied && (e.currentTarget.style.color = "var(--text-normal)")}
            onMouseLeave={e => !copied && (e.currentTarget.style.color = "var(--text-muted)")}
        >
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
    );
}

const UserIDSection = ErrorBoundary.wrap(({ userId }: { userId: string; }) => (
    <div style={{ display: "flex", alignItems: "center" }}>
        <BaseText size="sm" color="text-default" style={{ userSelect: "text" }}>
            {userId}
        </BaseText>
        <CopyButton text={userId} />
    </div>
), { noop: true });

export default definePlugin({
    name: "ShowID",
    description: "Shows the user ID in Discord profiles, below the 'Member Since' section.",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],

    patches: [
        {
            find: "#{intl::PROVISIONAL_ACCOUNT}),headingIcon:",
            replacement: {
                match: /(#{intl::USER_PROFILE_MEMBER_SINCE}\),.{0,100}userId:(\i\.id)}\)}\))/,
                replace: "$1,$self.renderProfileID({userId:$2,isSideBar:true})",
            }
        },
        {
            find: ",applicationRoleConnection:",
            replacement: {
                match: /(#{intl::USER_PROFILE_MEMBER_SINCE}\),.{0,100}userId:(\i\.id),.{0,100}}\)}\)),/,
                replace: "$1,$self.renderProfileID({userId:$2,isSideBar:false}),",
            }
        },
        {
            find: ".MODAL_V2,onClose:",
            replacement: {
                match: /(#{intl::USER_PROFILE_MEMBER_SINCE}\),.{0,100}userId:(\i\.id),.{0,100}}\)}\)),/,
                replace: "$1,$self.renderProfileID({userId:$2,isSideBar:false}),",
            }
        }
    ],

    renderProfileID({ userId, isSideBar }: { userId: string; isSideBar: boolean; }) {
        if (!userId) return null;
        return (
            <Section
                heading={t("معرّف المستخدم", "User ID")}
                headingVariant={isSideBar ? "text-xs/semibold" : "text-xs/medium"}
                headingColor={isSideBar ? "text-strong" : "text-default"}
            >
                <UserIDSection userId={userId} />
            </Section>
        );
    }
});
