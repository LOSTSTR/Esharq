import { Resolver } from "dns";

export type DnsFamily = 4 | 6;
export type ResolveProtocol = "automatic" | "doh" | "plain_dns";

export interface ShieldResolveResult {
    success: boolean;
    hostname: string;
    endpoint: string;
    family: DnsFamily;
    addresses: string[];
    protocol: Exclude<ResolveProtocol, "automatic">;
    error?: string;
}

const TIMEOUT_DEF = 5000;
const DNS_HDR_LEN = 12;
const CLASS_IN = 1;
const TYPE_A = 1;
const TYPE_AAAA = 28;

const dnsResolvers = new Map<string, Resolver>();
const textEncoder = new TextEncoder();

const u16 = (b: Uint8Array, o: number) => {
    if (o + 2 > b.length) throw new Error("dns packet truncated");
    return (b[o] << 8) | b[o + 1];
};

const skip = (b: Uint8Array, o: number) => {
    let p = o;
    while (p < b.length) {
        const l = b[p];
        if ((l & 0xc0) === 0xc0) return p + 2;
        if (!l) return p + 1;
        p += l + 1;
    }
    throw new Error("dns invalid name");
};

const makeIPv6 = (b: Uint8Array, o: number) => {
    let s = "";
    for (let i = 0; i < 16; i += 2) {
        if (i > 0) s += ":";
        s += ((b[o + i] << 8) | b[o + i + 1]).toString(16);
    }
    return s;
};

const buildQuery = (host: string, fam: DnsFamily) => {
    const raw = new Uint8Array(host.length + 20);
    let p = 0;
    const write16 = (v: number) => {
        raw[p++] = (v >> 8) & 0xff;
        raw[p++] = v & 0xff;
    };
    write16(0);
    write16(0x0100);
    write16(1);
    write16(0);
    write16(0);
    write16(0);

    const parts = host.split(".");
    for (let i = 0; i < parts.length; i++) {
        const enc = textEncoder.encode(parts[i]);
        raw[p++] = enc.length;
        raw.set(enc, p);
        p += enc.length;
    }
    raw[p++] = 0;
    write16(fam === 6 ? TYPE_AAAA : TYPE_A);
    write16(CLASS_IN);
    return raw.subarray(0, p);
};

const parseResponse = (b: Uint8Array, fam: DnsFamily) => {
    if (b.length < DNS_HDR_LEN) throw new Error("dns packet too small");
    const rcode = u16(b, 2) & 0xf;
    if (rcode !== 0) throw new Error(`dns response error code ${rcode}`);
    const qCount = u16(b, 4);
    const aCount = u16(b, 6);
    const targetType = fam === 6 ? TYPE_AAAA : TYPE_A;
    const addrs: string[] = [];

    let p = DNS_HDR_LEN;
    for (let i = 0; i < qCount; i++) p = skip(b, p) + 4;
    for (let i = 0; i < aCount; i++) {
        p = skip(b, p);
        if (p + 10 > b.length) throw new Error("dns answer truncated");
        const type = u16(b, p);
        const cls = u16(b, p + 2);
        const dLen = u16(b, p + 8);
        const dOff = p + 10;
        if (dOff + dLen > b.length) throw new Error("dns invalid data length");
        if (cls === CLASS_IN && type === targetType) {
            if (fam === 4 && dLen === 4) {
                addrs.push(`${b[dOff]}.${b[dOff + 1]}.${b[dOff + 2]}.${b[dOff + 3]}`);
            } else if (fam === 6 && dLen === 16) {
                addrs.push(makeIPv6(b, dOff));
            }
        }
        p = dOff + dLen;
    }
    return addrs;
};

const getResolver = (srv: string) => {
    let r = dnsResolvers.get(srv);
    if (!r) {
        r = new Resolver();
        r.setServers([srv]);
        dnsResolvers.set(srv, r);
    }
    return r;
};

const withTimeout = <T>(p: Promise<T>, ms: number) => {
    let t: ReturnType<typeof setTimeout>;
    return Promise.race([
        p,
        new Promise<T>((_, reject) => t = setTimeout(() => reject(new Error("dns request timeout")), ms))
    ]).finally(() => clearTimeout(t));
};

const resolvePlainDns = (host: string, srv: string, fam: DnsFamily) => {
    const resolver = getResolver(srv);
    return new Promise<string[]>((res, rej) => {
        const cb = (err: Error | null, ips: string[]) => err ? rej(err) : res(ips);
        if (fam === 6) {
            resolver.resolve6(host, cb);
        } else {
            resolver.resolve4(host, cb);
        }
    });
};

const dohQuery = async (host: string, url: string, fam: DnsFamily, ms: number): Promise<ShieldResolveResult> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(url, {
            method: "POST",
            headers: {
                Accept: "application/dns-message",
                "Content-Type": "application/dns-message"
            },
            body: buildQuery(host, fam),
            signal: ctrl.signal
        });
        if (!r.ok) throw new Error(`dns http status ${r.status}`);
        const addrs = parseResponse(new Uint8Array(await r.arrayBuffer()), fam);
        return {
            success: addrs.length > 0,
            hostname: host,
            endpoint: url,
            family: fam,
            addresses: addrs,
            protocol: "doh",
            error: addrs.length > 0 ? undefined : "empty response"
        };
    } catch (e) {
        return {
            success: false,
            hostname: host,
            endpoint: url,
            family: fam,
            addresses: [],
            protocol: "doh",
            error: e instanceof Error ? e.message : String(e)
        };
    } finally {
        clearTimeout(t);
    }
};

const udpQuery = async (host: string, url: string, srv: string, fam: DnsFamily, ms: number): Promise<ShieldResolveResult> => {
    try {
        const addrs = await withTimeout(resolvePlainDns(host, srv, fam), ms);
        return {
            success: addrs.length > 0,
            hostname: host,
            endpoint: url,
            family: fam,
            addresses: addrs,
            protocol: "plain_dns",
            error: addrs.length > 0 ? undefined : "empty response"
        };
    } catch (e) {
        return {
            success: false,
            hostname: host,
            endpoint: url,
            family: fam,
            addresses: [],
            protocol: "plain_dns",
            error: e instanceof Error ? e.message : String(e)
        };
    }
};

export const resolveDNS = async (
    event: Electron.IpcMainInvokeEvent,
    host: string,
    url: string,
    fam: DnsFamily = 4,
    ms = TIMEOUT_DEF,
    proto: ResolveProtocol = "automatic",
    srv = ""
) => {
    if (proto === "plain_dns") return udpQuery(host, url, srv, fam, ms);
    const rDoh = await dohQuery(host, url, fam, ms);
    if (rDoh.success || proto === "doh" || !srv) return rDoh;
    const rPlain = await udpQuery(host, url, srv, fam, ms);
    if (rPlain.success) return rPlain;
    return {
        ...rPlain,
        error: `${rDoh.error ?? "doh failed"} fallback failed: ${rPlain.error ?? "empty response"}`
    };
};

export const preloadDNS = async (
    event: Electron.IpcMainInvokeEvent,
    hosts: string[],
    url: string,
    fam: DnsFamily = 4,
    ms = TIMEOUT_DEF,
    proto: ResolveProtocol = "automatic",
    srv = ""
) => {
    const res = await Promise.all(hosts.map(async h => {
        const r = await resolveDNS(event, h, url, fam, ms, proto, srv);
        return [h, r.addresses] as const;
    }));
    return Object.fromEntries(res.filter(([, addrs]) => addrs.length));
};
