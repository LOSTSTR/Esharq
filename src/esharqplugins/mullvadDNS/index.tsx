import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { React, showToast, Toasts } from "@webpack/common";
import type { DnsFamily, ResolveProtocol, ShieldResolveResult } from "./native";

// Native helpers are keyed by the plugin's name (see scripts/build/build.mjs),
// so this MUST match name: "SecureDNS" below, or DNS resolution silently no-ops.
const Native = VencordNative.pluginHelpers.SecureDNS as PluginNative<typeof import("./native")>;

enum ProfileDns {
    DNS = "dns",
    ADBLOCK = "adblock",
    BASE = "base",
    EXTENDED = "extended",
    FAMILY = "family",
    ALL = "all"
}

enum LogLevel {
    VERBOSE = "verbose",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}

enum ResolutionMode {
    AUTOMATIC = "automatic",
    DOH = "doh",
    PLAIN_DNS = "plain_dns"
}

const logger = new Logger("SecureDNS", "#a6da95");

const SIESTE_TIME = 2000;
const PAR_MIN = 60_000;
const DEF_CACHE_MIN = 15;
const DEF_TIMEOUT = 5000;

const DOMAINES_CIBLE = [
    "discord.com",
    "discordapp.com",
    "discordapp.net",
    "gateway.discord.gg",
    "media.discordapp.net",
    "cdn.discordapp.com",
    "status.discord.com",
    "ptb.discord.com",
    "canary.discord.com"
];

const INTERDIT_AUX_FLICS = [
    "/api/v9/oauth2",
    "/api/oauth2",
    "/oauth2/",
    "/api/v9/auth",
    "/api/v9/verify",
    "/api/v9/users/@me/settings-proto",
    "/api/v9/users/@me/applications-role-connection"
];

const TUNNELS: Record<ProfileDns, string> = {
    [ProfileDns.DNS]: "https://dns.mullvad.net/dns-query",
    [ProfileDns.ADBLOCK]: "https://adblock.dns.mullvad.net/dns-query",
    [ProfileDns.BASE]: "https://base.dns.mullvad.net/dns-query",
    [ProfileDns.EXTENDED]: "https://extended.dns.mullvad.net/dns-query",
    [ProfileDns.FAMILY]: "https://family.dns.mullvad.net/dns-query",
    [ProfileDns.ALL]: "https://all.dns.mullvad.net/dns-query"
};

const IPS_SERVEURS: Record<ProfileDns, Record<DnsFamily, string>> = {
    [ProfileDns.DNS]: { 4: "194.242.2.2", 6: "2a07:e340::2" },
    [ProfileDns.ADBLOCK]: { 4: "194.242.2.3", 6: "2a07:e340::3" },
    [ProfileDns.BASE]: { 4: "194.242.2.4", 6: "2a07:e340::4" },
    [ProfileDns.EXTENDED]: { 4: "194.242.2.5", 6: "2a07:e340::5" },
    [ProfileDns.FAMILY]: { 4: "194.242.2.6", 6: "2a07:e340::6" },
    [ProfileDns.ALL]: { 4: "194.242.2.9", 6: "2a07:e340::9" }
};

const SEUIL_LOG: Record<LogLevel, number> = {
    [LogLevel.VERBOSE]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3
};

interface DnsStats {
    totalRequests: number;
    successfulResolutions: number;
    failedResolutions: number;
    cacheHits: number;
    nativeCalls: number;
}

interface CacheItem {
    addresses: string[];
    expiresAt: number;
    family: DnsFamily;
    hostname: string;
    server: string;
}

interface CacheStats {
    cacheSize: number;
    cachedHostnames: string[];
    cacheEntries: Record<string, string[]>;
}

interface ShieldApi {
    name: string;
    version: string;
    isActive(): boolean;
    start(): Promise<void>;
    stop(): void;
    getDNSTable(): Promise<Record<string, string[]>>;
    getCurrentEndpoint(): string;
    getCacheStats(): CacheStats;
    getStatistics(): DnsStats;
    clearStatistics(): void;
    clearCache(): number;
}

declare global {
    interface Window {
        ShieldDNS?: ShieldApi;
    }
}

let cfgProfile = ProfileDns.BASE;
let cfgMode = ResolutionMode.AUTOMATIC;
let cfgIPv6 = false;
let cfgRewrite = false;
let cfgPreload = true;
let cfgCacheMin = DEF_CACHE_MIN;
let cfgTimeout = DEF_TIMEOUT;
let cfgLogging = true;
let cfgNotify = false;
let cfgAuto = true;
let cfgLogLevel = LogLevel.INFO;

let setTargetDom = new Set<string>();

const majCible = (raw: string) => {
    const list = raw.split("\n").map(l => l.trim().toLowerCase()).filter(Boolean).map(l => l.startsWith("*.") ? l.slice(2) : l);
    setTargetDom = new Set(list.length ? list : DOMAINES_CIBLE);
};

const settings = definePluginSettings({
    dnsProfile: {
        type: OptionType.SELECT,
        description: "Choose which secure DNS profile to use.",
        options: [
            { label: "DNS", value: ProfileDns.DNS },
            { label: t("حظر الإعلانات", "Adblock"), value: ProfileDns.ADBLOCK },
            { label: t("أساسي", "Base"), value: ProfileDns.BASE, default: true },
            { label: t("موسّع", "Extended"), value: ProfileDns.EXTENDED },
            { label: t("عائلي", "Family"), value: ProfileDns.FAMILY },
            { label: t("الكل", "All"), value: ProfileDns.ALL }
        ],
        onChange(v) { cfgProfile = v; }
    },
    resolverMode: {
        type: OptionType.SELECT,
        description: "Choose how secure DNS should resolve hostnames.",
        options: [
            { label: t("تلقائي", "Automatic"), value: ResolutionMode.AUTOMATIC, default: true },
            { label: t("DNS عبر HTTPS", "DNS over HTTPS"), value: ResolutionMode.DOH },
            { label: t("DNS عادي", "Plain DNS"), value: ResolutionMode.PLAIN_DNS }
        ],
        onChange(v) { cfgMode = v; }
    },
    trackedDomains: {
        type: OptionType.STRING,
        description: "Domains to resolve, one per line.",
        default: DOMAINES_CIBLE.join("\n"),
        multiline: true,
        onChange(v) { majCible(v); }
    },
    preferIPv6: {
        type: OptionType.BOOLEAN,
        description: "Prefer IPv6 answers when the resolver returns them.",
        default: false,
        onChange(v) { cfgIPv6 = v; }
    },
    rewriteFetch: {
        type: OptionType.BOOLEAN,
        description: "Rewrite fetch URLs to resolved IPs. This is experimental and can break HTTPS.",
        default: false,
        restartNeeded: true,
        onChange(v) { cfgRewrite = v; }
    },
    preloadOnStart: {
        type: OptionType.BOOLEAN,
        description: "Preload DNS answers for tracked domains on startup.",
        default: true,
        onChange(v) { cfgPreload = v; }
    },
    cacheMinutes: {
        type: OptionType.SLIDER,
        description: "How long DNS answers stay cached.",
        markers: [1, 5, 15, 30, 60],
        default: DEF_CACHE_MIN,
        stickToMarkers: true,
        onChange(v) { cfgCacheMin = v; }
    },
    requestTimeoutMs: {
        type: OptionType.SLIDER,
        description: "How long to wait before a DNS request times out.",
        markers: [1500, 3000, 5000, 10000],
        default: DEF_TIMEOUT,
        stickToMarkers: true,
        onChange(v) { cfgTimeout = v; }
    },
    enableLogging: {
        type: OptionType.BOOLEAN,
        description: "Enable detailed logging.",
        default: true,
        onChange(v) { cfgLogging = v; }
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show toast notifications for DNS status changes.",
        default: false,
        onChange(v) { cfgNotify = v; }
    },
    autoStart: {
        type: OptionType.BOOLEAN,
        description: "Start the resolver when the plugin loads.",
        default: true,
        onChange(v) { cfgAuto = v; }
    },
    logLevel: {
        type: OptionType.SELECT,
        description: "Choose the logging level.",
        options: [
            { label: t("مفصّل", "Verbose"), value: LogLevel.VERBOSE },
            { label: t("معلومات", "Info"), value: LogLevel.INFO, default: true },
            { label: t("تحذير", "Warning"), value: LogLevel.WARN },
            { label: t("خطأ", "Error"), value: LogLevel.ERROR }
        ],
        onChange(v) { cfgLogLevel = v; }
    }
});

const loadCachedSettings = () => {
    cfgProfile = settings.store.dnsProfile ?? ProfileDns.BASE;
    cfgMode = settings.store.resolverMode ?? ResolutionMode.AUTOMATIC;
    cfgIPv6 = settings.store.preferIPv6 ?? false;
    cfgRewrite = settings.store.rewriteFetch ?? false;
    cfgPreload = settings.store.preloadOnStart ?? true;
    cfgCacheMin = settings.store.cacheMinutes ?? DEF_CACHE_MIN;
    cfgTimeout = settings.store.requestTimeoutMs ?? DEF_TIMEOUT;
    cfgLogging = settings.store.enableLogging ?? true;
    cfgNotify = settings.store.showNotifications ?? false;
    cfgAuto = settings.store.autoStart ?? true;
    cfgLogLevel = settings.store.logLevel ?? LogLevel.INFO;
    majCible(settings.store.trackedDomains ?? "");
};

const devLog = (lvl: LogLevel, ...msg: unknown[]) => {
    if (cfgLogging && SEUIL_LOG[lvl] >= SEUIL_LOG[cfgLogLevel]) {
        if (lvl === LogLevel.VERBOSE) logger.debug(...msg);
        else if (lvl === LogLevel.INFO) logger.info(...msg);
        else if (lvl === LogLevel.WARN) logger.warn(...msg);
        else if (lvl === LogLevel.ERROR) logger.error(...msg);
    }
};

const pousseToast = (msg: string, type = Toasts.Type.MESSAGE) => {
    if (cfgNotify) showToast(`[SecureDNS] ${msg}`, type);
};

const estCible = (h: string) => {
    const norm = h.toLowerCase();
    if (setTargetDom.has(norm)) return true;
    for (const d of setTargetDom) {
        if (norm.endsWith("." + d)) return true;
    }
    return false;
};

const evadeFlics = (u: URL) => {
    const path = u.pathname;
    for (let i = 0; i < INTERDIT_AUX_FLICS.length; i++) {
        if (path.includes(INTERDIT_AUX_FLICS[i])) return true;
    }
    return false;
};

const getDnsUrl = () => TUNNELS[cfgProfile];
const getUdpServer = (fam = getLookupFamily()) => IPS_SERVEURS[cfgProfile][fam];
const getProto = (): ResolveProtocol => cfgMode;
const getLookupFamily = (): DnsFamily => cfgIPv6 ? 6 : 4;
const cacheDuration = () => cfgCacheMin * PAR_MIN;
const getCacheKey = (h: string) => `${cfgMode}:${getDnsUrl()}:${getLookupFamily()}:${h.toLowerCase()}`;

const formatNewURL = (u: URL, ip: string) => {
    const { port } = u;
    const host = ip.includes(":") ? `[${ip}]` : ip;
    return u.protocol + "//" + (port ? `${host}:${port}` : host) + u.pathname + u.search + u.hash;
};

const buildFetchInp = (inp: RequestInfo | URL, url: string): RequestInfo | URL => {
    if (!(inp instanceof Request)) return url;
    return new Request(url, {
        method: inp.method,
        headers: inp.headers,
        body: inp.body,
        mode: inp.mode,
        credentials: inp.credentials,
        cache: inp.cache,
        redirect: inp.redirect,
        referrer: inp.referrer,
        referrerPolicy: inp.referrerPolicy,
        integrity: inp.integrity,
        keepalive: inp.keepalive,
        signal: inp.signal
    });
};

function AboutWarning() {
    return (
        <div style={{
            border: "1px solid #f0b232", borderRadius: 8, padding: "12px 14px", marginBottom: 12,
            background: "rgba(240, 178, 50, 0.1)", color: "var(--text-normal, #dbdee1)", fontSize: 13, lineHeight: 1.6
        }}>
            ⚠️ {t(
                "تحذير: هذه الإضافة توجّه استعلامات DNS الخاصة بديسكورد عبر خوادم Mullvad (مزوّد خصوصية موثوق) وتستخدم وحدة native لتحليل DNS. خيار «Rewrite fetch URLs» تجريبيّ وقد يكسر HTTPS ويعطّل الاتصال — اتركه مُطفأً ما لم تفهم المخاطرة. لا يقرأ التوكن ولا يرسل بياناتك لأي طرف ثالث سوى استعلام DNS نفسه.",
                "Warning: this plugin routes Discord's DNS lookups through Mullvad's servers (a reputable privacy provider) and uses a native module to resolve DNS. The 'Rewrite fetch URLs' option is experimental and can break HTTPS and connectivity — leave it OFF unless you understand the risk. It never reads your token and sends no data to any third party beyond the DNS query itself."
            )}
        </div>
    );
}

export default definePlugin({
    name: "SecureDNS",
    description: "Resolve client application hosts through a secure DNS over HTTPS via Mullvad's public resolvers. ⚠️ Uses a native module; the experimental 'Rewrite fetch URLs' option can break HTTPS — keep it off unless you understand it.",
    tags: ["Privacy", "Utility"],
    authors: [{ name: ">Snayz",
     id: 1361345963175968779n }],
    settings,
    settingsAboutComponent: AboutWarning,

    start() {
        const TAG = "SecureDNS";
        const VER = "1.1.0";
        loadCachedSettings();
        const origFetch = window.fetch;
        let isPatched = false;
        let isAlive = false;
        let tInit: number | undefined;

        const laMalle = new Map<string, CacheItem>();
        const lesFiles = new Map<string, Promise<CacheItem | null>>();
        const lesStats: DnsStats = {
            totalRequests: 0,
            successfulResolutions: 0,
            failedResolutions: 0,
            cacheHits: 0,
            nativeCalls: 0
        };

        const metEnMalle = (key: string, res: ShieldResolveResult) => {
            laMalle.set(key, {
                addresses: res.addresses,
                expiresAt: Date.now() + cacheDuration(),
                family: res.family,
                hostname: res.hostname,
                server: res.endpoint
            });
        };

        const trouveIP = async (host: string): Promise<CacheItem | null> => {
            const key = getCacheKey(host);
            const cached = laMalle.get(key);
            if (cached && cached.expiresAt > Date.now()) {
                lesStats.cacheHits++;
                devLog(LogLevel.VERBOSE, `Cache hit for ${host}.`);
                return cached;
            }
            laMalle.delete(key);
            let p = lesFiles.get(key);
            if (!p) {
                p = (async () => {
                    try {
                        if (!Native) {
                            devLog(LogLevel.ERROR, "Native resolver missing.");
                            return null;
                        }
                        lesStats.nativeCalls++;
                        const res = await Native.resolveDNS(host, getDnsUrl(), getLookupFamily(), cfgTimeout, getProto(), getUdpServer());
                        if (res.success && res.addresses.length) {
                            metEnMalle(key, res);
                            devLog(LogLevel.INFO, `Resolved ${host} to ${res.addresses[0]} via secure DNS ${res.protocol}.`);
                            return laMalle.get(key) ?? null;
                        }
                        if (cfgIPv6) {
                            lesStats.nativeCalls++;
                            const fallback = await Native.resolveDNS(host, getDnsUrl(), 4, cfgTimeout, getProto(), getUdpServer(4));
                            if (fallback.success && fallback.addresses.length) {
                                metEnMalle(key, fallback);
                                devLog(LogLevel.INFO, `Resolved ${host} to ${fallback.addresses[0]} via secure DNS ${fallback.protocol}.`);
                                return laMalle.get(key) ?? null;
                            }
                            devLog(LogLevel.WARN, `DNS fail for ${host}: ${fallback.error ?? res.error ?? "No IPs returned."}`);
                            return null;
                        }
                        devLog(LogLevel.WARN, `DNS fail for ${host}: ${res.error ?? "No IPs returned."}`);
                        return null;
                    } catch (err) {
                        devLog(LogLevel.ERROR, `Resolution error: ${err}`);
                        return null;
                    } finally {
                        lesFiles.delete(key);
                    }
                })();
                lesFiles.set(key, p);
            }
            return p;
        };

        const remplirCache = async () => {
            const list = Array.from(setTargetDom);
            await Promise.all(list.map(d => trouveIP(d)));
            devLog(LogLevel.INFO, `Preloaded ${laMalle.size} DNS records.`);
        };

        const installerHook = () => {
            if (isPatched) return true;
            window.fetch = async (inp, init) => {
                try {
                    const urlStr = inp instanceof Request ? inp.url : String(inp);
                    
                    let hasTracked = false;
                    for (const d of setTargetDom) {
                        if (urlStr.includes(d)) {
                            hasTracked = true;
                            break;
                        }
                    }
                    if (!hasTracked) return origFetch.call(window, inp, init);

                    const u = new URL(urlStr);
                    lesStats.totalRequests++;
                    if (!estCible(u.hostname) || evadeFlics(u)) {
                        devLog(LogLevel.VERBOSE, `Skipped ${u.hostname}${u.pathname}`);
                        return origFetch.call(window, inp, init);
                    }
                    const ipRes = await trouveIP(u.hostname);
                    if (!ipRes) {
                        lesStats.failedResolutions++;
                        return origFetch.call(window, inp, init);
                    }
                    const ip = ipRes.addresses[0];
                    const newUrl = formatNewURL(u, ip);
                    const newInp = buildFetchInp(inp, newUrl);
                    lesStats.successfulResolutions++;
                    devLog(LogLevel.INFO, `Rewrote ${u.hostname} -> ${ip}`);
                    pousseToast(t(`تمّ حلّ  عبر DNS الآمن.`, `Resolved  via secure DNS.`), Toasts.Type.SUCCESS);
                    return origFetch.call(window, newInp, init);
                } catch (err) {
                    lesStats.failedResolutions++;
                    devLog(LogLevel.ERROR, `Fetch patch error: ${err}`);
                    return origFetch.call(window, inp, init);
                }
            };
            isPatched = true;
            devLog(LogLevel.INFO, "Fetch hook active.");
            return true;
        };

        const ShieldDNS: ShieldApi = {
            name: TAG,
            version: VER,
            isActive: () => isAlive,
            async start() {
                if (isAlive) {
                    devLog(LogLevel.WARN, "Already active.");
                    return;
                }
                if (!Native) {
                    devLog(LogLevel.ERROR, "Native missing.");
                    pousseToast(t("الوحدة الأصلية مفقودة.", "Native missing."), Toasts.Type.FAILURE);
                    return;
                }
                devLog(LogLevel.INFO, `Starting ${TAG} ${VER} using ${getDnsUrl()}.`);
                if (cfgPreload) await remplirCache();
                if (cfgRewrite) {
                    devLog(LogLevel.WARN, "Fetch rewrite experimental!");
                    if (!installerHook()) {
                        pousseToast(t("فشل ربط الطلبات.", "Fetch hook fail."), Toasts.Type.FAILURE);
                        return;
                    }
                } else {
                    devLog(LogLevel.INFO, "Fetch rewrite disabled.");
                }
                isAlive = true;
                pousseToast(t(` جاهز.`, ` ready.`), Toasts.Type.SUCCESS);
            },
            stop() {
                if (tInit != null) {
                    window.clearTimeout(tInit);
                    tInit = undefined;
                }
                if (!isAlive) {
                    devLog(LogLevel.WARN, "Not active.");
                    return;
                }
                if (isPatched) {
                    window.fetch = origFetch;
                    isPatched = false;
                    devLog(LogLevel.INFO, "Fetch restored.");
                }
                laMalle.clear();
                lesFiles.clear();
                isAlive = false;
                pousseToast(t(` متوقّف.`, ` stopped.`));
            },
            async getDNSTable() {
                const list = Array.from(setTargetDom);
                const results = await Promise.all(list.map(async d => {
                    const r = await trouveIP(d);
                    return [d, r?.addresses ?? []] as const;
                }));
                return Object.fromEntries(results);
            },
            getCurrentEndpoint: () => getDnsUrl(),
            getCacheStats: () => ({
                cacheSize: laMalle.size,
                cachedHostnames: Array.from(laMalle.values()).map(e => e.hostname),
                cacheEntries: Object.fromEntries(Array.from(laMalle.values()).map(e => [e.hostname, e.addresses]))
            }),
            getStatistics: () => ({ ...lesStats }),
            clearStatistics() {
                lesStats.totalRequests = 0;
                lesStats.successfulResolutions = 0;
                lesStats.failedResolutions = 0;
                lesStats.cacheHits = 0;
                lesStats.nativeCalls = 0;
            },
            clearCache() {
                const size = laMalle.size;
                laMalle.clear();
                lesFiles.clear();
                return size;
            }
        };

        if (cfgAuto) {
            tInit = window.setTimeout(() => { void ShieldDNS.start(); }, SIESTE_TIME);
        } else {
            devLog(LogLevel.INFO, "Auto start disabled.");
        }
        window.ShieldDNS = ShieldDNS;
        devLog(LogLevel.INFO, `${TAG} ${VER} loaded.`);
    },

    stop() {
        try {
            window.ShieldDNS?.stop();
            window.ShieldDNS = undefined;
            logger.info("Plugin unloaded.");
        } catch (err) {
            logger.error(`Shutdown error: ${err}`);
        }
    }
});
