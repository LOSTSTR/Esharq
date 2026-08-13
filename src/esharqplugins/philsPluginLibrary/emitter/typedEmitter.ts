/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Local, type-only replacement for the (removed) `typed-emitter` package.
 * It exposes the same generic `TypedEmitter<Events>` type this library relies
 * on, layered on Node's EventEmitter. There is no runtime code here — every
 * import of this module is erased by the bundler.
 */

import type EventEmitter from "events";

export type TypedEmitter<Events extends Record<string, (...args: any[]) => any>> = EventEmitter & {
    /** Phantom marker so `J extends TypedEmitter<infer N>` can recover the events map. */
    __events?: Events;
    on<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    once<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    off<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    addListener<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    removeListener<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): boolean;
};
