/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { classNameFactory } from "@utils/css";
import { isArabicMode } from "@utils/esharqI18n";
import { formatDurationMs } from "@utils/text";
import type { RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, Modal, Tooltip, useEffect, useState } from "@webpack/common";

import { generateAndSave } from "./shareImage";
import {
    type ActivityProfile, calcRecords, calcStreak, DB_KEY, emptyDay, getActivityProfile,
    getLast7DayKeys, getLast84DayKeys, getPrev7DayKeys, pctChange, type Records,
    shortDayLabel, type StatsDB,
} from "./types";

const cl = classNameFactory("vc-personalanalytics-");

const STRINGS = {
    ar: {
        title: "التحليلات الشخصية",
        weekOf: (d: string) => `أسبوع ${d}`,
        messages: "الرسائل",
        voiceTime: "وقت الصوت",
        reactionsGiven: "التفاعلات المُضافة",
        activeDays: "الأيام النشطة",
        dailyActivity: "النشاط اليومي",
        topChannels: "أكثر القنوات نشاطاً",
        activityByHour: "النشاط بالساعة",
        activeDaysValue: (n: number) => `${n} من 7`,
        saveAsImage: "📥 حفظ كصورة",
        close: "إغلاق",
        loading: "جاري تحميل إحصاءاتك...",
        streak: "أيام متتالية",
        records: "السجلات الشخصية",
        bestDay: "أفضل يوم",
        longestVoice: "أطول جلسة صوتية",
        activityProfile: "نمط النشاط",
        calendarTitle: "٨٤ يوماً الماضية",
    },
    en: {
        title: "Personal Analytics",
        weekOf: (d: string) => `Week of ${d}`,
        messages: "Messages",
        voiceTime: "Voice time",
        reactionsGiven: "Reactions given",
        activeDays: "Active days",
        dailyActivity: "Daily Activity",
        topChannels: "Top Channels",
        activityByHour: "Activity by Hour",
        activeDaysValue: (n: number) => `${n} / 7`,
        saveAsImage: "📥 Save as Image",
        close: "Close",
        loading: "Loading your stats…",
        streak: "day streak",
        records: "Personal Records",
        bestDay: "Best day",
        longestVoice: "Longest voice",
        activityProfile: "Activity Profile",
        calendarTitle: "Last 84 Days",
    },
} as const;

function aggregate(db: StatsDB, keys: string[]) {
    let totalMessages = 0;
    let totalVoiceMs = 0;
    let totalReactionsGiven = 0;
    let totalReactionsReceived = 0;
    let activeDays = 0;
    const channelMap: Record<string, number> = {};
    const aggHours: number[] = Array(24).fill(0) as number[];
    const dailyMessages: Array<{ date: string; count: number; }> = [];

    for (const key of keys) {
        const day = db[key] ?? emptyDay();
        totalMessages += day.messages;
        totalVoiceMs += day.voiceMs;
        totalReactionsGiven += day.reactionsGiven;
        totalReactionsReceived += day.reactionsReceived;
        if (day.messages > 0) activeDays++;
        dailyMessages.push({ date: key, count: day.messages });
        for (const [ch, cnt] of Object.entries(day.channels)) {
            channelMap[ch] = (channelMap[ch] ?? 0) + cnt;
        }
        for (let h = 0; h < 24; h++) {
            aggHours[h] += day.hours[h] ?? 0;
        }
    }

    const topChannels = Object.entries(channelMap)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return { totalMessages, totalVoiceMs, totalReactionsGiven, totalReactionsReceived, activeDays, topChannels, dailyMessages, aggHours };
}

function ChangeChip({ change }: { change: number | null; }) {
    if (change === null) return null;
    const positive = change >= 0;
    return (
        <span className={cl("change-chip", positive ? "positive" : "negative")}>
            {positive ? "▲" : "▼"} {Math.abs(change)}%
        </span>
    );
}

function StatCard({ icon, label, value, accent, change }: {
    icon: string; label: string; value: string; accent: string; change?: number | null;
}) {
    return (
        <div className={cl("stat-card")} style={{ "--card-accent": accent } as React.CSSProperties}>
            <span className={cl("stat-icon")}>{icon}</span>
            <span className={cl("stat-value")}>{value}</span>
            <div className={cl("stat-footer")}>
                <span className={cl("stat-label")}>{label}</span>
                {change !== undefined && <ChangeChip change={change} />}
            </div>
        </div>
    );
}

function StreakBadge({ streak, label }: { streak: number; label: string; }) {
    if (streak === 0) return null;
    return (
        <div className={cl("streak-badge")}>
            <span>🔥</span>
            <span className={cl("streak-count")}>{streak}</span>
            <span className={cl("streak-label")}>{label}</span>
        </div>
    );
}

function ProfileChip({ profile, isAR }: { profile: ActivityProfile; isAR: boolean; }) {
    return (
        <div className={cl("profile-chip")}>
            <span className={cl("profile-icon")}>{profile.icon}</span>
            <span className={cl("profile-name")}>{isAR ? profile.ar : profile.en}</span>
        </div>
    );
}

function RecordsRow({ records, bestDayLabel, longestVoiceLabel }: {
    records: Records;
    bestDayLabel: string;
    longestVoiceLabel: string;
}) {
    return (
        <div className={cl("records-row")}>
            <div className={cl("record-item")}>
                <span className={cl("record-icon")}>🏆</span>
                <div className={cl("record-info")}>
                    <span className={cl("record-value")}>{records.bestDayCount}</span>
                    <span className={cl("record-label")}>{bestDayLabel}</span>
                    {records.bestDayDate && (
                        <span className={cl("record-date")}>{records.bestDayDate}</span>
                    )}
                </div>
            </div>
            <div className={cl("record-divider")} />
            <div className={cl("record-item")}>
                <span className={cl("record-icon")}>⏱️</span>
                <div className={cl("record-info")}>
                    <span className={cl("record-value")}>{formatDurationMs(records.longestVoiceMs)}</span>
                    <span className={cl("record-label")}>{longestVoiceLabel}</span>
                </div>
            </div>
        </div>
    );
}

function BarChart({ data }: { data: Array<{ date: string; count: number; }>; }) {
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div className={cl("bar-chart")}>
            {data.map(({ date, count }) => (
                <Tooltip key={date} text={`${shortDayLabel(date)}: ${count} messages`}>
                    {props => (
                        <div {...props} className={cl("bar-col")}>
                            <div
                                className={cl("bar")}
                                style={{ height: `${Math.max((count / max) * 100, count > 0 ? 8 : 2)}%` }}
                            />
                            <span className={cl("bar-label")}>{shortDayLabel(date)}</span>
                        </div>
                    )}
                </Tooltip>
            ))}
        </div>
    );
}

function HeatmapRow({ hours }: { hours: number[]; }) {
    const max = Math.max(...hours, 1);
    return (
        <div className={cl("heatmap")}>
            {hours.map((count, h) => (
                <Tooltip key={h} text={`${h}:00 — ${count} messages`}>
                    {props => (
                        <div
                            {...props}
                            className={cl("heatmap-cell")}
                            style={{ opacity: count > 0 ? 0.15 + (count / max) * 0.85 : 0.07 }}
                        />
                    )}
                </Tooltip>
            ))}
        </div>
    );
}

function CalendarGrid({ db, keys }: { db: StatsDB; keys: string[]; }) {
    const startDow = new Date(keys[0] + "T12:00:00").getDay();
    const padded: Array<string | null> = [...(Array(startDow).fill(null) as null[]), ...keys];
    const maxCount = Math.max(...keys.map(k => db[k]?.messages ?? 0), 1);

    return (
        <div className={cl("calendar-grid")}>
            {padded.map((key, i) => {
                if (!key) {
                    return <div key={`p${i}`} className={cl("calendar-cell", "calendar-empty")} />;
                }
                const count = db[key]?.messages ?? 0;
                return (
                    <Tooltip key={key} text={`${key}: ${count} msg`}>
                        {props => (
                            <div
                                {...props}
                                className={cl("calendar-cell")}
                                style={{ opacity: count > 0 ? 0.2 + (count / maxCount) * 0.8 : 0.07 }}
                            />
                        )}
                    </Tooltip>
                );
            })}
        </div>
    );
}

export function AnalyticsDashboard({ modalProps }: { modalProps: RenderModalProps; }) {
    const [db, setDb] = useState<StatsDB | null>(null);
    const keys7 = getLast7DayKeys();
    const prev7 = getPrev7DayKeys();
    const keys84 = getLast84DayKeys();
    const weekStart = new Date(keys7[0] + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const s = isArabicMode() ? STRINGS.ar : STRINGS.en;
    const isAR = s === STRINGS.ar;

    useEffect(() => {
        void DataStore.get<StatsDB>(DB_KEY).then(data => setDb(data ?? {}));
    }, []);

    if (!db) {
        return (
            <Modal {...modalProps} size="sm" title={`📊 ${s.title}`}>
                <div className={cl("loading")}>{s.loading}</div>
            </Modal>
        );
    }

    const stats = aggregate(db, keys7);
    const prev = aggregate(db, prev7);
    const streak = calcStreak(db);
    const records = calcRecords(db);
    const profile = getActivityProfile(stats.aggHours);
    const msgChange = pctChange(stats.totalMessages, prev.totalMessages);
    const voiceChange = pctChange(stats.totalVoiceMs, prev.totalVoiceMs);
    const reactChange = pctChange(stats.totalReactionsGiven, prev.totalReactionsGiven);

    return (
        <Modal
            {...modalProps}
            size="md"
            title={`📊 ${s.title}`}
            subtitle={s.weekOf(weekStart)}
            actions={[
                {
                    text: s.saveAsImage,
                    variant: "primary",
                    onClick: () => void generateAndSave(stats, weekStart),
                },
                {
                    text: s.close,
                    variant: "secondary",
                    onClick: modalProps.onClose,
                },
            ]}
        >
            <div className={cl("content")} dir={isAR ? "rtl" : "ltr"}>
                <div className={cl("top-row")}>
                    <StreakBadge streak={streak} label={s.streak} />
                    <ProfileChip profile={profile} isAR={isAR} />
                </div>

                <div className={cl("stat-grid")}>
                    <StatCard icon="💬" label={s.messages} value={stats.totalMessages.toLocaleString()} accent="#5865f2" change={msgChange} />
                    <StatCard icon="🎙️" label={s.voiceTime} value={formatDurationMs(stats.totalVoiceMs)} accent="#3ba55c" change={voiceChange} />
                    <StatCard icon="⭐" label={s.reactionsGiven} value={String(stats.totalReactionsGiven)} accent="#faa81a" change={reactChange} />
                    <StatCard icon="📅" label={s.activeDays} value={s.activeDaysValue(stats.activeDays)} accent="#eb459e" />
                </div>

                <h3 className={cl("section-heading")}>{s.records}</h3>
                <RecordsRow records={records} bestDayLabel={s.bestDay} longestVoiceLabel={s.longestVoice} />

                <h3 className={cl("section-heading")}>{s.dailyActivity}</h3>
                <BarChart data={stats.dailyMessages} />

                {stats.topChannels.length > 0 && (
                    <>
                        <h3 className={cl("section-heading")}>{s.topChannels}</h3>
                        <div className={cl("channels-list")}>
                            {stats.topChannels.map((ch, i) => {
                                const chName = ChannelStore.getChannel(ch.id)?.name ?? ch.id;
                                const maxCount = stats.topChannels[0]?.count ?? 1;
                                return (
                                    <div key={ch.id} className={cl("channel-row")}>
                                        <span className={cl("channel-rank")}>#{i + 1}</span>
                                        <span className={cl("channel-name")}>#{chName}</span>
                                        <div className={cl("channel-bar-track")}>
                                            <div
                                                className={cl("channel-bar-fill")}
                                                style={{ width: `${(ch.count / maxCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className={cl("channel-count")}>{ch.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                <h3 className={cl("section-heading")}>{s.activityByHour}</h3>
                <div className={cl("heatmap-labels")}>
                    {["12am", "6am", "12pm", "6pm", "11pm"].map(l => (
                        <span key={l}>{l}</span>
                    ))}
                </div>
                <HeatmapRow hours={stats.aggHours} />

                <h3 className={cl("section-heading")}>{s.calendarTitle}</h3>
                <CalendarGrid db={db} keys={keys84} />
            </div>
        </Modal>
    );
}
