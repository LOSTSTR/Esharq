/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Esharq contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * عميل CDP أدنى — بلا أي تبعية.
 *
 * `WebSocket` و`fetch` أصليّان في Node 22+، وبروتوكول أدوات المطوّر ليس
 * أكثر من HTTP للاكتشاف وWebSocket للأوامر. فنستطيع قيادة ديسكورد من
 * الطرفية: تنفيذ جافاسكربت داخله وقراءة ما يعرفه فعلاً وقت التشغيل.
 *
 * 🔴 اختيار النافذة **يُفحَص لا يُخمَّن**: أوّل نافذة يفتحها ديسكورد قد
 * تكون نافذة المُحدِّث، وعنوانها يمرّ بأي مُرشِّح على `discord.com`.
 * المِحكّ الصادق: **هل في هذه الصفحة حزمة webpack؟**
 */

export class Session {
    #socket;
    #nextId = 1;
    #pending = new Map();

    static async attach(url) {
        const session = new Session();
        session.#socket = new WebSocket(url);

        await new Promise((resolve, reject) => {
            session.#socket.addEventListener("open", resolve, { once: true });
            session.#socket.addEventListener("error", reject, { once: true });
        });

        session.#socket.addEventListener("message", event => {
            const message = JSON.parse(event.data);
            const waiter = session.#pending.get(message.id);
            if (waiter === undefined) return;
            session.#pending.delete(message.id);
            message.error === undefined
                ? waiter.resolve(message.result)
                : waiter.reject(new Error(message.error.message));
        });

        return session;
    }

    send(method, params = {}) {
        const id = this.#nextId++;
        return new Promise((resolve, reject) => {
            this.#pending.set(id, { resolve, reject });
            this.#socket.send(JSON.stringify({ id, method, params }));
            setTimeout(() => {
                if (this.#pending.delete(id)) reject(new Error(`مهلة: ${method}`));
            }, 60_000);
        });
    }

    async evaluate(expression) {
        const result = await this.send("Runtime.evaluate", {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (result.exceptionDetails !== undefined) {
            throw new Error(result.exceptionDetails.exception?.description
                ?? result.exceptionDetails.text);
        }
        return result.result.value;
    }

    close() {
        this.#socket.close();
    }
}

/** يجد نافذة التطبيق — لا نافذة المُحدِّث — بفحص وجود webpack فيها. */
export async function attachToDiscord(port = 9222, attempts = 60) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            for (const candidate of list) {
                if (candidate.type !== "page" || !candidate.webSocketDebuggerUrl) continue;

                const session = await Session.attach(candidate.webSocketDebuggerUrl);
                try {
                    const ready = await session.evaluate(
                        "Array.isArray(globalThis.webpackChunkdiscord_app) && typeof globalThis.Vencord === 'object'");
                    if (ready === true) return session;
                } catch { /* هدف يُغلق أثناء الفحص */ }
                session.close();
            }
        } catch { /* الباب لم يفتح بعد */ }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return undefined;
}
