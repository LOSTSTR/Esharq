/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Esharq's @utils/modal exports the low-level modal building blocks (ModalRoot, ModalHeader, …)
// as the deprecated `never` type — they work at runtime but can't be composed type-safely. This
// thin shim re-types them as real components and re-exports openModal/closeModal + the modal prop
// types, so plugins can build custom modals cleanly through one import.

import { closeModal, ModalCloseButton as RawClose, ModalContent as RawContent, ModalFooter as RawFooter, ModalHeader as RawHeader, ModalRoot as RawRoot, openModal } from "@utils/modal";
import type { ComponentType, PropsWithChildren } from "react";

export type { ModalProps, RenderModalProps } from "@vencord/discord-types";
export { closeModal, openModal };

type ModalComponent = ComponentType<PropsWithChildren<Record<string, unknown>>>;

export const ModalRoot = RawRoot as ModalComponent;
export const ModalHeader = RawHeader as ModalComponent;
export const ModalContent = RawContent as ModalComponent;
export const ModalFooter = RawFooter as ModalComponent;
export const ModalCloseButton = RawClose as ModalComponent;
