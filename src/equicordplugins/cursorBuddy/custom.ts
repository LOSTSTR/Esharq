/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const CUSTOM_BUDDY_ID = "cursor-buddy-custom";

interface CustomBuddyOptions {
    image: string;
    size?: number;
    speed?: number;
    flip?: boolean;
}

/**
 * A cursor buddy that shows the user's OWN image (animated GIF or static) as a
 * whole element and moves it toward the cursor. Unlike oneko/fathorse this uses
 * no sprite sheet — an animated GIF plays natively while it follows, and a
 * static image simply slides. Works with ANY image the user uploads.
 */
export default function customBuddy(options: CustomBuddyOptions) {
    const { image, size = 64, speed = 10, flip = true } = options;
    if (!image) return;

    const el = document.createElement("div");
    el.id = CUSTOM_BUDDY_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.position = "fixed";
    el.style.pointerEvents = "none";
    el.style.backgroundImage = `url(${JSON.stringify(image)})`;
    el.style.backgroundSize = "contain";
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundPosition = "center";
    el.style.zIndex = "2147483647";
    el.style.willChange = "left, top, transform";

    let posX = window.innerWidth / 2;
    let posY = window.innerHeight / 2;
    let mouseX = posX;
    let mouseY = posY;

    el.style.left = `${posX - size / 2}px`;
    el.style.top = `${posY - size / 2}px`;

    const onMouseMove = (event: MouseEvent) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
    };
    document.addEventListener("mousemove", onMouseMove);
    document.body.appendChild(el);

    function frame() {
        // The plugin removes the element by id on unload/reload; when that
        // happens we detach the listener and stop the loop — no leak.
        if (!el.isConnected) {
            document.removeEventListener("mousemove", onMouseMove);
            return;
        }
        const dx = mouseX - posX;
        const dy = mouseY - posY;
        const dist = Math.hypot(dx, dy);
        if (dist > size / 2) {
            const step = Math.min(speed, dist);
            posX += (dx / dist) * step;
            posY += (dy / dist) * step;
            el.style.left = `${posX - size / 2}px`;
            el.style.top = `${posY - size / 2}px`;
            if (flip) el.style.transform = dx < 0 ? "scaleX(-1)" : "scaleX(1)";
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
