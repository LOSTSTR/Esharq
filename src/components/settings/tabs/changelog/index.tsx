/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Divider } from "@components/Divider";
import { ErrorCard } from "@components/ErrorCard";
import { Heading } from "@components/Heading";
import { DeleteIcon } from "@components/Icons";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { Card as EsharqCard } from "@components/settings/esharq/Card";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { HashLink } from "@components/settings/tabs/updater/Components";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { getRepo, UpdateLogger } from "@utils/updater";
import { Alerts, React, Toasts } from "@webpack/common";

import gitHash from "~git-hash";

import {
    ChangelogEntry,
    ChangelogHistory,
    clearChangelogHistory,
    clearIndividualLog,
    fetchRecentCommits,
    formatTimestamp,
    getChangelogHistory,
    getCommitsSinceLastSeen,
    getLastRepositoryCheckHash,
    getNewPlugins,
    getNewSettings,
    getNewSettingsEntries,
    getNewSettingsSize,
    getUpdatedPlugins,
    initializeChangelog,
    saveUpdateSession,
    UpdateSession,
} from "./changelogManager";
import { NewPluginsCompact, NewPluginsSection } from "./NewPluginsSection";

function ChangelogCard({
    entry,
    repo,
    repoPending,
}: {
    entry: ChangelogEntry;
    repo: string;
    repoPending: boolean;
}) {
    return (
        <Card className="vc-changelog-entry">
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25em",
                }}
            >
                <div className="vc-changelog-entry-header">
                    <code className="vc-changelog-entry-hash">
                        <HashLink
                            repo={repo}
                            hash={entry.hash}
                            disabled={repoPending}
                        />
                    </code>
                    <span className="vc-changelog-entry-author">
                        by {entry.author}
                    </span>
                </div>
                <div className="vc-changelog-entry-message">
                    {entry.message}
                </div>
            </div>
        </Card>
    );
}

function UpdateLogCard({
    log,
    repo,
    repoPending,
    isExpanded,
    onToggleExpand,
    onClearLog,
}: {
    log: UpdateSession;
    repo: string;
    repoPending: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onClearLog: (logId: string) => void;
}) {
    const isRepositoryFetch =
        log.type === "repository_fetch" ||
        (log.type === undefined &&
            log.fromHash === log.toHash &&
            log.commits.length === 0);
    const isUpToDate = log.fromHash === log.toHash;

    return (
        <Card className="vc-changelog-log">
            <div className="vc-changelog-log-header" onClick={onToggleExpand}>
                <div className="vc-changelog-log-info">
                    <div className="vc-changelog-log-title">
                        <span>
                            {isRepositoryFetch
                                ? isUpToDate
                                    ? `${t("فحص المستودع", "Repository Check")}: ${log.fromHash.slice(0, 7)} (${t("محدَّث", "up-to-date")})`
                                    : `${t("فحص المستودع", "Repository Check")}: ${log.fromHash.slice(0, 7)} → ${log.toHash.slice(0, 7)}`
                                : `${t("تحديث", "Update")}: ${log.fromHash.slice(0, 7)} → ${log.toHash.slice(0, 7)}`}
                        </span>
                        <Button
                            size="min"
                            variant="secondary"
                            className="vc-changelog-delete-button"
                            style={{
                                padding: "4px",
                                color: "var(--status-danger)",
                                opacity: 0.6,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            onClick={e => {
                                e.stopPropagation();
                                onClearLog(log.id);
                            }}
                        >
                            <DeleteIcon width={16} height={16} />
                        </Button>
                    </div>
                    <div className="vc-changelog-log-meta">
                        {formatTimestamp(log.timestamp)}
                        {log.commits.length > 0 &&
                            ` • ${log.commits.length} ${t("إيداعات متاحة", "commits available")}`}
                        {log.commits.length === 0 && ` • ${t("لا إيداعات جديدة", "no new commits")}`}
                        {log.newPlugins.length > 0 &&
                            ` • ${log.newPlugins.length} ${t("إضافات جديدة", "new plugins")}`}
                        {log.updatedPlugins.length > 0 &&
                            ` • ${log.updatedPlugins.length} ${t("إضافات محدَّثة", "updated plugins")}`}
                        {log.newSettings &&
                            getNewSettingsSize(log.newSettings) > 0 &&
                            ` • ${getNewSettingsEntries(log.newSettings).reduce((sum, [, arr]) => sum + arr.length, 0)} ${t("إعدادات جديدة", "new settings")}`}
                    </div>
                </div>
                <div
                    className={`vc-changelog-log-toggle ${isExpanded ? "expanded" : ""}`}
                >
                    ▼
                </div>
            </div>

            {isExpanded && (
                <div className="vc-changelog-log-content">
                    {log.newPlugins.length > 0 && (
                        <div className="vc-changelog-log-plugins">
                            <NewPluginsCompact
                                newPlugins={log.newPlugins}
                                maxDisplay={50}
                            />
                        </div>
                    )}

                    {log.updatedPlugins.length > 0 && (
                        <div className="vc-changelog-log-plugins">
                            <Heading className={Margins.bottom8}>
                                {t("الإضافات المحدَّثة", "Updated Plugins")}
                            </Heading>
                            <NewPluginsCompact
                                newPlugins={log.updatedPlugins}
                                maxDisplay={50}
                            />
                        </div>
                    )}

                    {log.newSettings &&
                        getNewSettingsSize(log.newSettings) > 0 && (
                            <div className="vc-changelog-log-plugins">
                                <Heading className={Margins.bottom8}>
                                    {t("إعدادات جديدة", "New Settings")}
                                </Heading>
                                <div className="vc-changelog-new-plugins-list">
                                    {getNewSettingsEntries(log.newSettings).map(
                                        ([pluginName, settings]) =>
                                            settings.map(setting => (
                                                <span
                                                    key={`${pluginName}-${setting}`}
                                                    className="vc-changelog-new-plugin-tag"
                                                    title={`New setting in ${pluginName}`}
                                                >
                                                    {pluginName}.{setting}
                                                </span>
                                            )),
                                    )}
                                </div>
                            </div>
                        )}

                    {log.commits.length > 0 && (
                        <div className="vc-changelog-log-commits">
                            <div className="vc-changelog-log-commits-list">
                                {log.commits.map(entry => (
                                    <ChangelogCard
                                        key={entry.hash}
                                        entry={entry}
                                        repo={repo}
                                        repoPending={repoPending}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

function ChangelogContent() {
    useSettings(["plugins.Settings.arabicMode"]);

    const [repo, repoErr, repoPending] = useAwaiter(getRepo, {
        fallbackValue: "Loading...",
    });
    const [changelog, setChangelog] = React.useState<ChangelogEntry[]>([]);
    const [changelogHistory, setChangelogHistory] =
        React.useState<ChangelogHistory>([]);
    const [newPlugins, setNewPlugins] = React.useState<string[]>([]);
    const [updatedPlugins, setUpdatedPlugins] = React.useState<string[]>([]);
    const [recentCommits, setRecentCommits] = React.useState<ChangelogEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = React.useState<Set<string>>(
        new Set(),
    );
    const [showHistory, setShowHistory] = React.useState(false);
    const [recentlyChecked, setRecentlyChecked] = React.useState(false);

    React.useEffect(() => {
        const init = async () => {
            try {
                await initializeChangelog();
                await loadChangelogHistory();
            } catch (err) {
                console.error("Failed to initialize changelog:", err);
            }
        };
        init();
    }, []);

    React.useEffect(() => {
        if (repoErr) {
            UpdateLogger.error("Failed to retrieve repo", repoErr);
            setError(t("فشل استرداد معلومات المستودع", "Failed to retrieve repository info"));
        }
    }, [repoErr]);

    const loadChangelogHistory = React.useCallback(async () => {
        try {
            const history = await getChangelogHistory();
            setChangelogHistory(history);
        } catch (err) {
            console.error("Failed to load changelog history:", err);
        }
    }, []);

    const loadNewPlugins = React.useCallback(async () => {
        try {
            const newPlgs = await getNewPlugins();
            const updatedPlgs = await getUpdatedPlugins();
            setNewPlugins(newPlgs);
            setUpdatedPlugins(updatedPlgs);
        } catch (err) {
            console.error("Failed to load new plugins:", err);
        }
    }, []);

    const loadRecentCommits = React.useCallback(async (repoUrl: string) => {
        try {
            const commits = await fetchRecentCommits(repoUrl, 15);
            setRecentCommits(commits);
        } catch (err) {
            console.error("Failed to load recent commits:", err);
        }
    }, []);

    const ensureLocalUpdateLogged = React.useCallback(async () => {
        if (repoPending || repoErr) return false;
        const repoUrl = repo;
        if (!repoUrl) return false;

        try {
            const commits = await getCommitsSinceLastSeen(repoUrl);
            if (commits.length === 0) return false;

            const newPlgs = await getNewPlugins();
            const updatedPlgs = await getUpdatedPlugins();
            const newSettings = await getNewSettings();

            await saveUpdateSession(commits, newPlgs, updatedPlgs, newSettings);

            setChangelog(commits);
            setNewPlugins(newPlgs);
            setUpdatedPlugins(updatedPlgs);
            await loadChangelogHistory();
            return true;
        } catch (err) {
            console.error("Failed to log local update:", err);
            return false;
        }
    }, [repo, repoErr, repoPending, loadChangelogHistory]);

    // check if the repository was recently refreshed
    React.useEffect(() => {
        const checkRecentStatus = async () => {
            try {
                const lastRepoCheck = await getLastRepositoryCheckHash();
                const updates = await VencordNative.updater.getUpdates();

                if (updates.ok) {
                    const currentRepoHash =
                        updates.value.length > 0
                            ? updates.value[0].hash
                            : gitHash;
                    setRecentlyChecked(lastRepoCheck === currentRepoHash);
                }
            } catch (err) {
                // ignore errors (hopefully there are none lol)
                setRecentlyChecked(false);
            }
        };

        if (!repoPending && !repoErr) {
            checkRecentStatus();
        }
    }, [repoPending, repoErr]);

    const fetchChangelog = React.useCallback(async () => {
        if (repoPending || repoErr) return;

        setIsLoading(true);
        setError(null);

        try {
            // check if the repository was recently refreshed and that nothing has changed
            const updates = await VencordNative.updater.getUpdates();
            const lastRepoCheck = await getLastRepositoryCheckHash();
            const currentRepoHash =
                updates.ok && updates.value.length > 0
                    ? updates.value[0].hash
                    : gitHash;

            // If repository state hasn't changed since last check
            if (lastRepoCheck === currentRepoHash) {
                setIsLoading(false);
                setRecentlyChecked(true);
                const logged = await ensureLocalUpdateLogged();
                if (!logged) {
                    setChangelog([]);
                    Toasts.show({
                        message: t("المستودع محدَّث بالفعل", "Repository is already up to date"),
                        id: Toasts.genId(),
                        type: Toasts.Type.MESSAGE,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                }
                return;
            }

            if (updates.ok && updates.value) {
                if (updates.value.length > 0) {
                    setChangelog(updates.value);

                    const newPlgs = await getNewPlugins();
                    const updatedPlgs = await getUpdatedPlugins();
                    const newSettings = await getNewSettings();
                    setNewPlugins(newPlgs);
                    setUpdatedPlugins(updatedPlgs);

                    await saveUpdateSession(
                        updates.value,
                        newPlgs,
                        updatedPlgs,
                        newSettings,
                        true,
                    );
                    await loadChangelogHistory();
                    setRecentlyChecked(true);

                    Toasts.show({
                        message: t(
                            `تم جلب ${updates.value.length} ${updates.value.length === 1 ? "إيداع" : "إيداعات"} من المستودع`,
                            `Fetched ${updates.value.length} ${updates.value.length === 1 ? "commit" : "commits"} from repository`
                        ),
                        id: Toasts.genId(),
                        type: Toasts.Type.SUCCESS,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                } else {
                    const logged = await ensureLocalUpdateLogged();
                    setRecentlyChecked(true);
                    Toasts.show({
                        message: logged
                            ? t("تم تسجيل إيداعات آخر تحديث", "Last update commits logged")
                            : t("المستودع متزامن مع نسختك المحلية", "Repository is in sync with your local version"),
                        id: Toasts.genId(),
                        type: logged ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                    if (!logged) {
                        setChangelog([]);
                    }
                }
            } else if (!updates.ok) {
                throw new Error(
                    updates.error?.message || "Failed to fetch from repository",
                );
            }
        } catch (err: any) {
            UpdateLogger.error("Failed to fetch commits from repository", err);
            const errorMessage =
                err?.message ||
                t("فشل الاتصال بالمستودع. تحقق من اتصالك بالإنترنت.", "Failed to connect to repository. Check your internet connection.");
            setError(errorMessage);

            Toasts.show({
                message: t("تعذَّر جلب الإيداعات من المستودع", "Failed to fetch commits from repository"),
                id: Toasts.genId(),
                type: Toasts.Type.FAILURE,
                options: {
                    position: Toasts.Position.BOTTOM,
                },
            });
        } finally {
            setIsLoading(false);
        }
    }, [repoPending, repoErr, loadNewPlugins, loadChangelogHistory]);

    React.useEffect(() => {
        const loadInitialData = async () => {
            if (!repoPending && !repoErr) {
                await loadNewPlugins();
                loadRecentCommits(repo);
                const logged = await ensureLocalUpdateLogged();
                if (!logged) {
                    await fetchChangelog();
                } else {
                    setIsLoading(false);
                }
            } else if (!repoPending) {
                // perseverance
                await loadNewPlugins();
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [
        repoPending,
        repoErr,
        fetchChangelog,
        loadNewPlugins,
        loadRecentCommits,
        ensureLocalUpdateLogged,
    ]);

    const toggleLogExpanded = (logId: string) => {
        const newExpanded = new Set(expandedLogs);
        if (newExpanded.has(logId)) {
            newExpanded.delete(logId);
        } else {
            newExpanded.add(logId);
        }
        setExpandedLogs(newExpanded);
    };

    const hasCurrentChanges =
        changelog.length > 0 ||
        newPlugins.length > 0 ||
        updatedPlugins.length > 0;

    return (
        <>
            <EsharqCard
                index={0}
                title={t("جلب التغييرات", "Fetch changes")}
                subtitle={t(
                    "يقارن نسختك بأحدث ما في المستودع ويعرض ما استُجدّ من إيداعات وتحديثات إضافات.",
                    "Compares your version with the latest in the repository and shows the new commits and plugin updates."
                )}
                badge={recentlyChecked ? t("محدَّث", "Up to date") : undefined}
                badgeTone="ok"
            >
            <div className="vc-changelog-controls">
                <Button
                    size="small"
                    disabled={isLoading || repoPending || !!repoErr}
                    onClick={fetchChangelog}
                    variant={recentlyChecked ? "positive" : "primary"}
                >
                    {isLoading
                        ? t("جارٍ التحميل...", "Loading...")
                        : recentlyChecked
                            ? t("المستودع محدَّث", "Repository up to date")
                            : t("جلب من المستودع", "Fetch from Repository")}
                </Button>

                {changelogHistory.length > 0 && (
                    <>
                        <Button
                            size="small"
                            variant={showHistory ? "primary" : "secondary"}
                            onClick={() => setShowHistory(!showHistory)}
                            style={{ marginLeft: "8px" }}
                        >
                            {showHistory ? t("إخفاء السجلات", "Hide History") : t("عرض السجلات", "Show History")}
                        </Button>
                        <Button
                            size="small"
                            variant="dangerPrimary"
                            onClick={() => {
                                Alerts.show({
                                    title: t("مسح كل السجلات", "Clear All Logs"),
                                    body: t("هل أنت متأكد أنك تريد مسح كل السجلات؟ لا يمكن التراجع عن هذا الإجراء.", "Are you sure you want to clear all logs? This action cannot be undone."),
                                    confirmText: t("مسح الكل", "Clear All"),
                                    confirmColor: "danger",
                                    cancelText: t("إلغاء", "Cancel"),
                                    onConfirm: async () => {
                                        await clearChangelogHistory();
                                        await loadChangelogHistory();
                                        setShowHistory(false);
                                        Toasts.show({
                                            message: t("تم مسح كل السجلات", "All logs cleared"),
                                            id: Toasts.genId(),
                                            type: Toasts.Type.SUCCESS,
                                            options: {
                                                position: Toasts.Position.BOTTOM,
                                            },
                                        });
                                    },
                                });
                            }}
                            style={{ marginLeft: "8px" }}
                        >
                            {t("مسح كل السجلات", "Clear All Logs")}
                        </Button>
                    </>
                )}
            </div>

            {error && (
                <ErrorCard style={{ padding: "1em", marginTop: "1em" }}>
                    <Paragraph>{error}</Paragraph>
                    <Paragraph color="text-subtle" style={{ marginTop: "0.5em" }}>
                        {t("تأكد من اتصالك بالإنترنت وحاول مجدداً.", "Check your internet connection and try again.")}
                    </Paragraph>
                </ErrorCard>
            )}

            </EsharqCard>

            <EsharqCard
                index={1}
                title={t("المستودع", "Repository")}
                subtitle={t(
                    "المستودع الذي يجلب منه إشراق تحديثاته.",
                    "The repository Esharq fetches its updates from."
                )}
            >
            <Paragraph color="text-subtle">
                {repoPending ? (
                    repo
                ) : repoErr ? (
                    t("فشل الاسترداد — تحقق من وحدة التحكم", "Failed to retrieve — check the console")
                ) : (
                    <Link href={repo}>
                        {repo.split("/").slice(-2).join("/")}
                    </Link>
                )}
                {" "}(<HashLink repo={repo} hash={gitHash} disabled={repoPending} />)
            </Paragraph>

            </EsharqCard>

            {hasCurrentChanges && (
                <EsharqCard
                    index={2}
                    title={t("التغييرات الأخيرة", "Recent changes")}
                    subtitle={t(
                        "ما استُجدّ منذ إصدارك السابق: إيداعات، وإضافات جديدة، وأخرى تلقّت تحديثاً.",
                        "What is new since your previous version: commits, new plugins, and plugins that received an update."
                    )}
                >
                    {newPlugins.length > 0 && (
                        <div className={Margins.bottom16}>
                            <NewPluginsSection
                                newPlugins={newPlugins}
                                onPluginToggle={() => { }}
                            />
                        </div>
                    )}

                    {updatedPlugins.length > 0 && (
                        <div className={Margins.bottom16}>
                            <Heading className={Margins.bottom8}>
                                {t("الإضافات المحدَّثة", "Updated Plugins")} ({updatedPlugins.length})
                            </Heading>
                            <NewPluginsCompact newPlugins={updatedPlugins} />
                        </div>
                    )}

                    {changelog.length > 0 && (
                        <div>
                            <Heading className={Margins.bottom8}>
                                {t("تغييرات الكود", "Code Changes")} ({changelog.length} {changelog.length === 1 ? t("إيداع", "commit") : t("إيداعات", "commits")})
                            </Heading>
                            <div className="vc-changelog-commits-list">
                                {changelog.map(entry => (
                                    <ChangelogCard
                                        key={entry.hash}
                                        entry={entry}
                                        repo={repo}
                                        repoPending={repoPending}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </EsharqCard>
            )}

            {!hasCurrentChanges && !isLoading && !error && (
                <EsharqCard
                    index={2}
                    title={t("التغييرات الأخيرة", "Recent changes")}
                    subtitle={t(
                        "نسختك محدَّثة، وهذه آخر التغييرات في المستودع.",
                        "Your version is up to date; these are the latest changes in the repository."
                    )}
                >
                    {recentCommits.length > 0 && (
                        <div className="vc-changelog-commits-list">
                            {recentCommits.map(entry => (
                                <ChangelogCard
                                    key={entry.hash}
                                    entry={entry}
                                    repo={repo}
                                    repoPending={repoPending}
                                />
                            ))}
                        </div>
                    )}
                </EsharqCard>
            )}

            {showHistory && changelogHistory.length > 0 && (
                <>
                    <Divider className={Margins.top20} />

                    <Heading className={Margins.top20}>
                        {t("سجلات التحديث", "Update Logs")} ({changelogHistory.length} {changelogHistory.length === 1 ? t("سجل", "log") : t("سجلات", "logs")})
                    </Heading>
                    <Paragraph className={Margins.bottom16}>
                        {t("سجل جلسات التحديث السابقة مع تاريخ الإيداعات وتغييرات الإضافات. اضغط على سجل لتوسيعه والاطلاع على التفاصيل.", "History of previous update sessions with commit dates and plugin changes. Click a log to expand it and see the details.")}
                    </Paragraph>

                    <div className="vc-changelog-history-list">
                        {changelogHistory.map(log => (
                            <UpdateLogCard
                                key={log.id}
                                log={log}
                                repo={repo}
                                repoPending={repoPending}
                                isExpanded={expandedLogs.has(log.id)}
                                onToggleExpand={() => toggleLogExpanded(log.id)}
                                onClearLog={logId => {
                                    Alerts.show({
                                        title: t("مسح السجل", "Clear Log"),
                                        body: t("هل أنت متأكد أنك تريد مسح هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.", "Are you sure you want to clear this log? This action cannot be undone."),
                                        confirmText: t("مسح السجل", "Clear Log"),
                                        confirmColor: "danger",
                                        cancelText: t("إلغاء", "Cancel"),
                                        onConfirm: async () => {
                                            await clearIndividualLog(logId);
                                            await loadChangelogHistory();
                                            setExpandedLogs(
                                                new Set(
                                                    Array.from(expandedLogs).filter(id => id !== logId),
                                                ),
                                            );
                                            Toasts.show({
                                                message: t("تم مسح السجل", "Log cleared"),
                                                id: Toasts.genId(),
                                                type: Toasts.Type.SUCCESS,
                                                options: {
                                                    position: Toasts.Position.BOTTOM,
                                                },
                                            });
                                        },
                                    });
                                }}
                            />
                        ))}
                    </div>
                </>
            )}
        </>
    );
}

function ChangelogTab() {
    return (
        <SettingsTab>
            <ChangelogContent />
        </SettingsTab>
    );
}

export default wrapTab(ChangelogTab, "Changelog");
